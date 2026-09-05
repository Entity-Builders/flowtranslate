import type {
  ExpressionBreakdown,
  ExpressionMode,
  GrammarAnnotation,
  TranslationRecord,
} from '@entity-builders/flowtranslate-core';
import {
  getGrammarAnnotations,
  hasMixedSpanishEnglishInput,
} from '@entity-builders/flowtranslate-core';
import { BookOpen, Check, Copy, Languages } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { MAX_LEARNING_HISTORY } from '../constants';

type AccountKind = 'none' | 'guest' | 'permanent';

type LearningViewProps = {
  history: TranslationRecord[];
  accountKind: AccountKind;
};

type GrammarRoleConfig = {
  underline: string;
  label: string;
  dot: string;
  tooltipLabel: string;
};

type AttemptDiffStatus = 'same' | 'added' | 'changed';

type AttemptDiffToken = {
  id: string;
  word: string;
  status: AttemptDiffStatus;
  was?: string;
};

type AttemptFeedback = {
  wellDone: string;
  issue: string;
  why: string;
  pattern: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const modeLabel: Record<ExpressionMode, string> = {
  translate_to_english: 'Idea a inglés',
  improve_english: 'Mejorar mi inglés',
  translate_to_spanish: 'Entendido en español',
};

const formatRecordLabel = (record: TranslationRecord) => {
  if (record.mode) return modeLabel[record.mode];
  return `${record.sourceLanguage.toUpperCase()} a ${record.targetLanguage.toUpperCase()}`;
};

const grammarRoleConfig: Record<GrammarAnnotation['role'], GrammarRoleConfig> = {
  subject: {
    underline: 'decoration-blue-400',
    label: 'Sujeto',
    dot: 'bg-blue-400',
    tooltipLabel: 'text-blue-300',
  },
  verb: {
    underline: 'decoration-teal-400',
    label: 'Verbo',
    dot: 'bg-teal-400',
    tooltipLabel: 'text-teal-300',
  },
  object: {
    underline: 'decoration-violet-400',
    label: 'Objeto',
    dot: 'bg-violet-400',
    tooltipLabel: 'text-violet-300',
  },
  complement: {
    underline: 'decoration-violet-400',
    label: 'Complemento',
    dot: 'bg-violet-400',
    tooltipLabel: 'text-violet-300',
  },
  modifier: {
    underline: 'decoration-rose-400',
    label: 'Modificador',
    dot: 'bg-rose-400',
    tooltipLabel: 'text-rose-300',
  },
  connector: {
    underline: 'decoration-rose-400',
    label: 'Conector',
    dot: 'bg-rose-400',
    tooltipLabel: 'text-rose-300',
  },
  tense: {
    underline: 'decoration-teal-400',
    label: 'Tiempo verbal',
    dot: 'bg-teal-400',
    tooltipLabel: 'text-teal-300',
  },
  other: {
    underline: 'decoration-rose-400',
    label: 'Estructura',
    dot: 'bg-rose-400',
    tooltipLabel: 'text-rose-300',
  },
};

const GrammarLensIcon = () => (
  <svg
    width='14'
    height='14'
    viewBox='0 0 14 14'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    aria-hidden='true'
  >
    <rect
      x='1.5'
      y='2.5'
      width='11'
      height='1.5'
      rx='0.75'
      fill='currentColor'
      opacity='0.35'
    />
    <rect
      x='1.5'
      y='6.25'
      width='8'
      height='1.5'
      rx='0.75'
      fill='currentColor'
    />
    <rect
      x='1.5'
      y='10'
      width='5.5'
      height='1.5'
      rx='0.75'
      fill='currentColor'
      opacity='0.35'
    />
  </svg>
);

const ClockIcon = () => (
  <svg
    width='11'
    height='11'
    viewBox='0 0 11 11'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    aria-hidden='true'
  >
    <circle cx='5.5' cy='5.5' r='4.5' stroke='currentColor' strokeWidth='1.1' />
    <path
      d='M5.5 3v2.5L7 7'
      stroke='currentColor'
      strokeWidth='1.1'
      strokeLinecap='round'
    />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width='12'
    height='12'
    viewBox='0 0 12 12'
    fill='none'
    className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    aria-hidden='true'
  >
    <path
      d='M2 4l4 4 4-4'
      stroke='currentColor'
      strokeWidth='1.2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

const AnnotatedToken = ({ annotation }: { annotation: GrammarAnnotation }) => {
  const [show, setShow] = useState(false);
  const config = grammarRoleConfig[annotation.role];

  return (
    <span className='relative inline-block'>
      <span
        tabIndex={0}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className={`cursor-default font-medium text-[#0f1117] underline decoration-2 underline-offset-[4px] outline-none ${config.underline}`}
      >
        {annotation.text}
      </span>

      {show ? (
        <span
          role='tooltip'
          className='pointer-events-none absolute bottom-full left-0 z-20 mb-2 flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1a1f2e] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg'
        >
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`}
          />
          <span className={config.tooltipLabel}>{config.label}</span>
          {annotation.note ? (
            <>
              <span className='text-white/40'>·</span>
              <span className='text-white/80'>{annotation.note}</span>
            </>
          ) : null}
        </span>
      ) : null}
    </span>
  );
};

const renderAnnotatedText = ({
  annotations,
  text,
}: {
  annotations: GrammarAnnotation[];
  text: string;
}) => {
  const rangedAnnotations = annotations
    .filter(
      (annotation) =>
        annotation.startIndex !== null &&
        annotation.endIndex !== null &&
        annotation.endIndex > annotation.startIndex,
    )
    .sort((first, second) => Number(first.startIndex) - Number(second.startIndex));

  const fragments: ReactNode[] = [];
  let cursor = 0;

  rangedAnnotations.forEach((annotation) => {
    const startIndex = annotation.startIndex ?? 0;
    const endIndex = annotation.endIndex ?? startIndex;
    if (startIndex < cursor) return;

    if (startIndex > cursor) {
      const plainText = text.slice(cursor, startIndex).trim();
      if (plainText) {
        fragments.push(
          <span key={`plain-${cursor}-${startIndex}`}>{plainText}</span>,
        );
      }
    }

    fragments.push(
      <AnnotatedToken
        key={annotation.id}
        annotation={{
          ...annotation,
          text: text.slice(startIndex, endIndex),
        }}
      />,
    );
    cursor = endIndex;
  });

  if (cursor < text.length) {
    const plainText = text.slice(cursor).trim();
    if (plainText) {
      fragments.push(<span key={`plain-${cursor}`}>{plainText}</span>);
    }
  }

  return fragments;
};

const tokenizeDiffText = (text: string) => text.trim().match(/\S+/g) || [];

const normalizeDiffWord = (word: string) =>
  word.toLocaleLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');

const sameDiffWord = (sourceWord: string, targetWord: string) =>
  normalizeDiffWord(sourceWord) === normalizeDiffWord(targetWord);

const createAttemptDiff = (
  sourceText: string,
  translatedText: string,
): AttemptDiffToken[] => {
  const sourceWords = tokenizeDiffText(sourceText);
  const targetWords = tokenizeDiffText(translatedText);
  const tokens: AttemptDiffToken[] = [];
  let sourceIndex = 0;
  let targetIndex = 0;

  while (targetIndex < targetWords.length) {
    const sourceWord = sourceWords[sourceIndex];
    const targetWord = targetWords[targetIndex];

    if (sourceWord && sameDiffWord(sourceWord, targetWord)) {
      tokens.push({
        id: `${targetIndex}-same`,
        word: targetWord,
        status: 'same',
      });
      sourceIndex += 1;
      targetIndex += 1;
      continue;
    }

    if (
      sourceWord &&
      targetWords[targetIndex + 1] &&
      sameDiffWord(sourceWord, targetWords[targetIndex + 1])
    ) {
      tokens.push({
        id: `${targetIndex}-added`,
        word: targetWord,
        status: 'added',
      });
      targetIndex += 1;
      continue;
    }

    if (
      sourceWord &&
      sourceWords[sourceIndex + 1] &&
      targetWords[targetIndex + 1] &&
      sameDiffWord(sourceWords[sourceIndex + 1], targetWords[targetIndex + 1])
    ) {
      tokens.push({
        id: `${targetIndex}-changed`,
        word: targetWord,
        status: 'changed',
        was: sourceWord,
      });
      sourceIndex += 1;
      targetIndex += 1;
      continue;
    }

    if (sourceWord) {
      tokens.push({
        id: `${targetIndex}-changed`,
        word: targetWord,
        status: 'changed',
        was: sourceWord,
      });
      sourceIndex += 1;
      targetIndex += 1;
      continue;
    }

    tokens.push({
      id: `${targetIndex}-added`,
      word: targetWord,
      status: 'added',
    });
    targetIndex += 1;
  }

  return tokens;
};

const DiffWord = ({ token }: { token: AttemptDiffToken }) => {
  if (token.status === 'added') {
    return (
      <span className='font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2'>
        {token.word}
      </span>
    );
  }

  if (token.status === 'changed') {
    return (
      <span className='inline-flex items-baseline gap-1'>
        {token.was ? (
          <span className='text-[13px] text-amber-500 line-through decoration-amber-400/60'>
            {token.was}
          </span>
        ) : null}
        <span className='font-semibold text-emerald-700'>{token.word}</span>
      </span>
    );
  }

  return <span className='font-medium text-[#0f1117]'>{token.word}</span>;
};

const deriveReusablePattern = (
  record: TranslationRecord,
  breakdown: ExpressionBreakdown | null,
) => {
  if (breakdown?.reusablePattern?.trim()) {
    return breakdown.reusablePattern.trim();
  }

  const verb = breakdown?.structure?.find((part) => part.role === 'verb')?.text;
  if (verb) return `${verb} + ...`;

  const firstWords = tokenizeDiffText(record.translatedText).slice(0, 5).join(' ');
  return firstWords ? `${firstWords}...` : record.translatedText;
};

const getAttemptFeedback = (record: TranslationRecord): AttemptFeedback => {
  const breakdown = record.breakdown || null;
  const isSpanglish = hasMixedSpanishEnglishInput(record.sourceText);
  const fallbackWellDone = isSpanglish
    ? 'Ya combinaste una disculpa y una propuesta concreta; FlowTranslate lo convierte en inglés natural.'
    : 'La intención se entiende y ya estás construyendo la idea en inglés.';
  const fallbackIssue = isSpanglish
    ? 'Convertí los fragmentos en español a expresiones completas en inglés, no palabra por palabra.'
    : 'FlowTranslate ajustó una parte de la frase para que suene más natural.';
  const fallbackWhy = isSpanglish
    ? "En Spanglish la idea ya está clara, pero el salto a inglés natural suele necesitar expresiones hechas como \"can't make it\" o \"at the same time\"."
    : 'La versión final usa una estructura más común para este tipo de mensaje.';

  return {
    wellDone: breakdown?.whatWentWell?.trim() || fallbackWellDone,
    issue:
      breakdown?.commonMistake?.trim() ||
      breakdown?.feedback?.find((item) => item.trim().length > 0) ||
      fallbackIssue,
    why: breakdown?.whyThisWorks?.trim() || fallbackWhy,
    pattern: deriveReusablePattern(record, breakdown),
  };
};

const isEnglishAttemptRecord = (record: TranslationRecord) =>
  record.mode === 'improve_english' ||
  (record.sourceLanguage === 'en' && record.targetLanguage === 'en');

export const LearningView = ({ history, accountKind }: LearningViewProps) => {
  const [expandedRecordId, setExpandedRecordId] = useState('');
  const [copiedRecordId, setCopiedRecordId] = useState('');
  const [openAttemptFeedbackId, setOpenAttemptFeedbackId] = useState('');
  const recentHistory = useMemo(
    () => history.slice(0, MAX_LEARNING_HISTORY),
    [history],
  );
  const historyWithAnalysis = useMemo(
    () =>
      recentHistory.filter((record) => getGrammarAnnotations(record).hasAnalysis)
        .length,
    [recentHistory],
  );
  const accountCopy =
    accountKind === 'permanent'
      ? 'Tus traducciones guardadas se convierten en explicaciones breves.'
      : 'Conecta una cuenta para conservar historial y seguir aprendiendo desde tus respuestas.';

  const toggleExpandedRecord = (recordId: string) => {
    setExpandedRecordId((current) => (current === recordId ? '' : recordId));
  };

  const copyRecord = (record: TranslationRecord) => {
    void navigator.clipboard?.writeText(record.translatedText);
    setCopiedRecordId(record.id);
    window.setTimeout(() => {
      setCopiedRecordId((current) => (current === record.id ? '' : current));
    }, 1600);
  };

  return (
    <main className='min-h-0 flex-1 overflow-y-auto bg-[#f7f8f9] px-4 py-7 font-[Inter,system-ui,sans-serif] text-[#0f1117]'>
      <div className='mx-auto max-w-2xl'>
        <section className='mb-6'>
          <div className='mb-2 flex items-center gap-1.5'>
            <BookOpen size={12} className='text-[#0e7f72]' />
            <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0e7f72]'>
              Historial
            </span>
          </div>
          <h2 className='mb-1.5 text-[22px] font-semibold leading-snug text-[#0f1117]'>
            Historial de traducciones
          </h2>
          <p className='max-w-lg text-[13px] leading-relaxed text-[#6b7280]'>
            Revisa tus traducciones reales: texto original, versión en inglés y
            una capa opcional para aprender de cada frase.
          </p>
          <p className='mt-1.5 text-[12px] font-medium text-[#6b7280]'>
            {accountCopy}
          </p>
        </section>

        <section className='mb-5 flex items-start gap-7 border-b border-black/10 pb-5'>
          <div>
            <p className='mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]'>
              Traducciones
            </p>
            <p className='text-[20px] font-semibold leading-none text-[#0f1117]'>
              {recentHistory.length}
            </p>
          </div>
          <div>
            <p className='mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]'>
              Con análisis
            </p>
            <p className='text-[20px] font-semibold leading-none text-[#0f1117]'>
              {historyWithAnalysis}
            </p>
          </div>
          <div>
            <p className='mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]'>
              Modo
            </p>
            <p className='mt-0.5 text-[13px] font-medium leading-snug text-[#0f1117]'>
              Desglose por ítem
            </p>
          </div>
        </section>

        {recentHistory.length === 0 ? (
          <section className='overflow-hidden rounded-md border border-black/10 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
            <div className='flex max-w-md flex-col gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-md bg-[#eef0f3] text-[#6b7280]'>
                <Languages size={19} />
              </span>
              <h3 className='text-lg font-semibold text-[#0f1117]'>
                Todavía no hay traducciones guardadas.
              </h3>
              <p className='text-[13px] leading-relaxed text-[#6b7280]'>
                Usa Responder para generar una frase. Cuando FlowTranslate
                guarde el resultado, va a aparecer acá con el texto original y
                su desglose cuando esté disponible.
              </p>
            </div>
          </section>
        ) : (
          <section className='space-y-3'>
            {recentHistory.map((record) => {
              const summary = getGrammarAnnotations(record);
              const expanded = expandedRecordId === record.id;
              const copied = copiedRecordId === record.id;
              const hasGrammar = summary.hasAnalysis;
              const isAttempt = isEnglishAttemptRecord(record);
              const attemptFeedback = getAttemptFeedback(record);
              const attemptFeedbackOpen = openAttemptFeedbackId === record.id;
              const attemptDiff = createAttemptDiff(
                record.sourceText,
                record.translatedText,
              );
              const rangedAnnotations = summary.annotations.filter(
                (annotation) =>
                  annotation.startIndex !== null &&
                  annotation.endIndex !== null,
              );

              return (
                <article
                  key={record.id}
                  className='overflow-hidden rounded-md border border-black/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                >
                  <div className='flex items-center justify-between gap-3 border-b border-black/10 bg-[#f7f8f9]/60 px-4 py-2.5'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#6b7280]'>
                      <span className='inline-flex items-center gap-1.5'>
                        <ClockIcon />
                        {formatDate(record.createdAt)}
                      </span>
                      <span className='opacity-30'>·</span>
                      <span>{formatRecordLabel(record)}</span>
                    </div>

                    <div className='flex shrink-0 items-center gap-1.5'>
                      {isAttempt ? (
                        <span className='hidden rounded border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 min-[430px]:inline-flex'>
                          Inglés corregido
                        </span>
                      ) : null}

                      <button
                        type='button'
                        onClick={() => copyRecord(record)}
                        className='flex h-7 items-center gap-1.5 rounded border border-black/10 bg-white px-2.5 text-[11px] font-medium text-[#6b7280] transition-colors hover:text-[#0f1117]'
                      >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </button>

                      {hasGrammar && !isAttempt ? (
                        <button
                          type='button'
                          aria-controls={`learning-record-${record.id}`}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Ocultar' : 'Ver'} análisis gramatical de traducción ${record.id}`}
                          title={
                            expanded
                              ? 'Ocultar análisis'
                              : 'Ver análisis gramatical'
                          }
                          onClick={() => toggleExpandedRecord(record.id)}
                          className={`flex h-7 w-7 items-center justify-center rounded transition-all ${
                            expanded
                              ? 'border border-teal-200/80 bg-[#e6f4f2] text-[#0e7f72]'
                              : 'border border-transparent text-[#6b7280] hover:border-black/10 hover:text-[#0f1117]'
                          }`}
                        >
                          <GrammarLensIcon />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isAttempt ? (
                    <>
                      <div className='space-y-3.5 px-4 pb-1 pt-4'>
                        <div>
                          <p className='mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]/70'>
                            Tu intento
                          </p>
                          <p className='text-[13px] leading-relaxed text-[#6b7280]'>
                            {record.sourceText}
                          </p>
                        </div>

                        <div>
                          <p className='mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]/70'>
                            Versión más natural
                          </p>
                          <p className='flex flex-wrap items-baseline gap-x-1.5 text-[15px] leading-relaxed'>
                            {attemptDiff.map((token) => (
                              <DiffWord key={token.id} token={token} />
                            ))}
                          </p>
                          <div className='mt-2 flex items-center gap-4'>
                            <span className='flex items-center gap-1.5 text-[11px] text-amber-500/80'>
                              <span className='inline-block h-px w-3 rounded bg-amber-400' />
                              corregido
                            </span>
                            <span className='flex items-center gap-1.5 text-[11px] text-emerald-600/80'>
                              <span className='inline-block h-px w-3 rounded bg-emerald-400' />
                              agregado
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type='button'
                        aria-controls={`learning-attempt-${record.id}`}
                        aria-expanded={attemptFeedbackOpen}
                        onClick={() =>
                          setOpenAttemptFeedbackId((current) =>
                            current === record.id ? '' : record.id,
                          )
                        }
                        className='group mt-3 flex w-full items-center justify-between border-t border-black/10 px-4 py-3 text-[11px] font-medium text-[#6b7280] transition-colors hover:text-[#0f1117]'
                      >
                        <span>Aprende de este intento</span>
                        <ChevronIcon open={attemptFeedbackOpen} />
                      </button>

                      {attemptFeedbackOpen ? (
                        <div
                          id={`learning-attempt-${record.id}`}
                          className='divide-y divide-black/10 border-t border-black/10'
                        >
                          <div className='px-4 py-3'>
                            <p className='mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600'>
                              Qué hiciste bien
                            </p>
                            <p className='text-[13px] leading-relaxed text-[#0f1117]/80'>
                              {attemptFeedback.wellDone}
                            </p>
                          </div>
                          <div className='px-4 py-3'>
                            <p className='mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600'>
                              Ajuste clave
                            </p>
                            <p className='text-[13px] leading-relaxed text-[#0f1117]/80'>
                              {attemptFeedback.issue}
                            </p>
                          </div>
                          <div className='px-4 py-3'>
                            <p className='mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]'>
                              Por qué importa
                            </p>
                            <p className='text-[13px] leading-relaxed text-[#0f1117]/80'>
                              {attemptFeedback.why}
                            </p>
                          </div>
                          <div className='bg-[#eef0f3]/40 px-4 py-3'>
                            <p className='mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]'>
                              Patrón para reutilizar
                            </p>
                            <p className='inline-block rounded border border-black/10 bg-white px-2.5 py-1.5 font-mono text-[13px] font-medium text-[#0f1117]'>
                              {attemptFeedback.pattern}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className='space-y-3.5 px-4 pb-4 pt-4'>
                      <div>
                        <p className='mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]/70'>
                          Texto original
                        </p>
                        <p className='text-[13px] leading-relaxed text-[#6b7280]'>
                          {record.sourceText}
                        </p>
                      </div>

                      <div>
                        <p className='mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]/70'>
                          Traducción
                        </p>

                        {expanded && rangedAnnotations.length ? (
                          <p
                            id={`learning-record-${record.id}`}
                            aria-label={record.translatedText}
                            className='flex flex-wrap items-baseline gap-x-1 text-[15px] font-medium leading-relaxed'
                          >
                            {renderAnnotatedText({
                              annotations: rangedAnnotations,
                              text: record.translatedText,
                            })}
                          </p>
                        ) : (
                          <p
                            id={`learning-record-${record.id}`}
                            className='text-[15px] font-medium leading-relaxed text-[#0f1117]'
                          >
                            {record.translatedText}
                          </p>
                        )}
                      </div>

                      {expanded && summary.tenseSummary ? (
                        <div className='inline-flex items-center gap-1.5 rounded border border-teal-200/70 bg-[#e6f4f2] px-2.5 py-1 text-[11px] font-medium text-[#0e7f72]'>
                          <ClockIcon />
                          Tiempo: {summary.tenseSummary}
                        </div>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
};
