import {
  EXPRESSION_MODES,
  type ExpressionBreakdown,
  type ExpressionMode,
  type IntentDetectionResult,
  type LanguageCode,
  type TranslationPresetId,
} from '@eb-packages/flowtranslate-core';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquareText,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpressionBreakdownDetails } from './ExpressionBreakdownDetails';
import { TranslationActions } from './TranslationActions';
import { TranslationPresetControl } from './TranslationPresetControl';

type ExpressionWorkspaceStatus =
  | 'idle'
  | 'typing'
  | 'translating'
  | 'copied'
  | 'error'
  | 'offline'
  | 'quota'
  | 'auth';

type ExpressionWorkspaceProps = {
  inputText: string;
  resultText: string;
  mode: ExpressionMode;
  modeDetection: IntentDetectionResult;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  presetId: TranslationPresetId;
  breakdown: ExpressionBreakdown | null;
  breakdownStatus?: 'idle' | 'enriching' | 'ready' | 'error';
  translationRecordId?: string;
  status: ExpressionWorkspaceStatus;
  canTranslate: boolean;
  translateDisabledReason: string;
  copiedInput: boolean;
  copiedResult: boolean;
  canListen: boolean;
  speakingLanguage: LanguageCode | null;
  canDictate: boolean;
  dictatingLanguage: LanguageCode | null;
  dictationUnavailableReason: string;
  statusText?: string;
  onInputChange: (value: string) => void;
  onCopyInput: () => void;
  onCopyResult: () => void;
  onListenInput: () => void;
  onListenResult: () => void;
  onDictateInput: () => void;
  onTranslate: () => void;
  onSelectMode: (mode: ExpressionMode) => void;
  onSelectPreset: (presetId: TranslationPresetId) => void;
  onRequestBreakdown: () => void;
  onTranslateToSpanish: () => void;
};

const modeDescriptions: Record<ExpressionMode, string> = {
  translate_to_english: 'Tu idea en espanol como respuesta natural',
  improve_english: 'Tu ingles, mas natural y claro',
  translate_to_spanish: 'Entende un mensaje recibido',
};

const modeLabels: Record<ExpressionMode, string> = {
  translate_to_english: 'Responder en ingles',
  improve_english: 'Mejorar ingles',
  translate_to_spanish: 'Entender en espanol',
};

const languageLabels: Record<LanguageCode, string> = {
  es: 'Espanol',
  en: 'Ingles',
};

const confidenceLabel: Record<IntentDetectionResult['confidence'], string> = {
  high: 'alta confianza',
  medium: 'confianza media',
  low: 'necesita confirmacion',
};

const modeTone: Record<ExpressionMode, string> = {
  translate_to_english: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  improve_english: 'border-sky-200 bg-sky-50 text-sky-900',
  translate_to_spanish: 'border-amber-200 bg-amber-50 text-amber-900',
};

const resultPlaceholder = (mode: ExpressionMode) => {
  if (mode === 'translate_to_spanish') {
    return 'Vas a ver el mensaje en espanol claro, con una respuesta que puedas preparar despues.';
  }

  if (mode === 'improve_english') {
    return 'Vas a recibir una version mas natural, clara y lista para copiar.';
  }

  return 'Vas a recibir una respuesta en ingles lista para copiar, con tono natural y desglose opcional.';
};

const detectionCopy = (
  mode: ExpressionMode,
  detection: IntentDetectionResult,
) => {
  const label = modeLabels[mode];
  if (!detection.automatic) return `Modo: ${label}`;
  return `Detectamos ${label.toLowerCase()} con ${confidenceLabel[detection.confidence]}`;
};

