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

  // Tag every event with the project name for multi-app filtering
  analytics.setGlobalProperties({ project: 'flowtranslate' });
}
