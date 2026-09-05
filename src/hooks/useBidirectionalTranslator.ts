import {
  DEFAULT_EXPRESSION_MODE,
  DEFAULT_TRANSLATION_PRESET_ID,
  createExpressionDirection,
  detectExpressionMode,
  isTranslationPresetId,
  type ExpressionMode,
  type IntentDetectionResult,
  type TranslationPresetId,
  type TranslationRecord,
  type UsageSnapshot,
  type GrammarInsight,
} from '@entity-builders/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  STORAGE_KEYS,
  TRANSLATION_INPUT_MAX_CHARS,
} from '../constants';
import {
  buildTranslationInputLimitMessage,
  countTranslationInputCharacters,
  createTranslationRequestKey,
  fallbackDetection,
  getTranslatorReadiness,
  isConversationReplyMode,
  normalizeTranslatorText,
  translationAnalyticsProperties,
  type TranslationBlockedReason,
  type TranslationTrigger,
  type TranslatorStatus,
} from '../features/responder/translatorState';
import { runSpanishInputTranslationLifecycle } from '../features/responder/spanishInputTranslationLifecycle';
import { runTranslationRequestLifecycle } from '../features/responder/translationRequestLifecycle';
import { usePendingTranslationHistoryRefresh } from '../features/responder/usePendingTranslationHistoryRefresh';
import {
  analytics,
  commercialAnalyticsProperties,
} from '../services/analytics';
import {
  FlowtranslateApiError,
  generateLearningCourse,
} from '../services/flowtranslate-api';
import type { LearningCourseHistoryEntry } from '../services/learning-courses';

export type LearningCourseStatus = 'idle' | 'generating' | 'ready' | 'error';

type UseBidirectionalTranslatorParams = {
  accessToken: string;
  authPending?: boolean;
  online: boolean;
  onUsage: (usage: UsageSnapshot) => void;
  onSavedTranslation: (record: TranslationRecord) => void;
  onRefreshSavedTranslations?: () => Promise<TranslationRecord[]>;
  onLearningCourseSaved?: (course: LearningCourseHistoryEntry) => void;
};

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const PENDING_TRANSLATION_RESUME_TTL_MS = 24 * 60 * 60 * 1000;

const EXPRESSION_MODES = new Set<ExpressionMode>([
  'translate_to_english',
  'improve_english',
  'translate_to_spanish',
]);

type PendingTranslationResumeReason = 'pro_checkout' | 'cafecito_topup';

type PendingTranslationResume = {
  text: string;
  mode: ExpressionMode;
  presetId: TranslationPresetId;
  contextText: string;
  createdAt: number;
  reason: PendingTranslationResumeReason;
};

const isExpressionMode = (value: unknown): value is ExpressionMode =>
  typeof value === 'string' && EXPRESSION_MODES.has(value as ExpressionMode);

const readPendingTranslationResume = (): PendingTranslationResume | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pendingTranslationResume);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingTranslationResume>;
    const createdAt =
      typeof parsed.createdAt === 'number' ? parsed.createdAt : 0;
    if (
      !createdAt ||
      Date.now() - createdAt > PENDING_TRANSLATION_RESUME_TTL_MS
    ) {
      localStorage.removeItem(STORAGE_KEYS.pendingTranslationResume);
      return null;
    }

    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text || !isExpressionMode(parsed.mode)) return null;

    return {
      text,
      mode: parsed.mode,
      presetId: isTranslationPresetId(parsed.presetId)
        ? parsed.presetId
        : DEFAULT_TRANSLATION_PRESET_ID,
      contextText:
        typeof parsed.contextText === 'string' ? parsed.contextText : '',
      createdAt,
      reason:
        parsed.reason === 'cafecito_topup' ? 'cafecito_topup' : 'pro_checkout',
    };
  } catch {
    return null;
  }
};

const writePendingTranslationResume = (resume: PendingTranslationResume) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.pendingTranslationResume,
      JSON.stringify(resume),
    );
    return true;
  } catch {
    return false;
  }
};

const clearPendingTranslationResume = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.pendingTranslationResume);
  } catch {
    // A blocked storage cleanup should not affect the completed translation.
  }
};

