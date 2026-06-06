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

type ScheduleReason = 'detected' | 'manual';

type UseBidirectionalTranslatorParams = {
  accessToken: string;
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

const fallbackDetection = (mode: ExpressionMode): IntentDetectionResult => ({
  mode,
  confidence: 'low',
  reason: 'manual',
  automatic: false,
});

export const useBidirectionalTranslator = ({
  accessToken,
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

  const runTranslation = useCallback(
    async (
      nextMode: ExpressionMode,
      nextSourceText: string,
      nextPresetId: TranslationPresetId = presetIdRef.current,
    ) => {
      const trimmedSource = nextSourceText.trim();
      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
        setHasPendingChanges(false);
        return;
      }

      if (!online) {
        setStatus('offline');
        setMessage('Offline. Existing text stays readable; new AI work needs a connection.');
        return;
      }

      if (!accessToken) {
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

      if (requestKey === inFlightKeyRef.current) return;

      const requestSequence = sequenceRef.current + 1;
      sequenceRef.current = requestSequence;
      inFlightKeyRef.current = requestKey;
      setStatus('translating');
      setMessage('Generating...');

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
      } catch (error) {
        if (error instanceof FlowtranslateApiError) {
          if (error.usage) onUsage(error.usage);
          setStatus(error.status === 402 ? 'quota' : error.status === 401 ? 'auth' : 'error');
          setMessage(error.message);
          return;
        }

        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Expression generation failed.');
      } finally {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = '';
      }
    },
    [accessToken, online, onSavedTranslation, onUsage, updateMode],
  );

  const scheduleTranslation = useCallback(
    (
      nextSourceText: string,
      nextMode: ExpressionMode,
      nextPresetId: TranslationPresetId,
      reason: ScheduleReason,
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
        return;
      }

      setHasPendingChanges(true);

      if (!online) {
        setStatus('offline');
        setMessage('Offline. Existing text stays readable; new AI work needs a connection.');
        return;
      }

      if (!accessToken) {
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

      if (reason === 'detected' && !detection.automatic) {
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
        void runTranslation(nextMode, trimmedSource, nextPresetId);
      }, TRANSLATION_IDLE_DELAY_MS);
    },
    [
      accessToken,
      clearScheduledTranslation,
      online,
      runTranslation,
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
        'detected',
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
        'manual',
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
        'manual',
        fallbackDetection(modeRef.current),
      );
    },
    [scheduleTranslation],
  );

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
        ? 'Sign in to translate and save history.'
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
