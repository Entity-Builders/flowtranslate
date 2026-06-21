import { ArrowRight } from 'lucide-react';
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

const LAUNCH_LANDING_EXAMPLES: LandingExample[] = [
  {
    id: 'spanglish-reschedule',
    label: 'Reagendar call',
    channel: 'Slack',
    context: 'Reunión de trabajo',
    rawInput:
      'No puedo llegar a la call de mañana, algo surgió. Can we move it to Thursday?',
    output:
      "Hi — something came up and I won't be able to make tomorrow's call. Would Thursday work for you? Happy to find whatever time fits.",
  },
  {
    id: 'rough-status',
    label: 'Update de proyecto',
    channel: 'Email',
    context: 'Status para manager',
    rawInput:
      'El reporte tarda, I still need to check numbers, lo mando antes de las 5 pm de todas formas',
    output:
      "Quick update — the report is running a bit behind. I still need to verify a few numbers, but I'll have it to you before 5 PM today.",
  },
  {
    id: 'client-boundary',
    label: 'Límite de alcance',
    channel: 'Email',
    context: 'Cambio de alcance',
    rawInput:
      'Eso está fuera del scope original del proyecto, lo podemos hacer pero con costo extra',
    output:
      "That falls outside the original project scope. We can absolutely include it, but it would require additional work and come with an extra cost. Let me know if you'd like a separate quote.",
  },
  {
    id: 'linkedin-dm',
    label: 'Respuesta LinkedIn',
    channel: 'LinkedIn',
    context: 'Oportunidad laboral',
    rawInput:
      'Gracias por escribir, me interesa saber más del rol, podemos agendar una llamada corta esta semana?',
    output:
      "Thanks for reaching out — I'm definitely interested in learning more about the role. Would you be open to a quick call this week? I'm flexible on timing.",
  },
  {
    id: 'client-whatsapp',
    label: 'WhatsApp cliente',
    channel: 'WhatsApp',
    context: 'Demora con cliente',
    rawInput:
      'Sorry voy tarde con la entrega, hubo un problema técnico que no vi venir, lo tengo mañana a primera hora',
    output:
      "Apologies for the delay — an unexpected technical issue came up on my end. I'll have everything ready for you first thing tomorrow morning.",
  },
];

type LaunchLandingRouteProps = {
  onStartBlank: () => void;
  onTrackExperimentExposure?: (
    experimentKey: CommercialExperimentKey,
    properties?: Record<string, unknown>,
  ) => void;
};

const LANDING_TITLE = 'FlowTranslate - Respondé mensajes de trabajo en inglés';
const LANDING_DESCRIPTION =
  'Escribí tu idea en español, Spanglish o inglés inseguro y convertíla en un mensaje profesional en inglés listo para mandar.';
const LANDING_URL = `https://flowtranslate.app${FLOWTRANSLATE_LAUNCH_PATH}`;
const DEFAULT_TITLE = 'FlowTranslate | Respuestas de trabajo en inglés';
const DEFAULT_DESCRIPTION =
  'Escribí tu idea en español, Spanglish o inglés inseguro y convertíla en un mensaje profesional en inglés listo para mandar.';
const DEFAULT_URL = 'https://flowtranslate.app/';

type ToneExample = {
  tone: string;
  label: string;
  raw: string;
  output: string;
};

const toneExamples: ToneExample[] = [
  {
    tone: 'Formal',
    label: 'Para un cliente corporativo',
    raw: 'No puedo llegar a la reunión de mañana, algo surgió de último momento',
    output:
      "I regret to inform you that I will be unable to attend tomorrow's meeting due to an unforeseen matter. I would appreciate the opportunity to reschedule at your earliest convenience.",
  },
  {
    tone: 'Muy breve',
    label: 'Para un colega en Slack',
    raw: 'El reporte va a tardar un poco más, lo mando antes de las 5',
    output: 'Report running a bit late — will send before 5 PM.',
  },
  {
    tone: 'Amigable',
    label: 'Para un cliente habitual',
    raw: 'Gracias por el feedback, vamos a tenerlo en cuenta para la próxima versión',
    output:
      'Thanks so much for the feedback — really appreciate it! We will definitely keep that in mind for the next version.',
  },
  {
    tone: 'Directo',
    label: 'Para marcar un límite de scope',
    raw: 'Eso está fuera de lo que acordamos, si lo quieren hacer hay que presupuestarlo aparte',
    output:
      'That falls outside the agreed scope. If you want to include it, we will need to price it separately.',
  },
];

