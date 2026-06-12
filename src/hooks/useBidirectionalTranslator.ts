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
import {
  FlowtranslateApiError,
  enrichBreakdown,
  generateTranslation,
} from '../services/flowtranslate-api';

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
  | 'preset_selected'
  | 'context_applied';

type BreakdownTrigger = 'panel_opened';

type TranslationBlockedReason =
  | 'offline'
  | 'auth'
  | 'quota'
  | 'ambiguous'
  | 'mixed_input';

type BreakdownStatus = 'idle' | 'enriching' | 'ready' | 'error';

type UseBidirectionalTranslatorParams = {
  accessToken: string;
  authPending?: boolean;
  online: boolean;
  onUsage: (usage: UsageSnapshot) => void;
  onSavedTranslation: (record: TranslationRecord) => void;
  onRefreshSavedTranslations?: () => Promise<TranslationRecord[]>;
};

const PENDING_HISTORY_REFRESH_DELAY_MS = 1800;

const normalizeText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const createRequestKey = (
  mode: ExpressionMode,
  sourceText: string,
  presetId: TranslationPresetId,
  contextText = '',
) => [mode, presetId, normalizeText(sourceText), normalizeText(contextText)].join(':');

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const elapsedMs = (startedAt: number) =>
  Math.max(0, Math.round(currentTimeMs() - startedAt));

const translationAnalyticsProperties = (
  mode: ExpressionMode,
  sourceText: string,
  presetId: TranslationPresetId,
  trigger: TranslationTrigger | BreakdownTrigger,
  contextText = '',
) => {
  const direction = createExpressionDirection(mode);

  return {
    mode,
    preset_id: presetId,
    trigger,
    source_language: direction.sourceLanguage,
    target_language: direction.targetLanguage,
    input_chars: sourceText.trim().length,
    has_context: Boolean(contextText.trim()),
    context_chars: contextText.trim().length,
  };
};

const isConversationReplyMode = (mode: ExpressionMode) =>
  mode !== 'translate_to_spanish';

