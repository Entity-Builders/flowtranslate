import { ArrowRight, BriefcaseBusiness, CheckCircle2, MessageSquareText } from 'lucide-react';

export type LandingExample = {
  id: string;
  label: string;
  text: string;
};

const LANDING_EXAMPLES: LandingExample[] = [
  {
    id: 'client-delay',
    label: 'Responder a un cliente',
    text: 'Decile a un cliente que el reporte se demora hasta manana, pero que ya estamos revisando los datos y le vamos a mandar una version clara apenas este lista.',
  },
  {
    id: 'slack-update',
    label: 'Mejorar un Slack',
    text: 'I checked the deploy and I think the bug is not from the frontend. I need more time to review the logs and confirm.',
  },
  {
    id: 'linkedin-dm',
    label: 'Contestar LinkedIn',
    text: 'Decile a esta persona que gracias por escribir, que me interesa la propuesta, y que podemos coordinar una llamada corta la semana que viene.',
  },
  {
    id: 'direct-but-kind',
    label: 'Sonar directo y amable',
    text: 'Necesito decirle que no puedo tomar este trabajo ahora sin sonar cortante, pero dejando la puerta abierta para el mes que viene.',
  },
];

type LandingHeroProps = {
  onSelectExample: (example: LandingExample) => void;
};

const proofPoints = [
  'Sin login para probar',
  'Listo para copiar',
  'Detecta que necesitas',
];

export const LandingHero = ({
  onSelectExample,
}: LandingHeroProps) => (
  <section className='flex min-w-0 flex-col bg-slate-50 pb-1'>
    <div className='min-w-0'>
      <div className='inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-normal text-emerald-800'>
        <BriefcaseBusiness size={14} />
        Ingles para trabajo real
      </div>
      <h2 className='mt-3 max-w-3xl text-4xl font-black leading-[1.04] text-slate-950'>
        Tu respuesta en ingles, lista para mandar.
      </h2>
      <p className='mt-2 max-w-3xl text-base font-semibold leading-7 text-slate-600'>
        Pega lo que queres decirle a un cliente, equipo o contacto de trabajo.
        Flowtranslate te devuelve una version natural en ingles lista para copiar.
      </p>

      <div className='mt-3 flex flex-wrap gap-2'>
        {proofPoints.map((item) => (
          <span
            key={item}
            className='inline-flex min-h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm'
          >
            <CheckCircle2 size={14} className='shrink-0 text-emerald-600' />
            {item}
          </span>
        ))}
      </div>

      <div className='mt-3 flex min-w-0 flex-wrap gap-2'>
        {LANDING_EXAMPLES.map((example) => (
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
