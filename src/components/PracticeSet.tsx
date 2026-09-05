import type { PracticeItem } from '@entity-builders/flowtranslate-core';

const labels: Record<PracticeItem['type'], string> = {
  vocabulary_recall: 'Vocabulary',
  fill_in: 'Fill-in',
  re_translate: 'Re-translate',
};

type PracticeSetProps = {
  items: PracticeItem[];
};

export const PracticeSet = ({ items }: PracticeSetProps) => {
  if (items.length === 0) {
    return (
      <div className='flex min-h-[220px] items-center justify-center border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500'>
        Practice appears after you generate it from saved translations.
      </div>
    );
  }

  return (
    <div className='grid gap-3'>
      {items.map((item, index) => (
        <article
          key={`${item.type}-${item.translationRecordId || index}`}
          className='border border-slate-200 bg-white p-4'
        >
          <div className='text-xs font-bold uppercase tracking-normal text-emerald-700'>
            {labels[item.type]}
          </div>
          <p className='mt-2 text-base font-semibold text-slate-950'>
            {item.prompt}
          </p>
          <details className='mt-3'>
            <summary className='cursor-pointer text-sm font-semibold text-slate-600'>
              Answer
            </summary>
            <p className='mt-2 whitespace-pre-wrap text-sm text-slate-700'>
              {item.answer}
            </p>
          </details>
        </article>
      ))}
    </div>
  );
};
