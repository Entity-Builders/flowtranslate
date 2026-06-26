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
  BookOpen,
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
  UserRound,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSLATION_INPUT_MAX_CHARS } from '../constants';
import { countTranslationInputCharacters } from '../features/responder/translatorState';
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
  landingContext?: {
    selectedExampleLabel?: string;
    sourceSituation?: string;
    campaignId?: string;
    variantId?: string;
  } | null;
  quotaUsage?: UsageSnapshot | null;
  quotaUpgradeLabel?: string;
  quotaUpgradeBusy?: boolean;
  quotaSupportBusy?: boolean;
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
  onOpenAccount?: () => void;
  onOpenLearning?: () => void;
  postCopyAccountLabel?: string;
  onTranslateToSpanish: () => void;
  onQuotaUpgrade?: () => void;
  onQuotaSupport?: () => void;
};

const responsePlaceholder = (mode: ExpressionMode) => {
  if (mode === 'translate_to_spanish') {
    return 'Tu version en espanol va a aparecer aca, clara y facil de entender.';
  }

  if (mode === 'improve_english') {
    return 'Tu ingles profesional va a aparecer aca, listo para copiar.';
  }

  return 'Tu respuesta profesional en ingles va a aparecer aca, lista para copiar.';
};

const zeroStateSuggestions = [
  {
    label: 'Reagendar una call',
    prompt: 'Sorry, hoy no llego a la call. Can we move it to tomorrow same time?',
  },
  {
    label: 'Avisar demora',
    prompt:
      'El reporte se demora hasta manana. Ya estamos revisando los datos y te mando una version clara apenas este lista.',
  },
  {
    label: 'Mejorar un update',
    prompt:
      'I finish most part but still need check numbers. I send final today afternoon.',
  },
  {
    label: 'Pedir contexto',
    prompt:
      'Can you send me more context? porque con esto no puedo estimate bien.',
  },
] satisfies SuggestionChip[];

const translationLoadingMessages = [
  'Analizando contexto',
  'Ajustando tono',
  'Refinando vocabulario',
];

const formatQuotaResetDate = (resetAt?: string) => {
  if (!resetAt) return '';
  return new Intl.DateTimeFormat('es', {
    month: 'long',
    day: 'numeric',
  }).format(new Date(resetAt));
};

const formatCooldownWait = (cooldownUntil?: string) => {
  if (!cooldownUntil) return 'un rato';

  const remainingMs = new Date(cooldownUntil).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'unos minutos';

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes <= 1) return '1 minuto';
  if (remainingMinutes < 60) return `${remainingMinutes} minutos`;

  const remainingHours = Math.ceil(remainingMinutes / 60);
  if (remainingHours <= 1) return '1 hora';
  if (remainingHours < 24) return `${remainingHours} horas`;

  return 'mañana';
};

const formatCooldownResumeCopy = (cooldownUntil?: string) => {
  const wait = formatCooldownWait(cooldownUntil);
  return wait === 'mañana' ? 'mañana' : `en ${wait}`;
};

const USAGE_PIP_COUNT = 5;

const getUsageSummary = (usage?: UsageSnapshot | null) => {
  if (!usage || usage.monthlyQuota <= 0) return null;

  const recovery = usage.recovery;
  const quota = Math.max(0, usage.monthlyQuota);
  const remaining = Math.max(0, usage.remainingThisMonth);
  const remainingRatio = quota > 0 ? remaining / quota : 0;
  const availablePips =
    remaining <= 0
      ? 0
      : Math.min(
          USAGE_PIP_COUNT,
          Math.max(1, Math.ceil(remainingRatio * USAGE_PIP_COUNT)),
        );
  const label =
    recovery?.state === 'cooldown'
      ? 'Pausa de uso amigo'
      : recovery?.state === 'monthly_cap'
        ? 'Uso amigo completo'
        : remaining <= 0
          ? 'Gratis usado este mes'
          : remainingRatio <= 0.2
            ? 'Últimas respuestas gratis'
            : remainingRatio <= 0.5
              ? 'Te queda margen gratis'
              : 'Modo amigo gratis';
  const resetDate = formatQuotaResetDate(usage.resetAt);
  const detail =
    recovery?.state === 'cooldown'
      ? `Vuelve ${formatCooldownResumeCopy(recovery.cooldownUntil)}.`
      : (recovery?.state === 'monthly_cap' || remaining <= 0) && resetDate
        ? `Vuelve el ${resetDate}. Pasá a Pro para seguir ahora.`
        : 'Uso amigo gratis para probar FlowTranslate.';
  const pipClass =
    remaining <= 0
      ? 'bg-slate-300'
      : remainingRatio <= 0.2
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return {
    label,
    detail,
    availablePips,
    pipClass,
  };
};

