/**
 * App-specific analytics instance.
 * Uses the shared @eb-packages/analytics package.
 * This file only handles initialization with app-specific config (env vars).
 */
import { Analytics, PostHogProvider } from '@eb-packages/analytics';

// Read PostHog config from Vite env vars
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;
const MAX_ATTRIBUTION_VALUE_LENGTH = 120;

export const COMMERCIAL_ANALYTICS_EVENTS = [
  'conversation_reply_requested',
  'conversation_reply_generated',
  'conversation_reply_copied',
  'conversation_tone_changed',
  'translation_context_applied',
  'context_save_intent_clicked',
  'context_reuse_selected',
  'guest_trial_started',
  'account_connect_prompt_shown',
  'account_connect_prompt_clicked',
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
] as const;

export const SENSITIVE_ANALYTICS_PROPERTY_NAMES = [
  'text',
  'source_text',
  'translated_text',
  'generated_text',
  'prompt',
  'email',
  'payer_email',
  'code',
  'otp',
  'verification_code',
  'card',
  'card_token',
  'cvv',
  'cvc',
  'token',
  'access_token',
  'refresh_token',
  'payment_method',
  'payment_id',
  'merchant_order_id',
  'preapproval_id',
  'preference_id',
  'external_reference',
  'subscription_id',
  'provider_subscription_id',
  'provider_customer_id',
  'provider_payload',
  'checkout_url',
  'credential',
] as const;

const EXACT_SENSITIVE_ANALYTICS_PROPERTY_NAMES = new Set([
  'text',
  'email',
  'code',
  'otp',
  'card',
  'cvv',
  'cvc',
  'token',
  'credential',
]);

const EMAIL_VALUE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const SENSITIVE_VALUE_FRAGMENTS = [
  'access_token',
  'bearer ',
  'card_token',
  'checkout_secret',
  'external_reference',
  'merchant_order_id',
  'order_secret',
  'pay_secret',
  'payment_id',
  'refresh_token',
  'secret',
] as const;

const isUnsafeCommercialAnalyticsPropertyName = (key: string) => {
  const lowerKey = key.toLocaleLowerCase();
  if (EXACT_SENSITIVE_ANALYTICS_PROPERTY_NAMES.has(lowerKey)) return true;

  return SENSITIVE_ANALYTICS_PROPERTY_NAMES.some((sensitiveKey) => {
    if (EXACT_SENSITIVE_ANALYTICS_PROPERTY_NAMES.has(sensitiveKey)) {
      return false;
    }
    return lowerKey.includes(sensitiveKey);
  });
};

const isUnsafeCommercialAnalyticsValue = (value: unknown) => {
  if (typeof value !== 'string') return false;

  const lowerValue = value.toLocaleLowerCase();
  return (
    EMAIL_VALUE_PATTERN.test(value) ||
    SENSITIVE_VALUE_FRAGMENTS.some((fragment) => lowerValue.includes(fragment))
  );
};

export const hasUnsafeCommercialAnalyticsProperty = (
  properties: Record<string, unknown>,
) =>
  Object.entries(properties).some(
    ([key, value]) =>
      isUnsafeCommercialAnalyticsPropertyName(key) ||
      isUnsafeCommercialAnalyticsValue(value),
  );

export const safeCommercialAnalyticsProperties = (
  properties: Record<string, unknown>,
) =>
  Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        !isUnsafeCommercialAnalyticsPropertyName(key) &&
        !isUnsafeCommercialAnalyticsValue(value),
    ),
  );

// Create the shared analytics instance for this app
export const analytics = new Analytics(new PostHogProvider());

/**
 * Initialize analytics with app-specific config.
 * Call this once at app startup (in main.tsx).
 */
export function initAnalytics() {
  // Skip analytics entirely in dev to save PostHog quota
  if (import.meta.env.DEV) {
    console.info('[Analytics] Dev mode — tracking disabled.');
    return;
  }

  analytics.init({
    apiKey: POSTHOG_KEY,
    apiHost: POSTHOG_HOST,
  });

  // Tag every event for shared Entity Builders PostHog project filtering.
  analytics.setGlobalProperties({
    app: 'flowtranslate',
    project: 'flowtranslate',
  });
}

const boundedAttributionValue = (value: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
};

const referrerDomain = () => {
  if (typeof document === 'undefined' || !document.referrer) return null;

  try {
    return new URL(document.referrer).hostname || null;
  } catch {
    return null;
  }
};

export function getLaunchAnalyticsProperties(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {
      path: 'unknown',
      has_referrer: false,
      has_utm: false,
    };
  }

  const url = new URL(window.location.href);
  const properties: Record<string, unknown> = {
    path: url.pathname || '/',
    referrer_domain: referrerDomain(),
    has_referrer: Boolean(document.referrer),
    has_utm: false,
  };

  for (const key of ATTRIBUTION_KEYS) {
    const value = boundedAttributionValue(url.searchParams.get(key));
    if (!value) continue;

    properties[key] = value;
    properties.has_utm = true;
  }

  return properties;
}