export const useBidirectionalTranslator = ({
  accessToken,
  authPending = false,
  online,
  onUsage,
  onSavedTranslation,
  onRefreshSavedTranslations,
  onLearningCourseSaved,
}: UseBidirectionalTranslatorParams) => {
  const initialResumeRef = useRef<PendingTranslationResume | null>(
    readPendingTranslationResume(),
  );
  const initialResume = initialResumeRef.current;
  const initialText = initialResume?.text || '';
  const initialMode = initialResume?.mode || DEFAULT_EXPRESSION_MODE;
  const initialPresetId =
    initialResume?.presetId || DEFAULT_TRANSLATION_PRESET_ID;
  const initialContextText = initialResume?.contextText || '';

  const [inputText, setInputText] = useState(initialText);
  const [resultText, setResultText] = useState('');
  const [mode, setMode] = useState<ExpressionMode>(initialMode);
  const [modeDetection, setModeDetection] = useState<IntentDetectionResult>(
    fallbackDetection(initialMode),
  );
  const [learningCourseMarkdown, setLearningCourseMarkdown] = useState('');
  const [learningCourseStatus, setLearningCourseStatus] =
    useState<LearningCourseStatus>('idle');
  const [grammarInsight, setGrammarInsight] = useState<GrammarInsight | null>(null);
  const [translationRecordId, setTranslationRecordId] = useState('');
  const [presetId, setPresetId] = useState<TranslationPresetId>(initialPresetId);
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [message, setMessage] = useState('');
  const [workContextText, setWorkContextText] = useState(initialContextText);
  const [hasPendingChanges, setHasPendingChanges] = useState(
    Boolean(initialText),
  );
  const [resumeWakeUpCount, setResumeWakeUpCount] = useState(0);
  const sequenceRef = useRef(0);
  const lastCompletedKeyRef = useRef('');
  const inFlightKeyRef = useRef('');
  const inputTextRef = useRef(initialText);
  const workContextTextRef = useRef(initialContextText);
  const previousAccessTokenRef = useRef(accessToken);
  const lastBlockedAnalyticsKeyRef = useRef('');
  const translationRecordIdRef = useRef('');
  const translationRecordCreatedAtRef = useRef('');
  const modeRef = useRef<ExpressionMode>(initialMode);
  const lastModeRef = useRef<ExpressionMode>(initialMode);
  const presetIdRef = useRef<TranslationPresetId>(initialPresetId);
  const trackedComposerStartedRef = useRef(Boolean(initialText));
  const resumeAttemptedKeyRef = useRef('');
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const learningCourseRecordIdRef = useRef('');

  const clearScheduledTranslation = useCallback(() => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetLearningCourse = useCallback(() => {
    learningCourseRecordIdRef.current = '';
    setLearningCourseMarkdown('');
    setLearningCourseStatus('idle');
  }, []);

  useEffect(() => clearScheduledTranslation, [clearScheduledTranslation]);

  const updateMode = useCallback((nextMode: ExpressionMode) => {
    modeRef.current = nextMode;
    lastModeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const updateTranslationRecordId = useCallback((nextId: string, createdAt = '') => {
    translationRecordIdRef.current = nextId;
    translationRecordCreatedAtRef.current = createdAt;
    setTranslationRecordId(nextId);
  }, []);

  const rememberPendingTranslationResume = useCallback(
    (reason: PendingTranslationResumeReason = 'pro_checkout') => {
      const text = inputTextRef.current.trim();
      if (!text) return false;

      const resume: PendingTranslationResume = {
        text,
        mode: modeRef.current,
        presetId: presetIdRef.current,
        contextText: workContextTextRef.current,
        createdAt: Date.now(),
        reason,
      };
      const saved = writePendingTranslationResume(resume);
      if (saved) {
        initialResumeRef.current = resume;
        resumeAttemptedKeyRef.current = '';
      }
      analytics.track('translation_resume_saved', {
        ...translationAnalyticsProperties(
          resume.mode,
          resume.text,
          resume.presetId,
          reason === 'cafecito_topup' ? 'manual_generate' : 'checkout_resume',
          resume.contextText,
        ),
        reason,
        saved,
      });
      return saved;
    },
    [],
  );

  const getLatestTranslationSnapshot = useCallback(
    () => ({
      latestSequence: sequenceRef.current,
      latestMode: modeRef.current,
      latestSourceText: inputTextRef.current.trim(),
      latestPresetId: presetIdRef.current,
      latestContextText: workContextTextRef.current,
    }),
    [],
  );

  const resolvePendingSavedRecord = useCallback(
    (savedRecord: TranslationRecord) => {
      updateTranslationRecordId(savedRecord.id, savedRecord.createdAt);
      setMessage('Guardado en tu historial.');
    },
    [updateTranslationRecordId],
  );

  const { clearPendingHistoryRefresh, schedulePendingHistoryRefresh } =
    usePendingTranslationHistoryRefresh({
      getLatestSnapshot: getLatestTranslationSnapshot,
      onRefreshSavedTranslations,
      onResolveSavedRecord: resolvePendingSavedRecord,
      onSavedTranslation,
    });

  const trackTranslationBlocked = useCallback(
    (
      reason: TranslationBlockedReason,
      nextMode: ExpressionMode,
      nextSourceText: string,
      nextPresetId: TranslationPresetId,
      trigger: TranslationTrigger,
      contextText = '',
      properties: Record<string, unknown> = {},
    ) => {
      const trimmedSource = nextSourceText.trim();
      if (!trimmedSource) return;

      const analyticsKey = [
        reason,
        nextMode,
        nextPresetId,
        trigger,
        normalizeTranslatorText(contextText),
      ].join(':');
      if (lastBlockedAnalyticsKeyRef.current === analyticsKey) return;

      lastBlockedAnalyticsKeyRef.current = analyticsKey;
      analytics.track('translation_blocked', {
        ...translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          contextText,
        ),
        reason,
        ...properties,
      });
    },
    [],
  );

  const blockTranslationInputLimit = useCallback(
    (
      nextMode: ExpressionMode,
      trimmedSource: string,
      nextPresetId: TranslationPresetId,
      trigger: TranslationTrigger,
      nextContextText = '',
    ) => {
      const sourceCharacterCount = countTranslationInputCharacters(trimmedSource);
      const message = buildTranslationInputLimitMessage(sourceCharacterCount);

      trackTranslationBlocked(
        'input_too_long',
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
        {
          input_chars: sourceCharacterCount,
          max_chars: TRANSLATION_INPUT_MAX_CHARS,
        },
      );
      setResultText('');
      resetLearningCourse();
      setGrammarInsight(null);
      updateTranslationRecordId('');
      setStatus('error');
      setMessage(message);
      setHasPendingChanges(false);
      clearPendingHistoryRefresh();
    },
    [
      clearPendingHistoryRefresh,
      resetLearningCourse,
      trackTranslationBlocked,
      updateTranslationRecordId,
    ],
  );

  const runTranslation = useCallback(
    async (
      nextMode: ExpressionMode,
      nextSourceText: string,
      nextPresetId: TranslationPresetId = presetIdRef.current,
      trigger: TranslationTrigger = 'manual_generate',
      nextContextText = workContextTextRef.current,
    ) => {
      const trimmedSource = nextSourceText.trim();
      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
        setHasPendingChanges(false);
        lastBlockedAnalyticsKeyRef.current = '';
        return;
      }

      if (countTranslationInputCharacters(trimmedSource) > TRANSLATION_INPUT_MAX_CHARS) {
        blockTranslationInputLimit(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
        return;
      }

      if (!online) {
        trackTranslationBlocked(
          'offline',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
        setStatus('offline');
        setMessage('Estas offline. El texto queda visible, pero la IA necesita conexion.');
        return;
      }

      if (!accessToken) {
        if (authPending) {
          setStatus('typing');
          setMessage('Preparando modo invitado...');
          setHasPendingChanges(true);
          return;
        }

        trackTranslationBlocked(
          'auth',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
        setStatus('auth');
        setMessage('Conecta tu cuenta para guardar progreso y seguir.');
        return;
      }

      const requestKey = createTranslationRequestKey(
        nextMode,
        trimmedSource,
        nextPresetId,
        nextContextText,
      );

      if (requestKey === lastCompletedKeyRef.current) {
        analytics.track('translation_reused', {
          ...translationAnalyticsProperties(
            nextMode,
            trimmedSource,
            nextPresetId,
            trigger,
            nextContextText,
          ),
          reuse_source: 'client_current_result',
        });
        setStatus('idle');
        setMessage('Ya esta actualizado.');
        setHasPendingChanges(false);
        return;
      }

      if (requestKey === inFlightKeyRef.current) return;

      const requestSequence = sequenceRef.current + 1;
      const startedAt = currentTimeMs();
      sequenceRef.current = requestSequence;
      inFlightKeyRef.current = requestKey;
      lastBlockedAnalyticsKeyRef.current = '';
      clearPendingHistoryRefresh();
      setResultText('');
      resetLearningCourse();
      setGrammarInsight(null);
      setTranslationRecordId('');
      setStatus('translating');
      setMessage('Generando respuesta...');
      const submissionProperties = commercialAnalyticsProperties(
        translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        ),
      );
      analytics.track('translation_submitted', submissionProperties);
      if (isConversationReplyMode(nextMode)) {
        analytics.track('raw_idea_submitted', submissionProperties);
        analytics.track('conversation_reply_requested', submissionProperties);
      }

      try {
        const lifecycle = await runTranslationRequestLifecycle({
          accessToken,
          requestSequence,
          mode: nextMode,
          sourceText: trimmedSource,
          presetId: nextPresetId,
          contextText: nextContextText,
          startedAt,
          getLatestSnapshot: getLatestTranslationSnapshot,
        });

        if (lifecycle.kind === 'stale') return;

        if (lifecycle.kind === 'api_error') {
          if (lifecycle.error.usage) onUsage(lifecycle.error.usage);
          const errorProperties = {
            ...translationAnalyticsProperties(
              nextMode,
              trimmedSource,
              nextPresetId,
              trigger,
              nextContextText,
            ),
            latency_ms: lifecycle.latencyMs,
            error_status: lifecycle.error.status,
            remaining_quota:
              lifecycle.error.usage?.remainingThisMonth ?? null,
          };

          if (lifecycle.error.status === 402) {
            analytics.track('translation_blocked', {
              ...errorProperties,
              reason: 'quota',
            });
          } else if (lifecycle.error.status === 401) {
            analytics.track('translation_blocked', {
              ...errorProperties,
              reason: 'auth',
            });
          } else {
            analytics.captureError(lifecycle.error, {
              screen: 'translate',
              action: 'generate_translation',
              mode: nextMode,
              trigger,
              http_status: lifecycle.error.status,
            });
            analytics.track('translation_failed', {
              ...errorProperties,
              error_type: 'api_error',
            });
          }
          setStatus(lifecycle.status);
          setMessage(lifecycle.message);
          return;
        }

        if (lifecycle.kind === 'exception') {
          analytics.captureError(lifecycle.error, {
            screen: 'translate',
            action: 'generate_translation',
            mode: nextMode,
            trigger,
          });
          analytics.track('translation_failed', {
            ...translationAnalyticsProperties(
              nextMode,
              trimmedSource,
              nextPresetId,
              trigger,
              nextContextText,
            ),
            latency_ms: lifecycle.latencyMs,
            error_type: 'exception',
          });
          setStatus('error');
          setMessage(lifecycle.message);
          return;
        }

        const {
          result,
          responseMode,
          responseDirection,
          savedBreakdown,
          isSavedRecord,
          nextRecordId,
          latencyMs,
        } = lifecycle;

        updateMode(responseMode);
        updateTranslationRecordId(
          nextRecordId,
          isSavedRecord ? result.translationRecord.createdAt : '',
        );
        setResultText(result.text);
        if (result.grammarInsight) {
          setGrammarInsight(result.grammarInsight);
        } else {
          setGrammarInsight(null);
        }
        lastCompletedKeyRef.current = requestKey;
        setStatus('idle');
        setMessage(
          result.translationRecord.pending
            ? 'Respuesta lista. Guardando en tu historial...'
            : result.usage.charged
            ? 'Guardado en tu historial.'
            : 'Reusamos una respuesta guardada.',
        );
        setHasPendingChanges(false);
        const pendingResume = initialResumeRef.current;
        if (
          pendingResume &&
          createTranslationRequestKey(
            pendingResume.mode,
            pendingResume.text,
            pendingResume.presetId,
            pendingResume.contextText,
          ) === requestKey
        ) {
          clearPendingTranslationResume();
          initialResumeRef.current = null;
        }
        onUsage(result.usage);
        if (isSavedRecord) {
          onSavedTranslation({
            id: result.translationRecord.id,
            sourceLanguage:
              result.translationRecord.sourceLanguage ||
              responseDirection.sourceLanguage,
            targetLanguage:
              result.translationRecord.targetLanguage ||
              responseDirection.targetLanguage,
            sourceText: trimmedSource,
            translatedText: result.text,
            mode: responseMode,
            breakdown: savedBreakdown,
            createdAt: result.translationRecord.createdAt,
          });
        } else if (result.translationRecord.pending) {
          schedulePendingHistoryRefresh({
            requestSequence,
            mode: responseMode,
            sourceText: trimmedSource,
            translatedText: result.text,
            presetId: nextPresetId,
            contextText: nextContextText,
            trigger,
          });
        }
        const successProperties = commercialAnalyticsProperties({
          ...translationAnalyticsProperties(
            responseMode,
            trimmedSource,
            nextPresetId,
            trigger,
            nextContextText,
          ),
          output_chars: result.text.trim().length,
          latency_ms: latencyMs,
          charged: result.usage.charged,
          reused: !result.usage.charged,
          save_pending: Boolean(result.translationRecord.pending),
          estimated_tokens: result.usage.estimatedTokens,
          used_this_month: result.usage.usedThisMonth,
          remaining_quota: result.usage.remainingThisMonth,
        });
        analytics.track('translation_succeeded', successProperties);
        if (isConversationReplyMode(responseMode)) {
          analytics.track('professional_reply_generated', successProperties);
          analytics.track('conversation_reply_generated', successProperties);
        }
      } finally {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = '';
      }
    },
    [
      accessToken,
      authPending,
      blockTranslationInputLimit,
      online,
      onSavedTranslation,
      onUsage,
      clearPendingHistoryRefresh,
      getLatestTranslationSnapshot,
      resetLearningCourse,
      schedulePendingHistoryRefresh,
      trackTranslationBlocked,
      updateMode,
      updateTranslationRecordId,
    ],
  );

  useEffect(() => {
    const pendingResume = initialResumeRef.current;
    if (!pendingResume || !online || authPending || !accessToken) return;

    const currentText = inputTextRef.current.trim();
    if (
      currentText &&
      normalizeTranslatorText(currentText) !==
        normalizeTranslatorText(pendingResume.text)
    ) {
      return;
    }

    const resumeKey = [
      pendingResume.createdAt,
      pendingResume.mode,
      pendingResume.presetId,
      normalizeTranslatorText(pendingResume.text),
      normalizeTranslatorText(pendingResume.contextText),
      accessToken,
      resumeWakeUpCount,
    ].join(':');
    if (resumeAttemptedKeyRef.current === resumeKey) return;

    resumeAttemptedKeyRef.current = resumeKey;
    inputTextRef.current = pendingResume.text;
    workContextTextRef.current = pendingResume.contextText;
    presetIdRef.current = pendingResume.presetId;
    updateMode(pendingResume.mode);
    setInputText(pendingResume.text);
    setWorkContextText(pendingResume.contextText);
    setPresetId(pendingResume.presetId);
    setModeDetection(fallbackDetection(pendingResume.mode));
    setHasPendingChanges(true);
    setStatus('typing');
    setMessage('Retomando la respuesta pendiente...');
    analytics.track('translation_resume_started', {
      ...translationAnalyticsProperties(
        pendingResume.mode,
        pendingResume.text,
        pendingResume.presetId,
        'checkout_resume',
        pendingResume.contextText,
      ),
      reason: pendingResume.reason,
    });
    void runTranslation(
      pendingResume.mode,
      pendingResume.text,
      pendingResume.presetId,
      'checkout_resume',
      pendingResume.contextText,
    );
  }, [
    accessToken,
    authPending,
    online,
    resumeWakeUpCount,
    runTranslation,
    updateMode,
  ]);

  useEffect(() => {
    const wakePendingResume = () => {
      if (!initialResumeRef.current) return;
      resumeAttemptedKeyRef.current = '';
      setResumeWakeUpCount((current) => current + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') wakePendingResume();
    };

    window.addEventListener('focus', wakePendingResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', wakePendingResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const scheduleTranslation = useCallback(
    (
      nextSourceText: string,
      nextMode: ExpressionMode,
      nextPresetId: TranslationPresetId,
      trigger: TranslationTrigger,
      nextContextText = workContextTextRef.current,
    ) => {
      clearScheduledTranslation();
      const trimmedSource = nextSourceText.trim();

      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
        setHasPendingChanges(false);
        setGrammarInsight(null);
        setResultText('');
        resetLearningCourse();
        updateTranslationRecordId('');
        lastBlockedAnalyticsKeyRef.current = '';
        return;
      }

      setHasPendingChanges(true);

      if (countTranslationInputCharacters(trimmedSource) > TRANSLATION_INPUT_MAX_CHARS) {
        blockTranslationInputLimit(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
        return;
      }

      if (!online) {
        trackTranslationBlocked(
          'offline',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
        setStatus('offline');
        setMessage('Estas offline. El texto queda visible, pero la IA necesita conexion.');
        return;
      }

      if (!accessToken) {
        if (authPending) {
          setStatus('typing');
          setMessage('Preparando modo invitado...');
          return;
        }

        trackTranslationBlocked(
          'auth',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
        setStatus('auth');
        setMessage('Conecta tu cuenta para guardar progreso y seguir.');
        return;
      }

      const requestKey = createTranslationRequestKey(
        nextMode,
        trimmedSource,
        nextPresetId,
        nextContextText,
      );

      if (requestKey === lastCompletedKeyRef.current) {
        setStatus('idle');
        setMessage('Ya esta actualizado.');
        setHasPendingChanges(false);
        return;
      }

      if (trigger === 'auto_idle') {
        setStatus('typing');
        setMessage('Presiona Generar para traducir.');
        return;
      }

      setStatus('typing');
      setMessage('Generando...');
      void runTranslation(
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
      );
    },
    [
      accessToken,
      authPending,
      blockTranslationInputLimit,
      clearScheduledTranslation,
      online,
      resetLearningCourse,
      runTranslation,
      trackTranslationBlocked,
      updateTranslationRecordId,
    ],
  );

  const editInput = useCallback(
    (value: string) => {
      sequenceRef.current += 1;
      inputTextRef.current = value;
      setInputText(value);

      const nextDetection = detectExpressionMode(value, lastModeRef.current);
      const nextMode = nextDetection.automatic
        ? nextDetection.mode
        : modeRef.current;

      if (nextDetection.automatic) updateMode(nextMode);
      setModeDetection({ ...nextDetection, mode: nextMode });
      const inputChars = countTranslationInputCharacters(value);
      if (!value.trim()) {
        trackedComposerStartedRef.current = false;
      } else if (!trackedComposerStartedRef.current) {
        trackedComposerStartedRef.current = true;
        analytics.track(
          'composer_started',
          commercialAnalyticsProperties({
            mode: nextMode,
            preset_id: presetIdRef.current,
            input_chars: inputChars,
          }),
        );
      }
      scheduleTranslation(
        value,
        nextMode,
        presetIdRef.current,
        'auto_idle',
        workContextTextRef.current,
      );
    },
    [scheduleTranslation, updateMode],
  );

  const selectMode = useCallback(
    (nextMode: ExpressionMode) => {
      sequenceRef.current += 1;
      updateMode(nextMode);
      const nextDetection = fallbackDetection(nextMode);
      setModeDetection(nextDetection);
      scheduleTranslation(
        inputTextRef.current,
        nextMode,
        presetIdRef.current,
        'mode_selected',
        workContextTextRef.current,
      );
    },
    [scheduleTranslation, updateMode],
  );

  const selectPreset = useCallback(
    (nextPresetId: TranslationPresetId) => {
      if (nextPresetId === presetIdRef.current) return;

      sequenceRef.current += 1;
      presetIdRef.current = nextPresetId;
      setPresetId(nextPresetId);
      clearScheduledTranslation();
      void runTranslation(
        modeRef.current,
        inputTextRef.current,
        nextPresetId,
        'preset_selected',
        workContextTextRef.current,
      );
    },
    [clearScheduledTranslation, runTranslation],
  );

  useEffect(() => {
    const hadAccessToken = Boolean(previousAccessTokenRef.current);
    previousAccessTokenRef.current = accessToken;

    if (
      hadAccessToken ||
      !accessToken ||
      !hasPendingChanges ||
      !inputTextRef.current.trim() ||
      initialResumeRef.current
    ) {
      return;
    }

    scheduleTranslation(
      inputTextRef.current,
      modeRef.current,
      presetIdRef.current,
      'auto_idle',
      workContextTextRef.current,
    );
  }, [accessToken, hasPendingChanges, scheduleTranslation]);

  const editWorkContext = useCallback(
    (value: string) => {
      sequenceRef.current += 1;
      workContextTextRef.current = value;
      setWorkContextText(value);

      if (!inputTextRef.current.trim()) return;

      setHasPendingChanges(true);
      if (resultText.trim()) {
        setStatus('typing');
        setMessage('Contexto listo para aplicar.');
      }
    },
    [resultText],
  );

  const applyWorkContext = useCallback(() => {
    clearScheduledTranslation();
    analytics.track('translation_context_applied', {
      mode: modeRef.current,
      preset_id: presetIdRef.current,
      input_chars: inputTextRef.current.trim().length,
      has_context: Boolean(workContextTextRef.current.trim()),
      context_chars: workContextTextRef.current.trim().length,
    });
    return runTranslation(
      modeRef.current,
      inputTextRef.current,
      presetIdRef.current,
      'context_applied',
      workContextTextRef.current,
    );
  }, [clearScheduledTranslation, runTranslation]);

  const translate = useCallback(
    (nextMode: ExpressionMode = modeRef.current) => {
      clearScheduledTranslation();
      if (nextMode !== modeRef.current) {
        sequenceRef.current += 1;
        updateMode(nextMode);
        setModeDetection(fallbackDetection(nextMode));
      }
      return runTranslation(
        nextMode,
        inputTextRef.current,
        presetIdRef.current,
        'manual_generate',
        workContextTextRef.current,
      );
    },
    [clearScheduledTranslation, runTranslation, updateMode],
  );

  const translateInputToSpanish = useCallback(async () => {
    const nextMode: ExpressionMode = 'translate_to_spanish';
    const trimmedSource = inputTextRef.current.trim();
    const nextPresetId = presetIdRef.current;
    const nextContextText = workContextTextRef.current;
    const trigger: TranslationTrigger = 'input_to_spanish';

    clearScheduledTranslation();

    if (!trimmedSource) {
      setStatus('idle');
      setMessage('');
      setHasPendingChanges(false);
      return;
    }

    if (countTranslationInputCharacters(trimmedSource) > TRANSLATION_INPUT_MAX_CHARS) {
      blockTranslationInputLimit(
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
      );
      return;
    }

    if (!online) {
      trackTranslationBlocked(
        'offline',
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
      );
      setStatus('offline');
      setMessage('Estas offline. El texto queda visible, pero la IA necesita conexion.');
      return;
    }

    if (!accessToken) {
      if (authPending) {
        setStatus('typing');
        setMessage('Preparando modo invitado...');
        setHasPendingChanges(true);
        return;
      }

      trackTranslationBlocked(
        'auth',
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
      );
      setStatus('auth');
      setMessage('Conecta tu cuenta para guardar progreso y seguir.');
      return;
    }

    const requestSequence = sequenceRef.current + 1;
    const startedAt = currentTimeMs();
    sequenceRef.current = requestSequence;
    lastBlockedAnalyticsKeyRef.current = '';
    clearPendingHistoryRefresh();
    setResultText('');
    resetLearningCourse();
    setGrammarInsight(null);
    updateTranslationRecordId('');
    setStatus('translating');
    setMessage('Pasando a espanol...');
    setHasPendingChanges(true);
    analytics.track('translation_submitted', {
      ...translationAnalyticsProperties(
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
      ),
    });

    const lifecycle = await runSpanishInputTranslationLifecycle({
      accessToken,
      requestSequence,
      sourceText: trimmedSource,
      presetId: nextPresetId,
      contextText: nextContextText,
      startedAt,
      getLatestSnapshot: () => ({
        latestSequence: sequenceRef.current,
        latestSourceText: inputTextRef.current,
        latestPresetId: presetIdRef.current,
        latestContextText: workContextTextRef.current,
      }),
    });

    if (lifecycle.kind === 'stale') return;

    if (lifecycle.kind === 'empty_translation') {
      setStatus('error');
      setMessage('No pudimos pasar el texto a espanol.');
      return;
    }

    if (lifecycle.kind === 'api_error') {
      if (lifecycle.error.usage) onUsage(lifecycle.error.usage);
      const errorProperties = {
        ...translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        ),
        latency_ms: lifecycle.latencyMs,
        error_status: lifecycle.error.status,
        remaining_quota: lifecycle.error.usage?.remainingThisMonth ?? null,
      };

      if (lifecycle.error.status === 402) {
        analytics.track('translation_blocked', {
          ...errorProperties,
          reason: 'quota',
        });
      } else if (lifecycle.error.status === 401) {
        analytics.track('translation_blocked', {
          ...errorProperties,
          reason: 'auth',
        });
      } else {
        analytics.captureError(lifecycle.error, {
          screen: 'translate',
          action: 'translate_input_to_spanish',
          mode: nextMode,
          trigger,
          http_status: lifecycle.error.status,
        });
        analytics.track('translation_failed', {
          ...errorProperties,
          error_type: 'api_error',
        });
      }
      setStatus(lifecycle.status);
      setMessage(lifecycle.message);
      return;
    }

    if (lifecycle.kind === 'exception') {
      analytics.captureError(lifecycle.error, {
        screen: 'translate',
        action: 'translate_input_to_spanish',
        mode: nextMode,
        trigger,
      });
      analytics.track('translation_failed', {
        ...translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        ),
        latency_ms: lifecycle.latencyMs,
        error_type: 'exception',
      });
      setStatus('error');
      setMessage(lifecycle.message);
      return;
    }

    const {
      result,
      translatedInput,
      savedBreakdown,
      responseDirection,
      isSavedRecord,
      latencyMs,
    } = lifecycle;

    inputTextRef.current = translatedInput;
    setInputText(translatedInput);
    updateMode('translate_to_english');
    setModeDetection({
      mode: 'translate_to_english',
      confidence: 'high',
      reason: 'manual',
      automatic: false,
    });
    setResultText('');
    resetLearningCourse();
    setGrammarInsight(null);
    updateTranslationRecordId('');
    setStatus('typing');
    setMessage('Texto pasado a espanol. Editalo o toca Responder.');
    setHasPendingChanges(true);
    onUsage(result.usage);

    if (isSavedRecord) {
      onSavedTranslation({
        id: result.translationRecord.id,
        sourceLanguage:
          result.translationRecord.sourceLanguage ||
          responseDirection.sourceLanguage,
        targetLanguage:
          result.translationRecord.targetLanguage ||
          responseDirection.targetLanguage,
        sourceText: trimmedSource,
        translatedText: translatedInput,
        mode: nextMode,
        breakdown: savedBreakdown,
        createdAt: result.translationRecord.createdAt,
      });
    }

    analytics.track('translation_succeeded', {
      ...translationAnalyticsProperties(
        nextMode,
        trimmedSource,
        nextPresetId,
        trigger,
        nextContextText,
      ),
      output_chars: translatedInput.length,
      latency_ms: latencyMs,
      charged: result.usage.charged,
      reused: !result.usage.charged,
      save_pending: Boolean(result.translationRecord.pending),
      estimated_tokens: result.usage.estimatedTokens,
      used_this_month: result.usage.usedThisMonth,
      remaining_quota: result.usage.remainingThisMonth,
    });
  }, [
    accessToken,
    authPending,
    blockTranslationInputLimit,
    clearPendingHistoryRefresh,
    clearScheduledTranslation,
    online,
    onSavedTranslation,
    onUsage,
    resetLearningCourse,
    trackTranslationBlocked,
    updateMode,
    updateTranslationRecordId,
  ]);

  const requestLearningCourse = useCallback(async () => {
    const recordId = translationRecordIdRef.current;
    if (!recordId || !accessToken) return;
    if (learningCourseStatus === 'generating') return;
    if (
      learningCourseRecordIdRef.current === recordId &&
      learningCourseStatus === 'ready'
    ) {
      return;
    }

    setLearningCourseStatus('generating');

    try {
      const response = await generateLearningCourse(
        { translationRecordId: recordId },
        accessToken,
      );
      if (translationRecordIdRef.current !== recordId) return;

      learningCourseRecordIdRef.current = recordId;
      setLearningCourseMarkdown(response.markdown);
      setLearningCourseStatus('ready');
      onUsage(response.usage);
      onLearningCourseSaved?.({
        translationRecordId: recordId,
        markdown: response.markdown,
        createdAt: response.generatedAt || new Date().toISOString(),
      });
    } catch (error) {
      if (translationRecordIdRef.current !== recordId) return;

      if (error instanceof FlowtranslateApiError && error.usage) {
        onUsage(error.usage);
      }
      setLearningCourseStatus('error');
      analytics.captureError(error, {
        screen: 'translate',
        action: 'generate_learning_course',
        http_status:
          error instanceof FlowtranslateApiError ? error.status : null,
      });
    }
  }, [accessToken, learningCourseStatus, onLearningCourseSaved, onUsage]);

  const { canTranslate, translateDisabledReason } = getTranslatorReadiness({
    sourceText: inputText,
    online,
    accessToken,
    authPending,
    status,
  });

  const direction = createExpressionDirection(mode);

  return {
    inputText,
    resultText,
    mode,
    modeDetection,
    sourceLanguage: direction.sourceLanguage,
    targetLanguage: direction.targetLanguage,
    presetId,
    workContextText,
    learningCourseMarkdown,
    learningCourseStatus,
    grammarInsight,
    translationRecordId,
    status,
    message,
    hasPendingChanges,
    canTranslate,
    translateDisabledReason,
    translate,
    translateInputToSpanish,
    applyWorkContext,
    rememberPendingTranslationResume,
    requestLearningCourse,
    selectPreset,
    selectMode,
    editInput,
    editWorkContext,
    setStatus,
    setMessage,
  };
};
