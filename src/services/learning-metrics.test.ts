import type { TranslationRecord } from '@entity-builders/flowtranslate-core';
import { describe, expect, it } from 'vitest';
import { buildLearningDashboard } from './learning-metrics';

const record = (params: Partial<TranslationRecord>): TranslationRecord => ({
  id: params.id || 'record',
  sourceLanguage: params.sourceLanguage || 'es',
  targetLanguage: params.targetLanguage || 'en',
  sourceText: params.sourceText || 'Hola',
  translatedText: params.translatedText || 'Hello',
  createdAt: params.createdAt || '2026-06-01T00:00:00.000Z',
  requestHash: params.requestHash,
});

describe('buildLearningDashboard', () => {
  it('derives reused words, repeated phrases, direction mix, and recent context', () => {
    const metrics = buildLearningDashboard([
      record({
        id: '3',
        sourceText: 'El plan funciona',
        translatedText: 'The plan works',
        createdAt: '2026-06-01T12:00:00.000Z',
      }),
      record({
        id: '2',
        sourceText: 'Necesito un plan',
        translatedText: 'I need a plan',
        createdAt: '2026-06-01T11:00:00.000Z',
      }),
      record({
        id: '1',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        sourceText: 'I need help',
        translatedText: 'Necesito ayuda',
        createdAt: '2026-06-01T10:00:00.000Z',
      }),
    ]);

    expect(metrics.uniqueContextCount).toBe(3);
    expect(metrics.reusedWords[0]).toEqual({ value: 'need', count: 2 });
    expect(metrics.directionMix[0]).toMatchObject({
      sourceLanguage: 'es',
      targetLanguage: 'en',
      count: 2,
      percentage: 67,
    });
    expect(metrics.recentContexts).toHaveLength(3);
    expect('practiceReadiness' in metrics).toBe(false);
    expect('recommendedExercises' in metrics).toBe(false);
  });
});
