import { useCallback, useEffect, useRef, useState } from 'react';
import { analytics } from '../../services/analytics';
import type { FlowtranslateAccountKind } from '../../hooks/useFlowtranslateAccount';
import { ACCOUNT_PROMPT_COPY_THRESHOLD } from './accountPrompt';

type UseResponderAccountPromptParams = {
  accountKind: FlowtranslateAccountKind;
  resultCopyCount: number;
  openAccount: () => void;
};

export const useResponderAccountPrompt = ({
  accountKind,
  resultCopyCount,
  openAccount,
}: UseResponderAccountPromptParams) => {
  const [dismissed, setDismissed] = useState(false);
  const trackedAccountPromptRef = useRef(false);
  const shouldShowAccountPrompt =
    accountKind === 'guest' &&
    !dismissed &&
    resultCopyCount >= ACCOUNT_PROMPT_COPY_THRESHOLD;

  useEffect(() => {
    if (!shouldShowAccountPrompt) return;
    if (trackedAccountPromptRef.current) return;

    trackedAccountPromptRef.current = true;
    analytics.track('account_connect_prompt_shown', {
      surface: 'translate_soft_banner',
      reason: 'copied_replies',
      copy_count: resultCopyCount,
      account_kind: accountKind,
    });
  }, [accountKind, resultCopyCount, shouldShowAccountPrompt]);

  const openAccountFromPrompt = useCallback(
    (reason = 'copied_replies') => {
      analytics.track('account_connect_prompt_clicked', {
        surface: 'translate_soft_banner',
        reason,
        copy_count: resultCopyCount,
        account_kind: accountKind,
      });
      openAccount();
    },
    [accountKind, openAccount, resultCopyCount],
  );

  const dismissAccountPrompt = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    dismissAccountPrompt,
    openAccountFromPrompt,
    shouldShowAccountPrompt,
  };
};
