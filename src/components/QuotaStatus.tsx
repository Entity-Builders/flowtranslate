import {
  mapAccountKindToBillingState,
  type FlowtranslateBillingState,
  type UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { Sparkles } from 'lucide-react';
import type { FlowtranslateAccountKind } from '../hooks/useFlowtranslateAccount';

type QuotaStatusProps = {
  usage: UsageSnapshot | null;
  compact?: boolean;
  accountKind?: FlowtranslateAccountKind;
  billingState?: FlowtranslateBillingState;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatResetDate = (resetAt: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(resetAt));

const getUsageLabel = (usage: UsageSnapshot | null) => {
  if (!usage) return 'Ayuda de IA lista';
  if (usage.remainingThisMonth <= 0) return 'Llegaste al limite mensual';

  const ratio = usage.monthlyQuota > 0
    ? usage.remainingThisMonth / usage.monthlyQuota
    : 0;

  if (ratio <= 0.2) return 'Te queda poco';
  if (ratio <= 0.6) return 'Todavia tenes ayuda disponible';
  return 'Tenes bastante ayuda disponible';
};

const billingStateCopy: Record<
  FlowtranslateBillingState['id'],
  { label: string; detail: string }
> = {
  guest: {
    label: 'Prueba gratis',
    detail: 'Conecta una cuenta para guardar historial y preparar Pro.',
  },
  free: {
    label: 'Cuenta gratis',
    detail: 'Podes pasar a Pro cuando necesites mas margen mensual.',
  },
  pro_pending: {
    label: 'Pro pendiente',
    detail: 'Esperando Mercado Pago; si abandonaste, reintenta checkout.',
  },
  pro_active: {
    label: 'FlowTranslate Pro',
    detail: 'Pro activo para mas respuestas, Learning e historial.',
  },
  pro_failed: {
    label: 'Pago no confirmado',
    detail: 'Podes reintentar checkout desde tu cuenta.',
  },
  pro_cancelled: {
    label: 'Pro cancelado',
    detail: 'Podes reactivar Pro o pedir revision si ya pagaste.',
  },
};

export const QuotaStatus = ({
  usage,
  compact = false,
  accountKind = 'permanent',
  billingState,
}: QuotaStatusProps) => {
  const resolvedBillingState =
    billingState || mapAccountKindToBillingState(accountKind);
  const planCopy = billingStateCopy[resolvedBillingState.id];
  const label = getUsageLabel(usage);
  const percentRemaining = usage
    ? clampPercent(
        usage.monthlyQuota > 0
          ? (usage.remainingThisMonth / usage.monthlyQuota) * 100
          : 0,
      )
    : 100;
  const barClass =
    percentRemaining <= 0
      ? 'bg-rose-500'
      : percentRemaining <= 20
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div
      className={`rounded-md border border-slate-200 bg-white text-sm text-slate-700 ${
        compact
          ? 'inline-flex max-w-full items-center gap-2 px-3 py-2'
          : 'w-full p-3'
      }`}
    >
      <div className='flex min-w-0 items-center gap-2'>
        <Sparkles size={16} className='shrink-0 text-slate-500' />
        <div className='min-w-0'>
          <div className='truncate font-bold text-slate-950'>{label}</div>
          {!compact ? (
            <div className='mt-0.5 truncate text-xs text-slate-500'>
              {planCopy.label}
              {usage ? ` - se renueva ${formatResetDate(usage.resetAt)}` : ''}
            </div>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div className='mt-3'>
          <div className='h-2 overflow-hidden rounded-md bg-slate-100'>
            <div
              className={`h-full rounded-md ${barClass}`}
              style={{ width: `${percentRemaining}%` }}
            />
          </div>
          {usage ? (
            <div className='mt-2 text-xs text-slate-500'>
              Detalle tecnico: quedan {usage.remainingThisMonth.toLocaleString()} de{' '}
              {usage.monthlyQuota.toLocaleString()} creditos mensuales de IA.
            </div>
          ) : (
            <div className='mt-2 text-xs text-slate-500'>
              El detalle aparece despues de tu proxima respuesta con IA.
            </div>
          )}
          <div className='mt-1 text-xs font-semibold text-slate-500'>
            {planCopy.detail}
          </div>
        </div>
      ) : null}
    </div>
  );
};