const toneClassName: Record<string, string> = {
  Formal: 'bg-[#1e3a5f] text-white',
  'Muy breve': 'bg-[#374151] text-white',
  Amigable: 'bg-[#7c3aed] text-white',
  Directo: 'bg-[#059669] text-white',
};

const improvementSteps = [
  {
    step: '01',
    title: 'Escribís como puedas',
    body:
      'En español, en spanglish, o en inglés inseguro. No hay forma incorrecta de empezar.',
  },
  {
    step: '02',
    title: 'Ves la respuesta lista',
    body:
      'Con el tono exacto que necesitabas. Copiás y pegás. Listo para enviar.',
  },
  {
    step: '03',
    title: 'La próxima vez ya sabés',
    body:
      'Los patrones se quedan. Cada mensaje que generás te entrena el oído.',
  },
];

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

const ToneBadge = ({ tone }: { tone: string }) => (
  <span
    className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
      toneClassName[tone] ?? 'bg-slate-200 text-slate-800'
    }`}
  >
    {tone}
  </span>
);

export const LaunchLandingRoute = ({
  onStartBlank,
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

  return (
    <main className='min-h-[100dvh] overflow-x-hidden bg-white text-slate-950'>
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex h-14 max-w-5xl items-center justify-between px-5'>
          <span className='text-base font-bold tracking-tight text-slate-950'>
            Flow<span className='text-emerald-600'>Translate</span>
          </span>
          <button
            type='button'
            onClick={() => startBlankFromSurface('header')}
            className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90'
          >
            Probar gratis
          </button>
        </div>
      </header>

      <LandingHero examples={LAUNCH_LANDING_EXAMPLES} />

      <section className='border-t border-slate-200 bg-white'>
        <div className='mx-auto max-w-5xl px-5 py-10'>
          <p className='mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500'>
            El mismo mensaje, el tono que necesitás
          </p>
          <p className='mb-6 text-sm font-medium text-slate-500'>
            No solo lo traduce — lo adapta al registro exacto de la situación.
          </p>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {toneExamples.map((example) => (
              <div key={example.tone} className='space-y-2'>
                <div className='mb-1 flex items-center gap-2'>
                  <ToneBadge tone={example.tone} />
                  <span className='text-xs font-medium text-slate-500'>
                    {example.label}
                  </span>
                </div>
                <div className='rounded border border-slate-200 bg-white px-3 py-2.5'>
                  <p className='text-xs italic leading-relaxed text-slate-500'>
                    &quot;{example.raw}&quot;
                  </p>
                </div>
                <div className='flex items-center gap-1.5 text-slate-500'>
                  <ArrowRight size={12} />
                  <span className='text-[11px] text-slate-500'>
                    {example.tone}
                  </span>
                </div>
                <div className='rounded border border-slate-200 bg-white px-3 py-2.5'>
                  <p className='text-xs font-medium leading-relaxed text-slate-950'>
                    &quot;{example.output}&quot;
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='border-t border-slate-200'>
        <div className='mx-auto max-w-5xl px-5 py-10'>
          <p className='mb-6 text-xs font-semibold uppercase tracking-widest text-slate-500'>
            Cómo mejorás con el tiempo
          </p>
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-3'>
            {improvementSteps.map((item) => (
              <div key={item.step} className='flex gap-4'>
                <span className='mt-0.5 shrink-0 text-3xl font-black leading-none text-slate-200'>
                  {item.step}
                </span>
                <div>
                  <p className='mb-1 text-sm font-semibold text-slate-950'>
                    {item.title}
                  </p>
                  <p className='text-xs font-medium leading-relaxed text-slate-500'>
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='border-t border-slate-200'>
        <div className='mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-5 py-10 sm:flex-row sm:items-center'>
          <div>
            <p className='font-semibold text-slate-950'>Gratis para probar.</p>
            <p className='mt-0.5 text-sm font-medium text-slate-500'>
              Sin tarjeta de crédito. Sin registro. Solo tu próximo mensaje.
            </p>
          </div>
          <button
            type='button'
            onClick={() => startBlankFromSurface('footer')}
            className='rounded bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90'
          >
            Crear mi primera respuesta
          </button>
        </div>
      </section>
    </main>
  );
};
