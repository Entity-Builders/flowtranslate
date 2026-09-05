import type { SandboxVariation } from '@entity-builders/flowtranslate-core';
import { ArrowRight, FlaskConical } from 'lucide-react';

type GrammarSandboxProps = {
  sandbox: SandboxVariation[];
};

export const GrammarSandbox = ({ sandbox }: GrammarSandboxProps) => {
  if (!sandbox.length) return null;

  return (
    <section
      className='space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
      aria-label='Practica de gramatica'
    >
      <div className='flex items-center gap-2'>
        <FlaskConical size={16} className='text-slate-400' />
        <span className='text-xs font-black uppercase tracking-normal text-slate-400'>
          Practica de gramatica
        </span>
        <span className='ml-auto text-xs text-slate-400'>
          Que pasa si cambias una cosa?
        </span>
      </div>

      <div className='space-y-3'>
        {sandbox.map((variation) => (
          <div
            key={variation.label}
            className='space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3'
          >
            <div className='inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700'>
              {variation.label}
            </div>
            <div className='grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'>
              <span className='min-w-0 break-words font-semibold italic text-slate-500'>
                {variation.original}
              </span>
              <ArrowRight
                size={14}
                className='hidden shrink-0 text-slate-300 sm:block'
                aria-hidden
              />
              <span className='min-w-0 break-words font-bold text-slate-900'>
                {variation.translation}
              </span>
            </div>
            <p className='text-xs text-slate-500 leading-relaxed'>{variation.nuance}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
