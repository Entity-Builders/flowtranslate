import {
  canApplyTranslationResponse,
  type ExpressionMode,
  type TranslationPresetId,
  type TranslationRecord,
} from '@entity-builders/flowtranslate-core';
import { useCallback, useEffect, useRef } from 'react';
import { analytics } from '../../services/analytics';
import {
  normalizeTranslatorText,
  translationAnalyticsProperties,
  type TranslationTrigger,
} from './translatorState';

type LatestTranslationSnapshot = {
  latestSequence: number;
  latestMode: ExpressionMode;
  latestSourceText: string;
  latestPresetId: TranslationPresetId;
  latestContextText: string;
};

type PendingHistoryRefreshParams = {
  requestSequence: number;
  mode: ExpressionMode;
  sourceText: string;
  translatedText: string;
  presetId: TranslationPresetId;
  contextText: string;
  trigger: TranslationTrigger;
};

type UsePendingTranslationHistoryRefreshParams = {
  getLatestSnapshot: () => LatestTranslationSnapshot;
  onRefreshSavedTranslations?: () => Promise<TranslationRecord[]>;
  onResolveSavedRecord: (record: TranslationRecord) => void;
  onSavedTranslation: (record: TranslationRecord) => void;
};

const PENDING_HISTORY_REFRESH_DELAY_MS = 1800;

export const usePendingTranslationHistoryRefresh = ({
  getLatestSnapshot,
  onRefreshSavedTranslations,
  onResolveSavedRecord,
  onSavedTranslation,
}: UsePendingTranslationHistoryRefreshParams) => {
  const pendingHistoryTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  const clearPendingHistoryRefresh = useCallback(() => {
    if (!pendingHistoryTimerRef.current) return;
    window.clearTimeout(pendingHistoryTimerRef.current);
    pendingHistoryTimerRef.current = null;
  }, []);

  useEffect(() => clearPendingHistoryRefresh, [clearPendingHistoryRefresh]);

  const schedulePendingHistoryRefresh = useCallback(
    (params: PendingHistoryRefreshParams) => {
      if (!onRefreshSavedTranslations) return;
      clearPendingHistoryRefresh();

      pendingHistoryTimerRef.current = window.setTimeout(() => {
        pendingHistoryTimerRef.current = null;
        void (async () => {
          try {
            const records = await onRefreshSavedTranslations();
            const savedRecord = records.find(
              (record) =>
                normalizeTranslatorText(record.sourceText) ===
                  normalizeTranslatorText(params.sourceText) &&
                normalizeTranslatorText(record.translatedText) ===
                  normalizeTranslatorText(params.translatedText) &&
                (!record.mode || record.mode === params.mode),
            );

            if (!savedRecord) {
              analytics.track('translation_pending_save_unresolved', {
                ...translationAnalyticsProperties(
                  params.mode,
                  params.sourceText,
                  params.presetId,
                  params.trigger,
                  params.contextText,
                ),
              });
              return;
            }

            const latest = getLatestSnapshot();
            if (
              !canApplyTranslationResponse({
                requestSequence: params.requestSequence,
                latestSequence: latest.latestSequence,
                requestMode: params.mode,
                latestMode: latest.latestMode,
                requestSourceText: params.sourceText,
                latestSourceText: latest.latestSourceText,
                requestPresetId: params.presetId,
                latestPresetId: latest.latestPresetId,
                requestContextText: params.contextText,
                latestContextText: latest.latestContextText,
              })
            ) {
              return;
            }

            onResolveSavedRecord(savedRecord);
            onSavedTranslation(savedRecord);
            analytics.track('translation_pending_save_resolved', {
              ...translationAnalyticsProperties(
                params.mode,
                params.sourceText,
                params.presetId,
                params.trigger,
                params.contextText,
              ),
              record_id: savedRecord.id,
            });
          } catch (error) {
            analytics.captureError(error, {
              screen: 'translate',
              action: 'refresh_pending_translation_history',
              mode: params.mode,
              trigger: params.trigger,
            });
            analytics.track('translation_pending_save_refresh_failed', {
              ...translationAnalyticsProperties(
                params.mode,
                params.sourceText,
                params.presetId,
                params.trigger,
                params.contextText,
              ),
              error_type: error instanceof Error ? error.name : 'unknown',
            });
          }
        })();
      }, PENDING_HISTORY_REFRESH_DELAY_MS);
    },
    [
      clearPendingHistoryRefresh,
      getLatestSnapshot,
      onRefreshSavedTranslations,
      onResolveSavedRecord,
      onSavedTranslation,
    ],
  );

  return {
    clearPendingHistoryRefresh,
    schedulePendingHistoryRefresh,
  };
};