export const ExpressionWorkspace = ({
  inputText,
  resultText,
  mode,
  modeDetection,
  sourceLanguage,
  targetLanguage,
  presetId,
  breakdown,
  breakdownStatus = 'idle',
  translationRecordId = '',
  status,
  canTranslate,
  translateDisabledReason,
  copiedInput,
  copiedResult,
  canListen,
  speakingLanguage,
  canDictate,
  dictatingLanguage,
  dictationUnavailableReason,
  statusText,
  onInputChange,
  onCopyInput,
  onCopyResult,
  onListenInput,
  onListenResult,
  onDictateInput,
  onTranslate,
  onSelectMode,
  onSelectPreset,
  onRequestBreakdown,
  onTranslateToSpanish,
}: ExpressionWorkspaceProps) => {
  const isTranslating = status === 'translating';
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isMobileResultOpen, setIsMobileResultOpen] = useState(false);
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousBreakdownKeyRef = useRef('');
  const previousResultTextRef = useRef('');
  const requestedBreakdownKeyRef = useRef('');
  const breakdownKey = translationRecordId || resultText.trim();
  const trimmedInputText = inputText.trim();
  const trimmedResultText = resultText.trim();
  const hasResult = Boolean(trimmedResultText);
  const shouldShowMobileResultSheet = isTranslating || hasResult;

  useEffect(() => {
    if (!trimmedResultText) {
      previousResultTextRef.current = '';
      setIsMobileResultOpen(false);
      return;
    }

    if (previousResultTextRef.current !== trimmedResultText) {
      previousResultTextRef.current = trimmedResultText;
      setIsMobileResultOpen(true);
    }
  }, [trimmedResultText]);

  useEffect(() => {
    if (status === 'typing') setIsMobileResultOpen(false);
  }, [status]);

  useEffect(() => {
    const inputElement = inputTextareaRef.current;
    if (!inputElement) return;

    inputElement.style.minHeight = '0px';
    inputElement.style.minHeight = `${Math.max(144, inputElement.scrollHeight)}px`;
  }, [inputText]);

  useEffect(() => {
    if (!breakdownKey) return;

    const previousKey = previousBreakdownKeyRef.current;
    if (previousKey && previousKey !== breakdownKey) {
      setIsBreakdownOpen(false);
      requestedBreakdownKeyRef.current = '';
    }

    previousBreakdownKeyRef.current = breakdownKey;
  }, [breakdownKey]);

  const requestCurrentBreakdown = useCallback(() => {
    if (!translationRecordId || !resultText.trim() || isTranslating) return;
    if (breakdownStatus === 'enriching') return;
    if (requestedBreakdownKeyRef.current === translationRecordId) return;

    requestedBreakdownKeyRef.current = translationRecordId;
    onRequestBreakdown();
  }, [
    breakdownStatus,
    isTranslating,
    onRequestBreakdown,
    resultText,
    translationRecordId,
  ]);

  useEffect(() => {
    if (!isBreakdownOpen) return;
    requestCurrentBreakdown();
  }, [isBreakdownOpen, requestCurrentBreakdown]);

  const handleBreakdownOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsBreakdownOpen(nextOpen);

      if (!nextOpen) {
        requestedBreakdownKeyRef.current = '';
        return;
      }

      requestCurrentBreakdown();
    },
    [requestCurrentBreakdown],
  );

  return (
    <section className='grid w-full min-w-0 max-w-full grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-4'>
      <div className='flex min-h-[360px] min-w-0 max-w-full flex-col border border-slate-200 bg-white sm:min-h-[420px]'>
        <div className='border-b border-slate-100 px-3 py-3 sm:px-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-base font-black text-slate-950'>Mensaje o idea</h2>
              <p className='mt-1 break-words text-xs font-semibold uppercase tracking-normal text-slate-500'>
                Origen en {languageLabels[sourceLanguage]}
              </p>
            </div>
            <TranslationActions
              text={inputText}
              copied={copiedInput}
              canListen={canListen}
              isSpeaking={speakingLanguage === sourceLanguage}
              canDictate={canDictate}
              isDictating={dictatingLanguage === sourceLanguage}
              dictationUnavailableReason={dictationUnavailableReason}
              onCopy={onCopyInput}
              onListen={onListenInput}
              onDictate={onDictateInput}
            />
          </div>

          <div className='mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2'>
            {EXPRESSION_MODES.map((item) => (
              <button
                key={item}
                type='button'
                onClick={() => onSelectMode(item)}
                aria-pressed={mode === item}
                className={`min-h-12 rounded-md border px-2 py-2 text-left transition-colors sm:min-h-16 sm:px-3 ${
                  mode === item
                    ? modeTone[item]
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className='block text-xs font-black leading-tight sm:text-sm'>
                  {modeLabels[item]}
                </span>
                <span className='mt-1 hidden break-words text-xs font-semibold opacity-75 sm:block'>
                  {modeDescriptions[item]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={inputTextareaRef}
          value={inputText}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              if (canTranslate) onTranslate();
            }
          }}
          placeholder='Pega un chat de trabajo o escribi la idea que queres responder en ingles...'
          className='min-h-36 w-full min-w-0 flex-1 resize-none overflow-hidden break-words bg-transparent p-4 text-lg leading-relaxed text-slate-900 outline-none [overflow-wrap:anywhere] placeholder:text-slate-300 sm:p-5 sm:text-xl'
          spellCheck
          aria-label='Mensaje o idea'
        />

        <div className='flex min-h-14 flex-col items-stretch justify-between gap-3 border-t border-slate-100 px-3 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:px-4'>
          <span className='min-w-0 break-words font-semibold'>
            {statusText || detectionCopy(mode, modeDetection)}
          </span>
          <button
            type='button'
            onClick={onTranslate}
            disabled={!canTranslate}
            className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-black transition-colors sm:w-auto ${
              canTranslate
                ? 'bg-slate-950 text-white hover:bg-slate-800'
                : 'bg-slate-100 text-slate-400'
            }`}
            title={canTranslate ? 'Generar respuesta' : translateDisabledReason}
          >
            {isTranslating ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <Sparkles size={16} />
            )}
            {isTranslating ? 'Generando' : 'Responder'}
          </button>
        </div>
      </div>

      <div className='hidden min-h-[320px] min-w-0 max-w-full flex-col border border-slate-200 bg-white sm:min-h-[420px] lg:flex'>
        <div className='flex flex-col gap-3 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5'>
          <div className='min-w-0'>
            <h2 className='text-base font-black text-slate-950'>Respuesta</h2>
            <p className='mt-1 text-xs font-semibold uppercase tracking-normal text-slate-500'>
              Salida en {languageLabels[targetLanguage]}
            </p>
          </div>
          <div className='flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end'>
            <TranslationPresetControl
              value={presetId}
              onChange={onSelectPreset}
            />
            <div className='flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end'>
              <button
                type='button'
                onClick={onTranslateToSpanish}
                disabled={!trimmedInputText || isTranslating}
                className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors ${
                  trimmedInputText && !isTranslating
                    ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border-slate-100 bg-slate-50 text-slate-300'
                }`}
                title='Entender un mensaje en ingles'
              >
                <MessageSquareText size={16} />
                Espanol
              </button>
              <TranslationActions
                text={resultText}
                copied={copiedResult}
                canListen={canListen}
                isSpeaking={speakingLanguage === targetLanguage}
                canDictate={false}
                showDictate={false}
                isDictating={false}
                dictationUnavailableReason={dictationUnavailableReason}
                onCopy={onCopyResult}
                onListen={onListenResult}
                onDictate={() => undefined}
              />
            </div>
          </div>
        </div>

        <div className='min-h-40 min-w-0 max-w-full flex-1 p-3 sm:p-5 lg:min-h-[14rem]'>
          {hasResult ? (
            <p className='max-w-full break-words text-xl font-black leading-[1.16] text-slate-950 [overflow-wrap:anywhere] sm:text-3xl xl:text-[2.125rem]'>
              {resultText}
            </p>
          ) : (
            <div className='flex h-full min-h-36 items-center rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500'>
              {resultPlaceholder(mode)}
            </div>
          )}
        </div>

        <ExpressionBreakdownDetails
          key={breakdownKey || 'empty-breakdown'}
          breakdown={breakdown}
          emptyDescription={
            hasResult
              ? 'Abrilo para preparar un desglose completo.'
              : undefined
          }
          isEnriching={breakdownStatus === 'enriching'}
          hasEnrichmentError={breakdownStatus === 'error'}
          open={isBreakdownOpen}
          onOpenChange={handleBreakdownOpenChange}
        />
      </div>

      {shouldShowMobileResultSheet ? (
        <div
          className='fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-lg lg:hidden'
          aria-live='polite'
        >
          <div className='mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3'>
            <button
              type='button'
              onClick={() => setIsMobileResultOpen((current) => !current)}
              className='flex min-h-10 w-full items-center justify-between gap-3 text-left text-slate-700'
              aria-expanded={isMobileResultOpen}
            >
              <span className='min-w-0'>
                <span className='block text-xs font-black uppercase tracking-normal text-slate-400'>
                  {isTranslating ? 'Generando' : 'Respuesta lista'}
                </span>
                <span className='block truncate text-base font-black text-slate-950'>
                  {isTranslating
                    ? 'Preparando tu respuesta en ingles...'
                    : trimmedResultText}
                </span>
              </span>
              {isMobileResultOpen ? (
                <ChevronDown size={18} className='shrink-0 text-slate-500' />
              ) : (
                <ChevronUp size={18} className='shrink-0 text-slate-500' />
              )}
            </button>

            {isMobileResultOpen ? (
              <div className='max-h-[56dvh] overflow-y-auto pb-2 pt-4'>
                <div className='flex min-w-0 flex-col gap-4'>
                  {isTranslating ? (
                    <div className='flex min-h-24 items-center justify-center gap-2 rounded-md bg-slate-50 text-sm font-bold text-slate-500'>
                      <Loader2 size={17} className='animate-spin' />
                      Generando respuesta...
                    </div>
                  ) : (
                    <p className='max-w-full break-words text-2xl font-black leading-[1.12] text-slate-950 [overflow-wrap:anywhere]'>
                      {resultText}
                    </p>
                  )}

                  <div className='flex min-w-0 items-center gap-2 border-t border-slate-100 pt-3'>
                    <button
                      type='button'
                      onClick={onCopyResult}
                      disabled={!hasResult}
                      className='inline-flex h-10 flex-1 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400'
                    >
                      {copiedResult ? 'Copiado' : 'Copiar'}
                    </button>
                    {canListen ? (
                      <button
                        type='button'
                        onClick={onListenResult}
                        disabled={!hasResult}
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          hasResult
                            ? 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950'
                            : 'border-slate-100 text-slate-300'
                        }`}
                        title={speakingLanguage === targetLanguage ? 'Detener audio' : 'Escuchar texto'}
                        aria-label={speakingLanguage === targetLanguage ? 'Detener audio' : 'Escuchar texto'}
                      >
                        {speakingLanguage === targetLanguage ? (
                          <Square size={16} />
                        ) : (
                          <Volume2 size={17} />
                        )}
                      </button>
                    ) : null}
                    <button
                      type='button'
                      onClick={onTranslateToSpanish}
                      disabled={!trimmedInputText || isTranslating}
                      className={`inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-black transition-colors ${
                        trimmedInputText && !isTranslating
                          ? 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950'
                          : 'border-slate-100 text-slate-300'
                      }`}
                    >
                      ES
                    </button>
                  </div>
                </div>
              </div>
            ) : hasResult ? (
              <div className='flex min-w-0 items-center justify-between gap-2 pb-2 pt-2'>
                <p className='min-w-0 flex-1 truncate text-sm font-semibold text-slate-600'>
                  {trimmedResultText}
                </p>
                <button
                  type='button'
                  onClick={onCopyResult}
                  disabled={!hasResult}
                  className='inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400'
                >
                  {copiedResult ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
