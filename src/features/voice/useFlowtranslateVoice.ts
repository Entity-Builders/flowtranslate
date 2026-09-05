import type { LanguageCode } from '@entity-builders/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { analytics } from '../../services/analytics';
import {
  canUseSpeechRecognition,
  canUseSpeechSynthesis,
  type DictationSession,
  speakText,
  startDictation,
  stopSpeaking,
} from '../../services/speech';

type UseFlowtranslateVoiceParams = {
  inputText: string;
  sourceLanguage: LanguageCode;
  onInputChange: (value: string) => void;
};

const appendRecognizedText = (currentText: string, transcript: string) => {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return currentText;
  if (!currentText.trim()) return trimmedTranscript;
  return `${currentText}${/\s$/.test(currentText) ? '' : ' '}${trimmedTranscript}`;
};

export const useFlowtranslateVoice = ({
  inputText,
  sourceLanguage,
  onInputChange,
}: UseFlowtranslateVoiceParams) => {
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [dictationAvailable, setDictationAvailable] = useState(false);
  const [speakingLanguage, setSpeakingLanguage] = useState<LanguageCode | null>(
    null,
  );
  const [dictatingLanguage, setDictatingLanguage] =
    useState<LanguageCode | null>(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const dictationRef = useRef<DictationSession | null>(null);

  useEffect(() => {
    setSpeechAvailable(canUseSpeechSynthesis());
    setDictationAvailable(canUseSpeechRecognition());

    return () => {
      stopSpeaking();
      dictationRef.current?.abort();
    };
  }, []);

  const listenPanel = useCallback((language: LanguageCode, text: string) => {
    if (speakingLanguage === language) {
      stopSpeaking();
      setSpeakingLanguage(null);
      return;
    }

    const started = speakText({
      text,
      language,
      onEnd: () => {
        setSpeakingLanguage((current) => (current === language ? null : current));
      },
      onError: (nextMessage) => {
        setVoiceMessage(nextMessage);
        setSpeakingLanguage((current) => (current === language ? null : current));
      },
    });

    if (!started) {
      setVoiceMessage('La reproduccion de audio no esta disponible en este navegador.');
      return;
    }

    setVoiceMessage('');
    setSpeakingLanguage(language);
    analytics.track('translation_audio_started', {
      language,
      text_length: text.trim().length,
    });
  }, [speakingLanguage]);

  const stopCurrentDictation = useCallback(() => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setDictatingLanguage(null);
  }, []);

  const dictateInput = useCallback(() => {
    const language = sourceLanguage;
    if (dictatingLanguage === language) {
      stopCurrentDictation();
      return;
    }

    if (!dictationAvailable) {
      setVoiceMessage('El dictado por microfono no esta disponible en este navegador.');
      return;
    }

    dictationRef.current?.abort();
    const baseText = inputText;

    const session = startDictation({
      language,
      onResult: (transcript) => {
        const nextText = appendRecognizedText(baseText, transcript);
        onInputChange(nextText);

        setVoiceMessage('Dictado agregado al mensaje.');
        analytics.track('translation_dictation_completed', {
          language,
          text_length: transcript.trim().length,
        });
      },
      onEnd: () => {
        dictationRef.current = null;
        setDictatingLanguage((current) => (current === language ? null : current));
      },
      onError: (nextMessage) => {
        setVoiceMessage(nextMessage);
        setDictatingLanguage((current) => (current === language ? null : current));
        analytics.track('translation_dictation_failed', { language });
      },
    });

    if (!session) {
      setVoiceMessage('El dictado por microfono no esta disponible en este navegador.');
      return;
    }

    dictationRef.current = session;
    setDictatingLanguage(language);
    setVoiceMessage('Escuchando con el servicio de microfono del navegador...');
    analytics.track('translation_dictation_started', { language });
  }, [
    dictatingLanguage,
    dictationAvailable,
    inputText,
    onInputChange,
    sourceLanguage,
    stopCurrentDictation,
  ]);

  return {
    dictateInput,
    dictatingLanguage,
    dictationAvailable,
    dictationUnavailableReason:
      'El dictado por microfono no esta disponible en este navegador.',
    listenPanel,
    speakingLanguage,
    speechAvailable,
    voiceMessage,
  };
};
