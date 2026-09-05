/**
 * App-specific analytics instance.
 * Uses the shared @entity-builders/analytics package.
 * This file only handles initialization with app-specific config (env vars).
 */
import { Analytics, PostHogProvider } from '@entity-builders/analytics';
import { STORAGE_KEYS } from '../constants';

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
const ATTRIBUTION_STORAGE_VERSION = 1;

export const COMMERCIAL_ANALYTICS_EVENTS = [
  'landing_viewed',
  'landing_cta_clicked',
  'composer_started',
  'raw_idea_submitted',
  'professional_reply_generated',
  'copy_intent_clicked',
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
] as const;

export const COMMERCIAL_ANALYTICS_REQUIRED_PROPERTIES = {
  landing_viewed: ['landing_route', 'anonymous_visitor_id'],
  landing_cta_clicked: ['landing_route', 'cta', 'anonymous_visitor_id'],
  composer_started: ['landing_route', 'input_chars', 'anonymous_visitor_id'],
  raw_idea_submitted: [
    'landing_route',
    'mode',
    'input_chars',
    'anonymous_visitor_id',
  ],
  professional_reply_generated: [
    'landing_route',
    'mode',
    'output_chars',
    'anonymous_visitor_id',
  ],
  checkout_started: [
    'landing_route',
    'plan_id',
    'surface',
    'anonymous_visitor_id',
  ],
  checkout_returned: [
    'landing_route',
    'checkout_return_state',
    'anonymous_visitor_id',
  ],
} as const;

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

type CommercialAttributionSnapshot = {
  version: number;
  anonymous_visitor_id: string;
  first_touch_at: string;
  first_touch_path: string;
  landing_route: string;
  referrer_domain: string | null;
  has_referrer: boolean;
  has_utm: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campaign_id?: string;
  variant_id?: string;
};

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
    ...captureCommercialAttributionFromLocation(),
  });
}

const boundedAttributionValue = (value: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
};

const boundedStoredString = (value: unknown) =>
  typeof value === 'string'
    ? boundedAttributionValue(value) || undefined
    : undefined;

const createAnonymousVisitorId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `ftv_${crypto.randomUUID()}`;
  }

  return `ftv_${Math.random().toString(36).slice(2)}_${Date.now().toString(
    36,
  )}`;
};

const referrerDomain = () => {
  if (typeof document === 'undefined' || !document.referrer) return null;

  try {
    return boundedAttributionValue(new URL(document.referrer).hostname) || null;
  } catch {
    return null;
  }
};

const readStoredAttribution = (): Partial<CommercialAttributionSnapshot> => {
  if (typeof localStorage === 'undefined') return {};

  try {
    const rawValue = localStorage.getItem(STORAGE_KEYS.commercialAttribution);
    if (!rawValue) return {};
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;

    return safeCommercialAnalyticsProperties({
      version: ATTRIBUTION_STORAGE_VERSION,
      anonymous_visitor_id: boundedStoredString(parsed.anonymous_visitor_id),
      first_touch_at: boundedStoredString(parsed.first_touch_at),
      first_touch_path: boundedStoredString(parsed.first_touch_path),
      landing_route: boundedStoredString(parsed.landing_route),
      referrer_domain: boundedStoredString(parsed.referrer_domain) || null,
      has_referrer: Boolean(parsed.has_referrer),
      has_utm: Boolean(parsed.has_utm),
      utm_source: boundedStoredString(parsed.utm_source),
      utm_medium: boundedStoredString(parsed.utm_medium),
      utm_campaign: boundedStoredString(parsed.utm_campaign),
      utm_content: boundedStoredString(parsed.utm_content),
      utm_term: boundedStoredString(parsed.utm_term),
      campaign_id: boundedStoredString(parsed.campaign_id),
      variant_id: boundedStoredString(parsed.variant_id),
    }) as Partial<CommercialAttributionSnapshot>;
  } catch {
    return {};
  }
};

const writeStoredAttribution = (snapshot: CommercialAttributionSnapshot) => {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(
      STORAGE_KEYS.commercialAttribution,
      JSON.stringify(snapshot),
    );
  } catch {
    // Attribution should never block the product experience.
  }
};

const createCommercialAttributionSnapshot = (
  url: URL,
  previous: Partial<CommercialAttributionSnapshot>,
): CommercialAttributionSnapshot => {
  const currentReferrer = referrerDomain();
  const path = boundedAttributionValue(url.pathname) || '/';
  const now = new Date().toISOString();
  const next: CommercialAttributionSnapshot = {
    version: ATTRIBUTION_STORAGE_VERSION,
    anonymous_visitor_id:
      previous.anonymous_visitor_id || createAnonymousVisitorId(),
    first_touch_at: previous.first_touch_at || now,
    first_touch_path: previous.first_touch_path || path,
    landing_route: previous.landing_route || path,
    referrer_domain: previous.referrer_domain || currentReferrer,
    has_referrer: Boolean(previous.has_referrer || currentReferrer),
    has_utm: Boolean(previous.has_utm),
  };

  for (const key of ATTRIBUTION_KEYS) {
    const value =
      boundedAttributionValue(url.searchParams.get(key)) ||
      previous[key];
    if (!value) continue;

    next[key] = value;
    next.has_utm = true;
  }

  next.campaign_id =
    boundedAttributionValue(url.searchParams.get('campaign_id')) ||
    next.utm_campaign ||
    previous.campaign_id;
  next.variant_id =
    boundedAttributionValue(url.searchParams.get('variant_id')) ||
    next.utm_content ||
    previous.variant_id;

  return safeCommercialAnalyticsProperties(
    next,
  ) as CommercialAttributionSnapshot;
};

export function captureCommercialAttributionFromLocation(): Record<
  string,
  unknown
> {
  if (typeof window === 'undefined') {
    return {
      path: 'unknown',
      landing_route: 'unknown',
      has_referrer: false,
      has_utm: false,
    };
  }

  const url = new URL(window.location.href);
  const snapshot = createCommercialAttributionSnapshot(
    url,
    readStoredAttribution(),
  );
  writeStoredAttribution(snapshot);

  return snapshot;
}

export function getCommercialAttributionProperties(): Record<string, unknown> {
  const stored = readStoredAttribution();
  if (stored.anonymous_visitor_id && stored.landing_route) {
    return safeCommercialAnalyticsProperties(stored);
  }

  return captureCommercialAttributionFromLocation();
}

export const commercialAnalyticsProperties = (
  properties: Record<string, unknown> = {},
) =>
  safeCommercialAnalyticsProperties({
    ...getCommercialAttributionProperties(),
    ...properties,
  });

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
    ...captureCommercialAttributionFromLocation(),
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
