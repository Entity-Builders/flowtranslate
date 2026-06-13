import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FlowtranslateApiError,
  startFlowtranslateProCheckout,
} from './flowtranslate-api';

vi.mock('../lib/supabase', () => ({
  getFlowtranslateFunctionUrl: () =>
    'http://localhost/functions/v1/flowtranslate-generate',
  getFlowtranslateProCheckoutFunctionUrl: () =>
    'http://localhost/functions/v1/flowtranslate-pro-checkout',
}));

describe('Flowtranslate API checkout helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts Pro checkout through the server-side function', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout',
          subscriptionId: 'subscription_123',
          externalReference: 'entitybuilders:flowtranslate:pro:checkout_123',
          provider: 'mercado_pago',
          planId: 'flowtranslate_pro_monthly_ar',
          status: 'pending',
          currency: 'ARS',
          displayAmount: 4999,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await startFlowtranslateProCheckout('user-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/functions/v1/flowtranslate-pro-checkout',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );
    expect(result).toEqual({
      checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout',
      subscriptionId: 'subscription_123',
      externalReference: 'entitybuilders:flowtranslate:pro:checkout_123',
      provider: 'mercado_pago',
      planId: 'flowtranslate_pro_monthly_ar',
      status: 'pending',
      currency: 'ARS',
      displayAmount: 4999,
    });
  });

  it('throws typed API errors without exposing provider secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'No pudimos iniciar Mercado Pago. Proba de nuevo.',
          }),
          { status: 502, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(startFlowtranslateProCheckout('user-token')).rejects.toMatchObject({
      name: 'FlowtranslateApiError',
      status: 502,
      message: 'No pudimos iniciar Mercado Pago. Proba de nuevo.',
    } satisfies Partial<FlowtranslateApiError>);
  });
});
