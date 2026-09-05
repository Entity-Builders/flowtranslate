import type {
  BreakdownChatMessage,
  LanguageCode,
  StudyArticle,
  TranslationRecord,
} from '@entity-builders/flowtranslate-core';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Clock3,
  Loader2,
  Target,
  Volume2,
} from 'lucide-react';
import { GrammarSandbox } from './GrammarSandbox';
import { ExpressionBreakdownDetails } from './ExpressionBreakdownDetails';
import { MarkdownStudyArticle } from './MarkdownStudyArticle';
import { VibeCheckCard } from './VibeCheckCard';

type StudyArticleViewProps = {
  article: StudyArticle | null;
  selectedRecord?: TranslationRecord;
  loading: boolean;
  error: string;
  onClose: () => void;
  onListenPhrase?: (language: LanguageCode, text: string) => void;
  onAskBreakdownQuestion?: (
    record: TranslationRecord,
    question: string,
    history: BreakdownChatMessage[],
  ) => Promise<string>;
};

const languageLabel: Record<LanguageCode, string> = {
  es: 'Espanol',
  en: 'Ingles',
};

const EmptyStudyArticle = () => (
  <div className='mx-auto w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm'>
    <div className='flex items-center gap-2 text-base font-bold text-slate-950'>
      <BookOpen size={18} />
      Articulo de estudio
    </div>
    <p className='mt-2 text-sm text-slate-500'>
      Elegi una respuesta guardada del historial para abrir un articulo basado en
      tus propios mensajes.
    </p>
  </div>
);

export const StudyArticleView = ({
  article,
  selectedRecord,
  loading,
  error,
  onClose,
  onListenPhrase,
  onAskBreakdownQuestion,
}: StudyArticleViewProps) => {
  if (!article && !selectedRecord && !loading && !error) {
    return <EmptyStudyArticle />;
  }

  const sourceLanguage = article?.sourceLanguage || selectedRecord?.sourceLanguage;
  const targetLanguage = article?.targetLanguage || selectedRecord?.targetLanguage;
  const sourceText = article?.sourceText || selectedRecord?.sourceText;
  const translatedText = article?.translatedText || selectedRecord?.translatedText;
  const savedBreakdown = selectedRecord?.breakdown || null;
  const readingMinutes = article?.estimatedReadingMinutes;
  const lessonLabel = article?.title || selectedRecord?.sourceText || 'Respuesta seleccionada';
  const canListen = Boolean(sourceLanguage && sourceText && onListenPhrase);

  return (
    <article className='mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'>
      <header className='flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-5'>
        <div className='flex min-w-0 items-center gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950'
            aria-label='Volver al panel de Learning'
            title='Volver al panel de Learning'
          >
            <ArrowLeft size={17} />
          </button>
          <div className='min-w-0'>
            <h2 className='text-base font-black leading-none text-slate-950'>
              Articulo de estudio
            </h2>
            <p className='mt-1 truncate text-xs font-semibold text-slate-500'>
              Leccion: {lessonLabel}
            </p>
          </div>
        </div>
        <div className='hidden shrink-0 flex-wrap items-center justify-end gap-2 text-xs font-bold uppercase tracking-normal text-slate-500 sm:flex'>
          {sourceLanguage && targetLanguage ? (
            <span className='rounded-md border border-slate-200 px-2 py-1'>
              {languageLabel[sourceLanguage]} a {languageLabel[targetLanguage]}
            </span>
          ) : null}
          {readingMinutes ? (
            <span className='inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1'>
              <Clock3 size={13} />
              {readingMinutes} min lectura
            </span>
          ) : null}
        </div>
      </header>

      <div className='space-y-4 bg-[#eef5f8] p-3 sm:p-5'>
        {error ? (
          <div className='flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700'>
            <AlertTriangle size={17} className='mt-0.5 shrink-0' />
            {error}
          </div>
        ) : null}

        {sourceText && translatedText ? (
          <section className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
            <div className='flex items-start gap-3'>
              {canListen && sourceLanguage ? (
                <button
                  type='button'
                  onClick={() => onListenPhrase?.(sourceLanguage, sourceText)}
                  className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200'
                  aria-label='Escuchar frase seleccionada'
                  title='Escuchar frase seleccionada'
                >
                  <Volume2 size={18} />
                </button>
              ) : (
                <div className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700'>
                  <BookOpen size={18} />
                </div>
              )}

              <div className='min-w-0 flex-1'>
                <div className='text-xs font-black uppercase tracking-normal text-slate-400'>
                  Frase seleccionada
                </div>
                <p className='mt-2 break-words text-2xl font-black leading-tight text-slate-950 md:text-3xl'>
                  {sourceText}
                </p>
                <p className='mt-2 break-words text-sm font-semibold leading-6 text-slate-500 md:text-base'>
                  {translatedText}
                </p>
              </div>
            </div>

            {article?.summary ? (
              <p className='mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600'>
                {article.summary}
              </p>
            ) : null}

            {article?.lessonFocus?.length ? (
              <div className='mt-4 flex flex-wrap items-center gap-2'>
                <span className='inline-flex items-center gap-1 text-xs font-black uppercase tracking-normal text-slate-400'>
                  <Target size={13} />
                  Foco
                </span>
                {article.lessonFocus.map((focus) => (
                  <span
                    key={focus}
                    className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700'
                  >
                    {focus}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {savedBreakdown ? (
          <section className='rounded-lg border border-slate-200 bg-white shadow-sm'>
            <ExpressionBreakdownDetails
              breakdown={savedBreakdown}
              defaultOpen
              withTopBorder={false}
              onAskQuestion={
                selectedRecord && onAskBreakdownQuestion
                  ? (question, history) =>
                      onAskBreakdownQuestion(selectedRecord, question, history)
                  : undefined
              }
            />
          </section>
        ) : null}

        {loading ? (
          <div className='flex min-h-28 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm'>
            <Loader2 size={18} className='animate-spin' />
            Generando articulo de estudio
          </div>
        ) : null}

        {article ? (
          <>
            <MarkdownStudyArticle markdown={article.markdown} />

            {article.vibeCheck ? (
              <VibeCheckCard vibeCheck={article.vibeCheck} />
            ) : null}

            {article.sandbox?.length ? (
              <GrammarSandbox sandbox={article.sandbox} />
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
};
