import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LEARNING_HISTORY_PERSONALIZATION_THRESHOLD,
  type UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import type { ProUpgradeSurface } from '../../components/ProUpgradePrompt';
import type { useFlowtranslateAccount } from '../../hooks/useFlowtranslateAccount';
import {
  FlowtranslateApiError,
  startFlowtranslateProCheckout,
} from '../../services/flowtranslate-api';
import {
  analytics,
  safeCommercialAnalyticsProperties,
} from '../../services/analytics';
import {
  readCheckoutReturnFromUrl,
  type CheckoutReturnState,
} from '../../services/checkout-return';
import { ACCOUNT_PROMPT_COPY_THRESHOLD } from '../account/accountPrompt';
import { FLOWTRANSLATE_PRO_ANALYTICS } from '../commercial/useFlowtranslateCommercialExperiments';

type FlowtranslateAccount = ReturnType<typeof useFlowtranslateAccount>;

type UseFlowtranslateBillingParams = {
  account: FlowtranslateAccount;
  hasSavedPhrases: boolean;
  historyCount: number;
  isLearningView: boolean;
  learningSessionCount: number;
  openAccount: () => void;
  resultCopyCount: number;
  showAccount: boolean;
  trackCommercialExperimentExposure: (
    experimentKey: 'ft_pro_value_copy',
    properties?: Record<string, unknown>,
  ) => void;
  translatorStatus: string;
  usage: UsageSnapshot | null;
  onReturnToResponder: () => void;
};

const CHECKOUT_RETURN_PAYMENT_EVENTS: Record<CheckoutReturnState, string> = {
  success: 'payment_succeeded',
  pending: 'payment_pending',
  failed: 'payment_failed',
  cancelled: 'payment_cancelled',
  unknown: 'payment_pending',
};

const FLOWTRANSLATE_COFFEE_URL =
  import.meta.env.VITE_FLOWTRANSLATE_COFFEE_URL?.trim() ||
  'https://cafecito.app/entitybuilders';

const captureFlowtranslateError = (
  error: unknown,
  context: Record<string, unknown>,
) => {
  analytics.captureError(error, safeCommercialAnalyticsProperties(context));
};