const isEnrichedBreakdown = (value: ExpressionBreakdown | null) => {
  if (!value) return false;
  const hasTenses = Boolean(value.tenses?.length);
  const hasStructure = Boolean(value.structure?.length);
  const hasAlternatives = Boolean(value.alternatives?.length);
  const hasMistake = Boolean(value.commonMistake?.trim());

  return hasTenses || hasStructure || hasAlternatives || hasMistake;
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
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const pendingHistoryTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearScheduledTranslation = useCallback(() => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearScheduledTranslation, [clearScheduledTranslation]);

  const clearPendingHistoryRefresh = useCallback(() => {
    if (!pendingHistoryTimerRef.current) return;
    window.clearTimeout(pendingHistoryTimerRef.current);
    pendingHistoryTimerRef.current = null;
  }, []);

  useEffect(() => clearPendingHistoryRefresh, [clearPendingHistoryRefresh]);

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

  const schedulePendingHistoryRefresh = useCallback(
    (params: {
      requestSequence: number;
      mode: ExpressionMode;
      sourceText: string;
      translatedText: string;
      presetId: TranslationPresetId;
      contextText: string;
      trigger: TranslationTrigger;
    }) => {
      if (!onRefreshSavedTranslations) return;
      clearPendingHistoryRefresh();

      pendingHistoryTimerRef.current = window.setTimeout(() => {
        pendingHistoryTimerRef.current = null;
        void (async () => {
          try {
            const records = await onRefreshSavedTranslations();
            const savedRecord = records.find((record) =>
              normalizeText(record.sourceText) === normalizeText(params.sourceText) &&
              normalizeText(record.translatedText) === normalizeText(params.translatedText) &&
              (!record.mode || record.mode === params.mode)
            );

            if (!savedRecord) {
              analytics.track('translation_pending_save_unresolved', {
                ...translationAnalyticsProperties(
                  params.mode,
                  params.sourceText,
                  params.presetId,
                  params.trigger,
                  params.contextText,
                ),
              });
              return;
            }

            if (
              !canApplyTranslationResponse({
                requestSequence: params.requestSequence,
                latestSequence: sequenceRef.current,
                requestMode: params.mode,
                latestMode: modeRef.current,
                requestSourceText: params.sourceText,
                latestSourceText: inputTextRef.current.trim(),
                requestPresetId: params.presetId,
                latestPresetId: presetIdRef.current,
                requestContextText: params.contextText,
                latestContextText: workContextTextRef.current,
              })
            ) {
              return;
            }

            updateTranslationRecordId(savedRecord.id, savedRecord.createdAt);
            setMessage('Guardado en tu historial.');
            onSavedTranslation(savedRecord);
            analytics.track('translation_pending_save_resolved', {
              ...translationAnalyticsProperties(
                params.mode,
                params.sourceText,
                params.presetId,
                params.trigger,
                params.contextText,
              ),
              record_id: savedRecord.id,
            });
          } catch (error) {
            analytics.track('translation_pending_save_refresh_failed', {
              ...translationAnalyticsProperties(
                params.mode,
                params.sourceText,
                params.presetId,
                params.trigger,
                params.contextText,
              ),
              error_type: error instanceof Error ? error.name : 'unknown',
            });
          }
        })();
      }, PENDING_HISTORY_REFRESH_DELAY_MS);
    },
    [
      clearPendingHistoryRefresh,
      onRefreshSavedTranslations,
      onSavedTranslation,
      updateTranslationRecordId,
    ],
  );

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
        normalizeText(contextText),
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

      const isStillCurrent = () =>
        translationRecordIdRef.current === params.recordId &&
        canApplyTranslationResponse({
          requestSequence: params.requestSequence,
          latestSequence: sequenceRef.current,
          requestMode: params.mode,
          latestMode: modeRef.current,
          requestSourceText: params.sourceText,
          latestSourceText: inputTextRef.current.trim(),
          requestPresetId: params.presetId,
          latestPresetId: presetIdRef.current,
        });

      try {
        const response = await enrichBreakdown(
          { translationRecordId: params.recordId },
          accessToken,
        );

        if (!isStillCurrent()) return;

        const nextBreakdown =
          response.breakdown || response.translationRecord.breakdown || null;
        if (!isEnrichedBreakdown(nextBreakdown)) {
          setBreakdownStatus('error');
          analytics.track('breakdown_enrichment_failed', {
            ...translationAnalyticsProperties(
              params.mode,
              params.sourceText,
              params.presetId,
              params.trigger,
            ),
            latency_ms: elapsedMs(startedAt),
            error_status: null,
            remaining_quota: response.usage.remainingThisMonth,
            reason: 'missing_enriched_breakdown',
          });
          return;
        }

        const responseDirection = createExpressionDirection(params.mode);
        setBreakdown(nextBreakdown);
        setBreakdownStatus('ready');
        onUsage(response.usage);
        onSavedTranslation({
          id: params.recordId,
          sourceLanguage:
            response.translationRecord.sourceLanguage ||
            responseDirection.sourceLanguage,
          targetLanguage:
            response.translationRecord.targetLanguage ||
            responseDirection.targetLanguage,
          sourceText: params.sourceText,
          translatedText: params.translatedText,
          mode: params.mode,
          breakdown: nextBreakdown,
          createdAt: response.translationRecord.createdAt || params.createdAt,
        });
        analytics.track('breakdown_enrichment_succeeded', {
          ...translationAnalyticsProperties(
            params.mode,
            params.sourceText,
            params.presetId,
            params.trigger,
          ),
          latency_ms: elapsedMs(startedAt),
          charged: response.usage.charged,
          cached: Boolean(response.cached),
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
      } catch (error) {
        if (!isStillCurrent()) return;

        if (error instanceof FlowtranslateApiError && error.usage) {
          onUsage(error.usage);
        }

        setBreakdownStatus('error');
        analytics.track('breakdown_enrichment_failed', {
          ...translationAnalyticsProperties(
            params.mode,
            params.sourceText,
            params.presetId,
            params.trigger,
          ),
          latency_ms: elapsedMs(startedAt),
          error_status:
            error instanceof FlowtranslateApiError ? error.status : null,
          remaining_quota:
            error instanceof FlowtranslateApiError
              ? error.usage?.remainingThisMonth ?? null
              : null,
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
          setMessage('Preparando tu prueba gratis...');
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

      const requestKey = createRequestKey(
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
      setBreakdown(null);
      setBreakdownStatus('idle');
      setStatus('translating');
      setMessage('Generando respuesta...');
      analytics.track('translation_submitted', {
        ...translationAnalyticsProperties(
          nextMode,
          trimmedSource,
          nextPresetId,
          trigger,
          nextContextText,
        ),
      });
      if (isConversationReplyMode(nextMode)) {
        analytics.track('conversation_reply_requested', {
          ...translationAnalyticsProperties(
            nextMode,
            trimmedSource,
            nextPresetId,
            trigger,
            nextContextText,
          ),
        });
      }

      try {
        const result = await generateTranslation(
          {
            mode: nextMode,
            text: trimmedSource,
            context: nextContextText.trim() || undefined,
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
            requestContextText: nextContextText,
            latestContextText: workContextTextRef.current,
          })
        ) {
          return;
        }

        const savedBreakdown =
          result.breakdown || result.translationRecord.breakdown || null;
        const displayBreakdown = isEnrichedBreakdown(savedBreakdown)
          ? savedBreakdown
          : null;
        const responseMode = result.mode || result.translationRecord.mode || nextMode;
        const responseDirection = createExpressionDirection(responseMode);
        const isSavedRecord = result.translationRecord.saved !== false &&
          Boolean(result.translationRecord.id);
        const nextRecordId = isSavedRecord ? result.translationRecord.id : '';

        updateMode(responseMode);
        updateTranslationRecordId(
          nextRecordId,
          isSavedRecord ? result.translationRecord.createdAt : '',
        );
        setResultText(result.text);
        setBreakdown(displayBreakdown);
        setBreakdownStatus(displayBreakdown ? 'ready' : 'idle');
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
        analytics.track('translation_succeeded', {
          ...translationAnalyticsProperties(
            responseMode,
            trimmedSource,
            nextPresetId,
            trigger,
            nextContextText,
          ),
          output_chars: result.text.trim().length,
          latency_ms: elapsedMs(startedAt),
          charged: result.usage.charged,
          reused: !result.usage.charged,
          save_pending: Boolean(result.translationRecord.pending),
          estimated_tokens: result.usage.estimatedTokens,
          used_this_month: result.usage.usedThisMonth,
          remaining_quota: result.usage.remainingThisMonth,
        });
        if (isConversationReplyMode(responseMode)) {
          analytics.track('conversation_reply_generated', {
            ...translationAnalyticsProperties(
              responseMode,
              trimmedSource,
              nextPresetId,
              trigger,
              nextContextText,
            ),
            output_chars: result.text.trim().length,
            latency_ms: elapsedMs(startedAt),
            charged: result.usage.charged,
            reused: !result.usage.charged,
            remaining_quota: result.usage.remainingThisMonth,
          });
        }

      } catch (error) {
        if (error instanceof FlowtranslateApiError) {
          if (error.usage) onUsage(error.usage);
          const errorProperties = {
            ...translationAnalyticsProperties(
              nextMode,
              trimmedSource,
              nextPresetId,
              trigger,
              nextContextText,
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
            nextContextText,
          ),
          latency_ms: elapsedMs(startedAt),
          error_type: 'exception',
        });
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'No pudimos generar la respuesta.');
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
      clearPendingHistoryRefresh,
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
        setResultText('');
        updateTranslationRecordId('');
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
          nextContextText,
        );
        setStatus('offline');
        setMessage('Estas offline. El texto queda visible, pero la IA necesita conexion.');
        return;
      }

      if (!accessToken) {
        if (authPending) {
          setStatus('typing');
          setMessage('Preparando tu prueba gratis...');
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

      const requestKey = createRequestKey(
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

  const activeSourceText = inputText.trim();
  const canTranslate =
    Boolean(activeSourceText) &&
    online &&
    Boolean(accessToken) &&
    status !== 'translating';

  const translateDisabledReason = !activeSourceText
    ? 'Agrega texto para responder.'
    : !online
      ? 'Estas offline. La IA necesita conexion.'
      : !accessToken
        ? authPending
          ? 'Preparando tu prueba gratis...'
          : 'Conecta tu cuenta para guardar progreso y seguir.'
        : status === 'translating'
          ? 'Generacion en curso.'
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
    workContextText,
    breakdown,
    breakdownStatus,
    translationRecordId,
    status,
    message,
    hasPendingChanges,
    canTranslate,
    translateDisabledReason,
    translate,
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
