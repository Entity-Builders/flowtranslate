import {
  DEFAULT_EXPRESSION_MODE,
  DEFAULT_TRANSLATION_PRESET_ID,
  canApplyTranslationResponse,
  createExpressionDirection,
  detectExpressionMode,
  type ExpressionBreakdown,
  type ExpressionMode,
  type IntentDetectionResult,
  type TranslationPresetId,
  type TranslationRecord,
  type UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSLATION_IDLE_DELAY_MS } from '../constants';
import { analytics } from '../services/analytics';
import { FlowtranslateApiError, generateTranslation } from '../services/flowtranslate-api';

type TranslatorStatus =
  | 'idle'
  | 'typing'
  | 'translating'
  | 'copied'
  | 'error'
  | 'offline'
  | 'quota'
  | 'auth';

type TranslationTrigger =
  | 'auto_idle'
  | 'manual_generate'
  | 'mode_selected'
  | 'preset_selected';

type TranslationBlockedReason =
  | 'offline'
  | 'auth'
  | 'quota'
  | 'ambiguous'
  | 'mixed_input';

type UseBidirectionalTranslatorParams = {
  accessToken: string;
  authPending?: boolean;
  online: boolean;
  onUsage: (usage: UsageSnapshot) => void;
  onSavedTranslation: (record: TranslationRecord) => void;
};

const normalizeText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const createRequestKey = (
  mode: ExpressionMode,
  sourceText: string,
  presetId: TranslationPresetId,
) => [mode, presetId, normalizeText(sourceText)].join(':');

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const elapsedMs = (startedAt: number) =>
  Math.max(0, Math.round(currentTimeMs() - startedAt));

const translationAnalyticsProperties = (
  mode: ExpressionMode,
  sourceText: string,
  presetId: TranslationPresetId,
  trigger: TranslationTrigger,
) => {
  const direction = createExpressionDirection(mode);

  return {
    mode,
    preset_id: presetId,
    trigger,
    source_language: direction.sourceLanguage,
    target_language: direction.targetLanguage,
    input_chars: sourceText.trim().length,
  };
};

const fallbackDetection = (mode: ExpressionMode): IntentDetectionResult => ({
  mode,
  confidence: 'low',
  reason: 'manual',
  automatic: false,
});

