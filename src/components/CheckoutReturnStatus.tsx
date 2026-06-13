import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Languages,
  X,
  XCircle,
} from 'lucide-react';
import type {
  CheckoutReturnInfo,
  CheckoutReturnState,
} from '../services/checkout-return';

type CheckoutReturnStatusProps = {
  info: CheckoutReturnInfo;
  onDismiss: () => void;
  onReturnToResponder: () => void;
};

type CopyConfig = {
  title: string;
  body: string;
  toneClass: string;
  Icon: typeof CheckCircle2;
};

const COPY: Record<CheckoutReturnState, CopyConfig> = {
  success: {
    title: 'Volviste de Mercado Pago',
    body:
      'Pro se activa cuando Mercado Pago confirma el pago de forma segura. Mientras tanto, podes seguir usando FlowTranslate.',
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    Icon: CheckCircle2,
  },
  pending: {
    title: 'Pago pendiente',
    body:
      'Estamos esperando la confirmacion de Mercado Pago. Tu Pro se activara cuando el pago quede aprobado.',
    toneClass: 'border-amber-200 bg-amber-50 text-amber-900',
    Icon: Clock3,
  },
  failed: {
    title: 'Pago no confirmado',
    body: 'No pudimos confirmar el pago. Podes intentarlo de nuevo desde FlowTranslate.',
    toneClass: 'border-rose-200 bg-rose-50 text-rose-900',
    Icon: XCircle,
  },
  cancelled: {
    title: 'Checkout cancelado',
    body: 'El checkout fue cancelado. No se realizo ningun cargo y tu cuenta sigue igual.',
    toneClass: 'border-slate-200 bg-white text-slate-800',
    Icon: XCircle,
  },
  unknown: {
    title: 'Estamos revisando el estado',
    body:
      'Estamos esperando la confirmacion de Mercado Pago. Tu Pro se activara cuando el pago quede aprobado.',
    toneClass: 'border-sky-200 bg-sky-50 text-sky-900',
    Icon: AlertTriangle,
  },
};

export const CheckoutReturnStatus = ({
  info,
  onDismiss,
  onReturnToResponder,
}: CheckoutReturnStatusProps) => {
  const copy = COPY[info.state];
  const Icon = copy.Icon;
  const showSupportHint =
    info.state === 'success' || info.state === 'pending' || info.state === 'unknown';

  return (
    <section
      role='status'
      className={`border-b px-3 py-3 sm:px-4 ${copy.toneClass}`}
    >
      <div className='mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 gap-3'>
          <Icon size={20} className='mt-0.5 shrink-0' />
          <div className='min-w-0'>
            <p className='text-sm font-black'>{copy.title}</p>
            <p className='mt-1 max-w-3xl text-sm leading-5'>{copy.body}</p>
            {showSupportHint && info.hasExternalReference ? (
              <p className='mt-1 max-w-3xl text-xs leading-5 opacity-80'>
                Si Mercado Pago confirmo el cobro pero Pro todavia no aparece,
                revisamos estos casos manualmente dentro de 24-48h.
              </p>
            ) : null}
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2 self-start sm:self-center'>
          <button
            type='button'
            onClick={onReturnToResponder}
            className='inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800'
          >
            <Languages size={16} />
            Responder
          </button>
          <button
            type='button'
            onClick={onDismiss}
            className='inline-flex h-10 w-10 items-center justify-center rounded-md border border-current/20 text-current hover:bg-white/50'
            title='Ocultar estado de checkout'
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
