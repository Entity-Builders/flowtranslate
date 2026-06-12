import {
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
  onSelectPreset: (presetId: TranslationPresetId) => void;
  onRequestBreakdown: () => void;
  onTranslateToSpanish: () => void;
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
  if (!detection.automatic) return 'Listo para responder';
  if (mode === 'translate_to_spanish') {
    return `Detectamos ingles para ver en espanol con ${confidenceLabel[detection.confidence]}`;
  }
  if (mode === 'improve_english') {
    return `Detectamos ingles para dejarlo mas natural con ${confidenceLabel[detection.confidence]}`;
  }
  return `Detectamos espanol para preparar una respuesta en ingles con ${confidenceLabel[detection.confidence]}`;
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
    <section className='grid w-full min-w-0 max-w-full grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'>
      <div className='flex min-h-[360px] min-w-0 max-w-full flex-col border border-slate-200 bg-white shadow-sm sm:min-h-[420px]'>
        <div className='border-b border-slate-100 px-3 py-3 sm:px-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-sm font-black text-slate-950 sm:text-base'>Mensaje</h2>
              <p className='mt-0.5 break-words text-[11px] font-bold uppercase tracking-normal text-slate-400'>
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

          <div className='mt-3 flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
            <p className='px-1 text-xs font-semibold leading-5 text-slate-500'>
              Escribi como te salga. Flowtranslate detecta si tiene que responder,
              mejorar o traducir.
            </p>
            <TranslationPresetControl
              value={presetId}
              onChange={onSelectPreset}
            />
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
          className='min-h-36 w-full min-w-0 flex-1 resize-none overflow-hidden break-words bg-transparent p-4 text-lg leading-relaxed text-slate-900 outline-none [overflow-wrap:anywhere] placeholder:text-slate-300 sm:p-4 sm:text-xl'
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

      <div className='hidden min-h-[320px] min-w-0 max-w-full flex-col border border-slate-200 bg-white shadow-sm sm:min-h-[420px] lg:flex'>
        <div className='flex flex-col gap-3 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4'>
          <div className='min-w-0'>
            <h2 className='text-sm font-black text-slate-950 sm:text-base'>Respuesta</h2>
            <p className='mt-0.5 text-[11px] font-bold uppercase tracking-normal text-slate-400'>
              Salida en {languageLabels[targetLanguage]}
            </p>
          </div>
          <div className='flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end'>
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
                title='Ver el mensaje en espanol'
              >
                <MessageSquareText size={16} />
                Ver en espanol
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

        <div className='min-h-40 min-w-0 max-w-full flex-1 p-4 lg:min-h-[14rem]'>
          {hasResult ? (
            <p className='max-w-4xl break-words text-xl font-semibold leading-[1.34] text-slate-950 [overflow-wrap:anywhere] sm:text-2xl xl:text-[1.75rem]'>
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
                    <p className='max-w-full break-words text-xl font-semibold leading-[1.3] text-slate-950 [overflow-wrap:anywhere]'>
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
