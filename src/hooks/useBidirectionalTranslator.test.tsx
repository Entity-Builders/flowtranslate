import { act, renderHook } from '@testing-library/react';
import type {
  ExpressionBreakdown,
  ExpressionMode,
} from '@eb-packages/flowtranslate-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSLATION_IDLE_DELAY_MS } from '../constants';
import {
  FlowtranslateApiError,
  enrichBreakdown,
  generateTranslation,
  type BreakdownEnrichmentResponse,
  type TranslateResponse,
} from '../services/flowtranslate-api';
import { useBidirectionalTranslator } from './useBidirectionalTranslator';

const analyticsTrack = vi.hoisted(() => vi.fn());

vi.mock('../services/analytics', () => ({
  analytics: {
    track: analyticsTrack,
  },
}));

vi.mock('../services/flowtranslate-api', () => ({
  generateTranslation: vi.fn(),
  enrichBreakdown: vi.fn(),
  FlowtranslateApiError: class FlowtranslateApiError extends Error {
    status: number;
    usage: typeof usage | undefined;

    constructor(message: string, status = 500, nextUsage?: typeof usage) {
      super(message);
      this.name = 'FlowtranslateApiError';
      this.status = status;
      this.usage = nextUsage;
    }
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
  tenses: [
    {
      label: 'Simple present',
      text: 'need',
      note: 'Describe una necesidad actual.',
    },
  ],
  structure: [
    {
      text: 'I',
      role: 'subject',
      note: 'Subject',
    },
  ],
  commonMistake: 'Do not omit the subject in English.',
};

const partialRichBreakdown: ExpressionBreakdown = {
  changed: true,
  confidence: 'high',
  feedback: ['Suena natural en este contexto.'],
  tenses: [
    {
      label: 'Simple present',
      text: 'need',
      note: 'Describe una necesidad actual.',
    },
  ],
  structure: [
    {
      text: 'I need help',
      role: 'other',
      note: 'Frase completa con sujeto y verbo.',
    },
  ],
};

const minimalBreakdown: ExpressionBreakdown = {
  changed: true,
  confidence: 'high',
  feedback: [],
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
  nextBreakdown = minimalBreakdown,
}: {
  id?: string;
  text: string;
  mode: ExpressionMode;
  sourceLanguage: 'es' | 'en';
  targetLanguage: 'es' | 'en';
  createdAt?: string;
  nextBreakdown?: ExpressionBreakdown | null;
}): TranslateResponse => ({
  kind: 'translate',
  text,
  mode,
  breakdown: nextBreakdown,
  translationRecord: {
    id,
    sourceLanguage,
    targetLanguage,
    mode,
    breakdown: nextBreakdown,
    createdAt,
  },
  usage,
});

const enrichmentFor = ({
  id = 'record-1',
  mode,
  sourceLanguage,
  targetLanguage,
  createdAt = '2026-06-01T00:00:00.000Z',
  nextBreakdown = breakdown,
}: {
  id?: string;
  mode: ExpressionMode;
  sourceLanguage: 'es' | 'en';
  targetLanguage: 'es' | 'en';
  createdAt?: string;
  nextBreakdown?: ExpressionBreakdown;
}): BreakdownEnrichmentResponse => ({
  kind: 'breakdown_enrichment',
  breakdown: nextBreakdown,
  translationRecord: {
    id,
    sourceLanguage,
    targetLanguage,
    mode,
    breakdown: nextBreakdown,
    createdAt,
  },
  cached: false,
  usage,
});

describe('useBidirectionalTranslator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.mocked(enrichBreakdown).mockResolvedValue(
      enrichmentFor({
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
      }),
    );
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
    expect(result.current.breakdown).toBeNull();
    expect(result.current.breakdownStatus).toBe('idle');
    expect(result.current.translationRecordId).toBe('record-1');
    expect(enrichBreakdown).not.toHaveBeenCalled();
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
        breakdown: minimalBreakdown,
      }),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'translation_submitted',
      expect.objectContaining({
        mode: 'translate_to_english',
        preset_id: 'natural',
        trigger: 'auto_idle',
        source_language: 'es',
        target_language: 'en',
        input_chars: 15,
      }),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'conversation_reply_requested',
      expect.objectContaining({
        mode: 'translate_to_english',
        preset_id: 'natural',
        trigger: 'auto_idle',
        source_language: 'es',
        target_language: 'en',
        input_chars: 15,
      }),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'translation_succeeded',
      expect.objectContaining({
        mode: 'translate_to_english',
        output_chars: 19,
        charged: true,
        reused: false,
        remaining_quota: 96,
      }),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'conversation_reply_generated',
      expect.objectContaining({
        mode: 'translate_to_english',
        output_chars: 19,
        charged: true,
        reused: false,
        remaining_quota: 96,
      }),
    );

    const submittedProperties = analyticsTrack.mock.calls.find(
      ([eventName]) => eventName === 'translation_submitted',
    )?.[1] as Record<string, unknown>;
    expect(submittedProperties).not.toHaveProperty('text');
    expect(submittedProperties).not.toHaveProperty('source_text');
    expect(submittedProperties).not.toHaveProperty('translated_text');
    const generatedProperties = analyticsTrack.mock.calls.find(
      ([eventName]) => eventName === 'conversation_reply_generated',
    )?.[1] as Record<string, unknown>;
    expect(generatedProperties).not.toHaveProperty('text');
    expect(generatedProperties).not.toHaveProperty('source_text');
    expect(generatedProperties).not.toHaveProperty('translated_text');
  });

  it('requests the breakdown only after the user opens Desglose', async () => {
    const deferredEnrichment =
      createDeferred<BreakdownEnrichmentResponse>();

    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        id: 'record-fast',
        text: 'I think she got arrested too.',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
        nextBreakdown: minimalBreakdown,
      }),
    );
    vi.mocked(enrichBreakdown).mockReturnValueOnce(deferredEnrichment.promise);

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

    act(() => result.current.editInput('Creo que tambien, quedo detenida.'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.resultText).toBe('I think she got arrested too.');
    expect(result.current.breakdown).toBeNull();
    expect(result.current.breakdownStatus).toBe('idle');
    expect(enrichBreakdown).not.toHaveBeenCalled();

    act(() => result.current.requestBreakdown());

    expect(result.current.breakdownStatus).toBe('enriching');
    expect(enrichBreakdown).toHaveBeenCalledWith(
      { translationRecordId: 'record-fast' },
      'token',
    );

    await act(async () => {
      deferredEnrichment.resolve(
        enrichmentFor({
          id: 'record-fast',
          mode: 'translate_to_english',
          sourceLanguage: 'es',
          targetLanguage: 'en',
          nextBreakdown: breakdown,
        }),
      );
      await Promise.resolve();
    });

    expect(result.current.breakdown).toBe(breakdown);
    expect(result.current.breakdownStatus).toBe('ready');
    expect(onSavedTranslation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'record-fast',
        breakdown,
      }),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'breakdown_enrichment_requested',
      expect.objectContaining({
        mode: 'translate_to_english',
        trigger: 'panel_opened',
      }),
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'breakdown_enrichment_charged',
      expect.objectContaining({
        mode: 'translate_to_english',
        trigger: 'panel_opened',
      }),
    );
  });

  it('uses cached enriched breakdowns without calling the API again', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        id: 'record-cached',
        text: 'I need help with this.',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
        nextBreakdown: partialRichBreakdown,
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

    act(() => result.current.editInput('necesito ayuda con esto'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.breakdown).toBe(partialRichBreakdown);
    expect(result.current.breakdownStatus).toBe('ready');

    act(() => result.current.requestBreakdown());

    expect(enrichBreakdown).not.toHaveBeenCalled();
    expect(result.current.breakdownStatus).toBe('ready');
    expect(analyticsTrack).toHaveBeenCalledWith(
      'breakdown_enrichment_cached',
      expect.objectContaining({
        mode: 'translate_to_english',
        trigger: 'panel_opened',
        cache_source: 'client_state',
      }),
    );
  });

  it('ignores stale breakdown enrichment responses', async () => {
    const firstEnrichment = createDeferred<BreakdownEnrichmentResponse>();
    vi.mocked(generateTranslation)
      .mockResolvedValueOnce(
        responseFor({
          id: 'record-old',
          text: 'I need help with this.',
          mode: 'translate_to_english',
          sourceLanguage: 'es',
          targetLanguage: 'en',
        }),
      )
      .mockResolvedValueOnce(
        responseFor({
          id: 'record-new',
          text: 'Necesito ayuda.',
          mode: 'translate_to_spanish',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          createdAt: '2026-06-01T00:00:01.000Z',
        }),
      );
    vi.mocked(enrichBreakdown).mockReturnValueOnce(firstEnrichment.promise);

    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage: vi.fn(),
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editInput('necesito ayuda con esto'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });
    act(() => result.current.requestBreakdown());

    let secondSubmit: Promise<void> = Promise.resolve();
    act(() => {
      result.current.editInput('I need help');
      secondSubmit = result.current.translate('translate_to_spanish');
    });

    await act(async () => {
      await secondSubmit;
    });

    await act(async () => {
      firstEnrichment.resolve(
        enrichmentFor({
          id: 'record-old',
          mode: 'translate_to_english',
          sourceLanguage: 'es',
          targetLanguage: 'en',
          nextBreakdown: breakdown,
        }),
      );
      await Promise.resolve();
    });

    expect(result.current.translationRecordId).toBe('record-new');
    expect(result.current.resultText).toBe('Necesito ayuda.');
    expect(result.current.breakdown).toBeNull();
    expect(result.current.breakdownStatus).toBe('idle');
  });

  it('marks on-demand breakdown failures without losing the translation', async () => {
    const exhaustedUsage = {
      ...usage,
      usedThisMonth: 100,
      remainingThisMonth: 0,
      charged: false,
    };
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        id: 'record-error',
        text: 'I need help with this.',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
      }),
    );
    vi.mocked(enrichBreakdown).mockRejectedValueOnce(
      new FlowtranslateApiError('Monthly quota reached.', 402, exhaustedUsage),
    );

    const onUsage = vi.fn();
    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage,
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editInput('necesito ayuda con esto'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    act(() => result.current.requestBreakdown());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.resultText).toBe('I need help with this.');
    expect(result.current.breakdown).toBeNull();
    expect(result.current.breakdownStatus).toBe('error');
    expect(onUsage).toHaveBeenCalledWith(exhaustedUsage);
    expect(analyticsTrack).toHaveBeenCalledWith(
      'breakdown_enrichment_failed',
      expect.objectContaining({
        mode: 'translate_to_english',
        trigger: 'panel_opened',
        error_status: 402,
        remaining_quota: 0,
      }),
    );
  });

  it('regenerates the current answer immediately when the response tone changes', async () => {
    vi.mocked(generateTranslation)
      .mockResolvedValueOnce(
        responseFor({
          id: 'record-natural',
          text: 'I need help with this.',
          mode: 'translate_to_english',
          sourceLanguage: 'es',
          targetLanguage: 'en',
        }),
      )
      .mockResolvedValueOnce(
        responseFor({
          id: 'record-professional',
          text: 'I would appreciate your help with this.',
          mode: 'translate_to_english',
          sourceLanguage: 'es',
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

    act(() => result.current.editInput('necesito ayuda con esto'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(result.current.resultText).toBe('I need help with this.');

    act(() => result.current.selectPreset('professional'));

    expect(result.current.presetId).toBe('professional');
    expect(result.current.status).toBe('translating');
    expect(generateTranslation).toHaveBeenCalledTimes(2);
    expect(generateTranslation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: 'translate_to_english',
        text: 'necesito ayuda con esto',
        presetId: 'professional',
      }),
      'token',
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.resultText).toBe(
      'I would appreciate your help with this.',
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'translation_submitted',
      expect.objectContaining({
        mode: 'translate_to_english',
        preset_id: 'professional',
        trigger: 'preset_selected',
      }),
    );
  });

  it('regenerates with one-off work context without changing the visible source text', async () => {
    vi.mocked(generateTranslation)
      .mockResolvedValueOnce(
        responseFor({
          id: 'record-generic',
          text: "Hey, I can't make it today.",
          mode: 'translate_to_english',
          sourceLanguage: 'es',
          targetLanguage: 'en',
        }),
      )
      .mockResolvedValueOnce(
        responseFor({
          id: 'record-context',
          text: "Hi Sarah, I'm sorry, but I won't be able to make our meeting today.",
          mode: 'translate_to_english',
          sourceLanguage: 'es',
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

    act(() => result.current.editInput('que tal hoy no puedo ir'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    act(() =>
      result.current.editWorkContext(
        'Cliente Sarah: es una reunion de avance y quiero proponer reprogramar.',
      ),
    );
    await act(async () => {
      await result.current.applyWorkContext();
    });

    expect(result.current.inputText).toBe('que tal hoy no puedo ir');
    expect(result.current.resultText).toContain('Sarah');
    expect(generateTranslation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: 'que tal hoy no puedo ir',
        context:
          'Cliente Sarah: es una reunion de avance y quiero proponer reprogramar.',
      }),
      'token',
    );
    expect(analyticsTrack).toHaveBeenCalledWith(
      'translation_context_applied',
      expect.objectContaining({
        has_context: true,
        context_chars: expect.any(Number),
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

  it('waits for automatic guest auth before translating pending input', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        text: 'hello, how are you?',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
        targetLanguage: 'en',
      }),
    );

    const { result, rerender } = renderHook(
      ({
        accessToken,
        authPending,
      }: {
        accessToken: string;
        authPending: boolean;
      }) =>
        useBidirectionalTranslator({
          accessToken,
          authPending,
          online: true,
          onUsage: vi.fn(),
          onSavedTranslation: vi.fn(),
        }),
      {
        initialProps: {
          accessToken: '',
          authPending: true,
        },
      },
    );

    act(() => result.current.editInput('hola como estas'));

    expect(result.current.status).toBe('typing');
    expect(result.current.message).toBe('Preparando tu prueba gratis...');
    expect(result.current.translateDisabledReason).toBe('Preparando tu prueba gratis...');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(generateTranslation).not.toHaveBeenCalled();
    expect(analyticsTrack).not.toHaveBeenCalledWith(
      'translation_blocked',
      expect.objectContaining({ reason: 'auth' }),
    );

    rerender({
      accessToken: 'guest-token',
      authPending: false,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRANSLATION_IDLE_DELAY_MS);
    });

    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'translate_to_english',
        text: 'hola como estas',
      }),
      'guest-token',
    );
    expect(result.current.resultText).toBe('hello, how are you?');
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
    expect(analyticsTrack).not.toHaveBeenCalledWith(
      'conversation_reply_requested',
      expect.objectContaining({
        mode: 'translate_to_spanish',
      }),
    );
  });

  it('still generates short ambiguous input without asking for a mode', async () => {
    vi.mocked(generateTranslation).mockResolvedValueOnce(
      responseFor({
        text: 'Ok.',
        mode: 'translate_to_english',
        sourceLanguage: 'es',
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

    expect(generateTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'translate_to_english',
        text: 'ok',
      }),
      'token',
    );
    expect(result.current.resultText).toBe('Ok.');
    expect(analyticsTrack).not.toHaveBeenCalledWith(
      'translation_blocked',
      expect.objectContaining({
        reason: 'ambiguous',
      }),
    );
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

  it('tracks quota-blocked translation failures without source text', async () => {
    const exhaustedUsage = {
      ...usage,
      usedThisMonth: 100,
      remainingThisMonth: 0,
      charged: false,
    };
    vi.mocked(generateTranslation).mockRejectedValueOnce(
      new FlowtranslateApiError('Monthly quota reached.', 402, exhaustedUsage),
    );

    const onUsage = vi.fn();
    const { result } = renderHook(() =>
      useBidirectionalTranslator({
        accessToken: 'token',
        online: true,
        onUsage,
        onSavedTranslation: vi.fn(),
      }),
    );

    act(() => result.current.editInput('necesito ayuda con esto'));

    await act(async () => {
      await result.current.translate();
    });

    expect(result.current.status).toBe('quota');
    expect(onUsage).toHaveBeenCalledWith(exhaustedUsage);
    expect(analyticsTrack).toHaveBeenCalledWith(
      'translation_blocked',
      expect.objectContaining({
        reason: 'quota',
        mode: 'translate_to_english',
        trigger: 'manual_generate',
        error_status: 402,
        remaining_quota: 0,
      }),
    );

    const blockedProperties = analyticsTrack.mock.calls.find(
      ([eventName, properties]) =>
        eventName === 'translation_blocked' &&
        (properties as Record<string, unknown>).reason === 'quota',
    )?.[1] as Record<string, unknown>;
    expect(blockedProperties).not.toHaveProperty('text');
    expect(blockedProperties).not.toHaveProperty('source_text');
    expect(blockedProperties).not.toHaveProperty('translated_text');
  });
});
