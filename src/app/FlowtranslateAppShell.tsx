import type { ReactNode } from 'react';
import {
  BookOpen,
  Languages,
  Settings,
  ShieldCheck,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { CheckoutReturnStatus } from '../components/CheckoutReturnStatus';
import type { CheckoutReturnInfo } from '../services/checkout-return';
import type { AppView } from './useFlowtranslateView';

type AccountButtonIcon = 'guest' | 'signed-in' | 'settings';

type AccountButtonConfig = {
  icon: AccountButtonIcon;
  label: string;
  title: string;
};

type FlowtranslateAppShellProps = {
  accountButton: AccountButtonConfig;
  checkoutReturn: CheckoutReturnInfo | null;
  children: ReactNode;
  online: boolean;
  view: AppView;
  onDismissCheckoutReturn: () => void;
  onOpenAccount: () => void;
  onReturnToResponderFromCheckout: () => void;
  onViewChange: (view: AppView) => void;
};

const renderAccountIcon = (icon: AccountButtonIcon) => {
  if (icon === 'guest') return <UserRound size={17} />;
  if (icon === 'signed-in') return <ShieldCheck size={17} />;
  return <Settings size={17} />;
};

export const FlowtranslateAppShell = ({
  accountButton,
  checkoutReturn,
  children,
  online,
  view,
  onDismissCheckoutReturn,
  onOpenAccount,
  onReturnToResponderFromCheckout,
  onViewChange,
}: FlowtranslateAppShellProps) => (
  <div className='flex h-[100dvh] min-h-0 flex-col overflow-x-hidden bg-slate-50 text-slate-950'>
    <header className='grid min-h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200/70 bg-white px-3 sm:gap-3 sm:px-4'>
      <div className='flex min-w-0 items-center gap-3'>
        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white'>
          <Languages size={19} />
        </div>
        <div className='min-w-0'>
          <h1 className='hidden truncate text-lg font-bold leading-none sm:block'>
            flowtranslate
          </h1>
          <p className='mt-1 hidden text-xs text-slate-500 sm:block'>
            Respuestas en ingles listas para mandar.
          </p>
        </div>
      </div>

      <nav className='flex min-w-0 justify-center gap-5'>
        <button
          type='button'
          onClick={() => onViewChange('translate')}
          className={`inline-flex h-16 items-center gap-1.5 border-b-2 px-0 text-sm font-bold transition-colors sm:gap-2 ${
            view === 'translate'
              ? 'border-emerald-500 text-slate-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Languages size={16} />
          <span className='hidden min-[360px]:inline'>Responder</span>
        </button>
        <button
          type='button'
          onClick={() => onViewChange('learning')}
          className={`inline-flex h-16 items-center gap-1.5 border-b-2 px-0 text-sm font-bold transition-colors sm:gap-2 ${
            view === 'learning'
              ? 'border-emerald-500 text-slate-950'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen size={16} />
          <span className='hidden min-[360px]:inline'>Aprender</span>
        </button>
      </nav>

      <div className='flex min-w-0 items-center gap-2'>
        <button
          type='button'
          onClick={onOpenAccount}
          className='inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 sm:w-auto sm:max-w-44 sm:px-3'
          title={accountButton.title}
        >
          {renderAccountIcon(accountButton.icon)}
          <span className='hidden truncate sm:inline'>{accountButton.label}</span>
        </button>
      </div>
    </header>

    {!online ? (
      <div className='flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700'>
        <WifiOff size={16} />
        Estas offline. Podes ver la app, pero las nuevas respuestas con IA quedan
        pausadas.
      </div>
    ) : null}

    {checkoutReturn ? (
      <CheckoutReturnStatus
        info={checkoutReturn}
        onDismiss={onDismissCheckoutReturn}
        onReturnToResponder={onReturnToResponderFromCheckout}
      />
    ) : null}

    {children}
  </div>
);
