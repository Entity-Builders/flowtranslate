import type {
  ExpressionMode,
  LanguageCode,
  TranslationPresetId,
} from '@entity-builders/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowtranslateAccountKind } from '../../hooks/useFlowtranslateAccount';
import {
  analytics,
  commercialAnalyticsProperties,
} from '../../services/analytics';
import { copyText } from '../../services/clipboard';

export type CopiedTarget = 'input' | 'result' | null;

type UseExpressionClipboardParams = {
  accountKind: FlowtranslateAccountKind;
  mode: ExpressionMode;
  presetId: TranslationPresetId;
};

export const useExpressionClipboard = ({
  accountKind,
  mode,
  presetId,
}: UseExpressionClipboardParams) => {
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget>(null);
  const [resultCopyCount, setResultCopyCount] = useState(0);
  const copiedResetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  const clearCopiedResetTimer = useCallback(() => {
    if (!copiedResetTimerRef.current) return;
    window.clearTimeout(copiedResetTimerRef.current);
    copiedResetTimerRef.current = null;
  }, []);

  useEffect(() => clearCopiedResetTimer, [clearCopiedResetTimer]);

  const copyExpression = useCallback(
    async (
      target: Exclude<CopiedTarget, null>,
      language: LanguageCode,
      text: string,
    ) => {
      if (target === 'result') {
        analytics.track(
          'copy_intent_clicked',
          commercialAnalyticsProperties({
            target,
            language,
            text_length: text.length,
            mode,
            preset_id: presetId,
            account_kind: accountKind,
          }),
        );
      }
      const copied = await copyText(text);
      if (!copied) return;

      clearCopiedResetTimer();
      setCopiedTarget(target);
      analytics.track('translation_copied', {
        target,
        language,
        text_length: text.length,
      });
      if (target === 'result') {
        setResultCopyCount((current) => current + 1);
        analytics.track(
          'conversation_reply_copied',
          commercialAnalyticsProperties({
            language,
            text_length: text.length,
            mode,
            preset_id: presetId,
            account_kind: accountKind,
          }),
        );
      }
      copiedResetTimerRef.current = window.setTimeout(() => {
        copiedResetTimerRef.current = null;
        setCopiedTarget(null);
      }, 1600);
    },
    [accountKind, clearCopiedResetTimer, mode, presetId],
  );

  return {
    copiedTarget,
    copyExpression,
    resultCopyCount,
  };
};
