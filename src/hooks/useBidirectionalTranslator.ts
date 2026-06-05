import {
  DEFAULT_TRANSLATION_PRESET_ID,
  canApplyTranslationResponse,
  createDirection,
  type LanguageCode,
  type TranslationPresetId,
  type TranslationRecord,
  type UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSLATION_IDLE_DELAY_MS } from '../constants';
import { FlowtranslateApiError, generateTranslation } from '../services/flowtranslate-api';

type PanelTexts = Record<LanguageCode, string>;

type TranslatorStatus =
  | 'idle'
  | 'typing'
  | 'translating'
  | 'copied'
  | 'error'
  | 'offline'
  | 'quota'
  | 'auth';

type UseBidirectionalTranslatorParams = {
  accessToken: string;
  online: boolean;
  onUsage: (usage: UsageSnapshot) => void;
  onSavedTranslation: (record: TranslationRecord) => void;
};

const createRequestKey = (
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  sourceText: string,
  presetId: TranslationPresetId,
) =>
  [
    sourceLanguage,
    targetLanguage,
    presetId,
    sourceText.trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
  ].join(':');

export const useBidirectionalTranslator = ({
  accessToken,
  online,
  onUsage,
  onSavedTranslation,
}: UseBidirectionalTranslatorParams) => {
  const [texts, setTexts] = useState<PanelTexts>({ es: '', en: '' });
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('es');
  const [presetId, setPresetId] = useState<TranslationPresetId>(
    DEFAULT_TRANSLATION_PRESET_ID,
  );
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [message, setMessage] = useState('');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const sequenceRef = useRef(0);
  const lastCompletedKeyRef = useRef('');
  const inFlightKeyRef = useRef('');
  const sourceLanguageRef = useRef<LanguageCode>('es');
  const presetIdRef = useRef<TranslationPresetId>(
    DEFAULT_TRANSLATION_PRESET_ID,
  );
  const textsRef = useRef<PanelTexts>({ es: '', en: '' });
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearScheduledTranslation = useCallback(() => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearScheduledTranslation, [clearScheduledTranslation]);

  const runTranslation = useCallback(
    async (
      nextSourceLanguage: LanguageCode,
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

      const direction = createDirection(nextSourceLanguage);
      const requestKey = createRequestKey(
        direction.sourceLanguage,
        direction.targetLanguage,
        trimmedSource,
        nextPresetId,
      );

      if (requestKey === lastCompletedKeyRef.current) {
        setStatus('idle');
        setMessage('Already translated.');
        setHasPendingChanges(false);
        return;
      }

      if (requestKey === inFlightKeyRef.current) return;

      const requestSequence = sequenceRef.current + 1;
      sequenceRef.current = requestSequence;
      inFlightKeyRef.current = requestKey;
      setStatus('translating');
      setMessage('Translating...');

      try {
        const result = await generateTranslation(
          {
            sourceLanguage: direction.sourceLanguage,
            targetLanguage: direction.targetLanguage,
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
            requestSourceLanguage: nextSourceLanguage,
            latestSourceLanguage: sourceLanguageRef.current,
            requestSourceText: trimmedSource,
            latestSourceText: textsRef.current[nextSourceLanguage].trim(),
            requestPresetId: nextPresetId,
            latestPresetId: presetIdRef.current,
          })
        ) {
          return;
        }

        setTexts((current) => ({
          ...current,
          [direction.targetLanguage]: result.text,
        }));
        textsRef.current = {
          ...textsRef.current,
          [direction.targetLanguage]: result.text,
        };
        lastCompletedKeyRef.current = requestKey;
        setStatus('idle');
        setMessage(result.usage.charged ? 'Saved to history.' : 'Reused saved translation.');
        setHasPendingChanges(false);
        onUsage(result.usage);
        onSavedTranslation({
          id: result.translationRecord.id,
          sourceLanguage: result.translationRecord.sourceLanguage,
          targetLanguage: result.translationRecord.targetLanguage,
          sourceText: trimmedSource,
          translatedText: result.text,
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
        setMessage(error instanceof Error ? error.message : 'Translation failed.');
      } finally {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = '';
      }
    },
    [accessToken, online, onSavedTranslation, onUsage],
  );

  const scheduleTranslation = useCallback(
    (
      nextSourceLanguage: LanguageCode,
      nextSourceText: string,
      nextPresetId: TranslationPresetId,
    ) => {
      clearScheduledTranslation();
      const trimmedSource = nextSourceText.trim();

      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
        setHasPendingChanges(false);
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

      const direction = createDirection(nextSourceLanguage);
      const requestKey = createRequestKey(
        direction.sourceLanguage,
        direction.targetLanguage,
        trimmedSource,
        nextPresetId,
      );

      if (requestKey === lastCompletedKeyRef.current) {
        setStatus('idle');
        setMessage('Already translated.');
        setHasPendingChanges(false);
        return;
      }

      setStatus('typing');
      setMessage('Auto-translating after a short pause...');
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runTranslation(nextSourceLanguage, trimmedSource, nextPresetId);
      }, TRANSLATION_IDLE_DELAY_MS);
    },
    [
      accessToken,
      clearScheduledTranslation,
      online,
      runTranslation,
    ],
  );

  const editPanel = useCallback(
    (language: LanguageCode, value: string) => {
      sequenceRef.current += 1;
      sourceLanguageRef.current = language;
      textsRef.current = {
        ...textsRef.current,
        [language]: value,
      };
      setSourceLanguage(language);
      setTexts((current) => ({
        ...current,
        [language]: value,
      }));
      scheduleTranslation(language, value, presetIdRef.current);
    },
    [scheduleTranslation],
  );

  const selectPreset = useCallback(
    (nextPresetId: TranslationPresetId) => {
      if (nextPresetId === presetIdRef.current) return;

      sequenceRef.current += 1;
      presetIdRef.current = nextPresetId;
      setPresetId(nextPresetId);
      scheduleTranslation(
        sourceLanguageRef.current,
        textsRef.current[sourceLanguageRef.current],
        nextPresetId,
      );
    },
    [scheduleTranslation],
  );

  const translate = useCallback(() => {
    clearScheduledTranslation();
    return runTranslation(
      sourceLanguageRef.current,
      textsRef.current[sourceLanguageRef.current],
      presetIdRef.current,
    );
  }, [clearScheduledTranslation, runTranslation]);

  const activeSourceText = texts[sourceLanguage].trim();
  const canTranslate =
    Boolean(activeSourceText) &&
    online &&
    Boolean(accessToken) &&
    status !== 'translating';

  const translateDisabledReason = !activeSourceText
    ? 'Add text to translate.'
    : !online
      ? 'Offline. New AI work needs a connection.'
      : !accessToken
        ? 'Sign in to translate and save history.'
        : status === 'translating'
          ? 'Translation in progress.'
          : '';

  return {
    spanishText: texts.es,
    englishText: texts.en,
    sourceLanguage,
    targetLanguage: createDirection(sourceLanguage).targetLanguage,
    presetId,
    status,
    message,
    hasPendingChanges,
    canTranslate,
    translateDisabledReason,
    translate,
    selectPreset,
    editSpanish: (value: string) => editPanel('es', value),
    editEnglish: (value: string) => editPanel('en', value),
    setStatus,
    setMessage,
  };
};
