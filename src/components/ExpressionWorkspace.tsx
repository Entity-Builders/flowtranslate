import {
  type ExpressionBreakdown,
  type ExpressionMode,
  type IntentDetectionResult,
  type LanguageCode,
  type TranslationPresetId,
  type GrammarInsight,
  type UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Coffee,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpressionBreakdownDetails } from './ExpressionBreakdownDetails';
import { TranslationPresetControl } from './TranslationPresetControl';
import { SuggestionChips, type SuggestionChip } from './SuggestionChips';
import { GrammarInsightCard } from './GrammarInsightCard';

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
  grammarInsight?: GrammarInsight | null;
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
  quotaUsage?: UsageSnapshot | null;
  quotaUpgradeLabel?: string;
  quotaUpgradeBusy?: boolean;
  hasSeenResponderPromise: boolean;
  onInputChange: (value: string) => void;
  onCopyInput: () => void;
  onCopyResult: () => void;
  onListenInput: () => void;
  onListenResult: () => void;
  onDictateInput: () => void;
  onTranslate: () => void;
  onSelectPreset: (presetId: TranslationPresetId) => void;
  onRequestBreakdown: () => void;
  onRequestStudy?: () => void;
  onTranslateToSpanish: () => void;
  onQuotaUpgrade?: () => void;
  onQuotaSupport?: () => void;
};

const responsePlaceholder = (mode: ExpressionMode) => {
  if (mode === 'translate_to_spanish') {
    return 'Tu version en espanol va a aparecer aca, clara y facil de entender.';
  }

  if (mode === 'improve_english') {
    return 'Tu ingles mejorado va a aparecer aca, listo para copiar.';
  }

  return 'Tu respuesta en ingles va a aparecer aca, lista para copiar.';
};

const zeroStateSuggestions = [
  {
    label: 'Responder Slack',
    prompt:
      'Hola equipo, queria saber si hay novedades. Quedo atento a cualquier update.',
  },
  {
    label: 'Avisar demora a cliente',
    prompt:
      'El reporte se demora hasta manana. Ya estamos revisando los datos y te mando una version clara apenas este lista.',
  },
  {
    label: 'Contestar LinkedIn',
    prompt:
      'Gracias por escribirme. Me interesa la propuesta y podemos coordinar una llamada corta la semana que viene.',
  },
] satisfies SuggestionChip[];

const translationLoadingMessages = [
  'Analizando contexto',
  'Ajustando tono',
  'Refinando vocabulario',
];

const formatQuotaResetDate = (resetAt?: string) => {
  if (!resetAt) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
  }).format(new Date(resetAt));
};

const QuotaExhaustedState = ({
  usage,
  compact = false,
  upgradeLabel = 'Pasar a Pro',
  upgradeBusy = false,
  onUpgrade,
  onSupport,
}: {
  usage?: UsageSnapshot | null;
  compact?: boolean;
  upgradeLabel?: string;
  upgradeBusy?: boolean;
  onUpgrade?: () => void;
  onSupport?: () => void;
}) => {
  const resetLabel = formatQuotaResetDate(usage?.resetAt);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <div className='absolute inset-x-0 top-0 h-1 overflow-hidden bg-amber-100'>
        <div className='h-full w-1/2 animate-pulse bg-emerald-500' />
      </div>
      <div className='flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'>
          <div className='mb-4 flex items-center gap-3'>
            <div className='relative flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-amber-700 shadow-sm ring-1 ring-amber-200'>
              <Sparkles size={22} className='motion-safe:animate-bounce' />
            </div>
            <div className='min-w-0'>
              <p className='text-xs font-black uppercase tracking-normal text-amber-700'>
                Limite de prueba alcanzado
              </p>
              <h3 className='mt-1 text-2xl font-black leading-tight text-slate-950'>
                Segui respondiendo hoy
              </h3>
            </div>
          </div>
          <p className='max-w-2xl text-sm font-semibold leading-6 text-amber-900 sm:text-base'>
            Llegaste al limite mensual de IA para esta prueba. Tu texto sigue
            aca; podes pasar a Pro para continuar ahora o apoyar el proyecto con
            un cafecito si FlowTranslate te salvo una respuesta.
          </p>
          {resetLabel ? (
            <p className='mt-3 text-xs font-bold text-amber-800'>
              Tu cuota se renueva el {resetLabel}.
            </p>
          ) : null}
        </div>

        <div className='flex shrink-0 flex-col gap-2 sm:min-w-52'>
          <button
            type='button'
            onClick={onUpgrade}
            disabled={!onUpgrade || upgradeBusy}
            className='inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300'
          >
            {upgradeBusy ? <Loader2 size={16} className='animate-spin' /> : null}
            {upgradeLabel}
            {!upgradeBusy ? <ArrowRight size={16} /> : null}
          </button>
          <button
            type='button'
            onClick={onSupport}
            disabled={!onSupport}
            className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-4 text-sm font-black text-amber-900 transition-colors hover:bg-amber-100 disabled:text-amber-300'
          >
            <Coffee size={16} />
            Invitar un cafecito
          </button>
        </div>
      </div>
    </div>
  );
};

