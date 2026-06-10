import { describe, expect, it } from 'vitest';
import { getLaunchAnalyticsProperties } from './analytics';

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
});
