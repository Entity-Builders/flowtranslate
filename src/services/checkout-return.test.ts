import { describe, expect, it } from 'vitest';
import { readCheckoutReturnFromUrl } from './checkout-return';

describe('checkout return parser', () => {
  it('returns null outside the checkout return path', () => {
    expect(readCheckoutReturnFromUrl('https://flowtranslate.app/')).toBeNull();
    expect(
      readCheckoutReturnFromUrl('https://flowtranslate.app/responder?status=approved'),
    ).toBeNull();
  });

  it('maps Mercado Pago return statuses safely', () => {
    const cases = [
      ['approved', 'success'],
      ['accredited', 'success'],
      ['success', 'success'],
      ['authorized', 'success'],
      ['pending', 'pending'],
      ['in_process', 'pending'],
      ['processing', 'pending'],
      ['scheduled', 'pending'],
      ['rejected', 'failed'],
      ['failed', 'failed'],
      ['failure', 'failed'],
      ['error', 'failed'],
      ['cancelled', 'cancelled'],
      ['canceled', 'cancelled'],
      ['cancel', 'cancelled'],
    ] as const;

    for (const [status, state] of cases) {
      expect(
        readCheckoutReturnFromUrl(
          `https://flowtranslate.app/pro/checkout/return?status=${status}`,
        ),
      ).toMatchObject({ state });
    }
  });

  it('uses fallback status params and keeps provider ids out of the result', () => {
    expect(
      readCheckoutReturnFromUrl(
        'https://flowtranslate.app/pro/checkout/return?collection_status=rejected&payment_id=123&merchant_order_id=456&external_reference=entitybuilders:flowtranslate:pro:abc',
      ),
    ).toEqual({
      state: 'failed',
      rawStatus: 'rejected',
      hasExternalReference: true,
      hasProviderReference: true,
    });
  });

  it('treats unclear checkout returns as unknown instead of success', () => {
    expect(
      readCheckoutReturnFromUrl('https://flowtranslate.app/pro/checkout/return'),
    ).toMatchObject({
      state: 'unknown',
      rawStatus: null,
    });
    expect(
      readCheckoutReturnFromUrl(
        'https://flowtranslate.app/pro/checkout/return?status=mystery',
      ),
    ).toMatchObject({
      state: 'unknown',
      rawStatus: 'mystery',
    });
  });
});
