import { beforeEach, describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ANALYTICS_EVENTS,
  COMMERCIAL_ANALYTICS_REQUIRED_PROPERTIES,
  commercialAnalyticsProperties,
  getLaunchAnalyticsProperties,
  hasUnsafeCommercialAnalyticsProperty,
  safeCommercialAnalyticsProperties,
} from './analytics';

describe('Flowtranslate analytics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('extracts bounded launch attribution without the full query string', () => {
    window.history.pushState(
      {},
      '',
      '/respuestas-en-ingles?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_content=spanglish&campaign_id=launch-a&variant_id=hero-b&secret=value',
    );

    const properties = getLaunchAnalyticsProperties();

    expect(properties).toEqual(
      expect.objectContaining({
        path: '/respuestas-en-ingles',
        landing_route: '/respuestas-en-ingles',
        has_utm: true,
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'launch',
        utm_content: 'spanglish',
        campaign_id: 'launch-a',
        variant_id: 'hero-b',
        anonymous_visitor_id: expect.stringMatching(/^ftv_/),
        first_touch_at: expect.any(String),
      }),
    );
    expect(properties).not.toHaveProperty('secret');
    expect(properties).not.toHaveProperty('query');
  });

  it('persists first-touch attribution across the landing to responder route', () => {
    window.history.pushState(
      {},
      '',
      '/respuestas-en-ingles?utm_source=linkedin&utm_campaign=launch-icp&utm_content=variant-a',
    );

    const firstTouch = getLaunchAnalyticsProperties();

    window.history.pushState({}, '', '/');
    const responderTouch = getLaunchAnalyticsProperties();

    expect(responderTouch).toEqual(
      expect.objectContaining({
        path: '/',
        landing_route: '/respuestas-en-ingles',
        utm_source: 'linkedin',
        campaign_id: 'launch-icp',
        variant_id: 'variant-a',
        anonymous_visitor_id: firstTouch.anonymous_visitor_id,
        first_touch_at: firstTouch.first_touch_at,
      }),
    );
  });

  it('documents commercial funnel events without recording conversation content', () => {
    expect(COMMERCIAL_ANALYTICS_EVENTS).toEqual(
      expect.arrayContaining([
        'landing_viewed',
        'landing_cta_clicked',
        'composer_started',
        'raw_idea_submitted',
        'professional_reply_generated',
        'copy_intent_clicked',
        'conversation_reply_requested',
        'conversation_reply_generated',
        'conversation_reply_copied',
        'guest_trial_started',
        'account_connect_prompt_shown',
        'account_connection_started',
        'paywall_exposed',
        'upgrade_prompt_shown',
        'upgrade_intent_clicked',
        'upgrade_prompt_dismissed',
        'quota_recovery_shown',
        'quota_support_clicked',
        'topup_checkout_started',
        'topup_checkout_failed',
        'pricing_viewed',
        'experiment_exposed',
        'checkout_started',
        'checkout_pending',
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
    expect(COMMERCIAL_ANALYTICS_REQUIRED_PROPERTIES.checkout_started).toEqual(
      expect.arrayContaining(['plan_id', 'surface', 'anonymous_visitor_id']),
    );
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

  it('merges persisted attribution while stripping unsafe commercial payload fields', () => {
    window.history.pushState(
      {},
      '',
      '/respuestas-en-ingles?utm_campaign=sales-launch&utm_content=short-hero',
    );
    getLaunchAnalyticsProperties();

    const properties = commercialAnalyticsProperties({
      surface: 'hero',
      input_chars: 42,
      source_text: 'necesito responder esto',
      generated_text: 'I need to reply to this.',
      checkout_url: 'https://example.com/checkout_secret',
      provider_payload: { raw: true },
      email: 'person@example.com',
    });

    expect(properties).toEqual(
      expect.objectContaining({
        landing_route: '/respuestas-en-ingles',
        campaign_id: 'sales-launch',
        variant_id: 'short-hero',
        surface: 'hero',
        input_chars: 42,
        anonymous_visitor_id: expect.stringMatching(/^ftv_/),
      }),
    );
    expect(JSON.stringify(properties)).not.toContain('necesito responder');
    expect(JSON.stringify(properties)).not.toContain('I need to reply');
    expect(JSON.stringify(properties)).not.toContain('checkout_secret');
    expect(JSON.stringify(properties)).not.toContain('person@example.com');
  });
});