const UsagePips = ({ usage }: { usage?: UsageSnapshot | null }) => {
  const summary = getUsageSummary(usage);
  if (!summary) return null;

  return (
    <div
      className='inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-600'
      aria-label={`Modo amigo gratis: ${summary.label}`}
      title={summary.detail}
    >
      <span className='hidden max-w-[13rem] truncate xl:inline'>
        {summary.label}
      </span>
      <span className='inline-flex items-center gap-1' aria-hidden='true'>
        {Array.from({ length: USAGE_PIP_COUNT }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-4 rounded-full ${
              index < summary.availablePips ? summary.pipClass : 'bg-slate-200'
            }`}
          />
        ))}
      </span>
    </div>
  );
};

const PostCopyNudge = ({
  accountLabel = 'Crear cuenta gratis',
  compact = false,
  onDismiss,
  onOpenAccount,
  onOpenLearning,
}: {
  accountLabel?: string;
  compact?: boolean;
  onDismiss: () => void;
  onOpenAccount?: () => void;
  onOpenLearning?: () => void;
}) => {
  if (!onOpenAccount && !onOpenLearning) return null;

  return (
    <div
      className={`relative rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-950 ${
        compact ? 'p-3 pr-9' : 'p-4 pr-10'
      }`}
    >
      <button
        type='button'
        onClick={onDismiss}
        className='absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-950'
        aria-label='Cerrar sugerencia post-copy'
        title='Cerrar'
      >
        <X size={15} />
      </button>
      <div className='flex min-w-0 gap-3'>
        <div className='mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200 sm:flex'>
          <Sparkles size={18} />
        </div>
        <div className='min-w-0'>
          <p className='text-sm font-black'>Respuesta copiada.</p>
          <p className='mt-1 text-sm font-semibold leading-5 text-emerald-900'>
            Si esta respuesta te sirvio, llevala a Aprender o guardala con una
            cuenta para reutilizarla despues.
          </p>
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            {onOpenLearning ? (
              <button
                type='button'
                onClick={onOpenLearning}
                className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-black text-white transition-colors hover:bg-emerald-600'
              >
                <BookOpen size={15} />
                Guardar en Aprender
              </button>
            ) : null}
            {onOpenAccount ? (
              <button
                type='button'
                onClick={onOpenAccount}
                className='inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-900 transition-colors hover:bg-emerald-100'
              >
                <UserRound size={15} />
                {accountLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuotaPulseIcon = ({
  isCooldown,
  inverted = false,
}: {
  isCooldown: boolean;
  inverted?: boolean;
}) => {
  const tone = inverted
    ? {
        ring: 'border-emerald-300/25',
        halo: 'border-emerald-300/25',
        surface: 'bg-emerald-300/15 text-emerald-300 ring-emerald-300/30',
      }
    : isCooldown
      ? {
          ring: 'border-amber-200',
          halo: 'border-amber-200',
          surface: 'bg-amber-50 text-amber-700 ring-amber-200',
        }
    : {
        ring: 'border-emerald-200',
        halo: 'border-emerald-200',
        surface: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
      };

  return (
    <div
      className='relative flex h-14 w-14 shrink-0 items-center justify-center'
      aria-hidden='true'
    >
      <span
        className={`absolute inset-1 rounded-full border ${tone.halo} opacity-60 motion-safe:animate-ping`}
      />
      <span
        className={`absolute inset-0 rounded-full border ${tone.ring} opacity-40 motion-safe:animate-ping`}
        style={{ animationDelay: '420ms' }}
      />
      <span
        className={`quota-icon-float relative z-10 flex h-11 w-11 items-center justify-center rounded-full ring-1 ${tone.surface}`}
      >
        <Zap
          size={20}
          fill='currentColor'
          className='motion-safe:animate-pulse'
        />
      </span>
    </div>
  );
};

const QuotaExhaustedState = ({
  usage,
  compact = false,
  upgradeLabel = 'Activar Pro',
  upgradeBusy = false,
  supportBusy = false,
  onUpgrade,
  onSupport,
}: {
  usage?: UsageSnapshot | null;
  compact?: boolean;
  upgradeLabel?: string;
  upgradeBusy?: boolean;
  supportBusy?: boolean;
  onUpgrade?: () => void;
  onSupport?: () => void;
}) => {
  const resetLabel = formatQuotaResetDate(usage?.resetAt);
  const resetCopy = resetLabel
    ? `Tu uso amigo vuelve el ${resetLabel}.`
    : 'Tu uso amigo vuelve cuando se reinicie tu ciclo gratis.';
  const isCooldown = usage?.recovery?.state === 'cooldown';
  const cooldownResumeCopy = formatCooldownResumeCopy(
    usage?.recovery?.cooldownUntil,
  );
  const eyebrow = isCooldown ? 'Pausa de uso amigo' : 'Uso amigo completo';
  const title = isCooldown
    ? `Te damos más respuestas ${cooldownResumeCopy}`
    : 'Elegí cómo seguir';
  const bodyCopy = isCooldown
    ? 'Tu texto queda guardado. Podés esperar, apoyar con Cafecito o pasarte a Pro.'
    : `${resetCopy} También podés apoyar con Cafecito o pasarte a Pro.`;

  return (
    <div
      className={`quota-sheet-enter relative overflow-hidden bg-gradient-to-br from-emerald-950 to-emerald-900 text-white shadow-[0_18px_48px_rgba(6,78,59,0.34)] ${
        compact
          ? 'rounded-t-3xl px-6 pb-8 pt-3'
          : 'rounded-2xl px-6 py-7'
      }`}
    >
      {compact ? (
        <div className='flex justify-center pb-3'>
          <div className='h-1 w-8 rounded-full bg-white/20' />
        </div>
      ) : null}
      <div className='flex flex-col items-center gap-4 text-center'>
        <QuotaPulseIcon isCooldown={isCooldown} inverted />

        <div className='min-w-0'>
          <p className='text-xs font-black uppercase tracking-normal text-emerald-300/75'>
            {eyebrow}
          </p>
          <h3 className='mt-1 text-xl font-black leading-tight text-white sm:text-2xl'>
            {title}
          </h3>
          <p className='mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-emerald-50/75'>
            {bodyCopy}
          </p>
        </div>

        <div
          className={`flex w-full flex-col gap-2.5 ${
            compact ? '' : 'mx-auto max-w-sm'
          }`}
        >
          <button
            type='button'
            onClick={onSupport}
            disabled={!onSupport || supportBusy}
            aria-label='Apoyar con cafecito'
            className='inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-emerald-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15 disabled:text-white/35 disabled:hover:translate-y-0'
          >
            {supportBusy ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <Coffee size={17} />
            )}
            {supportBusy ? 'Abriendo recarga' : 'Cafecito + recarga'}
          </button>
          <button
            type='button'
            onClick={onUpgrade}
            disabled={!onUpgrade || upgradeBusy}
            aria-label={upgradeLabel}
            className='quota-cta-glow inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 text-sm font-black text-white shadow-[0_4px_20px_rgba(16,185,129,0.34)] transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-500 hover:shadow-[0_8px_28px_rgba(16,185,129,0.4)] active:translate-y-0 disabled:from-white/30 disabled:to-white/20 disabled:text-white/60 disabled:hover:translate-y-0'
          >
            {upgradeBusy ? (
              <Loader2 size={16} className='animate-spin' />
            ) : null}
            Ver Pro
            {!upgradeBusy ? <ArrowRight size={16} /> : null}
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
    landingContext,
    quotaUsage,
    quotaUpgradeLabel,
    quotaUpgradeBusy = false,
    quotaSupportBusy = false,
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
    onOpenAccount,
    onOpenLearning,
    postCopyAccountLabel = 'Crear cuenta gratis',
    onTranslateToSpanish,
    onQuotaUpgrade,
    onQuotaSupport,
  } = props;
  const isTranslating = status === 'translating';
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isMobileResultOpen, setIsMobileResultOpen] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showPostCopyNudge, setShowPostCopyNudge] = useState(false);
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousBreakdownKeyRef = useRef('');
  const previousResultTextRef = useRef('');
  const requestedBreakdownKeyRef = useRef('');
  const breakdownKey = translationRecordId || resultText.trim();
  const trimmedInputText = inputText.trim();
  const trimmedResultText = resultText.trim();
  const inputCharacterCount = countTranslationInputCharacters(inputText);
  const isInputOverLimit = inputCharacterCount > TRANSLATION_INPUT_MAX_CHARS;
  const isInputNearLimit =
    inputCharacterCount > Math.floor(TRANSLATION_INPUT_MAX_CHARS * 0.9);
  const hasResult = Boolean(trimmedResultText);
  const hasAttentionState =
    status === 'error' ||
    status === 'auth' ||
    status === 'quota' ||
    status === 'offline';
  const isQuotaState = status === 'quota';
  const shouldShowMobileResultSheet =
    isTranslating || hasResult || hasAttentionState;
  const shouldEmphasizeResponse =
    hasResult || isTranslating || hasAttentionState;
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
  const resultFrameLabel =
    targetLanguage === 'en'
      ? 'Inglés profesional listo para copiar'
      : 'Versión en español';
  const confidenceCues =
    targetLanguage === 'en'
      ? ['Profesional', 'Natural', 'Listo para copiar']
      : ['Claro', 'En español', 'Listo para entender'];
  const landingContextLabel =
    landingContext?.selectedExampleLabel || landingContext?.sourceSituation;
  const shouldShowPostCopyNudge =
    showPostCopyNudge &&
    hasResult &&
    !isTranslating &&
    status !== 'quota' &&
    (Boolean(onOpenAccount) || Boolean(onOpenLearning));

  const handleSuggestionSelect = (suggestion: string) => {
    onInputChange(suggestion);
    setTimeout(() => {
      onTranslate();
    }, 50);
  };

  const clearInputText = useCallback(() => {
    onInputChange('');
    inputTextareaRef.current?.focus();
  }, [onInputChange]);

  useEffect(() => {
    if (!trimmedResultText) {
      previousResultTextRef.current = '';
      setIsMobileResultOpen(false);
      setShowPostCopyNudge(false);
      return;
    }

    if (previousResultTextRef.current !== trimmedResultText) {
      previousResultTextRef.current = trimmedResultText;
      setIsMobileResultOpen(false);
      setShowPostCopyNudge(false);
    }
  }, [trimmedResultText]);

  useEffect(() => {
    if (copiedResult && hasResult) setShowPostCopyNudge(true);
  }, [copiedResult, hasResult]);

  useEffect(() => {
    if (status === 'typing') setIsMobileResultOpen(false);
  }, [status]);

  useEffect(() => {
    if (isQuotaState) setIsMobileResultOpen(true);
  }, [isQuotaState]);

  useEffect(() => {
    if (!isTranslating) {
      setLoadingMessageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex(
        (current) => (current + 1) % translationLoadingMessages.length,
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

  const mobileBreakdownSummary = isBreakdownOpen ? (
    <div className='rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700'>
      {breakdownStatus === 'enriching' ? (
        <div className='flex items-center gap-2 font-bold text-slate-500'>
          <Loader2 size={16} className='animate-spin text-emerald-600' />
          Preparando desglose...
        </div>
      ) : breakdownStatus === 'error' ? (
        <p className='font-semibold text-rose-700'>
          No pudimos preparar el desglose ahora. Proba abrirlo de nuevo en un
          momento.
        </p>
      ) : breakdown ? (
        <div className='space-y-3'>
          {breakdown.tense ? (
            <div>
              <div className='text-xs font-black uppercase text-slate-400'>
                Tiempo
              </div>
              <p className='mt-1 font-semibold text-slate-900'>
                {breakdown.tense}
              </p>
            </div>
          ) : null}
          {breakdown.whyThisWorks ? (
            <p className='leading-6 text-slate-700'>{breakdown.whyThisWorks}</p>
          ) : null}
          {breakdown.feedback.length ? (
            <ul className='space-y-2 leading-6'>
              {breakdown.feedback.slice(0, 2).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className='font-semibold text-slate-500'>
          Abrilo para preparar un desglose completo.
        </p>
      )}
    </div>
  ) : null;

  return (
    <section className='mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-5 overflow-x-hidden py-2 sm:gap-6 sm:py-5'>
      {shouldShowLaunchPromise ? (
        <div className='min-w-0 max-w-full px-1 sm:px-2'>
          <h2 className='max-w-full break-words text-2xl font-black leading-[1.12] tracking-normal text-slate-950 [overflow-wrap:anywhere] sm:text-4xl sm:leading-tight'>
            Escribí como te salga. Mandá inglés profesional.
          </h2>
          <p className='mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base'>
            Pegá una idea en español, Spanglish o inglés inseguro. FlowTranslate
            la convierte en una respuesta natural lista para copiar.
          </p>
          <p className='mt-2 max-w-2xl text-xs font-bold leading-5 text-slate-500 sm:text-sm'>
            Probalo sin cuenta. Conecta despues para guardar historial y
            desbloquear Learning personal.
          </p>
        </div>
      ) : null}

      {landingContextLabel && !hasResult && !isTranslating ? (
        <div className='mx-1 flex min-w-0 items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 sm:mx-2'>
          <Sparkles size={16} className='mt-0.5 shrink-0 text-emerald-700' />
          <p className='min-w-0 break-words leading-5 [overflow-wrap:anywhere]'>
            Continuás desde {landingContextLabel}. Podés editar este texto o
            pegar tu propio mensaje real.
          </p>
        </div>
      ) : null}

      <div className='overflow-hidden rounded-lg bg-white shadow-[0_18px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80'>
        <div className='relative'>
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
            placeholder='Escribí en español, Spanglish o inglés inseguro...'
            className='min-h-[132px] w-full min-w-0 resize-none overflow-hidden break-words bg-transparent py-5 pl-5 pr-14 text-lg leading-relaxed text-slate-950 outline-none [overflow-wrap:anywhere] placeholder:text-slate-300 sm:py-6 sm:pl-7 sm:pr-16 sm:text-xl'
            spellCheck
            aria-label='Mensaje o idea'
          />

          {inputText ? (
            <button
              type='button'
              onClick={clearInputText}
              className='absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:right-4 sm:top-4'
              aria-label='Limpiar texto ingresado'
              title='Limpiar texto'
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className='flex min-h-16 flex-col gap-3 border-t border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between sm:px-6'>
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
                aria-label={
                  speakingLanguage === sourceLanguage
                    ? 'Detener audio'
                    : 'Escuchar mensaje'
                }
                title={
                  speakingLanguage === sourceLanguage
                    ? 'Detener audio'
                    : 'Escuchar mensaje'
                }
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
              title={
                canDictate
                  ? 'Dictado por microfono'
                  : dictationUnavailableReason
              }
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

          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <UsagePips usage={quotaUsage} />

            <span
              className={`inline-flex h-10 items-center rounded-full px-2.5 text-xs font-black ${
                isInputOverLimit
                  ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                  : isInputNearLimit
                    ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
                    : 'bg-slate-50 text-slate-500 ring-1 ring-slate-100'
              }`}
              aria-label={`Caracteres del mensaje: ${inputCharacterCount} de ${TRANSLATION_INPUT_MAX_CHARS}`}
              title={`Caracteres: ${inputCharacterCount}/${TRANSLATION_INPUT_MAX_CHARS}`}
            >
              {inputCharacterCount}/{TRANSLATION_INPUT_MAX_CHARS}
            </span>

            <button
              type='button'
              onClick={onTranslate}
              disabled={!canTranslate}
              className={`inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition-colors min-[480px]:flex-none sm:w-11 sm:px-0 ${
                canTranslate
                  ? 'bg-slate-950 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
              aria-label={primaryActionLabel}
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
              <span className='sm:sr-only'>{primaryActionLabel}</span>
            </button>
          </div>
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
              <div
                className={`inline-flex items-center gap-2 text-sm font-black ${tone.text}`}
              >
                {isTranslating ? (
                  <Loader2 size={17} className='animate-spin' />
                ) : (
                  <CheckCircle2 size={17} className={tone.dot} />
                )}
                {readyText}
              </div>
              <p className='mt-1 text-xs font-bold uppercase tracking-normal text-slate-400'>
                {resultFrameLabel}
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
                  title={
                    speakingLanguage === targetLanguage
                      ? 'Detener audio'
                      : 'Audio'
                  }
                  aria-label={
                    speakingLanguage === targetLanguage
                      ? 'Detener audio'
                      : 'Audio'
                  }
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
              supportBusy={quotaSupportBusy}
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
            <div
              className={`inline-flex rounded-md px-3 py-2 text-sm font-bold ring-1 ${tone.surface}`}
            >
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
            {hasResult ? (
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                {confidenceCues.map((cue) => (
                  <span
                    key={cue}
                    className='inline-flex min-h-8 items-center rounded-full bg-slate-50 px-3 text-xs font-black text-slate-600 ring-1 ring-slate-100'
                  >
                    {cue}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type='button'
              onClick={onCopyResult}
              disabled={!hasResult}
              className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto'
              aria-label={
                copiedResult ? 'Respuesta copiada' : 'Copiar respuesta'
              }
              title='Copiar respuesta'
            >
              <Copy size={17} />
              {copiedResult ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : null}

        {shouldShowPostCopyNudge ? (
          <div className='mt-4'>
            <PostCopyNudge
              accountLabel={postCopyAccountLabel}
              onDismiss={() => setShowPostCopyNudge(false)}
              onOpenAccount={onOpenAccount}
              onOpenLearning={onOpenLearning}
            />
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

      {isQuotaState && shouldShowMobileResultSheet ? (
        <>
          {isMobileResultOpen ? (
            <div className='quota-overlay-enter pointer-events-none fixed inset-0 z-30 bg-gradient-to-b from-transparent via-slate-50/80 to-emerald-950/55 lg:hidden' />
          ) : null}
          <div
            className='fixed inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-3xl shadow-[0_-18px_55px_rgba(15,23,42,0.28)] lg:hidden'
            aria-live='polite'
            role='dialog'
            aria-label='Opciones para seguir usando FlowTranslate'
          >
            <div className='mx-auto max-w-3xl'>
              {isMobileResultOpen ? (
                <QuotaExhaustedState
                  usage={quotaUsage}
                  compact
                  upgradeLabel={quotaUpgradeLabel}
                  upgradeBusy={quotaUpgradeBusy}
                  supportBusy={quotaSupportBusy}
                  onUpgrade={onQuotaUpgrade}
                  onSupport={onQuotaSupport}
                />
              ) : (
                <button
                  type='button'
                  onClick={() => setIsMobileResultOpen(true)}
                  className='quota-sheet-enter flex w-full items-center justify-between gap-3 bg-gradient-to-r from-emerald-950 to-emerald-900 px-5 py-4 text-left text-white'
                  aria-expanded={isMobileResultOpen}
                >
                  <span className='flex min-w-0 items-center gap-3'>
                    <QuotaPulseIcon
                      isCooldown={quotaUsage?.recovery?.state === 'cooldown'}
                      inverted
                    />
                    <span className='min-w-0'>
                      <span className='block text-xs font-black uppercase tracking-normal text-emerald-300/75'>
                        {readyText}
                      </span>
                      <span className='mt-0.5 block truncate text-sm font-black text-white'>
                        Tocá para ver opciones
                      </span>
                    </span>
                  </span>
                  <ChevronUp size={18} className='shrink-0 text-emerald-200' />
                </button>
              )}
            </div>
          </div>
        </>
      ) : shouldShowMobileResultSheet ? (
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
                <span
                  className={`flex items-center gap-1.5 text-xs font-black ${tone.text}`}
                >
                  {isTranslating ? (
                    <Loader2 size={14} className='animate-spin' />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {isTranslating
                    ? 'Preparando'
                    : hasResult
                      ? 'Listo para mandar'
                      : readyText}
                </span>
                {hasResult && isMobileResultOpen ? (
                  <span className='mt-0.5 block text-sm font-bold text-slate-500'>
                    {resultFrameLabel}
                  </span>
                ) : !hasResult ? (
                  <span className='mt-0.5 block truncate text-base font-black text-slate-950'>
                    {readyText}
                  </span>
                ) : null}
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
                        <Loader2
                          size={18}
                          className='animate-spin text-emerald-600'
                        />
                        <span>{loadingStatusText}</span>
                      </div>
                      <div className='mt-5 space-y-2' aria-hidden='true'>
                        <div className='h-5 w-full animate-pulse rounded-md bg-slate-100' />
                        <div className='h-5 w-10/12 animate-pulse rounded-md bg-slate-100' />
                        <div className='h-5 w-7/12 animate-pulse rounded-md bg-slate-100' />
                      </div>
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      <p className='max-w-full break-words text-xl font-semibold leading-[1.28] text-slate-950 [overflow-wrap:anywhere]'>
                        {resultText}
                      </p>
                      {hasResult ? (
                        <div className='flex flex-wrap gap-2'>
                          {confidenceCues.map((cue) => (
                            <span
                              key={cue}
                              className='inline-flex min-h-7 items-center rounded-full bg-slate-50 px-2.5 text-xs font-black text-slate-600 ring-1 ring-slate-100'
                            >
                              {cue}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <>
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
                            title={
                              speakingLanguage === targetLanguage
                                ? 'Detener audio'
                                : 'Audio'
                            }
                            aria-label={
                              speakingLanguage === targetLanguage
                                ? 'Detener audio'
                                : 'Audio'
                            }
                          >
                            {speakingLanguage === targetLanguage ? (
                              <Square size={16} />
                            ) : (
                              <Volume2 size={17} />
                            )}
                          </button>
                        ) : null}
                      </div>

                      <div className='grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3'>
                        {canOfferTranslateToSpanish ? (
                          <button
                            type='button'
                            onClick={onTranslateToSpanish}
                            disabled={isTranslating}
                            className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:text-slate-300'
                          >
                            <Languages size={16} />
                            Espanol
                          </button>
                        ) : null}
                        <button
                          type='button'
                          onClick={() =>
                            handleBreakdownOpenChange(!isBreakdownOpen)
                          }
                          disabled={!hasResult || isTranslating}
                          className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:text-slate-300'
                          aria-label={
                            isBreakdownOpen
                              ? 'Ocultar desglose movil'
                              : 'Abrir desglose movil'
                          }
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${
                              isBreakdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                          Desglose
                        </button>
                        <button
                          type='button'
                          onClick={onRequestStudy}
                          disabled={
                            !hasResult ||
                            !translationRecordId ||
                            !onRequestStudy
                          }
                          className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:text-slate-300'
                        >
                          <BookOpen size={16} />
                          Estudiar
                        </button>
                      </div>

                      {shouldShowPostCopyNudge ? (
                        <PostCopyNudge
                          accountLabel={postCopyAccountLabel}
                          compact
                          onDismiss={() => setShowPostCopyNudge(false)}
                          onOpenAccount={onOpenAccount}
                          onOpenLearning={onOpenLearning}
                        />
                      ) : null}

                      {mobileBreakdownSummary}
                  </>
                </div>
              </div>
            ) : hasResult ? (
              <>
                <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pb-3 pt-2'>
                  <div className='min-w-0'>
                    <p className='line-clamp-2 min-w-0 break-words text-sm font-semibold leading-5 text-slate-700 [overflow-wrap:anywhere]'>
                      {trimmedResultText}
                    </p>
                    <button
                      type='button'
                      onClick={() => setIsMobileResultOpen(true)}
                      className='mt-1 inline-flex text-xs font-black text-blue-600 transition-colors hover:text-blue-700'
                      aria-label='Ver respuesta completa'
                      title='Ver respuesta completa'
                    >
                      Ver respuesta completa
                    </button>
                  </div>
                  <button
                    type='button'
                    onClick={onCopyResult}
                    disabled={!hasResult}
                    className='inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400'
                  >
                    {copiedResult ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                {shouldShowPostCopyNudge ? (
                  <div className='pb-3'>
                    <PostCopyNudge
                      accountLabel={postCopyAccountLabel}
                      compact
                      onDismiss={() => setShowPostCopyNudge(false)}
                      onOpenAccount={onOpenAccount}
                      onOpenLearning={onOpenLearning}
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {isMobileResultOpen &&
              grammarInsight &&
              hasResult &&
              !isTranslating && (
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
