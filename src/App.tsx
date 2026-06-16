import type {
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { STARTER_LEARNING_SITUATIONS } from '@eb-packages/flowtranslate-core';
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
import { useFlowtranslateCommercialExperiments } from './features/commercial/useFlowtranslateCommercialExperiments';
import { useFlowtranslateLearning } from './features/learning/useFlowtranslateLearning';
import { useLearningStudyTools } from './features/learning/useLearningStudyTools';
import { useExpressionClipboard } from './features/responder/useExpressionClipboard';
import { useResponderPromiseState } from './features/responder/useResponderPromiseState';
import { useFlowtranslateVoice } from './features/voice/useFlowtranslateVoice';
import { isOnline, subscribeToOnlineState } from './services/pwa';
import {
  clearTranslationHistory,
  deleteTranslationRecord,
  listTranslationHistory,
} from './services/translation-history';

const captureFlowtranslateError = (
  error: unknown,
  context: Record<string, unknown>,
) => {
  analytics.captureError(error, safeCommercialAnalyticsProperties(context));
};

function App() {
  const account = useFlowtranslateAccount();
  const { view, setView } = useFlowtranslateView();
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
  const study = useLearningStudyTools({
    account,
    historyCount: history.length,
    online,
    onOpenAccount: openAccount,
    onUsage: handleUsage,
  });
  const learning = useFlowtranslateLearning({
    account,
    historyCount: history.length,
    isLearningView: view === 'learning',
    online,
    onOpenAccount: openAccount,
    onUsage: handleUsage,
  });
  const returnToResponder = useCallback(() => {
    setView('translate');
  }, [setView]);
  const billing = useFlowtranslateBilling({
    account,
    hasSavedPhrases: learning.savedPhrases.some((phrase) => !phrase.archivedAt),
    historyCount: history.length,
    isLearningView: view === 'learning',
    learningSessionCount: learning.learningSessions.length,
    openAccount,
    resultCopyCount: clipboard.resultCopyCount,
    showAccount,
    trackCommercialExperimentExposure,
    translatorStatus: translator.status,
    usage,
    onReturnToResponder: returnToResponder,
  });

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

  const useLearningPhraseInResponder = useCallback(
    (text: string) => {
      translator.editInput(text);
      setView('translate');
      analytics.track('learning_phrase_used_in_responder', {
        text_length: text.trim().length,
      });
    },
    [setView, translator],
  );

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteTranslationRecord(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      learning.removeDeletedHistoryRecord(id);
      study.closeStudyArticleForRecord(id);
      analytics.track('translation_history_deleted', { count: 1 });
    } catch (error) {
      captureFlowtranslateError(error, {
        screen: 'learning',
        action: 'delete_translation_history_item',
        account_kind: account.accountKind,
      });
      setHistoryError(error instanceof Error ? error.message : 'No pudimos borrar ese item.');
    }
  };

  const clearHistory = async () => {
    try {
      await clearTranslationHistory();
      setHistory([]);
      learning.clearLearningState();
      study.closeStudyArticle();
      analytics.track('translation_history_cleared');
    } catch (error) {
      captureFlowtranslateError(error, {
        screen: 'learning',
        action: 'clear_translation_history',
        account_kind: account.accountKind,
      });
      setHistoryError(error instanceof Error ? error.message : 'No pudimos limpiar tu historial.');
    }
  };

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
  const expressionStatusText = translator.status === 'translating'
    ? 'Generando respuesta...'
    : translator.status === 'typing'
      ? 'Listo, espero una pausa'
    : translator.status === 'quota'
      ? 'Llegaste al limite mensual'
    : translator.hasPendingChanges
      ? 'Listo para responder'
      : translator.message || undefined;
  const shouldReserveMobileResultSheet =
    view === 'translate' &&
    (translator.status === 'translating' ||
      translator.status === 'quota' ||
      Boolean(translator.resultText.trim()));

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
          onRequestStudy={(record) => void study.openStudyArticle(record)}
          onSelectPreset={selectPreset}
          onStartProCheckout={(surface) => void billing.startProCheckout(surface)}
          upgradePromptState={billing.upgradePromptState}
        />
      ) : (
        <LearningRoute
          historyError={historyError}
          history={history}
          accountKind={account.accountKind}
          starterSituations={STARTER_LEARNING_SITUATIONS}
          learningSessions={learning.learningSessions}
          savedPhrases={learning.savedPhrases}
          activeSession={learning.activeLearningSession}
          progressLoading={learning.learningProgressLoading}
          progressError={learning.learningProgressError}
          sessionLoading={learning.learningSessionLoading}
          sessionError={learning.learningSessionError}
          selectedBestOptionId={learning.selectedBestOptionId}
          attemptLoading={learning.learningAttemptLoading}
          attemptError={learning.learningAttemptError}
          latestAttempt={learning.latestLearningAttempt}
          studyArticle={study.studyArticle}
          studyLoading={study.studyLoading}
          studyError={study.studyError}
          selectedStudyRecordId={study.selectedStudyRecordId}
          onStartSession={(situationId) =>
            void learning.startLearningSession(situationId)
          }
          onResumeSession={learning.resumeLearningSession}
          onLeaveSession={learning.leaveLearningSession}
          onSelectBestOption={learning.chooseLearningBestOption}
          onSubmitAttempt={(attemptText) =>
            void learning.submitLearningRewrite(attemptText)
          }
          onSavePhrase={(input) => void learning.savePhraseFromLearning(input)}
          onArchivePhrase={(id) => void learning.archivePhraseFromLearning(id)}
          onCompleteSession={() => void learning.completeActiveLearningSession()}
          onUsePhraseInResponder={useLearningPhraseInResponder}
          onOpenStudy={(record) => void study.openStudyArticle(record)}
          onCloseStudy={study.closeStudyArticle}
          onListenPhrase={(language, text) => voice.listenPanel(language, text)}
          onAskBreakdownQuestion={study.askAboutBreakdown}
          onDelete={(id) => void deleteHistoryItem(id)}
          onClear={() => void clearHistory()}
          upgradePrompt={
            billing.shouldShowLearningUpgradePrompt ? (
              <ProUpgradePrompt
                surface='learning'
                accountKind={account.accountKind}
                compact
                onStartCheckout={(surface) => void billing.startProCheckout(surface)}
                onConnectAccount={billing.connectAccountForPro}
                {...billing.upgradePromptState('learning')}
              />
            ) : null
          }
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