export const useFlowtranslateBilling = ({
  account,
  hasSavedPhrases,
  historyCount,
  isLearningView,
  learningSessionCount,
  openAccount,
  resultCopyCount,
  showAccount,
  trackCommercialExperimentExposure,
  translatorStatus,
  usage,
  onReturnToResponder,
}: UseFlowtranslateBillingParams) => {
  const [checkoutReturn, setCheckoutReturn] = useState(() =>
    readCheckoutReturnFromUrl(window.location),
  );
  const [dismissedUpgradePrompts, setDismissedUpgradePrompts] = useState<
    ProUpgradeSurface[]
  >([]);
  const [checkoutStartingSurface, setCheckoutStartingSurface] =
    useState<ProUpgradeSurface | null>(null);
  const [checkoutError, setCheckoutError] = useState<{
    surface: ProUpgradeSurface;
    message: string;
  } | null>(null);
  const trackedCheckoutReturnRef = useRef<string | null>(null);
  const trackedEntitlementStateRef = useRef<string | null>(null);
  const trackedUpgradePromptRef = useRef<Set<string>>(new Set());

  const usagePressure =
    usage &&
    (usage.remainingThisMonth <= 0 ||
      (usage.monthlyQuota > 0 &&
        usage.remainingThisMonth / usage.monthlyQuota <= 0.2));
  const shouldShowUsageUpgradePrompt =
    Boolean(usagePressure) &&
    translatorStatus !== 'quota' &&
    !account.billingState.hasProAccess &&
    !account.billingState.shouldWaitForProvider &&
    !dismissedUpgradePrompts.includes('usage_limit');
  const shouldShowSavedHistoryUpgradePrompt =
    account.accountKind === 'permanent' &&
    resultCopyCount >= ACCOUNT_PROMPT_COPY_THRESHOLD &&
    !account.billingState.hasProAccess &&
    !account.billingState.shouldWaitForProvider &&
    !dismissedUpgradePrompts.includes('saved_history');
  const shouldShowLearningUpgradePrompt =
    isLearningView &&
    !account.billingState.hasProAccess &&
    !account.billingState.shouldWaitForProvider &&
    (historyCount >= LEARNING_HISTORY_PERSONALIZATION_THRESHOLD ||
      learningSessionCount > 0 ||
      hasSavedPhrases);

  const billingAnalyticsProperties = useCallback(
    (extra: Record<string, unknown> = {}) =>
      safeCommercialAnalyticsProperties({
        account_kind: account.accountKind,
        billing_state: account.billingState.id,
        entitlement_source: account.billingState.source,
        entitlement_reason: account.billingState.reason,
        has_pro_access: account.billingState.hasProAccess,
        can_retry_checkout: account.billingState.canRetryCheckout,
        should_wait_for_provider: account.billingState.shouldWaitForProvider,
        requires_support: account.billingState.requiresSupport,
        ...FLOWTRANSLATE_PRO_ANALYTICS,
        ...extra,
      }),
    [
      account.accountKind,
      account.billingState.canRetryCheckout,
      account.billingState.hasProAccess,
      account.billingState.id,
      account.billingState.reason,
      account.billingState.requiresSupport,
      account.billingState.shouldWaitForProvider,
      account.billingState.source,
    ],
  );

  const proUpgradeAnalytics = useCallback(
    (surface: ProUpgradeSurface) => billingAnalyticsProperties({ surface }),
    [billingAnalyticsProperties],
  );

  const trackUpgradePromptShown = useCallback(
    (surface: ProUpgradeSurface, reason: string) => {
      const trackingKey = [
        surface,
        reason,
        account.accountKind,
        account.billingState.id,
      ].join(':');
      if (trackedUpgradePromptRef.current.has(trackingKey)) return;
      trackedUpgradePromptRef.current.add(trackingKey);

      const properties = billingAnalyticsProperties({
        surface,
        reason,
        history_count: historyCount,
        has_saved_history: historyCount > 0,
        remaining_quota: usage?.remainingThisMonth ?? null,
      });

      analytics.track('upgrade_prompt_shown', properties);
      analytics.track('pricing_viewed', properties);
      trackCommercialExperimentExposure('ft_pro_value_copy', { surface });
    },
    [
      account.accountKind,
      account.billingState.id,
      billingAnalyticsProperties,
      historyCount,
      trackCommercialExperimentExposure,
      usage?.remainingThisMonth,
    ],
  );

  const dismissUpgradePrompt = useCallback((surface: ProUpgradeSurface) => {
    setDismissedUpgradePrompts((current) =>
      current.includes(surface) ? current : [...current, surface],
    );
    analytics.track('upgrade_prompt_dismissed', { surface });
  }, []);

  useEffect(() => {
    if (shouldShowSavedHistoryUpgradePrompt) {
      trackUpgradePromptShown('saved_history', 'copied_replies');
    }
    if (shouldShowUsageUpgradePrompt) {
      trackUpgradePromptShown('usage_limit', 'usage_pressure');
    }
    if (translatorStatus === 'quota') {
      trackUpgradePromptShown('usage_limit', 'quota_exhausted');
    }
    if (shouldShowLearningUpgradePrompt) {
      trackUpgradePromptShown('learning', 'learning_value');
    }
    if (
      showAccount &&
      account.billingState.canRetryCheckout &&
      !account.billingState.hasProAccess
    ) {
      trackUpgradePromptShown('profile_preferences', 'account_modal');
    }
  }, [
    account.billingState.canRetryCheckout,
    account.billingState.hasProAccess,
    shouldShowLearningUpgradePrompt,
    shouldShowSavedHistoryUpgradePrompt,
    shouldShowUsageUpgradePrompt,
    showAccount,
    trackUpgradePromptShown,
    translatorStatus,
  ]);

  useEffect(() => {
    if (!checkoutReturn) return;

    const trackingKey = [
      checkoutReturn.state,
      checkoutReturn.rawStatus || 'missing',
      checkoutReturn.hasExternalReference ? 'external' : 'no_external',
      checkoutReturn.hasProviderReference ? 'provider' : 'no_provider',
    ].join(':');

    if (trackedCheckoutReturnRef.current === trackingKey) return;
    trackedCheckoutReturnRef.current = trackingKey;

    const properties = billingAnalyticsProperties({
      checkout_return_state: checkoutReturn.state,
      provider_status: checkoutReturn.rawStatus || 'missing',
      has_external_reference: checkoutReturn.hasExternalReference,
      has_provider_reference: checkoutReturn.hasProviderReference,
      entitlement_verified: account.billingState.hasProAccess,
      outcome_source: 'checkout_return',
    });

    analytics.track('checkout_returned', properties);
    analytics.track(CHECKOUT_RETURN_PAYMENT_EVENTS[checkoutReturn.state], properties);
  }, [account.billingState.hasProAccess, billingAnalyticsProperties, checkoutReturn]);

  useEffect(() => {
    if (account.authLoading || account.billingStateLoading) return;

    const state = account.billingState;
    const trackingKey = [
      account.session?.user?.id || 'no_user',
      state.id,
      state.source,
      state.reason,
      state.hasProAccess ? 'pro' : 'not_pro',
    ].join(':');

    if (trackedEntitlementStateRef.current === trackingKey) return;
    trackedEntitlementStateRef.current = trackingKey;

    const properties = billingAnalyticsProperties({
      entitlement_state: state.id,
      entitlement_verified: state.hasProAccess,
    });

    analytics.track('pro_entitlement_state_viewed', properties);
    if (state.hasProAccess) {
      analytics.track('pro_entitlement_granted', properties);
    }
  }, [
    account.authLoading,
    account.billingState,
    account.billingStateLoading,
    account.session?.user?.id,
    billingAnalyticsProperties,
  ]);

  const connectAccountForPro = useCallback(
    (surface: ProUpgradeSurface) => {
      setCheckoutError(null);
      analytics.track('upgrade_intent_clicked', {
        ...proUpgradeAnalytics(surface),
        requires_account: true,
      });
      analytics.track('account_connect_prompt_clicked', {
        surface,
        reason: 'pro_upgrade_requires_account',
        account_kind: account.accountKind,
      });
      openAccount();
    },
    [account.accountKind, openAccount, proUpgradeAnalytics],
  );

  const startProCheckout = useCallback(
    async (surface: ProUpgradeSurface) => {
      setCheckoutError(null);
      analytics.track('upgrade_intent_clicked', {
        ...proUpgradeAnalytics(surface),
        requires_account: !account.accessToken || account.isGuest,
      });

      if (!account.accessToken || account.isGuest) {
        analytics.track('account_connect_prompt_shown', {
          surface,
          reason: 'pro_checkout_requires_account',
          account_kind: account.accountKind,
        });
        openAccount();
        return;
      }

      setCheckoutStartingSurface(surface);
      try {
        const checkout = await startFlowtranslateProCheckout(account.accessToken);
        analytics.track('checkout_started', proUpgradeAnalytics(surface));
        window.location.assign(checkout.checkoutUrl);
      } catch (error) {
        captureFlowtranslateError(error, {
          screen: 'account',
          action: 'start_pro_checkout',
          account_kind: account.accountKind,
          billing_state: account.billingState.id,
          surface,
          http_status:
            error instanceof FlowtranslateApiError ? error.status : null,
        });
        analytics.track(
          'checkout_failed',
          billingAnalyticsProperties({
            surface,
            error_type:
              error instanceof FlowtranslateApiError
                ? 'flowtranslate_api_error'
                : error instanceof Error
                  ? error.name || 'checkout_error'
                  : 'checkout_error',
            http_status:
              error instanceof FlowtranslateApiError ? error.status : null,
          }),
        );
        setCheckoutError({
          surface,
          message:
            error instanceof Error
              ? error.message
              : 'No pudimos iniciar Mercado Pago. Proba de nuevo.',
        });
      } finally {
        setCheckoutStartingSurface(null);
      }
    },
    [
      account.accessToken,
      account.billingState.id,
      account.accountKind,
      account.isGuest,
      billingAnalyticsProperties,
      openAccount,
      proUpgradeAnalytics,
    ],
  );

  const upgradePromptState = (surface: ProUpgradeSurface) => ({
    busy: checkoutStartingSurface === surface,
    error: checkoutError?.surface === surface ? checkoutError.message : '',
  });

  const openQuotaSupport = useCallback(() => {
    analytics.track('quota_support_clicked', {
      surface: 'usage_limit',
      provider: 'cafecito',
      account_kind: account.accountKind,
    });
    window.open(FLOWTRANSLATE_COFFEE_URL, '_blank', 'noopener,noreferrer');
  }, [account.accountKind]);

  const dismissCheckoutReturn = useCallback(() => {
    setCheckoutReturn(null);
  }, []);

  const returnToResponderFromCheckout = useCallback(() => {
    onReturnToResponder();
    setCheckoutReturn(null);
  }, [onReturnToResponder]);

  const quotaUpgradeLabel =
    account.accountKind !== 'permanent'
      ? 'Conectar cuenta'
      : account.billingState.hasProAccess
        ? 'Ver Pro'
        : account.billingState.canRetryCheckout &&
            account.billingState.id !== 'free'
          ? 'Reintentar Pro'
          : account.billingState.shouldWaitForProvider
            ? 'Ver cuenta'
            : 'Pasar a Pro';

  const upgradeQuota = useCallback(() => {
    if (
      account.accountKind === 'permanent' &&
      account.billingState.canRetryCheckout
    ) {
      void startProCheckout('usage_limit');
      return;
    }
    if (account.accountKind === 'permanent') {
      openAccount();
      return;
    }
    connectAccountForPro('usage_limit');
  }, [
    account.accountKind,
    account.billingState.canRetryCheckout,
    connectAccountForPro,
    openAccount,
    startProCheckout,
  ]);

  const profileUpgradeActionLabel =
    account.billingState.canRetryCheckout && account.billingState.id !== 'free'
      ? 'Reintentar checkout'
      : undefined;

  return {
    checkoutReturn,
    connectAccountForPro,
    dismissCheckoutReturn,
    dismissUpgradePrompt,
    openQuotaSupport,
    quotaUpgradeBusy: checkoutStartingSurface === 'usage_limit',
    quotaUpgradeLabel,
    profileUpgradeActionLabel,
    returnToResponderFromCheckout,
    shouldShowLearningUpgradePrompt,
    shouldShowSavedHistoryUpgradePrompt,
    shouldShowUsageUpgradePrompt,
    startProCheckout,
    upgradeQuota,
    upgradePromptState,
  };
};
