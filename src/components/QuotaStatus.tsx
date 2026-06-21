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

const formatCooldownWait = (cooldownUntil?: string) => {
  if (!cooldownUntil) return 'un rato';

  const remainingMs = new Date(cooldownUntil).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'unos minutos';

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes <= 1) return '1 minuto';
  if (remainingMinutes < 60) return `${remainingMinutes} minutos`;

  const remainingHours = Math.ceil(remainingMinutes / 60);
  if (remainingHours <= 1) return '1 hora';
  if (remainingHours < 24) return `${remainingHours} horas`;

  return 'mañana';
};

const formatCooldownResumeCopy = (cooldownUntil?: string) => {
  const wait = formatCooldownWait(cooldownUntil);
  return wait === 'mañana' ? 'mañana' : `en ${wait}`;
};

const getUsageLabel = (usage: UsageSnapshot | null) => {
  if (!usage) return 'Modo amigo listo';
  if (usage.recovery?.state === 'cooldown') return 'Pausa de uso amigo';
  if (usage.recovery?.state === 'monthly_cap') return 'Uso amigo completo';
  if (usage.remainingThisMonth <= 0) return 'Gratis usado este mes';

  const ratio = usage.monthlyQuota > 0
    ? usage.remainingThisMonth / usage.monthlyQuota
    : 0;

  if (ratio <= 0.2) return 'Ultimas respuestas gratis';
  if (ratio <= 0.6) return 'Te queda margen gratis';
  return 'Modo amigo gratis';
};

const billingStateCopy: Record<
  FlowtranslateBillingState['id'],
  { label: string; detail: string }
> = {
  guest: {
    label: 'Modo invitado',
    detail: 'Conecta una cuenta para guardar historial y preparar Pro.',
  },
  free: {
    label: 'Plan basico',
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
              {usage.recovery?.state === 'cooldown'
                ? `Volvés a tener uso amigo ${formatCooldownResumeCopy(
                    usage.recovery.cooldownUntil,
                  )}.`
                : usage.recovery?.state === 'monthly_cap' ||
                    usage.remainingThisMonth <= 0
                  ? `Tu uso amigo vuelve el ${formatResetDate(usage.resetAt)}.`
                  : `Se renueva el ${formatResetDate(usage.resetAt)}.`}
            </div>
          ) : (
            <div className='mt-2 text-xs text-slate-500'>
              El estado aparece despues de tu proxima respuesta.
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
