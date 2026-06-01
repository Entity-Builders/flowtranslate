import type { UsageSnapshot } from '@eb-packages/flowtranslate-core';
import { Gauge } from 'lucide-react';

type QuotaStatusProps = {
  usage: UsageSnapshot | null;
  compact?: boolean;
};

export const QuotaStatus = ({ usage, compact = false }: QuotaStatusProps) => {
  const label = usage
    ? `${usage.remainingThisMonth.toLocaleString()} / ${usage.monthlyQuota.toLocaleString()} tokens`
    : 'Usage appears after your next AI request';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 ${
        compact ? 'max-w-full' : ''
      }`}
    >
      <Gauge size={16} className='shrink-0 text-slate-500' />
      <span className='truncate'>{label}</span>
    </div>
  );
};
