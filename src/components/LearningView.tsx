import type {
  BreakdownChatMessage,
  ExpressionMode,
  LanguageCode,
  LearningInsight,
  LearningInsightItem,
  StudyArticle,
  TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import {
  AlertCircle,
  BookOpen,
  Clock,
  Languages,
  Lightbulb,
  Loader2,
  MessageSquareText,
  PenLine,
  RefreshCw,
  Repeat2,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { MAX_LEARNING_HISTORY } from '../constants';
import { buildLearningDashboard } from '../services/learning-metrics';
import { StudyArticleView } from './StudyArticleView';

type LearningViewProps = {
  history: TranslationRecord[];
  learningInsight: LearningInsight | null;
  insightLoading: boolean;
  insightError: string;
  studyArticle: StudyArticle | null;
  studyLoading: boolean;
  studyError: string;
  selectedStudyRecordId: string | null;
  onRefreshInsight: () => void;
  onOpenStudy: (record: TranslationRecord) => void;
  onCloseStudy: () => void;
  onListenPhrase?: (language: LanguageCode, text: string) => void;
  onAskBreakdownQuestion?: (
    record: TranslationRecord,
    question: string,
    history: BreakdownChatMessage[],
  ) => Promise<string>;
  onDelete: (id: string) => void;
  onClear: () => void;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatDirection = (
  record: Pick<TranslationRecord, 'sourceLanguage' | 'targetLanguage'>,
) => `${record.sourceLanguage.toUpperCase()} a ${record.targetLanguage.toUpperCase()}`;

const modeLabel: Record<ExpressionMode, string> = {
  translate_to_english: 'Espanol a ingles',
  improve_english: 'Ingles mejorado',
  translate_to_spanish: 'Ingles a espanol',
};

const formatRecordLabel = (record: TranslationRecord) =>
  record.mode ? modeLabel[record.mode] : formatDirection(record);

const InsightItems = ({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: 'writing' | 'conversation';
  items: LearningInsightItem[];
  emptyText: string;
}) => {
  const Icon = icon === 'writing' ? PenLine : MessageSquareText;

  return (
    <section className='border border-slate-200 bg-white p-4'>
      <div className='mb-3 flex items-center gap-2 text-sm font-black text-slate-950'>
        <Icon size={17} />
        {title}
      </div>

      {items.length === 0 ? (
        <p className='text-sm leading-6 text-slate-500'>{emptyText}</p>
      ) : (
        <div className='space-y-3'>
          {items.map((item) => (
            <article
              key={`${item.title}-${item.expression}`}
              className='border border-slate-100 bg-slate-50 p-3'
            >
              <div className='text-xs font-black uppercase tracking-normal text-slate-400'>
                {item.title}
              </div>
              <p className='mt-2 break-words text-lg font-black leading-snug text-slate-950'>
                {item.expression}
              </p>
              <p className='mt-2 text-sm leading-6 text-slate-600'>
                {item.explanation}
              </p>
              {item.example ? (
                <p className='mt-2 rounded-md bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700'>
                  {item.example}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export const LearningView = ({
  history,
  learningInsight,
  insightLoading,
  insightError,
  studyArticle,
  studyLoading,
  studyError,
  selectedStudyRecordId,
  onRefreshInsight,
  onOpenStudy,
  onCloseStudy,
  onListenPhrase,
  onAskBreakdownQuestion,
  onDelete,
  onClear,
}: LearningViewProps) => {
  const metrics = useMemo(() => buildLearningDashboard(history), [history]);
  const primaryDirection = metrics.directionMix[0];
  const selectedStudyRecord = history.find(
    (record) => record.id === selectedStudyRecordId,
  );
  const studyIsOpen = Boolean(
    selectedStudyRecordId || studyArticle || studyLoading || studyError,
  );
  const canRefreshInsight = history.length > 0 && !insightLoading;

  if (studyIsOpen) {
    return (
      <main className='min-h-0 flex-1 overflow-y-auto bg-[#eef5f8] p-3 sm:p-5'>
        <StudyArticleView
          article={studyArticle}
          selectedRecord={selectedStudyRecord}
          loading={studyLoading}
          error={studyError}
          onClose={onCloseStudy}
          onListenPhrase={onListenPhrase}
          onAskBreakdownQuestion={onAskBreakdownQuestion}
        />
      </main>
    );
  }

  return (
    <main className='grid min-h-0 flex-1 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-4 p-4 max-lg:grid-cols-1'>
      <aside className='flex min-h-0 flex-col border border-slate-200 bg-white'>
        <div className='border-b border-slate-100 p-4'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h2 className='flex items-center gap-2 text-base font-bold text-slate-950'>
                <BookOpen size={18} />
                Historial
              </h2>
              <p className='mt-1 text-sm text-slate-500'>
                {history.length
                  ? `${Math.min(history.length, MAX_LEARNING_HISTORY)} respuestas recientes alimentan Learning`
                  : 'Tus respuestas guardadas van a aparecer aca'}
              </p>
            </div>
            <button
              type='button'
              onClick={onClear}
              disabled={history.length === 0}
              className='inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-2 text-slate-500 transition-colors hover:text-rose-600 disabled:text-slate-300'
              title='Limpiar historial'
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto p-2'>
          {history.length === 0 ? (
            <div className='p-4 text-sm text-slate-500'>
              Guarda algunas respuestas reales y volve para aprender desde tu historial.
            </div>
          ) : (
            history.map((record) => (
              <article
                key={record.id}
                className={`mb-2 border p-3 ${
                  selectedStudyRecordId === record.id
                    ? 'border-slate-400 bg-slate-50'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <button
                  type='button'
                  onClick={() => onOpenStudy(record)}
                  className='block w-full text-left'
                >
                  <div className='text-xs font-bold uppercase tracking-normal text-slate-400'>
                    {formatRecordLabel(record)} - {formatDate(record.createdAt)}
                  </div>
                  <p className='mt-2 line-clamp-2 text-sm font-semibold text-slate-900'>
                    {record.sourceText}
                  </p>
                  <p className='mt-1 line-clamp-2 text-sm text-slate-500'>
                    {record.translatedText}
                  </p>
                  <span className='mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-700'>
                    <BookOpen size={13} />
                    Estudiar
                  </span>
                </button>
                <div className='mt-2 flex flex-wrap items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => onDelete(record.id)}
                    className='inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600'
                  >
                    <Trash2 size={13} />
                    Borrar
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>

      <section className='flex min-h-0 flex-col gap-4 overflow-y-auto'>
        <div className='border border-slate-200 bg-white p-4'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-base font-bold text-slate-950'>Panel de Learning</h2>
              <p className='mt-1 text-sm text-slate-500'>
                Senales personales desde tus textos guardados y conversaciones reales.
              </p>
            </div>
            <div className='inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700'>
              <Lightbulb size={16} />
              {metrics.uniqueContextCount} senales de aprendizaje
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <BookOpen size={15} />
                Respuestas guardadas
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {metrics.totalRecords}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {metrics.uniqueContextCount}/{MAX_LEARNING_HISTORY} respuestas recientes usadas
              </p>
            </article>

            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <Repeat2 size={15} />
                Palabras repetidas
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {metrics.reusedWordTotal}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {metrics.reusedWords[0]?.value || 'Todavia no hay patrones repetidos'}
              </p>
            </article>

            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <TrendingUp size={15} />
                Frases repetidas
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {metrics.repeatedPhraseTotal}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {metrics.repeatedPhrases[0]?.value || 'Construyendo memoria de frases'}
              </p>
            </article>

            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <Languages size={15} />
                Direcciones
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {primaryDirection ? `${primaryDirection.percentage}%` : '0%'}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {primaryDirection
                  ? formatDirection(primaryDirection)
                  : 'Todavia no hay respuestas'}
              </p>
            </article>
          </div>

          {metrics.uniqueContextCount === 0 ? (
            <div className='mt-4 border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600'>
              Guarda algunas frases reales para desbloquear senales de vocabulario personal.
            </div>
          ) : null}
        </div>

        <section className='border border-slate-200 bg-white p-4'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-base font-bold text-slate-950'>
                Ingles util desde tu historial
              </h2>
              <p className='mt-1 text-sm text-slate-500'>
                Frases reutilizables, notas de tono y mejores formas para la proxima vez.
              </p>
            </div>
            <button
              type='button'
              onClick={onRefreshInsight}
              disabled={!canRefreshInsight}
              className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors ${
                canRefreshInsight
                  ? 'bg-slate-950 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {insightLoading ? (
                <Loader2 size={16} className='animate-spin' />
              ) : (
                <RefreshCw size={16} />
              )}
              {insightLoading ? 'Actualizando' : 'Actualizar'}
            </button>
          </div>

          {insightError ? (
            <div className='mb-4 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
              <AlertCircle size={16} className='mt-0.5 shrink-0' />
              {insightError}
            </div>
          ) : null}

          {insightLoading && !learningInsight ? (
            <div className='flex min-h-24 items-center justify-center gap-2 border border-slate-100 bg-slate-50 text-sm font-semibold text-slate-500'>
              <Loader2 size={17} className='animate-spin' />
              Cargando senales de Learning
            </div>
          ) : null}

          {!insightLoading && !learningInsight ? (
            <div className='border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500'>
              Tu historial guardado desbloquea aprendizajes practicos. Segui
              usando mensajes reales y actualiza cuando quieras una nueva lectura.
            </div>
          ) : null}

          {learningInsight ? (
            <div className='space-y-4'>
              {learningInsight.summary ? (
                <p className='border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600'>
                  {learningInsight.summary}
                </p>
              ) : null}

              <div className='grid gap-4 xl:grid-cols-2'>
                <InsightItems
                  title='Desde lo que escribis'
                  icon='writing'
                  items={learningInsight.writingItems}
                  emptyText='Tus respuestas en ingles y mejoras de ingles van a formar este grupo.'
                />
                <InsightItems
                  title='Desde conversaciones'
                  icon='conversation'
                  items={learningInsight.conversationItems}
                  emptyText='Los mensajes en ingles que entiendas en espanol van a formar este grupo.'
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className='border border-slate-200 bg-white p-4'>
          <div className='mb-3 flex items-center gap-2'>
            <Clock size={17} className='text-slate-400' />
            <h2 className='text-base font-bold text-slate-950'>Respuestas recientes</h2>
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            {metrics.recentContexts.length === 0 ? (
              <p className='text-sm text-slate-500'>
                Tus respuestas guardadas recientes van a aparecer aca.
              </p>
            ) : (
              metrics.recentContexts.map((record) => (
                <article key={record.id} className='border border-slate-100 p-3'>
                  <div className='text-xs font-bold uppercase tracking-normal text-slate-400'>
                    {formatRecordLabel(record)}
                  </div>
                  <p className='mt-2 line-clamp-2 text-sm font-semibold text-slate-900'>
                    {record.translatedText}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
};
