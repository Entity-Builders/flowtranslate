import { CheckCircle2, Copy, Languages, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import {
  LandingHero,
  type LandingExample,
} from '../../components/LandingHero';
import {
  analytics,
  commercialAnalyticsProperties,
} from '../../services/analytics';
import type { CommercialExperimentKey } from './useFlowtranslateCommercialExperiments';

export const FLOWTRANSLATE_LAUNCH_PATH = '/respuestas-en-ingles';

export type LaunchLandingContext = {
  selectedExampleId?: string;
  selectedExampleLabel?: string;
  sourceSituation?: string;
  campaignId?: string;
  variantId?: string;
};

export const LAUNCH_LANDING_EXAMPLES: LandingExample[] = [
  {
    id: 'client-delay',
    label: 'Avisar una demora',
    context: 'Demora con cliente',
    rawInput:
      'El reporte se demora hasta mañana. Ya estamos revisando los datos y te mando una version clara apenas este lista.',
    output:
      "The report will be delayed until tomorrow. We're already reviewing the data, and I'll send you a clear version as soon as it's ready.",
  },
  {
    id: 'spanglish-reschedule',
    label: 'Reagendar una call',
    context: 'Reunión de trabajo',
    rawInput: 'Sorry, hoy no llego a la call. Can we move it to tomorrow same time?',
    output:
      "Sorry, I won't be able to make today's call. Could we move it to tomorrow at the same time?",
  },
  {
    id: 'rough-status',
    label: 'Mejorar un update',
    context: 'Status para manager',
    rawInput:
      'I finish most part but still need check numbers. I send final today afternoon.',
    output:
      "I've finished most of it, but I still need to review the numbers. I'll send the final version this afternoon.",
  },
  {
    id: 'client-boundary',
    label: 'Poner un límite',
    context: 'Cambio de alcance',
    rawInput:
      'Esto no estaba incluido en el scope inicial. Lo puedo hacer pero necesitaria ajustar presupuesto.',
    output:
      "This wasn't included in the original scope. I can take care of it, but we would need to adjust the budget accordingly.",
  },
  {
    id: 'linkedin-dm',
    label: 'Responder LinkedIn',
    context: 'Oportunidad laboral',
    rawInput:
      'Gracias por escribir. Me interesa saber mas del role, podemos coordinar una llamada corta?',
    output:
      "Thanks for reaching out. I'd be interested in learning more about the role. Could we schedule a short call?",
  },
];

type LaunchLandingRouteProps = {
  onStartBlank: () => void;
  onSelectExample: (example: LandingExample) => void;
  onTrackExperimentExposure?: (
    experimentKey: CommercialExperimentKey,
    properties?: Record<string, unknown>,
  ) => void;
};

const LANDING_TITLE = 'FlowTranslate - Respuestas de trabajo en inglés';
const LANDING_DESCRIPTION =
  'Escribí tu idea en español, Spanglish o inglés inseguro y convertíla en una respuesta profesional en inglés lista para copiar.';
const LANDING_URL = `https://flowtranslate.app${FLOWTRANSLATE_LAUNCH_PATH}`;
const DEFAULT_TITLE = 'FlowTranslate | Respuestas de trabajo en inglés';
const DEFAULT_DESCRIPTION =
  'Escribí tu idea en español, Spanglish o inglés inseguro y convertíla en una respuesta profesional en inglés lista para copiar.';
const DEFAULT_URL = 'https://flowtranslate.app/';

const setMetaByName = (name: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
};

const setMetaByProperty = (property: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.content = content;
};

const setCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
};

