import {
  readEntityCheckoutReturnFromUrl,
  type EntityCheckoutReturnInfo,
  type EntityCheckoutReturnState,
} from '@eb-packages/billing-core';

export const CHECKOUT_RETURN_PATH = '/pro/checkout/return';

export type CheckoutReturnState = EntityCheckoutReturnState;
export type CheckoutReturnInfo = EntityCheckoutReturnInfo;

export const readCheckoutReturnFromUrl = (
  input: Parameters<typeof readEntityCheckoutReturnFromUrl>[0],
) =>
  readEntityCheckoutReturnFromUrl(input, {
    returnPath: CHECKOUT_RETURN_PATH,
    fallbackOrigin: 'https://flowtranslate.app',
  });
