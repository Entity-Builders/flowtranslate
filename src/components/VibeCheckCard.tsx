import type { VibeCheck } from '@eb-packages/flowtranslate-core';
import { AlertTriangle, Gauge } from 'lucide-react';

type VibeCheckCardProps = {
  vibeCheck: VibeCheck;
};

const TONE_COLORS: Record<VibeCheck['tone'], { bar: string; badge: string; text: string }> = {
  formal: {
    bar: 'bg-slate-700',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'Formal',
  },
  professional: {
    bar: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    text: 'Professional',
  },
  neutral: {
    bar: 'bg-violet-400',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    text: 'Neutral',
  },
  casual: {
    bar: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'Casual',
  },
  slang: {
    bar: 'bg-rose-400',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    text: 'Slang / Informal',
  },
};

export const VibeCheckCard = ({ vibeCheck }: VibeCheckCardProps) => {
  const colors = TONE_COLORS[vibeCheck.tone];
  // score 0 = very formal (left), 10 = very casual (right)
  const pct = Math.min(100, Math.max(0, vibeCheck.score * 10));

  return (
    <section
      className='space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
      aria-label='Vibe Check'
    >
      <div className='flex items-center gap-2'>
        <Gauge size={16} className='text-slate-400' />
        <span className='text-xs font-black uppercase tracking-normal text-slate-400'>
          Vibe Check
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${colors.badge}`}
        >
          <span role='img' aria-label={colors.text}>
            {vibeCheck.emoji}
          </span>
          {colors.text}
        </span>
      </div>

      <div aria-label={`Tone score: ${vibeCheck.score} out of 10`}>
        <div className='mb-1 flex justify-between text-[10px] font-semibold text-slate-400'>
          <span>Formal</span>
          <span>Casual</span>
        </div>
        <div className='h-1.5 w-full overflow-hidden rounded-full bg-slate-200'>
          <div
            className={`h-full rounded-full transition-all ${colors.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className='text-sm text-slate-600 leading-relaxed'>{vibeCheck.culturalNote}</p>

      {vibeCheck.watchOut ? (
        <div className='flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2'>
          <AlertTriangle size={15} className='mt-0.5 shrink-0 text-amber-700' />
          <p className='text-xs text-amber-800 leading-relaxed'>{vibeCheck.watchOut}</p>
        </div>
      ) : null}
    </section>
  );
};
