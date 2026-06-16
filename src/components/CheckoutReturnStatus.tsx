import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Languages,
  X,
  XCircle,
} from 'lucide-react';
import {
  EbButton,
  EbStatusBanner,
  type EbNoticeTone,
} from '@eb-packages/ui-web';
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
  tone: EbNoticeTone;
  Icon: typeof CheckCircle2;
};

const COPY: Record<CheckoutReturnState, CopyConfig> = {
  success: {
    title: 'Volviste de Mercado Pago',
    body:
      'Pro se activa cuando Mercado Pago confirma el pago de forma segura. Mientras tanto, podes seguir usando FlowTranslate.',
    tone: 'success',
    Icon: CheckCircle2,
  },
  pending: {
    title: 'Pago pendiente',
    body:
      'Estamos esperando la confirmacion de Mercado Pago. Tu Pro se activara cuando el pago quede aprobado.',
    tone: 'warning',
    Icon: Clock3,
  },
  failed: {
    title: 'Pago no confirmado',
    body: 'No pudimos confirmar el pago. Podes intentarlo de nuevo desde FlowTranslate.',
    tone: 'danger',
    Icon: XCircle,
  },
  cancelled: {
    title: 'Checkout cancelado',
    body: 'El checkout fue cancelado. No se realizo ningun cargo y tu cuenta sigue igual.',
    tone: 'neutral',
    Icon: XCircle,
  },
  unknown: {
    title: 'Estamos revisando el estado',
    body:
      'Estamos esperando la confirmacion de Mercado Pago. Tu Pro se activara cuando el pago quede aprobado.',
    tone: 'info',
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
    <EbStatusBanner
      actions={
        <>
          <EbButton
            leadingIcon={<Languages size={16} />}
            onClick={onReturnToResponder}
            size='sm'
            variant='primary'
          >
            Responder
          </EbButton>
          <EbButton
            aria-label='Ocultar estado de checkout'
            onClick={onDismiss}
            size='icon'
            title='Ocultar estado de checkout'
            variant='ghost'
          >
            <X size={16} />
          </EbButton>
        </>
      }
      body={copy.body}
      icon={<Icon size={20} />}
      title={copy.title}
      tone={copy.tone}
    >
      {showSupportHint && info.hasExternalReference ? (
        <p className='eb-status-banner__hint'>
          Si Mercado Pago confirmo el cobro pero Pro todavia no aparece,
          revisamos estos casos manualmente dentro de 24-48h.
        </p>
      ) : null}
    </EbStatusBanner>
  );
};
