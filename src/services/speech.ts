import type { LanguageCode } from '@eb-packages/flowtranslate-core';

type SpeechRecognitionResultEventLike = Event & {
  results: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export type DictationSession = Pick<SpeechRecognitionLike, 'stop' | 'abort'>;

export const speechLanguageCode = (language: LanguageCode) =>
  language === 'es' ? 'es-ES' : 'en-US';

const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

export const canUseSpeechSynthesis = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

export const canUseSpeechRecognition = () =>
  Boolean(getSpeechRecognitionConstructor());

export const stopSpeaking = () => {
  if (canUseSpeechSynthesis()) window.speechSynthesis.cancel();
};

const selectVoice = (language: LanguageCode) => {
  const languagePrefix = language === 'es' ? 'es' : 'en';
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) =>
      voice.lang.toLocaleLowerCase().startsWith(languagePrefix),
    ) || null
  );
};

export const speakText = ({
  text,
  language,
  onEnd,
  onError,
}: {
  text: string;
  language: LanguageCode;
  onEnd: () => void;
  onError: (message: string) => void;
}) => {
  const trimmed = text.trim();
  if (!trimmed || !canUseSpeechSynthesis()) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = speechLanguageCode(language);
  utterance.voice = selectVoice(language);
  utterance.onend = onEnd;
  utterance.onerror = () => {
    onError('La reproduccion de audio no esta disponible en este navegador.');
  };

  window.speechSynthesis.speak(utterance);
  return true;
};

const dictationErrorMessage = (error?: string) => {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'El permiso del microfono fue rechazado.';
  }
  if (error === 'no-speech') return 'No se detecto voz.';
  if (error === 'audio-capture') return 'No encontramos un microfono.';
  return 'El dictado por microfono se detuvo inesperadamente.';
};

export const startDictation = ({
  language,
  onResult,
  onEnd,
  onError,
}: {
  language: LanguageCode;
  onResult: (transcript: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}) => {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = speechLanguageCode(language);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .flatMap((result) => Array.from(result))
      .map((alternative) => alternative.transcript || '')
      .join(' ')
      .trim();

    if (transcript) onResult(transcript);
  };
  recognition.onerror = (event) => {
    onError(dictationErrorMessage(event.error));
  };
  recognition.onend = onEnd;

  try {
    recognition.start();
  } catch {
    onError('No pudimos iniciar el dictado por microfono.');
    return null;
  }

  return recognition;
};
