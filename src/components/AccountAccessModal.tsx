import type { ReactNode } from 'react';
import {
  AccountAccessModal as SharedAccountAccessModal,
} from '@eb-packages/auth-ui-web';
import type { UsageSnapshot } from '@eb-packages/flowtranslate-core';
import {
  CheckCircle2,
  Clock3,
  Flame,
  Save,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { useFlowtranslateAccount } from '../hooks/useFlowtranslateAccount';
import { QuotaStatus } from './QuotaStatus';

type FlowtranslateAccount = ReturnType<typeof useFlowtranslateAccount>;

type AccountAccessModalProps = {
  account: FlowtranslateAccount;
  usage: UsageSnapshot | null;
  profileUpgradePrompt: ReactNode;
  profileContextDraft: string;
  profileContextMessage: string;
  profileContextSaving: boolean;
  onProfileContextDraftChange: (value: string) => void;
  onProfileContextMessageClear: () => void;
  onSaveProfileContext: () => void;
  onClose: () => void;
};

const billingNoticeCopy: Record<
  FlowtranslateAccount['billingState']['id'],
  {
    label: string;
    body: string;
    toneClass: string;
    Icon: typeof ShieldCheck;
  }
> = {
  guest: {
    label: 'Prueba gratis',
    body:
      'Responde ahora. Conecta una cuenta para conservar historial y Learning.',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
    Icon: UserRound,
  },
  free: {
    label: 'Cuenta gratis',
    body: 'Cuenta conectada.',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
    Icon: ShieldCheck,
  },
  pro_pending: {
    label: 'Pro pendiente',
    body:
      'Esperando confirmacion segura de Mercado Pago. Podes reintentar checkout.',
    toneClass: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: Clock3,
  },
  pro_active: {
    label: 'FlowTranslate Pro',
    body: 'Pro activo para mas respuestas, Learning e historial.',
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Icon: CheckCircle2,
  },
  pro_failed: {
    label: 'Pago no confirmado',
    body:
      'No pudimos confirmar el pago. Podes reintentar checkout desde esta cuenta.',
    toneClass: 'border-rose-200 bg-rose-50 text-rose-800',
    Icon: XCircle,
  },
  pro_cancelled: {
    label: 'Pro cancelado',
    body:
      'Pro no esta activo. Reactiva checkout si queres seguir.',
    toneClass: 'border-slate-200 bg-white text-slate-700',
    Icon: XCircle,
  },
};

const BillingNotice = ({ account }: { account: FlowtranslateAccount }) => {
  const copy = billingNoticeCopy[account.billingState.id];
  const Icon = copy.Icon;

  return (
    <div className={`flex gap-2 rounded-md border p-3 text-sm ${copy.toneClass}`}>
      <Icon size={17} className='mt-0.5 shrink-0' />
      <div className='min-w-0'>
        <div className='font-black'>{copy.label}</div>
        <p className='mt-1 leading-5'>{copy.body}</p>
        {account.billingState.requiresSupport ? (
          <p className='mt-1 text-xs font-semibold'>
            Si pagaste y no aparece activo, revisamos el caso manualmente en 24-48h.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export const AccountAccessModal = ({
  account,
  usage,
  profileUpgradePrompt,
  profileContextDraft,
  profileContextMessage,
  profileContextSaving,
  onProfileContextDraftChange,
  onProfileContextMessageClear,
  onSaveProfileContext,
  onClose,
}: AccountAccessModalProps) => {
  const accountSummary = account.session ? (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2 text-xs font-bold uppercase text-slate-400'>
          {account.isGuest ? <UserRound size={14} /> : <ShieldCheck size={14} />}
          <span className='truncate'>
            {billingNoticeCopy[account.billingState.id].label}
          </span>
        </div>
        {account.currentStreak > 0 && (
          <div className='flex shrink-0 items-center gap-1.5 text-sm font-semibold text-orange-600'>
            <Flame size={16} />
            {account.currentStreak} dias seguidos
          </div>
        )}
      </div>
      {account.billingState.id !== 'free' ? <BillingNotice account={account} /> : null}
      <QuotaStatus
        usage={usage}
        compact
        accountKind={account.accountKind}
        billingState={account.billingState}
      />
    </div>
  ) : null;

  const permanentContent = !account.isGuest ? (
    <>
      <div className='space-y-3 border-t border-slate-100 pt-5'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2 text-sm font-black text-slate-900'>
            <UserRound size={16} />
            Perfil profesional
          </div>
          <p className='text-xs leading-5 text-slate-500'>
            Contexto fijo para ajustar vocabulario y tono.
          </p>
        </div>
        <label className='block'>
          <span className='mb-2 block text-xs font-bold uppercase text-slate-400'>
            Contexto permanente
          </span>
          <textarea
            value={profileContextDraft}
            onChange={(event) => {
              onProfileContextDraftChange(event.target.value);
              onProfileContextMessageClear();
            }}
            placeholder='Ej: Soy PM en una agencia de software y suelo escribirle a clientes y equipos tecnicos.'
            className='min-h-24 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-5 outline-none transition-colors focus:border-slate-500'
          />
        </label>
        <div className='flex items-center justify-between gap-3'>
          <span className='min-w-0 text-xs font-semibold text-slate-500'>
            {profileContextMessage}
          </span>
          <button
            type='button'
            onClick={onSaveProfileContext}
            disabled={
              profileContextSaving ||
              profileContextDraft.trim() === account.globalContext.trim()
            }
            className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400'
          >
            {profileContextSaving ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {profileContextSaving ? 'Guardando' : 'Guardar perfil'}
          </button>
        </div>
      </div>

      {account.billingState.canRetryCheckout ? (
        <div className='pt-3'>{profileUpgradePrompt}</div>
      ) : null}
    </>
  ) : null;

  return (
    <SharedAccountAccessModal
      config={account.authEntryConfig}
      account={account}
      onClose={onClose}
      slots={{
        accountSummary,
        permanentContent,
      }}
    />
  );
};