export const LaunchLandingRoute = ({
  onStartBlank,
  onSelectExample,
  onTrackExperimentExposure,
}: LaunchLandingRouteProps) => {
  const trackedLandingViewRef = useRef(false);

  useEffect(() => {
    document.title = LANDING_TITLE;
    setMetaByName('description', LANDING_DESCRIPTION);
    setMetaByProperty('og:title', LANDING_TITLE);
    setMetaByProperty('og:description', LANDING_DESCRIPTION);
    setMetaByProperty('og:url', LANDING_URL);
    setMetaByProperty('og:image', 'https://flowtranslate.app/icon.png');
    setMetaByName('twitter:title', LANDING_TITLE);
    setMetaByName('twitter:description', LANDING_DESCRIPTION);
    setCanonical(LANDING_URL);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaByName('description', DEFAULT_DESCRIPTION);
      setMetaByProperty('og:title', DEFAULT_TITLE);
      setMetaByProperty('og:description', DEFAULT_DESCRIPTION);
      setMetaByProperty('og:url', DEFAULT_URL);
      setMetaByName('twitter:title', DEFAULT_TITLE);
      setMetaByName('twitter:description', DEFAULT_DESCRIPTION);
      setCanonical(DEFAULT_URL);
    };
  }, []);

  useEffect(() => {
    if (trackedLandingViewRef.current) return;
    trackedLandingViewRef.current = true;
    analytics.track(
      'landing_viewed',
      commercialAnalyticsProperties({
        landing_route: FLOWTRANSLATE_LAUNCH_PATH,
        surface: 'campaign_landing',
      }),
    );
    onTrackExperimentExposure?.('ft_launch_landing_message', {
      surface: 'campaign_landing',
    });
    onTrackExperimentExposure?.('ft_launch_offer', {
      surface: 'campaign_landing',
    });
  }, [onTrackExperimentExposure]);

  const trackLandingCta = useCallback(
    (cta: string, properties: Record<string, unknown> = {}) => {
      analytics.track(
        'landing_cta_clicked',
        commercialAnalyticsProperties({
          cta,
          landing_route: FLOWTRANSLATE_LAUNCH_PATH,
          ...properties,
        }),
      );
    },
    [],
  );

  const startBlankFromSurface = useCallback(
    (surface: string) => {
      trackLandingCta('start_blank', { surface });
      onStartBlank();
    },
    [onStartBlank, trackLandingCta],
  );

  const selectExampleFromSurface = useCallback(
    (example: LandingExample, surface: string) => {
      trackLandingCta('example_selected', {
        surface,
        example_id: example.id,
        source_situation: example.context,
      });
      onSelectExample(example);
    },
    [onSelectExample, trackLandingCta],
  );

  return (
    <main className='min-h-[100dvh] overflow-x-hidden bg-slate-50 text-slate-950'>
      <header className='border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8'>
        <div className='mx-auto flex max-w-6xl items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/30'>
              <Languages size={20} />
            </div>
            <div className='min-w-0'>
              <p className='truncate text-base font-black leading-none'>
                FlowTranslate
              </p>
              <p className='mt-1 hidden text-xs font-bold text-slate-500 sm:block'>
                Inglés profesional desde ideas mezcladas
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => startBlankFromSurface('header')}
            className='inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-black text-white transition-colors hover:bg-slate-800 sm:px-4'
          >
            Probar gratis
          </button>
        </div>
      </header>

      <LandingHero
        examples={LAUNCH_LANDING_EXAMPLES}
        onStartBlank={() => startBlankFromSurface('hero')}
        onSelectExample={(example) => selectExampleFromSurface(example, 'hero')}
      />

      <section className='bg-white px-4 py-12 sm:px-6 lg:px-8'>
        <div className='mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]'>
          <div>
            <p className='text-xs font-black uppercase tracking-normal text-emerald-700'>
              Situaciones de trabajo
            </p>
            <h2 className='mt-3 max-w-2xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl'>
              Para mensajes que querés mandar bien, no solamente traducir.
            </h2>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            {[
              'Responder a un cliente sin sonar brusco',
              'Avisar una demora y mantener confianza',
              'Pedir más contexto antes de comprometerte',
              'Responder LinkedIn, recruiters o propuestas',
              'Poner límites de alcance con tono profesional',
              'Compartir un update claro con tu equipo',
            ].map((item) => (
              <div
                key={item}
                className='rounded-md border border-slate-200 bg-slate-50 p-4'
              >
                <CheckCircle2 size={18} className='text-emerald-600' />
                <p className='mt-3 text-sm font-bold leading-6 text-slate-700'>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id='ejemplos' className='px-4 py-12 sm:px-6 lg:px-8'>
        <div className='mx-auto max-w-6xl'>
          <div className='max-w-3xl'>
            <p className='text-xs font-black uppercase tracking-normal text-emerald-700'>
              Antes y después
            </p>
            <h2 className='mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl'>
              Escribí como puedas. Copiá una respuesta que suena profesional.
            </h2>
          </div>

          <div className='mt-7 grid gap-4 lg:grid-cols-2'>
            {LAUNCH_LANDING_EXAMPLES.map((example) => (
              <article
                key={example.id}
                className='overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
              >
                <div className='border-b border-slate-100 p-4'>
                  <p className='text-xs font-black uppercase tracking-normal text-slate-400'>
                    {example.context}
                  </p>
                  <p className='mt-2 break-words text-base font-semibold leading-7 text-slate-950 [overflow-wrap:anywhere]'>
                    {example.rawInput}
                  </p>
                </div>
                <div className='bg-slate-950 p-4 text-white'>
                  <p className='text-xs font-black uppercase tracking-normal text-emerald-300'>
                    Inglés profesional
                  </p>
                  <p className='mt-2 break-words text-base font-semibold leading-7 [overflow-wrap:anywhere]'>
                    {example.output}
                  </p>
                  <button
                    type='button'
                    onClick={() =>
                      selectExampleFromSurface(example, 'before_after')
                    }
                    className='mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-emerald-500 px-3 text-sm font-black text-white transition-colors hover:bg-emerald-400'
                  >
                    <Copy size={16} />
                    Probar este ejemplo
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className='bg-white px-4 py-12 sm:px-6 lg:px-8'>
        <div className='mx-auto grid max-w-6xl gap-6 lg:grid-cols-3'>
          <div className='rounded-lg border border-slate-200 bg-slate-50 p-5'>
            <ShieldCheck size={22} className='text-emerald-600' />
            <h3 className='mt-4 text-lg font-black text-slate-950'>
              Mensajes privados
            </h3>
            <p className='mt-2 text-sm font-semibold leading-6 text-slate-600'>
              Tus textos de trabajo no se envían a analytics. Medimos acciones,
              no el contenido que escribís.
            </p>
          </div>
          <div className='rounded-lg border border-slate-200 bg-slate-50 p-5'>
            <CheckCircle2 size={22} className='text-emerald-600' />
            <h3 className='mt-4 text-lg font-black text-slate-950'>
              Gratis para probar
            </h3>
            <p className='mt-2 text-sm font-semibold leading-6 text-slate-600'>
              Probalo con tus propios mensajes antes de crear una cuenta.
              Conectá después para guardar historial.
            </p>
          </div>
          <div className='rounded-lg border border-slate-200 bg-slate-50 p-5'>
            <Copy size={22} className='text-emerald-600' />
            <h3 className='mt-4 text-lg font-black text-slate-950'>
              Pro para uso frecuente
            </h3>
            <p className='mt-2 text-sm font-semibold leading-6 text-slate-600'>
              Más respuestas, historial persistente y Learning personalizado
              desde conversaciones reales.
            </p>
          </div>
        </div>
      </section>

      <footer className='px-4 py-10 sm:px-6 lg:px-8'>
        <div className='mx-auto flex max-w-6xl flex-col gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between'>
          <p className='max-w-2xl text-sm font-semibold leading-6 text-slate-600'>
            FlowTranslate ayuda a escribir inglés de trabajo más claro. No
            reemplaza revisión legal, contractual, HR o compliance.
          </p>
          <button
            type='button'
            onClick={() => startBlankFromSurface('footer')}
            className='inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-black text-white transition-colors hover:bg-slate-800'
          >
            Crear mi respuesta
          </button>
        </div>
      </footer>
    </main>
  );
};
