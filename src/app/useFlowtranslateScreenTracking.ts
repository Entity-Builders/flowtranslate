import { useEffect, useRef } from 'react';
import { analytics } from '../services/analytics';
import type { AppView } from './useFlowtranslateView';

type UseFlowtranslateScreenTrackingParams = {
  accountKind: string;
  hasSession: boolean;
  historyCount: number;
  resultText: string;
  view: AppView;
};

export const useFlowtranslateScreenTracking = ({
  accountKind,
  hasSession,
  historyCount,
  resultText,
  view,
}: UseFlowtranslateScreenTrackingParams) => {
  const trackedViewRef = useRef<AppView | null>(null);

  useEffect(() => {
    if (trackedViewRef.current === view) return;

    trackedViewRef.current = view;
    analytics.screen(view, {
      signed_in: hasSession,
      account_kind: accountKind,
      has_saved_history: historyCount > 0,
      history_count: historyCount,
      has_translation_result: Boolean(resultText.trim()),
    });

    if (view === 'learning') {
      analytics.track('learning_opened', {
        account_kind: accountKind,
        history_count: historyCount,
        has_saved_history: historyCount > 0,
      });
    }
  }, [accountKind, hasSession, historyCount, resultText, view]);
};
