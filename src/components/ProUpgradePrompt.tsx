import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { FlowtranslateAccountKind } from '../hooks/useFlowtranslateAccount';

export type ProUpgradeSurface =
  | 'usage_limit'
  | 'saved_history'
  | 'learning'
  | 'profile_preferences';

type ProUpgradePromptProps = {
  surface: ProUpgradeSurface;
  accountKind: FlowtranslateAccountKind;
  actionLabel?: string;
  busy?: boolean;
  error?: string;
  compact?: boolean;
  className?: string;
  onDismiss?: () => void;
  onStartCheckout: (surface: ProUpgradeSurface) => void;
  onConnectAccount: (surface: ProUpgradeSurface) => void;
};

const surfaceCopy: Record<
  ProUpgradeSurface,
  { title: string; reason: string }
> = {
  usage_limit: {
    title: 'Mas respuestas este mes',
    reason:
      'Segui respondiendo clientes, equipo y oportunidades sin esperar el reinicio.',
  },
  saved_history: {
    title: 'Historial y Learning con continuidad',
    reason:
      'Mas respuestas, historial reutilizable y practica desde tus mensajes reales.',
  },
  learning: {
    title: 'Learning con continuidad',
    reason:
      'Mas practica personalizada, progreso y frases guardadas.',
  },
  profile_preferences: {
    title: 'Pro: mas margen y contexto',
    reason:
      'Usa tu perfil profesional y amplia tus respuestas mensuales.',
  },
};

export const ProUpgradePrompt = ({
  surface,
  accountKind,
  actionLabel,
  busy = false,
  error = '',
  compact = false,
  className = '',
  onDismiss,
  onStartCheckout,
  onConnectAccount,
}: ProUpgradePromptProps) => {
  const copy = surfaceCopy[surface];
  const needsAccount = accountKind !== 'permanent';
  const resolvedActionLabel =
    actionLabel ?? (needsAccount ? 'Conectar cuenta y ver Pro' : 'Activar Pro');
  const priceCopy = 'ARS 4.999/mes. Cancela cuando quieras.';

  return (
    <section
      className={`rounded-md border border-emerald-200 bg-emerald-50 text-sm text-emerald-950 ${
        compact ? '' : 'shadow-sm'
      } ${className}`}
    >
      <div
        className={`flex flex-col gap-3 ${
          compact ? 'p-3' : 'p-4 sm:flex-row sm:items-center sm:justify-between'
        }`}
      >
        <div className='min-w-0'>
          <div className='flex items-start justify-between gap-3'>
            <p className='inline-flex items-center gap-2 font-black text-slate-950'>
              <Sparkles size={16} className='shrink-0 text-emerald-700' />
              {copy.title}
            </p>
            {onDismiss ? (
              <button
                type='button'
                onClick={onDismiss}
                className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-100 hover:text-emerald-950 sm:hidden'
                title='Ocultar'
                aria-label='Ocultar promocion Pro'
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
          <p className='mt-1 leading-5 text-emerald-900'>
            {compact ? priceCopy : copy.reason}
          </p>
          {!compact ? (
            <p className='mt-1 text-xs font-semibold leading-5 text-emerald-800'>
              {priceCopy}
            </p>
          ) : null}
          {error ? (
            <p className='mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800'>
              {error}
            </p>
          ) : null}
        </div>
        <button
          type='button'
          onClick={() =>
            needsAccount ? onConnectAccount(surface) : onStartCheckout(surface)
          }
          disabled={busy}
          className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
        >
          {resolvedActionLabel}
          <ArrowRight size={15} />
        </button>
        {onDismiss ? (
          <button
            type='button'
            onClick={onDismiss}
            className='hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-white text-emerald-800 transition-colors hover:bg-emerald-100 hover:text-emerald-950 sm:inline-flex'
            title='Ocultar'
            aria-label='Ocultar promocion Pro'
          >
            <X size={15} />
          </button>
        ) : null}
      </div>
    </section>
  );
};
