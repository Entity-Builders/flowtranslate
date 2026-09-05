import {
  readEntityCheckoutReturnFromUrl,
  type EntityCheckoutReturnInfo,
  type EntityCheckoutReturnState,
} from '@entity-builders/billing-core';

export const CHECKOUT_RETURN_PATH = '/pro/checkout/return';
export const TOPUP_CHECKOUT_RETURN_PATH = '/topup/checkout/return';

export type CheckoutReturnState = EntityCheckoutReturnState;
export type CheckoutReturnFlow = 'pro' | 'topup';
export type CheckoutReturnInfo = EntityCheckoutReturnInfo & {
  flow: CheckoutReturnFlow;
};

export const readCheckoutReturnFromUrl = (
  input: Parameters<typeof readEntityCheckoutReturnFromUrl>[0],
) => {
  const proReturn = readEntityCheckoutReturnFromUrl(input, {
    returnPath: CHECKOUT_RETURN_PATH,
    fallbackOrigin: 'https://flowtranslate.app',
  });
  if (proReturn) return { ...proReturn, flow: 'pro' as const };

  const topupReturn = readEntityCheckoutReturnFromUrl(input, {
    returnPath: TOPUP_CHECKOUT_RETURN_PATH,
    fallbackOrigin: 'https://flowtranslate.app',
  });
  if (topupReturn) return { ...topupReturn, flow: 'topup' as const };

  return null;
};
