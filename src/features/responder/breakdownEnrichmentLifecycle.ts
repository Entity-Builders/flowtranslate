import {
  canApplyTranslationResponse,
  createExpressionDirection,
  type ExpressionBreakdown,
  type ExpressionMode,
  type TranslationPresetId,
  type TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import {
  FlowtranslateApiError,
  enrichBreakdown,
  type BreakdownEnrichmentResponse,
} from '../../services/flowtranslate-api';
import { isEnrichedBreakdown } from './translatorState';

type LatestBreakdownSnapshot = {
  latestSequence: number;
  latestMode: ExpressionMode;
  latestSourceText: string;
  latestPresetId: TranslationPresetId;
  latestRecordId: string;
};

type BreakdownEnrichmentLifecycleParams = {
  accessToken: string;
  recordId: string;
  requestSequence: number;
  mode: ExpressionMode;
  sourceText: string;
  translatedText: string;
  presetId: TranslationPresetId;
  createdAt: string;
  startedAt: number;
  getLatestSnapshot: () => LatestBreakdownSnapshot;
};

type BreakdownEnrichmentSuccess = {
  kind: 'success';
  response: BreakdownEnrichmentResponse;
  breakdown: ExpressionBreakdown;
  savedRecord: TranslationRecord;
  latencyMs: number;
};

type BreakdownEnrichmentMissing = {
  kind: 'missing_breakdown';
  response: BreakdownEnrichmentResponse;
  latencyMs: number;
};

type BreakdownEnrichmentApiError = {
  kind: 'api_error';
  error: FlowtranslateApiError;
  latencyMs: number;
};

type BreakdownEnrichmentException = {
  kind: 'exception';
  error: unknown;
  latencyMs: number;
};

type BreakdownEnrichmentStale = {
  kind: 'stale';
};

export type BreakdownEnrichmentLifecycleResult =
  | BreakdownEnrichmentSuccess
  | BreakdownEnrichmentMissing
  | BreakdownEnrichmentApiError
  | BreakdownEnrichmentException
  | BreakdownEnrichmentStale;

const currentTimeMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

const elapsedMs = (startedAt: number) =>
  Math.max(0, Math.round(currentTimeMs() - startedAt));

export const runBreakdownEnrichmentLifecycle = async ({
  accessToken,
  recordId,
  requestSequence,
  mode,
  sourceText,
  translatedText,
  presetId,
  createdAt,
  startedAt,
  getLatestSnapshot,
}: BreakdownEnrichmentLifecycleParams): Promise<BreakdownEnrichmentLifecycleResult> => {
  const isStillCurrent = () => {
    const latest = getLatestSnapshot();
    return (
      latest.latestRecordId === recordId &&
      canApplyTranslationResponse({
        requestSequence,
        latestSequence: latest.latestSequence,
        requestMode: mode,
        latestMode: latest.latestMode,
        requestSourceText: sourceText,
        latestSourceText: latest.latestSourceText,
        requestPresetId: presetId,
        latestPresetId: latest.latestPresetId,
      })
    );
  };

  try {
    const response = await enrichBreakdown({ translationRecordId: recordId }, accessToken);

    if (!isStillCurrent()) return { kind: 'stale' };

    const nextBreakdown =
      response.breakdown || response.translationRecord.breakdown || null;
    if (!isEnrichedBreakdown(nextBreakdown)) {
      return {
        kind: 'missing_breakdown',
        response,
        latencyMs: elapsedMs(startedAt),
      };
    }

    const responseDirection = createExpressionDirection(mode);
    return {
      kind: 'success',
      response,
      breakdown: nextBreakdown,
      savedRecord: {
        id: recordId,
        sourceLanguage:
          response.translationRecord.sourceLanguage ||
          responseDirection.sourceLanguage,
        targetLanguage:
          response.translationRecord.targetLanguage ||
          responseDirection.targetLanguage,
        sourceText,
        translatedText,
        mode,
        breakdown: nextBreakdown,
        createdAt: response.translationRecord.createdAt || createdAt,
      },
      latencyMs: elapsedMs(startedAt),
    };
  } catch (error) {
    if (!isStillCurrent()) return { kind: 'stale' };

    if (error instanceof FlowtranslateApiError) {
      return {
        kind: 'api_error',
        error,
        latencyMs: elapsedMs(startedAt),
      };
    }

    return {
      kind: 'exception',
      error,
      latencyMs: elapsedMs(startedAt),
    };
  }
};
