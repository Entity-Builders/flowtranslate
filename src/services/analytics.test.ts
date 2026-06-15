import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ANALYTICS_EVENTS,
  getLaunchAnalyticsProperties,
  hasUnsafeCommercialAnalyticsProperty,
  safeCommercialAnalyticsProperties,
} from './analytics';

describe('Flowtranslate analytics', () => {
  it('extracts bounded launch attribution without the full query string', () => {
    window.history.pushState(
      {},
      '',
      '/?utm_source=newsletter&utm_medium=email&utm_campaign=launch&secret=value',
    );

    const properties = getLaunchAnalyticsProperties();

    expect(properties).toEqual(
      expect.objectContaining({
        path: '/',
        has_utm: true,
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'launch',
      }),
    );
    expect(properties).not.toHaveProperty('secret');
    expect(properties).not.toHaveProperty('query');
  });

  it('documents commercial funnel events without recording conversation content', () => {
    expect(COMMERCIAL_ANALYTICS_EVENTS).toEqual(
      expect.arrayContaining([
        'conversation_reply_requested',
        'conversation_reply_generated',
        'conversation_reply_copied',
        'guest_trial_started',
        'account_connect_prompt_shown',
        'upgrade_prompt_shown',
        'upgrade_intent_clicked',
        'upgrade_prompt_dismissed',
        'pricing_viewed',
        'experiment_exposed',
        'checkout_started',
        'checkout_returned',
        'checkout_failed',
        'payment_succeeded',
        'payment_pending',
        'payment_failed',
        'payment_cancelled',
        'pro_entitlement_state_viewed',
        'pro_entitlement_granted',
      ]),
    );

    expect(
      hasUnsafeCommercialAnalyticsProperty({
        mode: 'translate_to_english',
        input_chars: 24,
        source_text: 'hola',
      }),
    ).toBe(true);
    expect(
      hasUnsafeCommercialAnalyticsProperty({
        mode: 'translate_to_english',
        input_chars: 24,
        preset_id: 'professional',
      }),
    ).toBe(false);
    expect(
      hasUnsafeCommercialAnalyticsProperty({
        text_length: 24,
      }),
    ).toBe(false);
  });

  it('sanitizes commercial payment analytics before tracking', () => {
    const properties = safeCommercialAnalyticsProperties({
      provider: 'mercado_pago',
      plan_id: 'flowtranslate_pro',
      currency: 'ARS',
      display_price: 'ARS 4.999/mes',
      account_kind: 'permanent',
      billing_state: 'pro_pending',
      source_text: 'hola, necesito ayuda',
      generated_text: 'Hi, I need help',
      email: 'juan@example.com',
      payer_email: 'juan@example.com',
      card_token_id: 'card_token_secret',
      payment_id: 'pay_secret',
      merchant_order_id: 'order_secret',
      external_reference: 'entitybuilders:flowtranslate:pro:checkout_secret',
      provider_payload: { raw: true },
      note: 'juan@example.com',
    });

    expect(properties).toEqual({
      provider: 'mercado_pago',
      plan_id: 'flowtranslate_pro',
      currency: 'ARS',
      display_price: 'ARS 4.999/mes',
      account_kind: 'permanent',
      billing_state: 'pro_pending',
    });
    expect(JSON.stringify(properties)).not.toContain('juan@example.com');
    expect(JSON.stringify(properties)).not.toContain('hola');
    expect(JSON.stringify(properties)).not.toContain('Hi, I need help');
    expect(JSON.stringify(properties)).not.toContain('card_token_secret');
    expect(JSON.stringify(properties)).not.toContain('pay_secret');
  });
});
