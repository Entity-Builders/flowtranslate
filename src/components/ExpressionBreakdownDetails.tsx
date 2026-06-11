import type {
  BreakdownChatMessage,
  ExpressionBreakdown,
} from '@eb-packages/flowtranslate-core';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageCircleQuestion,
  Send,
} from 'lucide-react';
import { useState } from 'react';

const structureRoleTone: Record<
  NonNullable<ExpressionBreakdown['structure']>[number]['role'],
  string
> = {
  subject: 'bg-sky-100 text-sky-900',
  verb: 'bg-emerald-100 text-emerald-900',
  object: 'bg-amber-100 text-amber-900',
  complement: 'bg-violet-100 text-violet-900',
  modifier: 'bg-rose-100 text-rose-900',
  connector: 'bg-slate-200 text-slate-800',
  other: 'bg-slate-100 text-slate-700',
};

type ExpressionBreakdownDetailsProps = {
  breakdown: ExpressionBreakdown | null;
  defaultOpen?: boolean;
  emptyDescription?: string;
  withTopBorder?: boolean;
  onAskQuestion?: (
    question: string,
    history: BreakdownChatMessage[],
  ) => Promise<string>;
};

const starterQuestions = [
  'Como sonaria mas casual?',
  'Puedo usarlo en una llamada?',
  'Que cambia si uso would?',
];

const structureRoleLabel: Record<
  NonNullable<ExpressionBreakdown['structure']>[number]['role'],
  string
> = {
  subject: 'sujeto',
  verb: 'verbo',
  object: 'objeto',
  complement: 'complemento',
  modifier: 'modificador',
  connector: 'conector',
  other: 'otro',
};

