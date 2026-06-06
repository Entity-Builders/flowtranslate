import { act, renderHook } from '@testing-library/react';
import type {
  ExpressionBreakdown,
  ExpressionMode,
} from '@eb-packages/flowtranslate-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSLATION_IDLE_DELAY_MS } from '../constants';
import {
  generateTranslation,
  type TranslateResponse,
} from '../services/flowtranslate-api';
import { useBidirectionalTranslator } from './useBidirectionalTranslator';

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

const breakdown: ExpressionBreakdown = {
  changed: true,
  confidence: 'high',
  feedback: ['Suena natural en este contexto.'],
  tense: 'Simple present',
  structure: [
    {
      text: 'I',
      role: 'subject',
      note: 'Subject',
    },
  ],
  commonMistake: 'Do not omit the subject in English.',
};

const createDeferred = <TValue,>() => {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

const responseFor = ({
  id = 'record-1',
  text,
  mode,
  sourceLanguage,
  targetLanguage,
  createdAt = '2026-06-01T00:00:00.000Z',
}: {
  id?: string;
  text: string;
  mode: ExpressionMode;
  sourceLanguage: 'es' | 'en';
  targetLanguage: 'es' | 'en';
  createdAt?: string;
}): TranslateResponse => ({
  kind: 'translate',
  text,
  mode,
  breakdown,
  translationRecord: {
    id,
    sourceLanguage,
    targetLanguage,
    mode,
    breakdown,
    createdAt,
  },
  usage,
});

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
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        text: 'hello, how are you?',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
      }),
    );

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

    act(() => result.current.editInput('hola como estas'));

    expect(generateTranslation).not.toHaveBeenCalled();
    expect(result.current.mode).toBe('translate_to_english');
    expect(result.current.canTranslate).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.resultText).toBe('hello, how are you?');
    expect(result.current.breakdown).toBe(breakdown);
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'translate_to_english',
        text: 'hola como estas',
        presetId: 'natural',
      }),
      'token',
    );
    expect(onUsage).toHaveBeenCalledWith(usage);
    expect(onSavedTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'translate_to_english',
        breakdown,
      }),
    );
  });

  it('auto-improves English after the idle delay', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        text: 'I need help with this task.',
        mode: 'improve_english',
        sourceLanguage: 'en',
        targetLanguage: 'en',
      }),
    );

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editInput('I need help with this task'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.mode).toBe('improve_english');
    expect(result.current.sourceLanguage).toBe('en');
    expect(result.current.targetLanguage).toBe('en');
    expect(result.current.resultText).toBe('I need help with this task.');
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'improve_english',
        text: 'I need help with this task',
      }),
      'token',
    );
  });

  it('uses the Spanish understanding action for incoming English', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        text: 'Necesito ayuda.',
        mode: 'translate_to_spanish',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      }),
    );

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editInput('I need help'));

    await act(async () => {
      await result.current.translate('translate_to_spanish');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.mode).toBe('translate_to_spanish');
    expect(result.current.resultText).toBe('Necesito ayuda.');
    expect(generateTranslation).toHaveBeenCalledTimes(1);
    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'translate_to_spanish',
        text: 'I need help',
      }),
      'token',
    );
  });

  it('leaves short ambiguous input manual until a mode is selected', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        text: 'Ok.',
        mode: 'improve_english',
        sourceLanguage: 'en',
        targetLanguage: 'en',
      }),
    );

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editInput('ok'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });
    expect(generateTranslation).not.toHaveBeenCalled();

    act(() => result.current.selectMode('improve_english'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'improve_english',
        text: 'ok',
      }),
      'token',
    );
    expect(result.current.resultText).toBe('Ok.');
  });

  it('keeps the latest input and mode when a stale response returns late', async () => {
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
      result.current.editInput('hola como estas');
      firstSubmit = result.current.translate();
    });

    act(() => {
      result.current.editInput('I need help');
      secondSubmit = result.current.translate('translate_to_spanish');
    });

    first.resolve(
      responseFor({
        id: 'old',
        text: 'old hello',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
      }),
    );
    second.resolve(
      responseFor({
        id: 'new',
        text: 'Necesito ayuda.',
        mode: 'translate_to_spanish',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        createdAt: '2026-06-01T00:00:01.000Z',
      }),
    );

    await act(async () => {
      await firstSubmit;
      await secondSubmit;
    });

    expect(result.current.inputText).toBe('I need help');
    expect(result.current.resultText).toBe('Necesito ayuda.');
    expect(result.current.mode).toBe('translate_to_spanish');
  });
});
