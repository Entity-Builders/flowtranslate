import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBidirectionalTranslator } from './useBidirectionalTranslator';
import { generateTranslation } from '../services/flowtranslate-api';

vi.mock('../services/flowtranslate-api', () => ({
  generateTranslation: vi.fn(),
  FlowtranslateApiError: class FlowtranslateApiError extends Error {
    status = 500;
    usage = undefined;
  },
}));

const usage = {
  estimatedTokens: 4,
  monthlyQuota: 100,
  usedThisMonth: 4,
  remainingThisMonth: 96,
  charged: true,
  resetAt: '2026-07-01T00:00:00.000Z',
};

describe('useBidirectionalTranslator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('translates Spanish into English after an idle delay', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce({
      kind: 'translate',
      text: 'hello',
      translationRecord: {
        id: 'record-1',
        sourceLanguage: 'es',
        targetLanguage: 'en',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      usage,
    });

    const onUsage = vi.fn();
    const onSavedTranslation = vi.fn();
    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage,
        onSavedTranslation,
      }),
    );

    act(() => result.current.editSpanish('hola', true));

    await waitFor(() => expect(result.current.englishText).toBe('hello'));
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'es',
        targetLanguage: 'en',
        text: 'hola',
      }),
      'token',
    );
    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it('keeps the latest source when panels are edited quickly', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce({
      kind: 'translate',
      text: 'hola',
      translationRecord: {
        id: 'new',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        createdAt: '2026-06-01T00:00:01.000Z',
      },
      usage,
    });

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => {
      result.current.editSpanish('hola', true);
      result.current.editEnglish('hello', true);
    });

    await waitFor(() => expect(result.current.spanishText).toBe('hola'));
    expect(result.current.sourceLanguage).toBe('en');
  });
});
