import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Languages,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import {
  EbButton,
  EbStatusBanner,
  type EbNoticeTone,
} from '@entity-builders/ui-web';
import type {
  CheckoutReturnInfo,
  CheckoutReturnState,
} from '../services/checkout-return';

type CheckoutReturnStatusProps = {
  info: CheckoutReturnInfo;
  onDismiss: () => void;
  onOpenAccount: () => void;
  onRetryCheckout: () => void;
  onReturnToResponder: () => void;
  retryCheckoutBusy?: boolean;
  retryCheckoutLabel?: string;
};

type CopyConfig = {
  title: string;
  body: string;
  tone: EbNoticeTone;
  Icon: typeof CheckCircle2;
};

const PRO_COPY: Record<CheckoutReturnState, CopyConfig> = {
  success: {
    title: 'Volviste de Mercado Pago',
    body: 'Pro se activa cuando Mercado Pago confirma el pago de forma segura. Mientras tanto, podes seguir usando FlowTranslate.',
    tone: 'success',
    Icon: CheckCircle2,
  },
  pending: {
    title: 'Pago pendiente',
    body: 'Estamos esperando la confirmacion de Mercado Pago. Tu Pro se activara cuando el pago quede aprobado.',
    tone: 'warning',
    Icon: Clock3,
  },
  failed: {
    title: 'Pago no confirmado',
    body: 'No pudimos confirmar el pago. Pro no se activa hasta que Mercado Pago lo apruebe; podes reintentar o revisar tu cuenta.',
    tone: 'danger',
    Icon: XCircle,
  },
  cancelled: {
    title: 'Checkout cancelado',
    body: 'El checkout se cerro sin activar Pro ni generar cargos nuevos. Podes reintentar cuando quieras o revisar tu cuenta.',
    tone: 'neutral',
    Icon: XCircle,
  },
  unknown: {
    title: 'Estamos revisando el estado',
    body: 'Estamos esperando la confirmacion de Mercado Pago. Tu Pro se activara cuando el pago quede aprobado.',
    tone: 'info',
    Icon: AlertTriangle,
  },
};

const TOPUP_COPY: Record<CheckoutReturnState, CopyConfig> = {
  success: {
    title: 'Recarga en revision',
    body: 'La recarga se activa cuando Mercado Pago confirma el pago de forma segura. Si ya fue aprobado, retomamos tu traduccion automaticamente.',
    tone: 'success',
    Icon: CheckCircle2,
  },
  pending: {
    title: 'Recarga pendiente',
    body: 'Estamos esperando la confirmacion de Mercado Pago. Tus tokens se suman cuando el pago queda aprobado.',
    tone: 'warning',
    Icon: Clock3,
  },
  failed: {
    title: 'Recarga no confirmada',
    body: 'No pudimos confirmar el pago. No sumamos tokens hasta que Mercado Pago lo apruebe; podes reintentar la recarga.',
    tone: 'danger',
    Icon: XCircle,
  },
  cancelled: {
    title: 'Recarga cancelada',
    body: 'El checkout se cerro sin activar tokens ni generar cargos nuevos. Podes reintentar cuando quieras.',
    tone: 'neutral',
    Icon: XCircle,
  },
  unknown: {
    title: 'Estamos revisando la recarga',
    body: 'Estamos esperando la confirmacion de Mercado Pago. Tus tokens se suman cuando el pago quede aprobado.',
    tone: 'info',
    Icon: AlertTriangle,
  },
};

export const CheckoutReturnStatus = ({
  info,
  onDismiss,
  onOpenAccount,
  onRetryCheckout,
  onReturnToResponder,
  retryCheckoutBusy = false,
  retryCheckoutLabel = 'Reintentar Pro',
}: CheckoutReturnStatusProps) => {
  const copy = (info.flow === 'topup' ? TOPUP_COPY : PRO_COPY)[info.state];
  const Icon = copy.Icon;
  const showSupportHint =
    info.state === 'success' ||
    info.state === 'pending' ||
    info.state === 'unknown';
  const showRecoveryActions =
    info.state === 'failed' || info.state === 'cancelled';

  return (
    <EbStatusBanner
      actions={
        <>
          {showRecoveryActions ? (
            <>
              <EbButton
                disabled={retryCheckoutBusy}
                leadingIcon={<ArrowRight size={16} />}
                onClick={onRetryCheckout}
                size='sm'
                variant='primary'
              >
                {retryCheckoutBusy
                  ? 'Abriendo Mercado Pago'
                  : retryCheckoutLabel}
              </EbButton>
              <EbButton
                leadingIcon={<UserRound size={16} />}
                onClick={onOpenAccount}
                size='sm'
              >
                Ver cuenta
              </EbButton>
              <EbButton
                leadingIcon={<Languages size={16} />}
                onClick={onReturnToResponder}
                size='sm'
                variant='ghost'
              >
                Responder
              </EbButton>
            </>
          ) : (
            <EbButton
              leadingIcon={<Languages size={16} />}
              onClick={onReturnToResponder}
              size='sm'
              variant='primary'
            >
              Responder
            </EbButton>
          )}
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
          {info.flow === 'topup'
            ? 'Si Mercado Pago confirmo el cobro pero la recarga todavia no aparece, revisamos estos casos manualmente dentro de 24-48h.'
            : 'Si Mercado Pago confirmo el cobro pero Pro todavia no aparece, revisamos estos casos manualmente dentro de 24-48h.'}
        </p>
      ) : null}
    </EbStatusBanner>
  );
};
