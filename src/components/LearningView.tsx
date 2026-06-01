import type {
  PracticeSet as PracticeSetType,
  TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import { BookOpen, Sparkles, Trash2 } from 'lucide-react';
import { MAX_LEARNING_HISTORY } from '../constants';
import { PracticeSet } from './PracticeSet';

type LearningViewProps = {
  history: TranslationRecord[];
  practice: PracticeSetType | null;
  loading: boolean;
  insufficientHistory: boolean;
  error: string;
  onGenerate: () => void;
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

export const LearningView = ({
  history,
  practice,
  loading,
  insufficientHistory,
  error,
  onGenerate,
  onDelete,
  onClear,
}: LearningViewProps) => {
  const canGenerate = history.length > 0 && !loading;

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
              <article key={record.id} className='mb-2 border border-slate-100 p-3'>
                <div className='text-xs font-bold uppercase tracking-normal text-slate-400'>
                  {record.sourceLanguage.toUpperCase()} to{' '}
                  {record.targetLanguage.toUpperCase()} - {formatDate(record.createdAt)}
                </div>
                <p className='mt-2 line-clamp-2 text-sm font-semibold text-slate-900'>
                  {record.sourceText}
                </p>
                <p className='mt-1 line-clamp-2 text-sm text-slate-500'>
                  {record.translatedText}
                </p>
                <button
                  type='button'
                  onClick={() => onDelete(record.id)}
                  className='mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600'
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </article>
            ))
          )}
        </div>
      </aside>

      <section className='flex min-h-0 flex-col border border-slate-200 bg-white'>
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
    </main>
  );
};
