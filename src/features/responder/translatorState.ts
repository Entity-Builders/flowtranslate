import {
  createExpressionDirection,
  type ExpressionBreakdown,
  type ExpressionMode,
  type IntentDetectionResult,
  type TranslationPresetId,
} from '@eb-packages/flowtranslate-core';

export type TranslatorStatus =
  | 'idle'
  | 'typing'
  | 'translating'
  | 'copied'
  | 'error'
  | 'offline'
  | 'quota'
  | 'auth';

export type TranslationTrigger =
  | 'auto_idle'
  | 'manual_generate'
  | 'mode_selected'
  | 'preset_selected'
  | 'context_applied'
  | 'input_to_spanish';

export type BreakdownTrigger = 'panel_opened';

export type TranslationBlockedReason =
  | 'offline'
  | 'auth'
  | 'quota'
  | 'ambiguous'
  | 'mixed_input';

export type BreakdownStatus = 'idle' | 'enriching' | 'ready' | 'error';

export const normalizeTranslatorText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const createTranslationRequestKey = (
  mode: ExpressionMode,
  sourceText: string,
  presetId: TranslationPresetId,
  contextText = '',
) =>
  [
    mode,
    presetId,
    normalizeTranslatorText(sourceText),
    normalizeTranslatorText(contextText),
  ].join(':');

export const translationAnalyticsProperties = (
  mode: ExpressionMode,
  sourceText: string,
  presetId: TranslationPresetId,
  trigger: TranslationTrigger | BreakdownTrigger,
  contextText = '',
) => {
  const direction = createExpressionDirection(mode);

  return {
    mode,
    preset_id: presetId,
    trigger,
    source_language: direction.sourceLanguage,
    target_language: direction.targetLanguage,
    input_chars: sourceText.trim().length,
    has_context: Boolean(contextText.trim()),
    context_chars: contextText.trim().length,
  };
};

export const isConversationReplyMode = (mode: ExpressionMode) =>
  mode !== 'translate_to_spanish';

export const isEnrichedBreakdown = (value: ExpressionBreakdown | null) => {
  if (!value) return false;
  const hasTenses = Boolean(value.tenses?.length);
  const hasStructure = Boolean(value.structure?.length);
  const hasAlternatives = Boolean(value.alternatives?.length);
  const hasMistake = Boolean(value.commonMistake?.trim());

  return hasTenses || hasStructure || hasAlternatives || hasMistake;
};

export const fallbackDetection = (
  mode: ExpressionMode,
): IntentDetectionResult => ({
  mode,
  confidence: 'low',
  reason: 'manual',
  automatic: false,
});

export const getTranslatorReadiness = ({
  sourceText,
  online,
  accessToken,
  authPending,
  status,
}: {
  sourceText: string;
  online: boolean;
  accessToken: string;
  authPending: boolean;
  status: TranslatorStatus;
}) => {
  const activeSourceText = sourceText.trim();
  const canTranslate =
    Boolean(activeSourceText) &&
    online &&
    Boolean(accessToken) &&
    status !== 'translating';

  const translateDisabledReason = !activeSourceText
    ? 'Agrega texto para responder.'
    : !online
      ? 'Estas offline. La IA necesita conexion.'
      : !accessToken
        ? authPending
          ? 'Preparando modo invitado...'
          : 'Conecta tu cuenta para guardar progreso y seguir.'
        : status === 'translating'
          ? 'Generacion en curso.'
          : '';

  return {
    activeSourceText,
    canTranslate,
    translateDisabledReason,
  };
};