export const useBidirectionalTranslator = ({
  accessToken,
  authPending = false,
  online,
  onUsage,
  onSavedTranslation,
}: UseBidirectionalTranslatorParams) => {
  const [inputText, setInputText] = useState('');
  const [resultText, setResultText] = useState('');
  const [mode, setMode] = useState<ExpressionMode>(DEFAULT_EXPRESSION_MODE);
  const [modeDetection, setModeDetection] = useState<IntentDetectionResult>(
    fallbackDetection(DEFAULT_EXPRESSION_MODE),
  );
  const [breakdown, setBreakdown] = useState<ExpressionBreakdown | null>(null);
  const [presetId, setPresetId] = useState<TranslationPresetId>(
    DEFAULT_TRANSLATION_PRESET_ID,
  );
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [message, setMessage] = useState('');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const sequenceRef = useRef(0);
  const lastCompletedKeyRef = useRef('');
  const inFlightKeyRef = useRef('');
  const inputTextRef = useRef('');
  const previousAccessTokenRef = useRef(accessToken);
  const lastBlockedAnalyticsKeyRef = useRef('');
  const modeRef = useRef<ExpressionMode>(DEFAULT_EXPRESSION_MODE);
  const lastModeRef = useRef<ExpressionMode>(DEFAULT_EXPRESSION_MODE);
  const presetIdRef = useRef<TranslationPresetId>(
    DEFAULT_TRANSLATION_PRESET_ID,
  );
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

  const trackTranslationBlocked = useCallback(
    (
      reason: TranslationBlockedReason,
      nextMode: ExpressionMode,
      nextSourceText: string,
      nextPresetId: TranslationPresetId,
      trigger: TranslationTrigger,
      properties: Record<string, unknown> = {},
    ) => {
      const trimmedSource = nextSourceText.trim();
      if (!trimmedSource) return;

      const analyticsKey = [reason, nextMode, nextPresetId, trigger].join(':');
      if (lastBlockedAnalyticsKeyRef.current === analyticsKey) return;

      lastBlockedAnalyticsKeyRef.current = analyticsKey;
      analytics.track('translation_blocked', {
        ...translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
        ),
        reason,
        ...properties,
      });
    },
    [],
  );

  const runTranslation = useCallback(
    async (
      nextMode: ExpressionMode,
      nextSourceText: string,
      nextPresetId: TranslationPresetId = presetIdRef.current,
      trigger: TranslationTrigger = 'manual_generate',
    ) => {
      const trimmedSource = nextSourceText.trim();
      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
        setHasPendingChanges(false);
        lastBlockedAnalyticsKeyRef.current = '';
        return;
      }

      if (!online) {
        trackTranslationBlocked(
          'offline',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
        );
        setStatus('offline');
        setMessage('Offline. Existing text stays readable; new AI work needs a connection.');
        return;
      }

      if (!accessToken) {
        if (authPending) {
          setStatus('typing');
          setMessage('Starting guest trial...');
          setHasPendingChanges(true);
          return;
        }

        trackTranslationBlocked(
          'auth',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
        );
        setStatus('auth');
        setMessage('Sign in to translate and save history.');
        return;
      }

      const requestKey = createRequestKey(
        nextMode,
        trimmedSource,
        nextPresetId,
      );

      if (requestKey === lastCompletedKeyRef.current) {
        analytics.track('translation_reused', {
          ...translationAnalyticsProperties(
            nextMode,
            trimmedSource,
            nextPresetId,
            trigger,
          ),
          reuse_source: 'client_current_result',
        });
        setStatus('idle');
        setMessage('Already current.');
        setHasPendingChanges(false);
        return;
      }

      if (requestKey === inFlightKeyRef.current) return;

      const requestSequence = sequenceRef.current + 1;
      const startedAt = currentTimeMs();
      sequenceRef.current = requestSequence;
      inFlightKeyRef.current = requestKey;
      lastBlockedAnalyticsKeyRef.current = '';
      setStatus('translating');
      setMessage('Generating...');
      analytics.track('translation_submitted', {
        ...translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
        ),
      });

      try {
        const result = await generateTranslation(
          {
            mode: nextMode,
            text: trimmedSource,
            presetId: nextPresetId,
            clientRequestId: `${requestSequence}`,
          },
          accessToken,
        );

        if (
          !canApplyTranslationResponse({
            requestSequence,
            latestSequence: sequenceRef.current,
            requestMode: nextMode,
            latestMode: modeRef.current,
            requestSourceText: trimmedSource,
            latestSourceText: inputTextRef.current.trim(),
            requestPresetId: nextPresetId,
            latestPresetId: presetIdRef.current,
          })
        ) {
          return;
        }

        const nextBreakdown =
          result.breakdown || result.translationRecord.breakdown || null;
        const responseMode = result.mode || result.translationRecord.mode || nextMode;
        const responseDirection = createExpressionDirection(responseMode);

        updateMode(responseMode);
        setResultText(result.text);
        setBreakdown(nextBreakdown);
        lastCompletedKeyRef.current = requestKey;
        setStatus('idle');
        setMessage(result.usage.charged ? 'Saved to history.' : 'Reused saved expression.');
        setHasPendingChanges(false);
        onUsage(result.usage);
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
          breakdown: nextBreakdown,
          createdAt: result.translationRecord.createdAt,
        });
        analytics.track('translation_succeeded', {
          ...translationAnalyticsProperties(
            responseMode,
            trimmedSource,
            nextPresetId,
            trigger,
          ),
          output_chars: result.text.trim().length,
          latency_ms: elapsedMs(startedAt),
          charged: result.usage.charged,
          reused: !result.usage.charged,
          estimated_tokens: result.usage.estimatedTokens,
          used_this_month: result.usage.usedThisMonth,
          remaining_quota: result.usage.remainingThisMonth,
        });
      } catch (error) {
        if (error instanceof FlowtranslateApiError) {
          if (error.usage) onUsage(error.usage);
          const errorProperties = {
            ...translationAnalyticsProperties(
              nextMode,
              trimmedSource,
              nextPresetId,
              trigger,
            ),
            latency_ms: elapsedMs(startedAt),
            error_status: error.status,
            remaining_quota: error.usage?.remainingThisMonth ?? null,
          };

          if (error.status === 402) {
            analytics.track('translation_blocked', {
              ...errorProperties,
              reason: 'quota',
            });
          } else if (error.status === 401) {
            analytics.track('translation_blocked', {
              ...errorProperties,
              reason: 'auth',
            });
          } else {
            analytics.track('translation_failed', {
              ...errorProperties,
              error_type: 'api_error',
            });
          }
          setStatus(error.status === 402 ? 'quota' : error.status === 401 ? 'auth' : 'error');
          setMessage(error.message);
          return;
        }

        analytics.track('translation_failed', {
          ...translationAnalyticsProperties(
            nextMode,
            trimmedSource,
            nextPresetId,
            trigger,
          ),
          latency_ms: elapsedMs(startedAt),
          error_type: 'exception',
        });
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Expression generation failed.');
      } finally {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = '';
      }
    },
    [
      accessToken,
      authPending,
      online,
      onSavedTranslation,
      onUsage,
      trackTranslationBlocked,
      updateMode,
    ],
  );

  const scheduleTranslation = useCallback(
    (
      nextSourceText: string,
      nextMode: ExpressionMode,
      nextPresetId: TranslationPresetId,
      trigger: TranslationTrigger,
      detection: IntentDetectionResult,
    ) => {
      clearScheduledTranslation();
      const trimmedSource = nextSourceText.trim();

      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
        setHasPendingChanges(false);
        setBreakdown(null);
        setResultText('');
        lastBlockedAnalyticsKeyRef.current = '';
        return;
      }

      setHasPendingChanges(true);

      if (!online) {
        trackTranslationBlocked(
          'offline',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
        );
        setStatus('offline');
        setMessage('Offline. Existing text stays readable; new AI work needs a connection.');
        return;
      }

      if (!accessToken) {
        if (authPending) {
          setStatus('typing');
          setMessage('Starting guest trial...');
          return;
        }

        trackTranslationBlocked(
          'auth',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
        );
        setStatus('auth');
        setMessage('Sign in to translate and save history.');
        return;
      }

      const requestKey = createRequestKey(
        nextMode,
        trimmedSource,
        nextPresetId,
      );

      if (requestKey === lastCompletedKeyRef.current) {
        setStatus('idle');
        setMessage('Already current.');
        setHasPendingChanges(false);
        return;
      }

      if (trigger === 'auto_idle' && !detection.automatic) {
        trackTranslationBlocked(
          detection.reason === 'mixed' ? 'mixed_input' : 'ambiguous',
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          {
            detection_reason: detection.reason,
            detection_confidence: detection.confidence,
          },
        );
        setStatus('typing');
        setMessage(
          detection.reason === 'ambiguous'
            ? 'Choose a mode to generate this short text.'
            : 'Choose a mode for this mixed text.',
        );
        return;
      }

      setStatus('typing');
      setMessage('Auto-generating after a short pause...');
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runTranslation(nextMode, trimmedSource, nextPresetId, trigger);
      }, TRANSLATION_IDLE_DELAY_MS);
    },
    [
      accessToken,
      authPending,
      clearScheduledTranslation,
      online,
      runTranslation,
      trackTranslationBlocked,
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
      scheduleTranslation(
        value,
        nextMode,
        presetIdRef.current,
        'auto_idle',
        nextDetection,
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
        nextDetection,
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
      scheduleTranslation(
        inputTextRef.current,
        modeRef.current,
        nextPresetId,
        'preset_selected',
        fallbackDetection(modeRef.current),
      );
    },
    [scheduleTranslation],
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

    const nextDetection = detectExpressionMode(
      inputTextRef.current,
      lastModeRef.current,
    );
    scheduleTranslation(
      inputTextRef.current,
      modeRef.current,
      presetIdRef.current,
      'auto_idle',
      nextDetection,
    );
  }, [accessToken, hasPendingChanges, scheduleTranslation]);

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
      );
    },
    [clearScheduledTranslation, runTranslation, updateMode],
  );

  const activeSourceText = inputText.trim();
  const canTranslate =
    Boolean(activeSourceText) &&
    online &&
    Boolean(accessToken) &&
    status !== 'translating';

  const translateDisabledReason = !activeSourceText
    ? 'Add text to generate.'
    : !online
      ? 'Offline. New AI work needs a connection.'
      : !accessToken
        ? authPending
          ? 'Starting guest trial...'
          : 'Sign in to translate and save history.'
        : status === 'translating'
          ? 'Generation in progress.'
          : '';

  const direction = createExpressionDirection(mode);

  return {
    inputText,
    resultText,
    mode,
    modeDetection,
    sourceLanguage: direction.sourceLanguage,
    targetLanguage: direction.targetLanguage,
    presetId,
    breakdown,
    status,
    message,
    hasPendingChanges,
    canTranslate,
    translateDisabledReason,
    translate,
    selectPreset,
    selectMode,
    editInput,
    setStatus,
    setMessage,
  };
};
