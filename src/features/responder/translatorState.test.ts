import { describe, expect, it } from 'vitest';
import type { ExpressionBreakdown } from '@entity-builders/flowtranslate-core';
import { TRANSLATION_INPUT_MAX_CHARS } from '../../constants';
import {
  createTranslationRequestKey,
  fallbackDetection,
  getTranslatorReadiness,
  isEnrichedBreakdown,
  normalizeTranslatorText,
  translationAnalyticsProperties,
} from './translatorState';

describe('translatorState', () => {
  it('normalizes request keys across whitespace and case', () => {
    expect(normalizeTranslatorText('  Hello   TEAM  ')).toBe('hello team');
    expect(
      createTranslationRequestKey(
        'translate_to_english',
        '  Hello   TEAM  ',
        'natural',
        '  Support   desk ',
      ),
    ).toBe('translate_to_english:natural:hello team:support desk');
  });

  it('builds fallback detection for manual mode selection', () => {
    expect(fallbackDetection('translate_to_spanish')).toEqual({
      mode: 'translate_to_spanish',
      confidence: 'low',
      reason: 'manual',
      automatic: false,
    });
  });

  it('recognizes only enriched breakdown details as ready content', () => {
    const baseBreakdown: ExpressionBreakdown = {
      changed: false,
      confidence: 'medium',
      feedback: [],
    };

    expect(isEnrichedBreakdown(null)).toBe(false);
    expect(isEnrichedBreakdown(baseBreakdown)).toBe(false);
    expect(
      isEnrichedBreakdown({
        ...baseBreakdown,
        structure: [
          {
            text: 'Thanks',
            role: 'other',
            note: 'Reusable opener.',
          },
        ],
      }),
    ).toBe(true);
  });

  it('resolves translate readiness without React state', () => {
    expect(
      getTranslatorReadiness({
        sourceText: 'Hello',
        online: true,
        accessToken: 'token',
        authPending: false,
        status: 'idle',
      }),
    ).toMatchObject({
      activeSourceText: 'Hello',
      canTranslate: true,
      translateDisabledReason: '',
    });

    expect(
      getTranslatorReadiness({
        sourceText: 'Hello',
        online: false,
        accessToken: 'token',
        authPending: false,
        status: 'idle',
      }).translateDisabledReason,
    ).toBe('Estas offline. La IA necesita conexion.');
  });

  it('blocks translation readiness above the input safety limit', () => {
    const longText = 'a'.repeat(TRANSLATION_INPUT_MAX_CHARS + 1);

    expect(
      getTranslatorReadiness({
        sourceText: longText,
        online: true,
        accessToken: 'token',
        authPending: false,
        status: 'idle',
      }),
    ).toMatchObject({
      activeSourceText: longText,
      sourceCharacterCount: TRANSLATION_INPUT_MAX_CHARS + 1,
      isSourceTooLong: true,
      canTranslate: false,
      translateDisabledReason:
        'FlowTranslate acepta hasta 500 caracteres por traduccion. Tu texto tiene 501.',
    });
  });

  it('keeps analytics properties privacy-safe and mode-derived', () => {
    expect(
      translationAnalyticsProperties(
        'translate_to_english',
        '  Hola equipo ',
        'warm',
        'manual_generate',
        ' customer success ',
      ),
    ).toMatchObject({
      mode: 'translate_to_english',
      preset_id: 'warm',
      trigger: 'manual_generate',
      source_language: 'es',
      target_language: 'en',
      input_chars: 11,
      has_context: true,
      context_chars: 16,
    });
  });
});
