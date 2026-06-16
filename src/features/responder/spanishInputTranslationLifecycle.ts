import {
  createExpressionDirection,
  type ExpressionBreakdown,
  type TranslationPresetId,
} from '@eb-packages/flowtranslate-core';
import {
  FlowtranslateApiError,
  generateTranslation,
  type TranslateResponse,
} from '../../services/flowtranslate-api';
import {
  normalizeTranslatorText,
  type TranslatorStatus,
} from './translatorState';

type LatestSpanishInputSnapshot = {
  latestSequence: number;
  latestSourceText: string;
  latestPresetId: TranslationPresetId;
  latestContextText: string;
};

type SpanishInputTranslationLifecycleParams = {
  accessToken: string;
  requestSequence: number;
  sourceText: string;
  presetId: TranslationPresetId;
  contextText: string;
  startedAt: number;
  getLatestSnapshot: () => LatestSpanishInputSnapshot;
};

type SpanishInputTranslationSuccess = {
  kind: 'success';
  result: TranslateResponse;
  translatedInput: string;
  savedBreakdown: ExpressionBreakdown | null;
  responseDirection: ReturnType<typeof createExpressionDirection>;
  isSavedRecord: boolean;
  latencyMs: number;
};

type SpanishInputTranslationApiError = {
  kind: 'api_error';
  error: FlowtranslateApiError;
  status: Extract<TranslatorStatus, 'quota' | 'auth' | 'error'>;
  message: string;
  latencyMs: number;
};

type SpanishInputTranslationException = {
  kind: 'exception';
  error: unknown;
  message: string;
  latencyMs: number;
};

type SpanishInputTranslationEmpty = {
  kind: 'empty_translation';
};

type SpanishInputTranslationStale = {
  kind: 'stale';
};

export type SpanishInputTranslationLifecycleResult =
  | SpanishInputTranslationSuccess
  | SpanishInputTranslationApiError
  | SpanishInputTranslationException
  | SpanishInputTranslationEmpty
  | SpanishInputTranslationStale;

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const elapsedMs = (startedAt: number) =>
  Math.max(0, Math.round(currentTimeMs() - startedAt));

const isStillCurrentSpanishInput = ({
  requestSequence,
  sourceText,
  presetId,
  contextText,
  getLatestSnapshot,
}: Omit<SpanishInputTranslationLifecycleParams, 'accessToken' | 'startedAt'>) => {
  const latest = getLatestSnapshot();
  return (
    requestSequence === latest.latestSequence &&
    normalizeTranslatorText(latest.latestSourceText) ===
      normalizeTranslatorText(sourceText) &&
    presetId === latest.latestPresetId &&
    normalizeTranslatorText(contextText) ===
      normalizeTranslatorText(latest.latestContextText)
  );
};

export const runSpanishInputTranslationLifecycle = async ({
  accessToken,
  requestSequence,
  sourceText,
  presetId,
  contextText,
  startedAt,
  getLatestSnapshot,
}: SpanishInputTranslationLifecycleParams): Promise<SpanishInputTranslationLifecycleResult> => {
  try {
    const result = await generateTranslation(
      {
        mode: 'translate_to_spanish',
        text: sourceText,
        context: contextText.trim() || undefined,
        presetId,
        clientRequestId: `${requestSequence}`,
      },
      accessToken,
    );

    if (
      !isStillCurrentSpanishInput({
        requestSequence,
        sourceText,
        presetId,
        contextText,
        getLatestSnapshot,
      })
    ) {
      return { kind: 'stale' };
    }

    const translatedInput = result.text.trim();
    if (!translatedInput) return { kind: 'empty_translation' };

    const savedBreakdown =
      result.breakdown || result.translationRecord.breakdown || null;
    const responseDirection = createExpressionDirection('translate_to_spanish');
    const isSavedRecord =
      result.translationRecord.saved !== false &&
      Boolean(result.translationRecord.id);

    return {
      kind: 'success',
      result,
      translatedInput,
      savedBreakdown,
      responseDirection,
      isSavedRecord,
      latencyMs: elapsedMs(startedAt),
    };
  } catch (error) {
    if (
      !isStillCurrentSpanishInput({
        requestSequence,
        sourceText,
        presetId,
        contextText,
        getLatestSnapshot,
      })
    ) {
      return { kind: 'stale' };
    }

    if (error instanceof FlowtranslateApiError) {
      return {
        kind: 'api_error',
        error,
        status:
          error.status === 402 ? 'quota' : error.status === 401 ? 'auth' : 'error',
        message:
          error.status === 402 ? 'Llegaste al limite mensual.' : error.message,
        latencyMs: elapsedMs(startedAt),
      };
    }

    return {
      kind: 'exception',
      error,
      message:
        error instanceof Error
          ? error.message
          : 'No pudimos pasar el texto a espanol.',
      latencyMs: elapsedMs(startedAt),
    };
  }
};