export const ExpressionBreakdownDetails = ({
  breakdown,
  defaultOpen = false,
  emptyDescription = 'Genera una respuesta para ver tiempos, estructura y notas de uso.',
  withTopBorder = true,
  onAskQuestion,
}: ExpressionBreakdownDetailsProps) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<BreakdownChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState('');
  const borderClass = withTopBorder ? 'border-t border-slate-100' : '';

  const submitQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !onAskQuestion || asking) return;

    const history = messages;
    setQuestion('');
    setChatError('');
    setAsking(true);
    setMessages((current) => [
      ...current,
      { role: 'user', content: trimmedQuestion },
    ]);

    try {
      const answer = await onAskQuestion(trimmedQuestion, history);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: answer },
      ]);
    } catch (error) {
        setChatError(
        error instanceof Error
          ? error.message
          : 'No pudimos responder esta pregunta.',
      );
    } finally {
      setAsking(false);
    }
  };

  if (!breakdown) {
    return (
      <details
        className={`max-w-full shrink-0 overflow-hidden px-4 py-3 sm:px-5 ${borderClass}`}
        open={defaultOpen}
      >
        <summary className='flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-500'>
          <ChevronDown size={16} />
          Desglose
        </summary>
        <p className='mt-3 text-sm text-slate-500'>{emptyDescription}</p>
      </details>
    );
  }

  const tenseNotes = breakdown.tenses?.length
    ? breakdown.tenses
    : breakdown.tense
      ? [{ label: breakdown.tense, text: '', note: '' }]
      : [];

  return (
    <details
      className={`max-w-full shrink-0 overflow-hidden px-4 py-3 sm:px-5 ${borderClass}`}
      open={defaultOpen}
    >
      <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-700'>
        <span className='inline-flex min-w-0 items-center gap-2 break-words'>
          <ChevronDown size={16} className='shrink-0' />
          Desglose
        </span>
        <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600'>
          {breakdown.changed ? 'Ajustado' : 'Ya suena natural'}
        </span>
      </summary>

      <div className='mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.85fr)]'>
        <div className='min-w-0 space-y-3'>
          {breakdown.feedback.length ? (
            <div className='rounded-md border border-slate-200 bg-white p-3'>
              <div className='flex items-center gap-2 text-xs font-black uppercase tracking-normal text-slate-400'>
                <CheckCircle2 size={14} />
                Comentarios
              </div>
              <ul className='mt-2 space-y-2 break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]'>
                {breakdown.feedback.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {breakdown.whyThisWorks ? (
            <div className='break-words rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900 [overflow-wrap:anywhere]'>
              {breakdown.whyThisWorks}
            </div>
          ) : null}

          {breakdown.commonMistake ? (
            <div className='flex items-start gap-2 break-words rounded-md border border-rose-100 bg-rose-50 p-3 text-sm leading-6 text-rose-900 [overflow-wrap:anywhere]'>
              <AlertCircle size={16} className='mt-0.5 shrink-0' />
              {breakdown.commonMistake}
            </div>
          ) : null}
        </div>

        <div className='min-w-0 space-y-3'>
          {tenseNotes.length ? (
            <div className='rounded-md border border-slate-200 bg-white p-3'>
              <div className='text-xs font-black uppercase tracking-normal text-slate-400'>
                {tenseNotes.length > 1 ? 'Tiempos' : 'Tiempo'}
              </div>
              <div className='mt-2 space-y-2'>
                {tenseNotes.map((tense, index) => (
                  <div
                    key={`${tense.label}-${tense.text || index}`}
                    className={
                      tenseNotes.length > 1
                        ? 'rounded-md bg-slate-50 p-2'
                        : undefined
                    }
                  >
                    <div className='break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]'>
                      {tense.label}
                    </div>
                    {tense.text ? (
                      <div className='mt-1 break-words text-xs font-bold text-slate-500 [overflow-wrap:anywhere]'>
                        {tense.text}
                      </div>
                    ) : null}
                    {tense.note ? (
                      <div className='mt-1 break-words text-xs font-semibold leading-5 text-slate-500 [overflow-wrap:anywhere]'>
                        {tense.note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {breakdown.structure?.length ? (
            <div className='rounded-md border border-slate-200 bg-white p-3'>
              <div className='text-xs font-black uppercase tracking-normal text-slate-400'>
                Estructura
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                {breakdown.structure.map((part, index) => (
                  <span
                    key={`${part.text}-${part.role}-${index}`}
                    className={`inline-flex max-w-full flex-col rounded-md px-2.5 py-2 text-xs font-bold ${structureRoleTone[part.role]}`}
                    title={part.note}
                  >
                    <span className='break-words [overflow-wrap:anywhere]'>
                      {part.text}
                    </span>
                    <span className='mt-1 font-semibold opacity-70'>
                      {structureRoleLabel[part.role]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {breakdown.alternatives?.length ? (
            <div className='rounded-md border border-slate-200 bg-white p-3'>
              <div className='text-xs font-black uppercase tracking-normal text-slate-400'>
                Alternativas
              </div>
              <div className='mt-2 space-y-2'>
                {breakdown.alternatives.map((alternative) => (
                  <div key={`${alternative.label}-${alternative.text}`}>
                    <div className='break-words text-sm font-black leading-5 text-slate-900 [overflow-wrap:anywhere]'>
                      {alternative.text}
                    </div>
                    <div className='break-words text-xs font-semibold leading-5 text-slate-500 [overflow-wrap:anywhere]'>
                      {alternative.label}: {alternative.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {onAskQuestion ? (
        <div className='mt-4 rounded-md border border-slate-200 bg-slate-50 p-3'>
          <div className='flex items-center gap-2 text-xs font-black uppercase tracking-normal text-slate-500'>
            <MessageCircleQuestion size={15} />
            Preguntar sobre este desglose
          </div>

          {messages.length ? (
            <div className='mt-3 space-y-2'>
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}-${message.content.slice(0, 20)}`}
                  className={`max-w-[92%] break-words rounded-md px-3 py-2 text-sm leading-6 [overflow-wrap:anywhere] ${
                    message.role === 'user'
                      ? 'ml-auto bg-slate-900 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  <div
                    className={`mb-1 text-[11px] font-black uppercase tracking-normal ${
                      message.role === 'user'
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {message.role === 'user' ? 'Vos' : 'Tutor'}
                  </div>
                  {message.content}
                </div>
              ))}
            </div>
          ) : (
            <div className='mt-3 flex flex-wrap gap-2'>
              {starterQuestions.map((starter) => (
                <button
                  key={starter}
                  type='button'
                  onClick={() => setQuestion(starter)}
                  className='rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-950'
                >
                  {starter}
                </button>
              ))}
            </div>
          )}

          {chatError ? (
            <div className='mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-semibold leading-5 text-amber-800'>
              <AlertCircle size={14} className='mt-0.5 shrink-0' />
              {chatError}
            </div>
          ) : null}

          <form
            className='mt-3 flex min-w-0 items-center gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              void submitQuestion();
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={asking}
              aria-label='Preguntar sobre este desglose'
              placeholder='Pregunta por que, compara otra frase...'
              className='min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100'
            />
            <button
              type='submit'
              disabled={!question.trim() || asking}
              aria-label='Enviar pregunta del desglose'
              title='Enviar pregunta del desglose'
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition ${
                question.trim() && !asking
                  ? 'bg-slate-950 text-white hover:bg-slate-800'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {asking ? (
                <Loader2 size={16} className='animate-spin' />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      ) : null}
    </details>
  );
};
