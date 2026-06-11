import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ANALYTICS_EVENTS,
  getLaunchAnalyticsProperties,
  hasUnsafeCommercialAnalyticsProperty,
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
        'account_connect_prompt_shown',
        'upgrade_intent_clicked',
        'checkout_started',
        'payment_succeeded',
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
  });
});
