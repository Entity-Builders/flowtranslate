import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analytics,
  commercialAnalyticsProperties,
} from '../../services/analytics';
import type { useFlowtranslateAccount } from '../../hooks/useFlowtranslateAccount';

type FlowtranslateAccount = ReturnType<typeof useFlowtranslateAccount>;

type UseFlowtranslateAccountPanelParams = {
  account: FlowtranslateAccount;
  historyCount: number;
  translatorStatus: string;
};

export const useFlowtranslateAccountPanel = ({
  account,
  historyCount,
  translatorStatus,
}: UseFlowtranslateAccountPanelParams) => {
  const {
    accountKind,
    authLoading,
    busy,
    error,
    globalContext,
    isSupabaseConfigured,
    session,
    signInAsGuest,
    updateGlobalContext,
  } = account;
  const [showAccount, setShowAccount] = useState(false);
  const [profileContextDraft, setProfileContextDraft] = useState('');
  const [profileContextSaving, setProfileContextSaving] = useState(false);
  const [profileContextMessage, setProfileContextMessage] = useState('');
  const trackedGuestTrialRef = useRef(false);
  const autoGuestStartedRef = useRef(false);

  const openAccount = useCallback(() => setShowAccount(true), []);
  const closeAccount = useCallback(() => setShowAccount(false), []);
  const clearProfileContextMessage = useCallback(
    () => setProfileContextMessage(''),
    [],
  );

  useEffect(() => {
    if (!showAccount) return;
    setProfileContextDraft(globalContext);
    setProfileContextMessage('');
  }, [globalContext, showAccount]);

  useEffect(() => {
    if (trackedGuestTrialRef.current) return;
    if (accountKind !== 'guest' || !session) return;

    trackedGuestTrialRef.current = true;
    analytics.track(
      'guest_trial_started',
      commercialAnalyticsProperties({
        source: 'anonymous_session',
        account_kind: accountKind,
        has_saved_history: historyCount > 0,
        history_count: historyCount,
      }),
    );
  }, [accountKind, historyCount, session]);

  useEffect(() => {
    if (
      autoGuestStartedRef.current ||
      !isSupabaseConfigured ||
      authLoading ||
      busy ||
      session
    ) {
      return;
    }

    autoGuestStartedRef.current = true;
    void signInAsGuest({ source: 'automatic' });
  }, [authLoading, busy, isSupabaseConfigured, session, signInAsGuest]);

  useEffect(() => {
    if (
      translatorStatus === 'auth' &&
      !authLoading &&
      !busy
    ) {
      openAccount();
    }
  }, [authLoading, busy, openAccount, translatorStatus]);

  useEffect(() => {
    if (!error || authLoading) return;
    openAccount();
  }, [authLoading, error, openAccount]);

  const saveProfileContext = useCallback(async () => {
    setProfileContextSaving(true);
    setProfileContextMessage('');
    try {
      const saved = await updateGlobalContext(profileContextDraft);
      setProfileContextMessage(saved ? 'Perfil guardado.' : '');
    } finally {
      setProfileContextSaving(false);
    }
  }, [profileContextDraft, updateGlobalContext]);

  return {
    showAccount,
    profileContextDraft,
    profileContextMessage,
    profileContextSaving,
    clearProfileContextMessage,
    closeAccount,
    openAccount,
    saveProfileContext,
    setProfileContextDraft,
  };
};
