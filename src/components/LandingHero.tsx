import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  MessageSquareText,
  Send,
} from 'lucide-react';

export type LandingExample = {
  id: string;
  label: string;
  context: string;
  rawInput: string;
  output: string;
};

type LandingHeroProps = {
  examples: LandingExample[];
  onStartBlank: () => void;
  onSelectExample: (example: LandingExample) => void;
};

const proofPoints = [
  'Español, Spanglish o inglés inseguro',
  'Listo para copiar',
  'Sin cuenta para probar',
];

export const LandingHero = ({
  examples,
  onStartBlank,
  onSelectExample,
}: LandingHeroProps) => (
  <section className='min-w-0 bg-slate-50 px-4 pb-10 pt-8 sm:px-6 lg:px-8'>
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-7'>
      <div className='min-w-0'>
        <div className='inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-normal text-emerald-800'>
          <BriefcaseBusiness size={14} />
          Inglés para mensajes reales de trabajo
        </div>
        <h1 className='mt-4 max-w-4xl text-4xl font-black leading-[1.03] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl'>
          Respondé en inglés profesional aunque tu idea salga mezclada.
        </h1>
        <p className='mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-600 sm:text-lg'>
          Escribí en español, Spanglish o inglés inseguro. FlowTranslate lo
          convierte en una respuesta natural, profesional y lista para copiar.
        </p>

        <div className='mt-5 flex flex-wrap gap-2'>
          {proofPoints.map((item) => (
            <span
              key={item}
              className='inline-flex min-h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/80'
            >
              <CheckCircle2 size={14} className='shrink-0 text-emerald-600' />
              {item}
            </span>
          ))}
        </div>

        <div className='mt-6 flex flex-col gap-2 min-[430px]:flex-row'>
          <button
            type='button'
            onClick={onStartBlank}
            className='inline-flex h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-black text-white transition-colors hover:bg-slate-800'
          >
            <Send size={17} />
            Crear mi respuesta
          </button>
          <a
            href='#ejemplos'
            className='inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950'
          >
            Ver ejemplos
            <ArrowRight size={16} />
          </a>
        </div>
      </div>

      <div className='overflow-hidden rounded-lg bg-white shadow-[0_22px_80px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/80'>
        <div className='border-b border-slate-100 px-4 py-3 sm:px-6'>
          <div className='inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100'>
            <MessageSquareText size={14} />
            Demo de respuesta
          </div>
        </div>
        <div className='grid min-w-0 gap-0 lg:grid-cols-[1fr_1.05fr]'>
          <div className='min-w-0 border-b border-slate-100 p-4 sm:p-6 lg:border-b-0 lg:border-r'>
            <p className='text-xs font-black uppercase tracking-normal text-slate-400'>
              Tu idea cruda
            </p>
            <p className='mt-3 max-w-2xl break-words text-2xl font-semibold leading-[1.22] text-slate-950 [overflow-wrap:anywhere]'>
              No puedo llegar a la call today. Can we move it to tomorrow?
            </p>
          </div>
          <div className='min-w-0 bg-slate-950 p-4 text-white sm:p-6'>
            <p className='text-xs font-black uppercase tracking-normal text-emerald-300'>
              Inglés profesional
            </p>
            <p className='mt-3 max-w-2xl break-words text-2xl font-semibold leading-[1.22] [overflow-wrap:anywhere]'>
              I won't be able to make today's call. Could we move it to tomorrow?
            </p>
            <div className='mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-black text-white'>
              <Copy size={16} />
              Listo para copiar
            </div>
          </div>
        </div>
      </div>

      <div className='flex min-w-0 flex-wrap gap-2' aria-label='Ejemplos rápidos'>
        {examples.slice(0, 4).map((example) => (
          <button
            key={example.id}
            type='button'
            onClick={() => onSelectExample(example)}
            className='inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950'
          >
            <MessageSquareText size={15} className='shrink-0 text-slate-500' />
            <span className='truncate'>{example.label}</span>
            <ArrowRight size={14} className='shrink-0 text-slate-400' />
          </button>
        ))}
      </div>
    </div>
  </section>
);
