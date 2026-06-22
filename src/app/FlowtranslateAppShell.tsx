import type { ReactNode } from 'react';
import { BookOpen, WifiOff } from 'lucide-react';
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
  checkoutReturnRetryBusy?: boolean;
  checkoutReturnRetryLabel?: string;
  onDismissCheckoutReturn: () => void;
  onOpenAccount: () => void;
  onOpenAccountFromCheckoutReturn: () => void;
  onRetryCheckoutFromReturn: () => void;
  onReturnToResponderFromCheckout: () => void;
  onViewChange: (view: AppView) => void;
};

const FlowMarkIcon = () => (
  <svg width='10' height='10' viewBox='0 0 10 10' fill='none' aria-hidden='true'>
    <path
      d='M1.5 5h4.5M4 3l2 2-2 2'
      stroke='white'
      strokeWidth='1.3'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

const ResponderIcon = () => (
  <svg width='12' height='12' viewBox='0 0 12 12' fill='none' aria-hidden='true'>
    <path
      d='M2 4h8M2 7h5'
      stroke='currentColor'
      strokeWidth='1.2'
      strokeLinecap='round'
    />
  </svg>
);

export const FlowtranslateAppShell = ({
  accountButton,
  checkoutReturn,
  children,
  online,
  view,
  checkoutReturnRetryBusy,
  checkoutReturnRetryLabel,
  onDismissCheckoutReturn,
  onOpenAccount,
  onOpenAccountFromCheckoutReturn,
  onRetryCheckoutFromReturn,
  onReturnToResponderFromCheckout,
  onViewChange,
}: FlowtranslateAppShellProps) => (
  <div className='flex h-[100dvh] min-h-0 flex-col overflow-x-hidden bg-[#f7f8f9] font-[Inter,system-ui,sans-serif] text-[#0f1117]'>
    <header className='sticky top-0 z-50 shrink-0 border-b border-black/10 bg-[#f7f8f9]/95 backdrop-blur-sm'>
      <div className='mx-auto flex h-11 max-w-2xl items-center justify-between gap-1.5 px-4'>
        <div className='flex min-w-0 shrink-0 items-center gap-1.5'>
          <div className='flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[#0e7f72] text-white'>
            <FlowMarkIcon />
          </div>
          <span className='truncate text-[13px] font-semibold tracking-tight text-[#0f1117] max-[359px]:hidden'>
            FlowTranslate
          </span>
        </div>

        <nav
          className='flex shrink-0 items-center gap-0.5'
          aria-label='Navegacion principal de FlowTranslate'
        >
          <button
            type='button'
            onClick={() => onViewChange('translate')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors sm:px-3 ${
              view === 'translate'
                ? 'bg-[#eef0f3] text-[#0f1117]'
                : 'text-[#6b7280] hover:text-[#0f1117]'
            }`}
          >
            <ResponderIcon />
            Responder
          </button>
          <button
            type='button'
            onClick={() => onViewChange('learning')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors sm:px-3 ${
              view === 'learning'
                ? 'bg-[#eef0f3] text-[#0f1117]'
                : 'text-[#6b7280] hover:text-[#0f1117]'
            }`}
          >
            <BookOpen size={12} />
            Historial
          </button>
        </nav>

        <button
          type='button'
          onClick={onOpenAccount}
          className='shrink-0 px-1 text-[12px] font-medium text-[#6b7280] transition-colors hover:text-[#0f1117]'
          title={accountButton.title}
        >
          {accountButton.label}
        </button>
      </div>
    </header>

    {!online ? (
      <div className='flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700'>
        <WifiOff size={16} />
        Estas offline. Podes ver la app, pero las nuevas respuestas con IA
        quedan pausadas.
      </div>
    ) : null}

    {checkoutReturn ? (
      <CheckoutReturnStatus
        info={checkoutReturn}
        onDismiss={onDismissCheckoutReturn}
        onOpenAccount={onOpenAccountFromCheckoutReturn}
        onRetryCheckout={onRetryCheckoutFromReturn}
        onReturnToResponder={onReturnToResponderFromCheckout}
        retryCheckoutBusy={checkoutReturnRetryBusy}
        retryCheckoutLabel={checkoutReturnRetryLabel}
      />
    ) : null}

    {children}
  </div>
);
