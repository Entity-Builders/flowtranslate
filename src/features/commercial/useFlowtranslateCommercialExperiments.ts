import { useCallback, useEffect, useRef } from 'react';
import {
  analytics,
  safeCommercialAnalyticsProperties,
} from '../../services/analytics';
import { ACCOUNT_PROMPT_COPY_THRESHOLD } from '../account/accountPrompt';

const COMMERCIAL_EXPERIMENT_DEFAULT_VARIANTS = {
  ft_account_prompt_after_copy_count: 'after_2_copies',
  ft_pro_value_copy: 'higher_limits',
  ft_onboarding_positioning: 'work_chat_speed',
} as const;

type CommercialExperimentKey = keyof typeof COMMERCIAL_EXPERIMENT_DEFAULT_VARIANTS;

const getCommercialExperimentVariant = (experimentKey: CommercialExperimentKey) => {
  const flagReader = analytics as typeof analytics & {
    getFeatureFlag?: (key: string) => string | boolean | undefined;
  };
  const flagValue = flagReader.getFeatureFlag?.(experimentKey);

  if (typeof flagValue === 'string' && flagValue.trim()) return flagValue.trim();
  if (flagValue === true) return 'enabled';
  if (flagValue === false) return 'control';

  return COMMERCIAL_EXPERIMENT_DEFAULT_VARIANTS[experimentKey];
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

      analytics.track('experiment_exposed', safeCommercialAnalyticsProperties({
        experiment_key: experimentKey,
        variant: getCommercialExperimentVariant(experimentKey),
        ...properties,
      }));
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
