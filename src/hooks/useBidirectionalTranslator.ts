import {
  canApplyTranslationResponse,
  createDirection,
  type LanguageCode,
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

export const useBidirectionalTranslator = ({
  accessToken,
  online,
  onUsage,
  onSavedTranslation,
}: UseBidirectionalTranslatorParams) => {
  const [texts, setTexts] = useState<PanelTexts>({ es: '', en: '' });
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('es');
  const [status, setStatus] = useState<TranslatorStatus>('idle');
  const [message, setMessage] = useState('');
  const sequenceRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const lastCompletedKeyRef = useRef('');
  const sourceLanguageRef = useRef<LanguageCode>('es');
  const textsRef = useRef<PanelTexts>({ es: '', en: '' });

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runTranslation = useCallback(
    async (nextSourceLanguage: LanguageCode, nextSourceText: string) => {
      clearPending();
      const trimmedSource = nextSourceText.trim();
      if (!trimmedSource) {
        setStatus('idle');
        setMessage('');
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
      const requestKey = `${direction.sourceLanguage}:${direction.targetLanguage}:${trimmedSource}`;
      if (requestKey === lastCompletedKeyRef.current) return;

      const requestSequence = sequenceRef.current + 1;
      sequenceRef.current = requestSequence;
      setStatus('translating');
      setMessage('Translating...');

      try {
        const result = await generateTranslation(
          {
            sourceLanguage: direction.sourceLanguage,
            targetLanguage: direction.targetLanguage,
            text: trimmedSource,
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
        setStatus(result.usage.charged ? 'idle' : 'idle');
        setMessage(result.usage.charged ? 'Saved to history.' : 'Reused saved translation.');
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
      }
    },
    [
      accessToken,
      clearPending,
      online,
      onSavedTranslation,
      onUsage,
    ],
  );

  const scheduleTranslation = useCallback(
    (nextSourceLanguage: LanguageCode, nextSourceText: string, immediate = false) => {
      clearPending();

      if (!nextSourceText.trim()) {
        setStatus('idle');
        setMessage('');
        return;
      }

      setStatus('typing');
      setMessage(immediate ? 'Preparing translation...' : 'Waiting for pause...');

      const delay = immediate ? 0 : TRANSLATION_IDLE_DELAY_MS;
      timeoutRef.current = window.setTimeout(() => {
        void runTranslation(nextSourceLanguage, nextSourceText);
      }, delay);
    },
    [clearPending, runTranslation],
  );

  const editPanel = useCallback(
    (language: LanguageCode, value: string, immediate = false) => {
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
      scheduleTranslation(language, value, immediate);
    },
    [scheduleTranslation],
  );

  useEffect(() => clearPending, [clearPending]);

  return {
    spanishText: texts.es,
    englishText: texts.en,
    sourceLanguage,
    targetLanguage: createDirection(sourceLanguage).targetLanguage,
    status,
    message,
    editSpanish: (value: string, immediate = false) =>
      editPanel('es', value, immediate),
    editEnglish: (value: string, immediate = false) =>
      editPanel('en', value, immediate),
    setStatus,
    setMessage,
  };
};
