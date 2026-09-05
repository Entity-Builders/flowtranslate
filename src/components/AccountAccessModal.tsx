import type { ReactNode } from 'react';
import { AccountAccessModal as SharedAccountAccessModal } from '@entity-builders/auth-ui-web';
import type { UsageSnapshot } from '@entity-builders/flowtranslate-core';
import { EbButton } from '@entity-builders/ui-web';
import {
  CheckCircle2,
  Clock3,
  Link2,
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
    label: 'Guarda tu progreso',
    body: 'Conecta una cuenta para conservar historial y Learning.',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
    Icon: UserRound,
  },
  free: {
    label: 'Plan basico',
    body: 'Tu historial y Learning quedan guardados en esta cuenta.',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
    Icon: ShieldCheck,
  },
  pro_pending: {
    label: 'Pro en proceso',
    body: 'Estamos confirmando tu acceso Pro. Podes reintentar checkout.',
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
    body: 'No pudimos confirmar el pago. Podes reintentar checkout desde esta cuenta.',
    toneClass: 'border-rose-200 bg-rose-50 text-rose-800',
    Icon: XCircle,
  },
  pro_cancelled: {
    label: 'Pro cancelado',
    body: 'Pro no esta activo. Reactiva checkout si queres seguir.',
    toneClass: 'border-slate-200 bg-white text-slate-700',
    Icon: XCircle,
  },
};

const BillingNotice = ({ account }: { account: FlowtranslateAccount }) => {
  const copy = billingNoticeCopy[account.billingState.id];
  const Icon = copy.Icon;

  return (
    <div
      className={`flex gap-2 rounded-md border p-3 text-sm ${copy.toneClass}`}
    >
      <Icon size={17} className='mt-0.5 shrink-0' />
      <div className='min-w-0'>
        <div className='font-black'>{copy.label}</div>
        <p className='mt-1 leading-5'>{copy.body}</p>
        {account.billingState.requiresSupport ? (
          <p className='mt-1 text-xs font-semibold'>
            Si pagaste y no aparece activo, revisamos el caso manualmente en
            24-48h.
          </p>
        ) : null}
      </div>
    </div>
  );
};

const guestValueItems = [
  'Historial listo para reutilizar tus mejores respuestas.',
  'Learning personal desde tus mensajes reales.',
  'Progreso y Pro quedan ligados a tu cuenta.',
];

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
      {!account.isGuest || account.currentStreak > 0 ? (
        <div className='flex items-center justify-between gap-3'>
          {!account.isGuest ? (
            <div className='flex min-w-0 items-center gap-2 text-xs font-bold uppercase text-slate-400'>
              <ShieldCheck size={14} />
              <span className='truncate'>
                {billingNoticeCopy[account.billingState.id].label}
              </span>
            </div>
          ) : null}
          {account.currentStreak > 0 && (
            <div className='flex shrink-0 items-center gap-1.5 text-sm font-semibold text-orange-600'>
              <Flame size={16} />
              {account.currentStreak} dias seguidos
            </div>
          )}
        </div>
      ) : null}
      {account.billingState.id !== 'free' ? (
        <BillingNotice account={account} />
      ) : null}
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
            {profileContextSaving ? (
              <CheckCircle2 size={16} />
            ) : (
              <Save size={16} />
            )}
            {profileContextSaving ? 'Guardando' : 'Guardar perfil'}
          </button>
        </div>
      </div>

      {account.billingState.canRetryCheckout ? (
        <div className='pt-3'>{profileUpgradePrompt}</div>
      ) : null}
    </>
  ) : null;

  const guestContent = account.isGuest ? (
    <div className='space-y-3'>
      <div className='rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950'>
        <div className='flex items-start gap-2'>
          <Save size={17} className='mt-0.5 shrink-0 text-emerald-700' />
          <div className='min-w-0'>
            <div className='font-black'>Guarda tus mejores respuestas</div>
            <p className='mt-1 leading-5'>
              Conecta una cuenta para que FlowTranslate recuerde lo que ya te
              sirvio y lo use como base para practicar mejor.
            </p>
          </div>
        </div>
        <ul className='mt-3 space-y-2'>
          {guestValueItems.map((item) => (
            <li key={item} className='flex gap-2 leading-5'>
              <CheckCircle2
                size={15}
                className='mt-0.5 shrink-0 text-emerald-700'
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {account.canSyncExistingGoogleAccount ? (
        <div className='space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
          <div className='flex items-start gap-2'>
            <Link2 size={17} className='mt-0.5 shrink-0' />
            <div className='min-w-0'>
              <div className='font-black'>Ese Google ya tiene cuenta</div>
              <p className='mt-1 leading-5'>
                Podes entrar con esa cuenta y traer tu historial temporal de
                esta sesion.
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => void account.syncExistingGoogleAccount()}
            disabled={account.busy || account.guestSyncLoading}
            className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
          >
            <Link2 size={16} />
            {account.guestSyncLoading
              ? 'Sincronizando'
              : 'Entrar y sincronizar'}
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <SharedAccountAccessModal
      config={account.authEntryConfig}
      account={account}
      onClose={onClose}
      slots={{
        accountSummary,
        guestContent,
        guestContinuation: account.isGuest ? (
          <EbButton fullWidth onClick={onClose} variant='ghost'>
            Seguir como invitado
          </EbButton>
        ) : null,
        permanentContent,
      }}
    />
  );
};
