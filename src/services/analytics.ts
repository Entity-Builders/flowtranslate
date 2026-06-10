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
