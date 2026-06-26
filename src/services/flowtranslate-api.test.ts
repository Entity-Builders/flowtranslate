import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLOWTRANSLATE_GUEST_DEVICE_HEADER, STORAGE_KEYS } from '../constants';
import {
  FlowtranslateApiError,
  generateTranslation,
  startFlowtranslateProCheckout,
  startFlowtranslateTopupCheckout,
} from './flowtranslate-api';

const usage = {
  estimatedTokens: 3,
  monthlyQuota: 800,
  usedThisMonth: 3,
  remainingThisMonth: 797,
  charged: true,
  resetAt: '2026-07-01T00:00:00.000Z',
};

describe('flowtranslate api guest identity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_FLOWTRANSLATE_API_URL', 'https://edge.test/flowtranslate');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          kind: 'translate',
          text: 'Hello',
          mode: 'translate_to_english',
          breakdown: null,
          translationRecord: {
            id: '',
            sourceLanguage: 'es',
            targetLanguage: 'en',
            mode: 'translate_to_english',
            breakdown: null,
            createdAt: '2026-06-01T00:00:00.000Z',
            pending: true,
            saved: false,
          },
          usage,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends a stable local device id with generate requests', async () => {
    localStorage.setItem(STORAGE_KEYS.guestDeviceId, 'ft-existing-device-123');

    await generateTranslation(
      {
        mode: 'translate_to_english',
        text: 'hola',
        presetId: 'natural',
      },
      'access-token',
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://edge.test/flowtranslate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          [FLOWTRANSLATE_GUEST_DEVICE_HEADER]: 'ft-existing-device-123',
        }),
      }),
    );
    expect(localStorage.getItem(STORAGE_KEYS.guestDeviceId)).toBe(
      'ft-existing-device-123',
    );
  });

  it('replaces invalid stored device ids before sending requests', async () => {
    localStorage.setItem(
      STORAGE_KEYS.guestDeviceId,
      'ft invalid device id with spaces',
    );

    await generateTranslation(
      {
        mode: 'translate_to_english',
        text: 'hola',
        presetId: 'natural',
      },
      'access-token',
    );

    const [, request] = vi.mocked(fetch).mock.calls[0];
    const headers = request?.headers as Record<string, string>;
    expect(headers[FLOWTRANSLATE_GUEST_DEVICE_HEADER]).toMatch(/^ft-/);
    expect(headers[FLOWTRANSLATE_GUEST_DEVICE_HEADER]).not.toBe(
      'ft invalid device id with spaces',
    );
    expect(localStorage.getItem(STORAGE_KEYS.guestDeviceId)).toBe(
      headers[FLOWTRANSLATE_GUEST_DEVICE_HEADER],
    );
  });
});

describe('Flowtranslate API checkout helper', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv(
      'VITE_FLOWTRANSLATE_PRO_CHECKOUT_API_URL',
      'http://localhost/functions/v1/flowtranslate-pro-checkout',
    );
    vi.stubEnv(
      'VITE_FLOWTRANSLATE_TOPUP_CHECKOUT_API_URL',
      'http://localhost/functions/v1/flowtranslate-topup-checkout',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it('starts top-up checkout with a stable guest device id', async () => {
    localStorage.setItem(STORAGE_KEYS.guestDeviceId, 'ft-existing-device-123');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect',
          purchaseId: 'purchase_123',
          externalReference: 'entitybuilders:flowtranslate:topup:checkout_123',
          provider: 'mercado_pago',
          status: 'pending',
          tier: {
            id: 'doble',
            title: 'FlowTranslate recarga generosa',
            amount: 2500,
            currency: 'ARS',
            allowanceTokens: 20000,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await startFlowtranslateTopupCheckout('guest-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/functions/v1/flowtranslate-topup-checkout',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer guest-token',
          'Content-Type': 'application/json',
          [FLOWTRANSLATE_GUEST_DEVICE_HEADER]: 'ft-existing-device-123',
        },
        body: JSON.stringify({ tierId: 'doble' }),
      },
    );
    expect(result.tier.allowanceTokens).toBe(20000);
  });
});