const statusTone = (status: ExpressionWorkspaceStatus) => {
  if (status === 'error' || status === 'auth') {
    return {
      dot: 'text-rose-600',
      text: 'text-rose-700',
      surface: 'bg-rose-50 text-rose-700 ring-rose-100',
    };
  }

  if (status === 'quota') {
    return {
      dot: 'text-amber-600',
      text: 'text-amber-800',
      surface: 'bg-amber-50 text-amber-800 ring-amber-100',
    };
  }

  if (status === 'offline') {
    return {
      dot: 'text-slate-500',
      text: 'text-slate-600',
      surface: 'bg-slate-100 text-slate-700 ring-slate-200',
    };
  }

  return {
    dot: 'text-emerald-600',
    text: 'text-emerald-700',
    surface: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  };
};

export const ExpressionWorkspace = (props: ExpressionWorkspaceProps) => {
  const {
    inputText,
    resultText,
    mode,
    sourceLanguage,
    targetLanguage,
    presetId,
    breakdown,
    breakdownStatus = 'idle',
    grammarInsight,
    translationRecordId = '',
    status,
    canTranslate,
    translateDisabledReason,
    copiedResult,
    canListen,
    speakingLanguage,
    canDictate,
    dictatingLanguage,
    dictationUnavailableReason,
    statusText,
    quotaUsage,
    quotaUpgradeLabel,
    quotaUpgradeBusy = false,
    hasSeenResponderPromise,
    onInputChange,
    onCopyResult,
    onListenInput,
    onListenResult,
    onDictateInput,
    onTranslate,
    onSelectPreset,
    onRequestBreakdown,
    onRequestStudy,
    onTranslateToSpanish,
    onQuotaUpgrade,
    onQuotaSupport,
  } = props;
  const isTranslating = status === 'translating';
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isMobileResultOpen, setIsMobileResultOpen] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousBreakdownKeyRef = useRef('');
  const previousResultTextRef = useRef('');
  const requestedBreakdownKeyRef = useRef('');
  const breakdownKey = translationRecordId || resultText.trim();
  const trimmedInputText = inputText.trim();
  const trimmedResultText = resultText.trim();
  const hasResult = Boolean(trimmedResultText);
  const hasAttentionState =
    status === 'error' ||
    status === 'auth' ||
    status === 'quota' ||
    status === 'offline';
  const shouldShowMobileResultSheet = isTranslating || hasResult || hasAttentionState;
  const shouldEmphasizeResponse = hasResult || isTranslating || hasAttentionState;
  const shouldShowLaunchPromise =
    !hasSeenResponderPromise &&
    !trimmedInputText &&
    !hasResult &&
    !isTranslating &&
    !hasAttentionState;
  const tone = statusTone(status);
  const isSpanishTranslationMode = mode === 'translate_to_spanish';
  const canOfferTranslateToSpanish =
    Boolean(trimmedInputText) &&
    sourceLanguage === 'en' &&
    !isSpanishTranslationMode;
  const primaryActionLabel = isTranslating
    ? 'Generando'
    : isSpanishTranslationMode
      ? 'Traducir'
      : 'Responder';
  const loadingStatusText =
    translationLoadingMessages[loadingMessageIndex] ||
    translationLoadingMessages[0];
  const readyText = isTranslating
    ? loadingStatusText
    : hasAttentionState
      ? statusText || 'Revisa el estado para continuar'
      : hasResult
        ? statusText || 'Listo para mandar'
        : 'Listo para mandar';
  const responseLanguageLabel = targetLanguage === 'en' ? 'ingles' : 'espanol';

  const handleSuggestionSelect = (suggestion: string) => {
    onInputChange(suggestion);
    setTimeout(() => {
      onTranslate();
    }, 50);
  };

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
    if (!isTranslating) {
      setLoadingMessageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((current) =>
        (current + 1) % translationLoadingMessages.length,
      );
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [isTranslating]);

  useEffect(() => {
    const inputElement = inputTextareaRef.current;
    if (!inputElement) return;

    inputElement.style.minHeight = '0px';
    inputElement.style.minHeight = `${Math.max(132, inputElement.scrollHeight)}px`;
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
    <section className='mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 py-2 sm:gap-6 sm:py-5'>
      {shouldShowLaunchPromise ? (
        <div className='px-1 sm:px-2'>
          <h2 className='text-3xl font-black leading-tight tracking-normal text-slate-950 sm:text-4xl'>
            Tu respuesta en ingles para trabajo, lista para mandar.
          </h2>
          <p className='mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base'>
            Pega un Slack, DM, email o mensaje para cliente. Pensalo en espanol;
            mandalo en ingles natural.
          </p>
          <p className='mt-2 max-w-2xl text-xs font-bold leading-5 text-slate-500 sm:text-sm'>
            Probalo sin cuenta. Conecta despues para guardar historial y
            desbloquear Learning personal.
          </p>
        </div>
      ) : null}

      <div className='overflow-hidden rounded-lg bg-white shadow-[0_18px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80'>
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
          className='min-h-[132px] w-full min-w-0 resize-none overflow-hidden break-words bg-transparent px-5 py-5 text-lg leading-relaxed text-slate-950 outline-none [overflow-wrap:anywhere] placeholder:text-slate-300 sm:px-7 sm:py-6 sm:text-xl'
          spellCheck
          aria-label='Mensaje o idea'
        />

        <div className='flex min-h-16 flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            {canListen ? (
              <button
                type='button'
                onClick={onListenInput}
                disabled={!trimmedInputText}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                  trimmedInputText
                    ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                    : 'text-slate-300'
                }`}
                aria-label={speakingLanguage === sourceLanguage ? 'Detener audio' : 'Escuchar mensaje'}
                title={speakingLanguage === sourceLanguage ? 'Detener audio' : 'Escuchar mensaje'}
              >
                {speakingLanguage === sourceLanguage ? (
                  <Square size={16} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
            ) : null}

            <button
              type='button'
              onClick={onDictateInput}
              disabled={!canDictate}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                canDictate
                  ? dictatingLanguage
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                  : 'text-slate-300'
              }`}
              aria-label={
                canDictate
                  ? dictatingLanguage
                    ? 'Detener dictado'
                    : 'Iniciar dictado'
                  : 'Dictado por microfono no disponible'
              }
              title={canDictate ? 'Dictado por microfono' : dictationUnavailableReason}
            >
              {canDictate ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            <TranslationPresetControl
              value={presetId}
              onChange={onSelectPreset}
            />

            {canOfferTranslateToSpanish ? (
              <button
                type='button'
                onClick={onTranslateToSpanish}
                disabled={isTranslating}
                className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors ${
                  !isTranslating
                    ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                    : 'text-slate-300'
                }`}
                aria-label='Pasar a espanol'
                title='Pasar a espanol'
              >
                <Languages size={16} />
                Pasar a espanol
              </button>
            ) : null}
          </div>

          <button
            type='button'
            onClick={onTranslate}
            disabled={!canTranslate}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition-colors sm:min-w-32 ${
              canTranslate
                ? 'bg-slate-950 text-white hover:bg-slate-800'
                : 'bg-slate-100 text-slate-400'
            }`}
            title={
              canTranslate
                ? isSpanishTranslationMode
                  ? 'Generar en espanol'
                  : 'Generar respuesta'
                : translateDisabledReason
            }
          >
            {isTranslating ? (
              <Loader2 size={17} className='animate-spin' />
            ) : (
              <Send size={17} />
            )}
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {!inputText.trim() && (
        <SuggestionChips
          suggestions={zeroStateSuggestions}
          onSelect={handleSuggestionSelect}
          disabled={isTranslating}
        />
      )}

      <div
        className={`hidden rounded-lg lg:block ${
          shouldEmphasizeResponse
            ? 'bg-white px-5 py-5 shadow-[0_18px_80px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 lg:px-8 lg:py-7'
            : 'px-2 py-1'
        }`}
      >
        {shouldEmphasizeResponse ? (
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className={`inline-flex items-center gap-2 text-sm font-black ${tone.text}`}>
                {isTranslating ? (
                  <Loader2 size={17} className='animate-spin' />
                ) : (
                  <CheckCircle2 size={17} className={tone.dot} />
                )}
                {readyText}
              </div>
              <p className='mt-1 text-xs font-bold uppercase tracking-normal text-slate-400'>
                Respuesta en {responseLanguageLabel}
              </p>
            </div>

            <div className='flex shrink-0 flex-wrap items-center gap-2'>
              {canListen ? (
                <button
                  type='button'
                  onClick={onListenResult}
                  disabled={!hasResult}
                  className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors ${
                    hasResult
                      ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                      : 'text-slate-300'
                  }`}
                  title={speakingLanguage === targetLanguage ? 'Detener audio' : 'Audio'}
                  aria-label={speakingLanguage === targetLanguage ? 'Detener audio' : 'Audio'}
                >
                  {speakingLanguage === targetLanguage ? (
                    <Square size={16} />
                  ) : (
                    <Volume2 size={17} />
                  )}
                  Audio
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={shouldEmphasizeResponse ? 'min-h-36 pt-7' : 'pt-1'}>
          {hasResult ? (
            <p className='max-w-4xl break-words text-3xl font-semibold leading-[1.18] tracking-normal text-slate-950 [overflow-wrap:anywhere] xl:text-[2.45rem]'>
              {resultText}
            </p>
          ) : status === 'quota' ? (
            <QuotaExhaustedState
              usage={quotaUsage}
              upgradeLabel={quotaUpgradeLabel}
              upgradeBusy={quotaUpgradeBusy}
              onUpgrade={onQuotaUpgrade}
              onSupport={onQuotaSupport}
            />
          ) : isTranslating ? (
            <div className='space-y-5' aria-label='Preparando respuesta'>
              <div className='inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500'>
                <Loader2 size={16} className='animate-spin text-emerald-600' />
                <span>{loadingStatusText}</span>
              </div>
              <div className='max-w-3xl space-y-3' aria-hidden='true'>
                <div className='h-8 w-11/12 animate-pulse rounded-md bg-slate-100' />
                <div className='h-8 w-9/12 animate-pulse rounded-md bg-slate-100' />
                <div className='h-8 w-7/12 animate-pulse rounded-md bg-slate-100' />
              </div>
            </div>
          ) : hasAttentionState ? (
            <div className={`inline-flex rounded-md px-3 py-2 text-sm font-bold ring-1 ${tone.surface}`}>
              {readyText}
            </div>
          ) : (
            <p className='max-w-xl text-sm font-bold leading-6 text-slate-400'>
              {responsePlaceholder(mode)}
            </p>
          )}
        </div>

        {shouldEmphasizeResponse && status !== 'quota' ? (
          <div className='mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <button
            type='button'
            onClick={onCopyResult}
            disabled={!hasResult}
            className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto'
            aria-label={copiedResult ? 'Respuesta copiada' : 'Copiar respuesta'}
            title='Copiar respuesta'
          >
            <Copy size={17} />
            {copiedResult ? 'Copiado' : 'Copiar'}
          </button>
          </div>
        ) : null}

        {shouldEmphasizeResponse && status !== 'quota' ? (
          <div className='mt-5 border-t border-slate-100 pt-1'>
          <ExpressionBreakdownDetails
            key={breakdownKey || 'empty-breakdown'}
            breakdown={breakdown}
            emptyDescription={
              hasResult
                ? 'Abrilo para preparar un desglose completo.'
                : undefined
            }
            withTopBorder={false}
            isEnriching={breakdownStatus === 'enriching'}
            hasEnrichmentError={breakdownStatus === 'error'}
            open={isBreakdownOpen}
            onOpenChange={handleBreakdownOpenChange}
          />
          </div>
        ) : null}

        {grammarInsight && hasResult && !isTranslating && (
          <GrammarInsightCard
            tense={grammarInsight.tense}
            structure={grammarInsight.structure}
            observation={grammarInsight.observation}
            onStudyClick={onRequestStudy}
          />
        )}
      </div>

      {shouldShowMobileResultSheet ? (
        <div
          className='fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white shadow-[0_-18px_55px_rgba(15,23,42,0.12)] lg:hidden'
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
                <span className={`flex items-center gap-1.5 text-xs font-black ${tone.text}`}>
                  {isTranslating ? (
                    <Loader2 size={14} className='animate-spin' />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {isTranslating ? 'Preparando' : hasResult ? 'Listo para mandar' : readyText}
                </span>
                {hasResult ? (
                  <span className='mt-0.5 block text-sm font-bold text-slate-500'>
                    Respuesta en {responseLanguageLabel}
                  </span>
                ) : (
                  <span className='mt-0.5 block truncate text-base font-black text-slate-950'>
                    {readyText}
                  </span>
                )}
              </span>
              {isMobileResultOpen ? (
                <ChevronDown size={18} className='shrink-0 text-slate-500' />
              ) : (
                <ChevronUp size={18} className='shrink-0 text-slate-500' />
              )}
            </button>

            {isMobileResultOpen ? (
              <div className='max-h-[58dvh] overflow-y-auto pb-2 pt-4'>
                <div className='flex min-w-0 flex-col gap-4'>
                  {isTranslating ? (
                    <div
                      className='min-h-28 rounded-md bg-slate-50 p-4'
                      aria-label='Preparando respuesta'
                    >
                      <div className='flex items-center gap-2 text-sm font-bold text-slate-500'>
                        <Loader2 size={18} className='animate-spin text-emerald-600' />
                        <span>{loadingStatusText}</span>
                      </div>
                      <div className='mt-5 space-y-2' aria-hidden='true'>
                        <div className='h-5 w-full animate-pulse rounded-md bg-slate-100' />
                        <div className='h-5 w-10/12 animate-pulse rounded-md bg-slate-100' />
                        <div className='h-5 w-7/12 animate-pulse rounded-md bg-slate-100' />
                      </div>
                    </div>
                  ) : status === 'quota' ? (
                    <QuotaExhaustedState
                      usage={quotaUsage}
                      compact
                      upgradeLabel={quotaUpgradeLabel}
                      upgradeBusy={quotaUpgradeBusy}
                      onUpgrade={onQuotaUpgrade}
                      onSupport={onQuotaSupport}
                    />
                  ) : (
                    <p className='max-w-full break-words text-xl font-semibold leading-[1.28] text-slate-950 [overflow-wrap:anywhere]'>
                      {resultText}
                    </p>
                  )}

                  {status !== 'quota' ? (
                  <div className='flex min-w-0 items-center gap-2 border-t border-slate-100 pt-3'>
                    <button
                      type='button'
                      onClick={onCopyResult}
                      disabled={!hasResult}
                      className='inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400'
                    >
                      <Copy size={16} />
                      {copiedResult ? 'Copiado' : 'Copiar'}
                    </button>
                    {canListen ? (
                      <button
                        type='button'
                        onClick={onListenResult}
                        disabled={!hasResult}
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
                          hasResult
                            ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                            : 'text-slate-300'
                        }`}
                        title={speakingLanguage === targetLanguage ? 'Detener audio' : 'Audio'}
                        aria-label={speakingLanguage === targetLanguage ? 'Detener audio' : 'Audio'}
                      >
                        {speakingLanguage === targetLanguage ? (
                          <Square size={16} />
                        ) : (
                          <Volume2 size={17} />
                        )}
                      </button>
                    ) : null}
                  </div>
                  ) : null}
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
                  className='inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400'
                >
                  {copiedResult ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            ) : null}

            {isMobileResultOpen && grammarInsight && hasResult && !isTranslating && (
              <div className='px-4 pb-4'>
                <GrammarInsightCard
                  tense={grammarInsight.tense}
                  structure={grammarInsight.structure}
                  observation={grammarInsight.observation}
                  onStudyClick={onRequestStudy}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
