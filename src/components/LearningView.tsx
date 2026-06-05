import type {
  LanguageCode,
  PracticeSet as PracticeSetType,
  StudyArticle,
  TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import {
  BookOpen,
  Clock,
  Dumbbell,
  Languages,
  Repeat2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { MAX_LEARNING_HISTORY } from '../constants';
import { buildLearningDashboard } from '../services/learning-metrics';
import { PracticeSet } from './PracticeSet';
import { StudyArticleView } from './StudyArticleView';

type LearningViewProps = {
  history: TranslationRecord[];
  practice: PracticeSetType | null;
  loading: boolean;
  insufficientHistory: boolean;
  error: string;
  studyArticle: StudyArticle | null;
  studyLoading: boolean;
  studyError: string;
  selectedStudyRecordId: string | null;
  onGenerate: () => void;
  onOpenStudy: (record: TranslationRecord) => void;
  onCloseStudy: () => void;
  onListenPhrase?: (language: LanguageCode, text: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatDirection = (record: Pick<TranslationRecord, 'sourceLanguage' | 'targetLanguage'>) =>
  `${record.sourceLanguage.toUpperCase()} to ${record.targetLanguage.toUpperCase()}`;

export const LearningView = ({
  history,
  practice,
  loading,
  insufficientHistory,
  error,
  studyArticle,
  studyLoading,
  studyError,
  selectedStudyRecordId,
  onGenerate,
  onOpenStudy,
  onCloseStudy,
  onListenPhrase,
  onDelete,
  onClear,
}: LearningViewProps) => {
  const metrics = useMemo(() => buildLearningDashboard(history), [history]);
  const canGenerate = metrics.uniqueContextCount > 0 && !loading;
  const primaryDirection = metrics.directionMix[0];
  const selectedStudyRecord = history.find(
    (record) => record.id === selectedStudyRecordId,
  );
  const studyIsOpen = Boolean(
    selectedStudyRecordId || studyArticle || studyLoading || studyError,
  );

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
                History
              </h2>
              <p className='mt-1 text-sm text-slate-500'>
                {history.length
                  ? `${Math.min(history.length, MAX_LEARNING_HISTORY)} recent unique records feed practice`
                  : 'Saved translations will appear here'}
              </p>
            </div>
            <button
              type='button'
              onClick={onClear}
              disabled={history.length === 0}
              className='inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-2 text-slate-500 transition-colors hover:text-rose-600 disabled:text-slate-300'
              title='Clear all history'
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto p-2'>
          {history.length === 0 ? (
            <div className='p-4 text-sm text-slate-500'>
              Translate a few real phrases, then come back for contextual practice.
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
                    {formatDirection(record)} - {formatDate(record.createdAt)}
                  </div>
                  <p className='mt-2 line-clamp-2 text-sm font-semibold text-slate-900'>
                    {record.sourceText}
                  </p>
                  <p className='mt-1 line-clamp-2 text-sm text-slate-500'>
                    {record.translatedText}
                  </p>
                  <span className='mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-700'>
                    <BookOpen size={13} />
                    Study
                  </span>
                </button>
                <div className='mt-2 flex flex-wrap items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => onDelete(record.id)}
                    className='inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600'
                  >
                    <Trash2 size={13} />
                    Delete
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
              <h2 className='text-base font-bold text-slate-950'>Learning dashboard</h2>
              <p className='mt-1 text-sm text-slate-500'>
                Personal signals from your saved Spanish and English context.
              </p>
            </div>
            <div className='inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700'>
              <Target size={16} />
              {metrics.practiceReadiness.label}
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <Repeat2 size={15} />
                Reused words
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {metrics.reusedWordTotal}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {metrics.reusedWords[0]?.value || 'No repeat pattern yet'}
              </p>
            </article>

            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <TrendingUp size={15} />
                Repeated phrases
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {metrics.repeatedPhraseTotal}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {metrics.repeatedPhrases[0]?.value || 'Building phrase memory'}
              </p>
            </article>

            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <Languages size={15} />
                Direction mix
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {primaryDirection ? `${primaryDirection.percentage}%` : '0%'}
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {primaryDirection
                  ? formatDirection(primaryDirection)
                  : 'No translations yet'}
              </p>
            </article>

            <article className='border border-slate-100 p-3'>
              <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-slate-400'>
                <Clock size={15} />
                Practice readiness
              </div>
              <div className='mt-3 text-3xl font-black text-slate-950'>
                {metrics.practiceReadiness.score}%
              </div>
              <p className='mt-1 text-sm text-slate-500'>
                {metrics.uniqueContextCount}/{MAX_LEARNING_HISTORY} context slots
              </p>
            </article>
          </div>

          {metrics.uniqueContextCount === 0 ? (
            <div className='mt-4 border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600'>
              Translate a few real phrases to unlock personal vocabulary signals.
            </div>
          ) : null}

          {metrics.uniqueContextCount > 0 && metrics.uniqueContextCount < 5 ? (
            <div className='mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
              More saved translations will improve Learning variety and reuse signals.
            </div>
          ) : null}
        </div>

        <StudyArticleView
          article={studyArticle}
          selectedRecord={selectedStudyRecord}
          loading={studyLoading}
          error={studyError}
          onClose={onCloseStudy}
        />

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]'>
          <section className='border border-slate-200 bg-white p-4'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div>
                <h2 className='text-base font-bold text-slate-950'>Recommended exercises</h2>
                <p className='mt-1 text-sm text-slate-500'>
                  Quick paths from your latest saved context.
                </p>
              </div>
              <Dumbbell size={20} className='text-slate-400' />
            </div>

            <div className='grid gap-3 md:grid-cols-3'>
              {metrics.recommendedExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  type='button'
                  onClick={onGenerate}
                  disabled={!canGenerate || !exercise.enabled}
                  className={`min-h-36 rounded-md border p-3 text-left transition-colors ${
                    canGenerate && exercise.enabled
                      ? 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                      : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  <div className='text-sm font-black text-slate-950'>
                    {exercise.title}
                  </div>
                  <p className='mt-2 line-clamp-3 text-sm text-slate-500'>
                    {exercise.detail}
                  </p>
                  <div className='mt-4 text-xs font-bold uppercase tracking-normal text-slate-400'>
                    {exercise.count} signals
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className='border border-slate-200 bg-white p-4'>
            <h2 className='text-base font-bold text-slate-950'>Recent context</h2>
            <div className='mt-3 space-y-3'>
              {metrics.recentContexts.length === 0 ? (
                <p className='text-sm text-slate-500'>
                  Recent saved translations will appear here.
                </p>
              ) : (
                metrics.recentContexts.map((record) => (
                  <article key={record.id} className='border border-slate-100 p-3'>
                    <div className='text-xs font-bold uppercase tracking-normal text-slate-400'>
                      {formatDirection(record)}
                    </div>
                    <p className='mt-2 line-clamp-2 text-sm font-semibold text-slate-900'>
                      {record.translatedText}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <section className='flex min-h-[360px] flex-col border border-slate-200 bg-white'>
          <div className='flex items-center justify-between gap-4 border-b border-slate-100 p-4'>
            <div className='min-w-0'>
              <h2 className='text-base font-bold text-slate-950'>Practice</h2>
              <p className='mt-1 text-sm text-slate-500'>
                Vocabulary recall, fill-in, and re-translate from your saved context.
              </p>
            </div>
            <button
              type='button'
              onClick={onGenerate}
              disabled={!canGenerate}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors ${
                canGenerate
                  ? 'bg-slate-950 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Sparkles size={16} />
              {loading ? 'Generating' : 'Generate'}
            </button>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto p-4'>
            {error ? (
              <div className='mb-4 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700'>
                {error}
              </div>
            ) : null}
            {insufficientHistory && history.length > 0 ? (
              <div className='mb-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
                More saved translations will improve practice variety.
              </div>
            ) : null}
            <PracticeSet items={practice?.items || []} />
          </div>
        </section>
      </section>
    </main>
  );
};
