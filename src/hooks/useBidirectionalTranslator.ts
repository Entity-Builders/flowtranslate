import {
  DEFAULT_EXPRESSION_MODE,
  DEFAULT_TRANSLATION_PRESET_ID,
  createExpressionDirection,
  detectExpressionMode,
  type ExpressionBreakdown,
  type ExpressionMode,
  type IntentDetectionResult,
  type TranslationPresetId,
  type TranslationRecord,
  type UsageSnapshot,
  type GrammarInsight,
} from '@eb-packages/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TRANSLATION_IDLE_DELAY_MS,
  TRANSLATION_INPUT_MAX_CHARS,
} from '../constants';
import { runBreakdownEnrichmentLifecycle } from '../features/responder/breakdownEnrichmentLifecycle';
import {
  buildTranslationInputLimitMessage,
  countTranslationInputCharacters,
  createTranslationRequestKey,
  fallbackDetection,
  getTranslatorReadiness,
  isConversationReplyMode,
  isEnrichedBreakdown,
  normalizeTranslatorText,
  translationAnalyticsProperties,
  type BreakdownStatus,
  type BreakdownTrigger,
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
import { FlowtranslateApiError } from '../services/flowtranslate-api';

type UseBidirectionalTranslatorParams = {
  accessToken: string;
  authPending?: boolean;
  online: boolean;
  onUsage: (usage: UsageSnapshot) => void;
  onSavedTranslation: (record: TranslationRecord) => void;
  onRefreshSavedTranslations?: () => Promise<TranslationRecord[]>;
};

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

export const useBidirectionalTranslator = ({
  accessToken,
  authPending = false,
  online,
  onUsage,
  onSavedTranslation,
  onRefreshSavedTranslations,
}: UseBidirectionalTranslatorParams) => {
  const [inputText, setInputText] = useState('');
  const [resultText, setResultText] = useState('');
  const [mode, setMode] = useState<ExpressionMode>(DEFAULT_EXPRESSION_MODE);
  const [modeDetection, setModeDetection] = useState<IntentDetectionResult>(
    fallbackDetection(DEFAULT_EXPRESSION_MODE),
  );
  const [breakdown, setBreakdown] = useState<ExpressionBreakdown | null>(null);
  const [breakdownStatus, setBreakdownStatus] =
    useState<BreakdownStatus>('idle');
  const [grammarInsight, setGrammarInsight] = useState<GrammarInsight | null>(null);
  const [translationRecordId, setTranslationRecordId] = useState('');
  const [presetId, setPresetId] = useState<TranslationPresetId>(
    DEFAULT_TRANSLATION_PRESET_ID,
  );
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [message, setMessage] = useState('');
  const [workContextText, setWorkContextText] = useState('');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const sequenceRef = useRef(0);
  const lastCompletedKeyRef = useRef('');
  const inFlightKeyRef = useRef('');
  const inputTextRef = useRef('');
  const workContextTextRef = useRef('');
  const previousAccessTokenRef = useRef(accessToken);
  const lastBlockedAnalyticsKeyRef = useRef('');
  const translationRecordIdRef = useRef('');
  const translationRecordCreatedAtRef = useRef('');
  const modeRef = useRef<ExpressionMode>(DEFAULT_EXPRESSION_MODE);
  const lastModeRef = useRef<ExpressionMode>(DEFAULT_EXPRESSION_MODE);
  const presetIdRef = useRef<TranslationPresetId>(
    DEFAULT_TRANSLATION_PRESET_ID,
  );
  const trackedComposerStartedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearScheduledTranslation = useCallback(() => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
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
      setBreakdown(null);
      setBreakdownStatus('idle');
      setGrammarInsight(null);
      updateTranslationRecordId('');
      setStatus('error');
      setMessage(message);
      setHasPendingChanges(false);
      clearPendingHistoryRefresh();
    },
    [
      clearPendingHistoryRefresh,
      trackTranslationBlocked,
      updateTranslationRecordId,
    ],
  );

  const enrichSavedBreakdown = useCallback(
    async (params: {
      recordId: string;
      requestSequence: number;
      mode: ExpressionMode;
      sourceText: string;
      translatedText: string;
      presetId: TranslationPresetId;
      trigger: BreakdownTrigger;
      createdAt: string;
    }) => {
      if (!params.recordId || !accessToken) return;

      const startedAt = currentTimeMs();
      setBreakdownStatus('enriching');

      const lifecycle = await runBreakdownEnrichmentLifecycle({
        accessToken,
        recordId: params.recordId,
        requestSequence: params.requestSequence,
        mode: params.mode,
        sourceText: params.sourceText,
        translatedText: params.translatedText,
        presetId: params.presetId,
        createdAt: params.createdAt,
        startedAt,
        getLatestSnapshot: () => ({
          latestSequence: sequenceRef.current,
          latestMode: modeRef.current,
          latestSourceText: inputTextRef.current.trim(),
          latestPresetId: presetIdRef.current,
          latestRecordId: translationRecordIdRef.current,
        }),
      });

      if (lifecycle.kind === 'stale') return;

      if (lifecycle.kind === 'missing_breakdown') {
        setBreakdownStatus('error');
        analytics.track('breakdown_enrichment_failed', {
          ...translationAnalyticsProperties(
            params.mode,
            params.sourceText,
            params.presetId,
            params.trigger,
          ),
          latency_ms: lifecycle.latencyMs,
          error_status: null,
          remaining_quota: lifecycle.response.usage.remainingThisMonth,
          reason: 'missing_enriched_breakdown',
        });
        return;
      }

      if (lifecycle.kind === 'api_error' || lifecycle.kind === 'exception') {
        const error = lifecycle.error;
        if (error instanceof FlowtranslateApiError && error.usage) {
          onUsage(error.usage);
        }

        setBreakdownStatus('error');
        analytics.captureError(error, {
          screen: 'translate',
          action: 'enrich_breakdown',
          mode: params.mode,
          trigger: params.trigger,
          http_status:
            error instanceof FlowtranslateApiError ? error.status : null,
        });
        analytics.track('breakdown_enrichment_failed', {
          ...translationAnalyticsProperties(
            params.mode,
            params.sourceText,
            params.presetId,
            params.trigger,
          ),
          latency_ms: lifecycle.latencyMs,
          error_status:
            error instanceof FlowtranslateApiError ? error.status : null,
          remaining_quota:
            error instanceof FlowtranslateApiError
              ? error.usage?.remainingThisMonth ?? null
              : null,
        });
        return;
      }

      const { response } = lifecycle;
      setBreakdown(lifecycle.breakdown);
      setBreakdownStatus('ready');
      onUsage(response.usage);
      onSavedTranslation(lifecycle.savedRecord);
      analytics.track('breakdown_enrichment_succeeded', {
        ...translationAnalyticsProperties(
          params.mode,
          params.sourceText,
          params.presetId,
          params.trigger,
        ),
        latency_ms: lifecycle.latencyMs,
        charged: response.usage.charged,
        cached: Boolean(response.cached),
        generated_from: response.generatedFrom || 'gemini',
        remaining_quota: response.usage.remainingThisMonth,
      });
      if (response.cached) {
        analytics.track('breakdown_enrichment_cached', {
          ...translationAnalyticsProperties(
            params.mode,
            params.sourceText,
            params.presetId,
            params.trigger,
          ),
        });
      }
      if (response.usage.charged) {
        analytics.track('breakdown_enrichment_charged', {
          ...translationAnalyticsProperties(
            params.mode,
            params.sourceText,
            params.presetId,
            params.trigger,
          ),
          estimated_tokens: response.usage.estimatedTokens,
          remaining_quota: response.usage.remainingThisMonth,
        });
      }
    },
    [accessToken, onSavedTranslation, onUsage],
  );

  const requestBreakdown = useCallback(() => {
    const recordId = translationRecordIdRef.current;
    const sourceText = inputTextRef.current.trim();
    const translatedText = resultText.trim();
    const currentMode = modeRef.current;
    const currentPresetId = presetIdRef.current;
    const trigger: BreakdownTrigger = 'panel_opened';

    if (!recordId || !sourceText || !translatedText) return;
    if (breakdownStatus === 'enriching') return;

    analytics.track('breakdown_enrichment_requested', {
      ...translationAnalyticsProperties(
        currentMode,
        sourceText,
        currentPresetId,
        trigger,
      ),
    });

    if (isEnrichedBreakdown(breakdown)) {
      setBreakdownStatus('ready');
      analytics.track('breakdown_enrichment_cached', {
        ...translationAnalyticsProperties(
          currentMode,
          sourceText,
          currentPresetId,
          trigger,
        ),
        cache_source: 'client_state',
      });
      return;
    }

    if (!online) {
      setBreakdownStatus('error');
      analytics.track('breakdown_enrichment_failed', {
        ...translationAnalyticsProperties(
          currentMode,
          sourceText,
          currentPresetId,
          trigger,
        ),
        error_status: null,
        remaining_quota: null,
        reason: 'offline',
      });
      return;
    }

    if (!accessToken) {
      setBreakdownStatus('error');
      analytics.track('breakdown_enrichment_failed', {
        ...translationAnalyticsProperties(
          currentMode,
          sourceText,
          currentPresetId,
          trigger,
        ),
        error_status: 401,
        remaining_quota: null,
        reason: 'auth',
      });
      return;
    }

    void enrichSavedBreakdown({
      recordId,
      requestSequence: sequenceRef.current,
      mode: currentMode,
      sourceText,
      translatedText,
      presetId: currentPresetId,
      trigger,
      createdAt: translationRecordCreatedAtRef.current,
    });
  }, [
    accessToken,
    breakdown,
    breakdownStatus,
    enrichSavedBreakdown,
    online,
    resultText,
  ]);

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
      setBreakdown(null);
      setBreakdownStatus('idle');
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
          displayBreakdown,
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
        setBreakdown(displayBreakdown);
        setBreakdownStatus(displayBreakdown ? 'ready' : 'idle');
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
      schedulePendingHistoryRefresh,
      trackTranslationBlocked,
      updateMode,
      updateTranslationRecordId,
    ],
  );

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
        setBreakdown(null);
        setBreakdownStatus('idle');
        setGrammarInsight(null);
        setResultText('');
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

      setStatus('typing');
      setMessage('Genero despues de una pausa corta...');
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runTranslation(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        );
      }, TRANSLATION_IDLE_DELAY_MS);
    },
    [
      accessToken,
      authPending,
      blockTranslationInputLimit,
      clearScheduledTranslation,
      online,
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
      !inputTextRef.current.trim()
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
    setBreakdown(null);
    setBreakdownStatus('idle');
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
    setBreakdown(null);
    setBreakdownStatus('idle');
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
    trackTranslationBlocked,
    updateMode,
    updateTranslationRecordId,
  ]);

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
    breakdown,
    breakdownStatus,
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
    requestBreakdown,
    selectPreset,
    selectMode,
    editInput,
    editWorkContext,
    setStatus,
    setMessage,
  };
};
