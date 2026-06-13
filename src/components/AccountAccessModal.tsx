import type { ReactNode } from 'react';
import type { UsageSnapshot } from '@eb-packages/flowtranslate-core';
import {
  CheckCircle2,
  Chrome,
  Flame,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
  X,
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

const Feedback = ({ error, message }: { error: string; message: string }) => (
  <>
    {error ? (
      <div className='border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700'>
        {error}
      </div>
    ) : null}

    {message ? (
      <div className='border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700'>
        {message}
      </div>
    ) : null}
  </>
);

const EmailCodeForm = ({ account }: { account: FlowtranslateAccount }) => (
  <form onSubmit={account.submit} className='space-y-4 border-t border-slate-200 pt-4'>
    <div className='flex items-center gap-2 text-sm font-black text-slate-900'>
      <Mail size={16} />
      Codigo por email
    </div>

    <label className='block'>
      <span className='mb-2 block text-sm font-bold text-slate-700'>
        Email
      </span>
      <input
        type='email'
        value={account.email}
        onChange={(event) => account.setEmail(event.target.value)}
        disabled={account.busy}
        className='h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-slate-500'
        placeholder='you@example.com'
      />
    </label>

    {account.codeSent ? (
      <label className='block'>
        <span className='mb-2 block text-sm font-bold text-slate-700'>
          Codigo
        </span>
        <input
          inputMode='numeric'
          value={account.code}
          onChange={(event) => account.setCode(event.target.value)}
          disabled={account.busy}
          className='h-11 w-full rounded-md border border-slate-200 px-3 text-lg font-bold tracking-normal outline-none focus:border-slate-500'
          placeholder='000000'
        />
      </label>
    ) : null}

    <button
      type='submit'
      disabled={account.busy}
      className='h-11 w-full rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
    >
      {account.busy
        ? 'Revisando'
        : account.codeSent
          ? 'Verificar codigo'
          : 'Enviar codigo'}
    </button>

    {account.codeSent ? (
      <button
        type='button'
        onClick={() => void account.requestCode()}
        disabled={account.busy}
        className='h-11 w-full rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-300'
      >
        Enviar nuevo codigo
      </button>
    ) : null}
  </form>
);

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
}: AccountAccessModalProps) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4'>
    <div className='max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h2 className='flex items-center gap-2 text-lg font-bold'>
          <ShieldCheck size={19} />
          Cuenta
        </h2>
        <button
          type='button'
          onClick={onClose}
          className='rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          title='Cerrar'
        >
          <X size={18} />
        </button>
      </div>

      {!account.isSupabaseConfigured ? (
        <div className='border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
          Faltan variables de Supabase para cuentas y respuestas con IA.
        </div>
      ) : account.authLoading ? (
        <div className='border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600'>
          Revisando cuenta...
        </div>
      ) : account.session ? (
        <div className='space-y-5'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2 text-xs font-bold uppercase text-slate-400'>
              {account.isGuest ? <UserRound size={14} /> : <ShieldCheck size={14} />}
              {account.isGuest ? 'Prueba gratis' : 'Cuenta conectada'}
            </div>
            <div className='truncate text-base font-bold text-slate-950'>
              {account.displayName}
            </div>
            {account.currentStreak > 0 && (
              <div className='flex items-center gap-1.5 text-sm font-semibold text-orange-600'>
                <Flame size={16} />
                {account.currentStreak} dias seguidos
              </div>
            )}
            <p className='text-sm leading-6 text-slate-600'>
              {account.isGuest
                ? 'Responde ahora sin friccion. Conecta una cuenta para conservar historial y Learning personal.'
                : 'Tu cuenta gratis de Flowtranslate esta conectada.'}
            </p>
          </div>

          <QuotaStatus usage={usage} accountKind={account.accountKind} />

          {!account.isGuest ? profileUpgradePrompt : null}

          {!account.isGuest && (
            <div className='space-y-3 border-t border-slate-100 pt-5'>
              <div className='space-y-1'>
                <div className='flex items-center gap-2 text-sm font-black text-slate-900'>
                  <UserRound size={16} />
                  Perfil profesional
                </div>
                <p className='text-xs leading-5 text-slate-500'>
                  Contale a Flowtranslate quien sos, con quien hablas o en que
                  contexto trabajas. Se usa como contexto permanente para
                  ajustar vocabulario y tono.
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
          )}

          <Feedback error={account.error} message={account.message} />

          {account.isGuest ? (
            <>
              <button
                type='button'
                onClick={() => void account.signInWithGoogle()}
                disabled={account.busy}
                className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
              >
                <Chrome size={16} />
                Conectar con Google
              </button>
              <EmailCodeForm account={account} />
            </>
          ) : null}

          <button
            type='button'
            onClick={() => void account.signOut()}
            disabled={account.busy}
            className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-300'
          >
            <LogOut size={16} />
            Cerrar sesion
          </button>
        </div>
      ) : (
        <div className='space-y-4'>
          <div className='space-y-3'>
            <button
              type='button'
              onClick={() => void account.signInWithGoogle()}
              disabled={account.busy}
              className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
            >
              <Chrome size={16} />
              Continuar con Google
            </button>
            <button
              type='button'
              onClick={() => void account.signInAsGuest()}
              disabled={account.busy}
              className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-300'
            >
              <UserRound size={16} />
              Iniciar prueba gratis
            </button>
          </div>

          <Feedback error={account.error} message={account.message} />
          <EmailCodeForm account={account} />
        </div>
      )}
    </div>
  </div>
);
