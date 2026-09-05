import {
  canApplyTranslationResponse,
  createExpressionDirection,
  type ExpressionBreakdown,
  type ExpressionMode,
  type TranslationPresetId,
} from '@entity-builders/flowtranslate-core';
import {
  FlowtranslateApiError,
  generateTranslation,
  type TranslateResponse,
} from '../../services/flowtranslate-api';
import { type TranslatorStatus } from './translatorState';

type LatestTranslationSnapshot = {
  latestSequence: number;
  latestMode: ExpressionMode;
  latestSourceText: string;
  latestPresetId: TranslationPresetId;
  latestContextText: string;
};

type TranslationRequestLifecycleParams = {
  accessToken: string;
  requestSequence: number;
  mode: ExpressionMode;
  sourceText: string;
  presetId: TranslationPresetId;
  contextText: string;
  startedAt: number;
  getLatestSnapshot: () => LatestTranslationSnapshot;
};

type TranslationRequestSuccess = {
  kind: 'success';
  result: TranslateResponse;
  responseMode: ExpressionMode;
  responseDirection: ReturnType<typeof createExpressionDirection>;
  savedBreakdown: ExpressionBreakdown | null;
  isSavedRecord: boolean;
  nextRecordId: string;
  latencyMs: number;
};

type TranslationRequestApiError = {
  kind: 'api_error';
  error: FlowtranslateApiError;
  status: Extract<TranslatorStatus, 'quota' | 'auth' | 'error'>;
  message: string;
  latencyMs: number;
};

type TranslationRequestException = {
  kind: 'exception';
  error: unknown;
  message: string;
  latencyMs: number;
};

type TranslationRequestStale = {
  kind: 'stale';
};

export type TranslationRequestLifecycleResult =
  | TranslationRequestSuccess
  | TranslationRequestApiError
  | TranslationRequestException
  | TranslationRequestStale;

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const elapsedMs = (startedAt: number) =>
  Math.max(0, Math.round(currentTimeMs() - startedAt));

const isStillCurrentTranslation = ({
  requestSequence,
  mode,
  sourceText,
  presetId,
  contextText,
  getLatestSnapshot,
}: Omit<TranslationRequestLifecycleParams, 'accessToken' | 'startedAt'>) => {
  const latest = getLatestSnapshot();
  return canApplyTranslationResponse({
    requestSequence,
    latestSequence: latest.latestSequence,
    requestMode: mode,
    latestMode: latest.latestMode,
    requestSourceText: sourceText,
    latestSourceText: latest.latestSourceText,
    requestPresetId: presetId,
    latestPresetId: latest.latestPresetId,
    requestContextText: contextText,
    latestContextText: latest.latestContextText,
  });
};

export const runTranslationRequestLifecycle = async ({
  accessToken,
  requestSequence,
  mode,
  sourceText,
  presetId,
  contextText,
  startedAt,
  getLatestSnapshot,
}: TranslationRequestLifecycleParams): Promise<TranslationRequestLifecycleResult> => {
  try {
    const result = await generateTranslation(
      {
        mode,
        text: sourceText,
        context: contextText.trim() || undefined,
        presetId,
        clientRequestId: `${requestSequence}`,
      },
      accessToken,
    );

    const latest = getLatestSnapshot();
    if (!isStillCurrentTranslation({
      requestSequence,
      mode,
      sourceText,
      presetId,
      contextText,
      getLatestSnapshot: () => latest,
    })) {
      return { kind: 'stale' };
    }

    const savedBreakdown =
      result.breakdown || result.translationRecord.breakdown || null;
    const responseMode = result.mode || result.translationRecord.mode || mode;
    const responseDirection = createExpressionDirection(responseMode);
    const isSavedRecord =
      result.translationRecord.saved !== false &&
      Boolean(result.translationRecord.id);
    const nextRecordId = isSavedRecord ? result.translationRecord.id : '';

    return {
      kind: 'success',
      result,
      responseMode,
      responseDirection,
      savedBreakdown,
      isSavedRecord,
      nextRecordId,
      latencyMs: elapsedMs(startedAt),
    };
  } catch (error) {
    if (
      !isStillCurrentTranslation({
        requestSequence,
        mode,
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
          : 'No pudimos generar la respuesta.',
      latencyMs: elapsedMs(startedAt),
    };
  }
};
