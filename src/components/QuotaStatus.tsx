import type { UsageSnapshot } from '@eb-packages/flowtranslate-core';
import { Sparkles } from 'lucide-react';
import type { FlowtranslateAccountKind } from '../hooks/useFlowtranslateAccount';

type QuotaStatusProps = {
  usage: UsageSnapshot | null;
  compact?: boolean;
  accountKind?: FlowtranslateAccountKind;
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

export const QuotaStatus = ({
  usage,
  compact = false,
  accountKind = 'permanent',
}: QuotaStatusProps) => {
  const planLabel =
    accountKind === 'guest'
      ? 'Prueba gratis'
      : accountKind === 'permanent'
        ? 'Cuenta gratis'
        : 'Acceso IA';
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
              {planLabel}
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
        </div>
      ) : null}
    </div>
  );
};
