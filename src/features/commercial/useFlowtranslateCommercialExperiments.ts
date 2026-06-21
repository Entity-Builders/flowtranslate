import { useCallback, useEffect, useRef } from 'react';
import {
  analytics,
  commercialAnalyticsProperties,
  safeCommercialAnalyticsProperties,
} from '../../services/analytics';
import { ACCOUNT_PROMPT_COPY_THRESHOLD } from '../account/accountPrompt';

export const FLOWTRANSLATE_COMMERCIAL_EXPERIMENT_DEFAULT_VARIANTS = {
  ft_launch_landing_message: 'spanglish_work_reply',
  ft_launch_offer: 'free_reply_then_pro',
  ft_account_prompt_after_copy_count: 'after_2_copies',
  ft_pro_value_copy: 'higher_limits',
  ft_onboarding_positioning: 'work_chat_speed',
} as const;

export type CommercialExperimentKey =
  keyof typeof FLOWTRANSLATE_COMMERCIAL_EXPERIMENT_DEFAULT_VARIANTS;

export const getCommercialExperimentVariant = (
  experimentKey: CommercialExperimentKey,
) => {
  const flagReader = analytics as typeof analytics & {
    getFeatureFlag?: (key: string) => string | boolean | undefined;
  };
  const flagValue = flagReader.getFeatureFlag?.(experimentKey);

  if (typeof flagValue === 'string' && flagValue.trim()) return flagValue.trim();
  if (flagValue === true) return 'enabled';
  if (flagValue === false) return 'control';

  return FLOWTRANSLATE_COMMERCIAL_EXPERIMENT_DEFAULT_VARIANTS[experimentKey];
};

export const FLOWTRANSLATE_PRO_ANALYTICS = {
  provider: 'mercado_pago',
  plan_id: 'flowtranslate_pro',
  currency: 'ARS',
  display_price: 'ARS 4.999/mes',
};

export const useFlowtranslateCommercialExperiments = () => {
  const trackedCommercialExperimentRef = useRef<Set<string>>(new Set());

  const trackCommercialExperimentExposure = useCallback(
    (
      experimentKey: CommercialExperimentKey,
      properties: Record<string, unknown> = {},
    ) => {
      if (trackedCommercialExperimentRef.current.has(experimentKey)) return;
      trackedCommercialExperimentRef.current.add(experimentKey);

      analytics.track(
        'experiment_exposed',
        safeCommercialAnalyticsProperties(
          commercialAnalyticsProperties({
            experiment_key: experimentKey,
            variant: getCommercialExperimentVariant(experimentKey),
            ...properties,
          }),
        ),
      );
    },
    [],
  );

  useEffect(() => {
    trackCommercialExperimentExposure('ft_onboarding_positioning', {
      surface: 'responder',
    });
    trackCommercialExperimentExposure('ft_account_prompt_after_copy_count', {
      surface: 'translate_soft_banner',
      threshold: ACCOUNT_PROMPT_COPY_THRESHOLD,
    });
  }, [trackCommercialExperimentExposure]);

  return { trackCommercialExperimentExposure };
};
