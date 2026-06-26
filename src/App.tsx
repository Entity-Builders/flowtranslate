import type {
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { FlowtranslateAppShell } from './app/FlowtranslateAppShell';
import { useFlowtranslateScreenTracking } from './app/useFlowtranslateScreenTracking';
import { useFlowtranslateView } from './app/useFlowtranslateView';
import { AccountAccessModal } from './components/AccountAccessModal';
import { ProUpgradePrompt } from './components/ProUpgradePrompt';
import { LearningRoute } from './features/learning/LearningRoute';
import { ResponderRoute } from './features/responder/ResponderRoute';
import { useBidirectionalTranslator } from './hooks/useBidirectionalTranslator';
import { useFlowtranslateAccount } from './hooks/useFlowtranslateAccount';
import {
  analytics,
  safeCommercialAnalyticsProperties,
} from './services/analytics';
import { useFlowtranslateAccountPanel } from './features/account/useFlowtranslateAccountPanel';
import { useResponderAccountPrompt } from './features/account/useResponderAccountPrompt';
import { useFlowtranslateBilling } from './features/billing/useFlowtranslateBilling';
import {
  FLOWTRANSLATE_LAUNCH_PATH,
  LaunchLandingRoute,
  type LaunchLandingContext,
} from './features/commercial/LaunchLandingRoute';
import { useFlowtranslateCommercialExperiments } from './features/commercial/useFlowtranslateCommercialExperiments';
import { useExpressionClipboard } from './features/responder/useExpressionClipboard';
import { useResponderPromiseState } from './features/responder/useResponderPromiseState';
import { useFlowtranslateVoice } from './features/voice/useFlowtranslateVoice';
import { isOnline, subscribeToOnlineState } from './services/pwa';
import { listTranslationHistory } from './services/translation-history';

const captureFlowtranslateError = (
  error: unknown,
  context: Record<string, unknown>,
) => {
  analytics.captureError(error, safeCommercialAnalyticsProperties(context));
};

const LAUNCH_LANDING_PATHS = new Set([
  FLOWTRANSLATE_LAUNCH_PATH,
  '/work-english',
  '/campaign/work-english',
]);

const isLaunchLandingPath = () => {
  if (typeof window === 'undefined') return false;
  return LAUNCH_LANDING_PATHS.has(window.location.pathname);
};

const getLaunchUrlContext = (): LaunchLandingContext => {
  if (typeof window === 'undefined') return {};

  const url = new URL(window.location.href);
  return {
    campaignId:
      url.searchParams.get('campaign_id') ||
      url.searchParams.get('utm_campaign') ||
      undefined,
    variantId:
      url.searchParams.get('variant_id') ||
      url.searchParams.get('utm_content') ||
      undefined,
  };
};

function App() {
  const account = useFlowtranslateAccount();
  const { view, setView } = useFlowtranslateView();
  const [isLaunchLanding, setIsLaunchLanding] = useState(isLaunchLandingPath);
  const [landingContext, setLandingContext] =
    useState<LaunchLandingContext | null>(null);
  const { hasSeenResponderPromise, markResponderPromiseSeen } =
    useResponderPromiseState();
  const { trackCommercialExperimentExposure } =
    useFlowtranslateCommercialExperiments();
  const [online, setOnline] = useState(isOnline);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => subscribeToOnlineState(setOnline), []);

  const loadHistory = useCallback(async () => {
    if (!account.accessToken) {
      setHistory([]);
      return [];
    }

    try {
      setHistoryError('');
      const nextHistory = await listTranslationHistory();
      setHistory(nextHistory);
      return nextHistory;
    } catch (error) {
      captureFlowtranslateError(error, {
        screen: 'translate',
        action: 'load_translation_history',
        account_kind: account.accountKind,
      });
      setHistoryError(
        error instanceof Error ? error.message : 'No pudimos cargar tu historial.',
      );
      return [];
    }
  }, [account.accessToken, account.accountKind]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleUsage = useCallback((nextUsage: UsageSnapshot) => {
    setUsage(nextUsage);
  }, []);

  const handleSavedTranslation = useCallback((record: TranslationRecord) => {
    setHistory((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== record.id);
      return [record, ...withoutDuplicate].slice(0, 80);
    });
  }, []);

  const translator = useBidirectionalTranslator({
    accessToken: account.accessToken,
    authPending: account.authLoading || (account.busy && !account.session),
    online,
    onUsage: handleUsage,
    onSavedTranslation: handleSavedTranslation,
    onRefreshSavedTranslations: loadHistory,
  });
  const clipboard = useExpressionClipboard({
    accountKind: account.accountKind,
    mode: translator.mode,
    presetId: translator.presetId,
  });
  const voice = useFlowtranslateVoice({
    inputText: translator.inputText,
    sourceLanguage: translator.sourceLanguage,
    onInputChange: translator.editInput,
  });
  const accountPanel = useFlowtranslateAccountPanel({
    account,
    historyCount: history.length,
    translatorStatus: translator.status,
  });
  const showAccount = accountPanel.showAccount;
  const { openAccount } = accountPanel;
  const responderAccountPrompt = useResponderAccountPrompt({
    accountKind: account.accountKind,
    openAccount,
    resultCopyCount: clipboard.resultCopyCount,
  });
  const returnToResponder = useCallback(() => {
    setView('translate');
  }, [setView]);
  const billing = useFlowtranslateBilling({
    account,
    hasSavedPhrases: false,
    historyCount: history.length,
    isLearningView: view === 'learning',
    learningSessionCount: 0,
    openAccount,
    resultCopyCount: clipboard.resultCopyCount,
    showAccount,
    trackCommercialExperimentExposure,
    translatorStatus: translator.status,
    usage,
    onReturnToResponder: returnToResponder,
    onRememberPendingTranslation: translator.rememberPendingTranslationResume,
  });

  useEffect(() => {
    const handlePopState = () => {
      setIsLaunchLanding(isLaunchLandingPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openResponderFromLanding = useCallback(
    (nextContext: LaunchLandingContext = {}) => {
      setLandingContext({
        ...getLaunchUrlContext(),
        ...nextContext,
      });
      setView('translate');
      window.history.pushState({}, '', '/');
      setIsLaunchLanding(false);
    },
    [setView],
  );

  const startBlankFromLanding = useCallback(() => {
    openResponderFromLanding({
      sourceSituation: 'Mensaje propio',
    });
  }, [openResponderFromLanding]);

  const shouldSuppressResponderPromise =
    hasSeenResponderPromise ||
    account.accountKind === 'permanent' ||
    account.billingState.hasProAccess;

  useEffect(() => {
    if (hasSeenResponderPromise) return;
    if (account.accountKind !== 'permanent' && !account.billingState.hasProAccess) {
      return;
    }

    markResponderPromiseSeen();
  }, [
    account.accountKind,
    account.billingState.hasProAccess,
    hasSeenResponderPromise,
    markResponderPromiseSeen,
  ]);

  useEffect(() => {
    if (hasSeenResponderPromise || !translator.resultText.trim()) return;
    markResponderPromiseSeen();
  }, [
    hasSeenResponderPromise,
    markResponderPromiseSeen,
    translator.resultText,
  ]);

  useFlowtranslateScreenTracking({
    accountKind: account.accountKind,
    hasSession: Boolean(account.session),
    historyCount: history.length,
    resultText: translator.resultText,
    view,
  });

  const selectPreset = useCallback(
    (nextPresetId: TranslationPresetId) => {
      translator.selectPreset(nextPresetId);
      analytics.track('translation_preset_selected', {
        preset_id: nextPresetId,
      });
      analytics.track('conversation_tone_changed', {
        preset_id: nextPresetId,
        account_kind: account.accountKind,
        input_chars: translator.inputText.trim().length,
        has_result: Boolean(translator.resultText.trim()),
      });
    },
    [account.accountKind, translator],
  );

  const accountButtonLabel = account.billingState.hasProAccess
    ? 'Pro'
    : account.isPermanent
      ? 'Perfil'
      : account.displayName;
  const accountButtonTitle = account.billingState.hasProAccess
    ? 'FlowTranslate Pro'
    : account.isPermanent
      ? 'Perfil'
      : 'Cuenta';
  const accountButtonIcon = account.isGuest
    ? 'guest'
    : account.session
      ? 'signed-in'
      : 'settings';
  const quotaStatusText =
    usage?.recovery?.state === 'cooldown'
      ? 'Pausa de uso amigo'
      : usage?.recovery?.state === 'monthly_cap'
        ? 'Uso amigo completo'
        : 'Llegaste al limite mensual';
  const expressionStatusText = translator.status === 'translating'
    ? 'Generando respuesta...'
    : translator.status === 'typing'
      ? 'Listo, espero una pausa'
    : translator.status === 'quota'
      ? quotaStatusText
    : translator.hasPendingChanges
      ? 'Listo para responder'
      : translator.message || undefined;
  const shouldReserveMobileResultSheet =
    view === 'translate' &&
    (translator.status === 'translating' ||
      translator.status === 'quota' ||
      translator.status === 'error' ||
      translator.status === 'offline' ||
      translator.status === 'auth' ||
      Boolean(translator.resultText.trim()));

  if (isLaunchLanding) {
    return (
      <LaunchLandingRoute
        onStartBlank={startBlankFromLanding}
        onTrackExperimentExposure={trackCommercialExperimentExposure}
      />
    );
  }

  return (
    <FlowtranslateAppShell
      accountButton={{
        icon: accountButtonIcon,
        label: accountButtonLabel,
        title: accountButtonTitle,
      }}
      checkoutReturn={billing.checkoutReturn}
      checkoutReturnRetryBusy={billing.checkoutReturnRetryBusy}
      checkoutReturnRetryLabel={billing.checkoutReturnRetryLabel}
      online={online}
      view={view}
      onDismissCheckoutReturn={billing.dismissCheckoutReturn}
      onOpenAccount={openAccount}
      onOpenAccountFromCheckoutReturn={billing.openAccountFromCheckoutReturn}
      onRetryCheckoutFromReturn={billing.retryCheckoutFromReturn}
      onReturnToResponderFromCheckout={billing.returnToResponderFromCheckout}
      onViewChange={setView}
    >
      {view === 'translate' ? (
        <ResponderRoute
          accountKind={account.accountKind}
          copiedTarget={clipboard.copiedTarget}
          dictatingLanguage={voice.dictatingLanguage}
          dictationAvailable={voice.dictationAvailable}
          dictationUnavailableReason={voice.dictationUnavailableReason}
          expressionStatusText={expressionStatusText}
          history={history}
          landingContext={landingContext}
          shouldReserveMobileResultSheet={shouldReserveMobileResultSheet}
          shouldShowAccountPrompt={responderAccountPrompt.shouldShowAccountPrompt}
          shouldShowSavedHistoryUpgradePrompt={
            billing.shouldShowSavedHistoryUpgradePrompt
          }
          shouldShowUsageUpgradePrompt={billing.shouldShowUsageUpgradePrompt}
          shouldSuppressResponderPromise={shouldSuppressResponderPromise}
          speakingLanguage={voice.speakingLanguage}
          speechAvailable={voice.speechAvailable}
          translator={translator}
          usage={usage}
          voiceMessage={voice.voiceMessage}
          quotaUpgradeBusy={billing.quotaUpgradeBusy}
          quotaUpgradeLabel={billing.quotaUpgradeLabel}
          quotaSupportBusy={billing.quotaSupportBusy}
          onConnectAccountForPro={billing.connectAccountForPro}
          onCopyInput={() =>
            void clipboard.copyExpression(
              'input',
              translator.sourceLanguage,
              translator.inputText,
            )
          }
          onCopyResult={() =>
            void clipboard.copyExpression(
              'result',
              translator.targetLanguage,
              translator.resultText,
            )
          }
          onDictateInput={voice.dictateInput}
          onDismissAccountPrompt={responderAccountPrompt.dismissAccountPrompt}
          onDismissUpgradePrompt={billing.dismissUpgradePrompt}
          onListenInput={() =>
            voice.listenPanel(translator.sourceLanguage, translator.inputText)
          }
          onListenResult={() =>
            voice.listenPanel(translator.targetLanguage, translator.resultText)
          }
          onOpenAccountFromPrompt={responderAccountPrompt.openAccountFromPrompt}
          onOpenLearning={() => setView('learning')}
          onQuotaSupport={billing.openQuotaSupport}
          onQuotaUpgrade={billing.upgradeQuota}
          onRequestStudy={() => setView('learning')}
          onSelectPreset={selectPreset}
          onStartProCheckout={(surface) => void billing.startProCheckout(surface)}
          upgradePromptState={billing.upgradePromptState}
        />
      ) : (
        <LearningRoute
          historyError={historyError}
          history={history}
          accountKind={account.accountKind}
        />
      )}

      {showAccount ? (
        <AccountAccessModal
          account={account}
          usage={usage}
          profileUpgradePrompt={
            <ProUpgradePrompt
              surface='profile_preferences'
              accountKind={account.accountKind}
              actionLabel={billing.profileUpgradeActionLabel}
              compact
              onStartCheckout={(surface) => void billing.startProCheckout(surface)}
              onConnectAccount={billing.connectAccountForPro}
              {...billing.upgradePromptState('profile_preferences')}
            />
          }
          profileContextDraft={accountPanel.profileContextDraft}
          profileContextMessage={accountPanel.profileContextMessage}
          profileContextSaving={accountPanel.profileContextSaving}
          onProfileContextDraftChange={accountPanel.setProfileContextDraft}
          onProfileContextMessageClear={accountPanel.clearProfileContextMessage}
          onSaveProfileContext={() => void accountPanel.saveProfileContext()}
          onClose={accountPanel.closeAccount}
        />
      ) : null}
    </FlowtranslateAppShell>
  );
}

export default App;
