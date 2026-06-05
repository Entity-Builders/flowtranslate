import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSLATION_IDLE_DELAY_MS } from '../constants';
import { useBidirectionalTranslator } from './useBidirectionalTranslator';
import {
  generateTranslation,
  type TranslateResponse,
} from '../services/flowtranslate-api';

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

const createDeferred = <TValue,>() => {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

describe('useBidirectionalTranslator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-translates Spanish into English after the idle delay', async () => {
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

    act(() => result.current.editSpanish('hola'));

    expect(generateTranslation).not.toHaveBeenCalled();
    expect(result.current.canTranslate).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.englishText).toBe('hello');
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguage: 'es',
        targetLanguage: 'en',
        text: 'hola',
        presetId: 'natural',
      }),
      'token',
    );
    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it('manual submit cancels the pending auto-translate timer', async () => {
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

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editSpanish('hola'));

    await act(async () => {
      await result.current.translate();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(generateTranslation).toHaveBeenCalledTimes(1);
    expect(result.current.englishText).toBe('hello');
  });

  it('does not call the network while typing continues inside the idle window', async () => {
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

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editSpanish('ho'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS - 1);
    });
    expect(generateTranslation).not.toHaveBeenCalled();

    act(() => result.current.editSpanish('hola'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS - 1);
    });
    expect(generateTranslation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(generateTranslation).toHaveBeenCalledTimes(1);
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'hola' }),
      'token',
    );
  });

  it('retranslates when the preset changes', async () => {
    vi.mocked(generateTranslation)
      .mockResolvedValueOnce({
        kind: 'translate',
        text: 'hello',
        translationRecord: {
          id: 'record-1',
          sourceLanguage: 'es',
          targetLanguage: 'en',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
        usage,
      })
      .mockResolvedValueOnce({
        kind: 'translate',
        text: 'hi there',
        translationRecord: {
          id: 'record-2',
          sourceLanguage: 'es',
          targetLanguage: 'en',
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

    act(() => result.current.editSpanish('hola'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });
    expect(result.current.englishText).toBe('hello');

    act(() => result.current.selectPreset('casual'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.englishText).toBe('hi there');
    expect(generateTranslation).toHaveBeenLastCalledWith(
      expect.objectContaining({ presetId: 'casual' }),
      'token',
    );
  });

  it('keeps the latest source when a stale response returns late', async () => {
    const first = createDeferred<TranslateResponse>();
    const second = createDeferred<TranslateResponse>();
    vi.mocked(generateTranslation)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    let firstSubmit: Promise<void> = Promise.resolve();
    let secondSubmit: Promise<void> = Promise.resolve();

    act(() => {
      result.current.editSpanish('hola');
      firstSubmit = result.current.translate();
    });

    act(() => {
      result.current.editEnglish('good morning');
      secondSubmit = result.current.translate();
    });

    first.resolve({
      kind: 'translate',
      text: 'old hello',
      translationRecord: {
        id: 'old',
        sourceLanguage: 'es',
        targetLanguage: 'en',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      usage,
    });
    second.resolve({
      kind: 'translate',
      text: 'buenos dias',
      translationRecord: {
        id: 'new',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        createdAt: '2026-06-01T00:00:01.000Z',
      },
      usage,
    });

    await act(async () => {
      await firstSubmit;
      await secondSubmit;
    });

    expect(result.current.spanishText).toBe('buenos dias');
    expect(result.current.englishText).toBe('good morning');
    expect(result.current.sourceLanguage).toBe('en');
  });
});
