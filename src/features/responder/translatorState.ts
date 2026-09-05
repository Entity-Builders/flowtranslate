import {
  createExpressionDirection,
  type ExpressionMode,
  type IntentDetectionResult,
  type TranslationPresetId,
} from '@entity-builders/flowtranslate-core';
import { TRANSLATION_INPUT_MAX_CHARS } from '../../constants';

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
  | 'input_to_spanish'
  | 'checkout_resume';

export type TranslationBlockedReason =
  | 'offline'
  | 'auth'
  | 'quota'
  | 'input_too_long'
  | 'ambiguous'
  | 'mixed_input';

export const normalizeTranslatorText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const countTranslationInputCharacters = (value: string) =>
  Array.from(value.trim()).length;

export const buildTranslationInputLimitMessage = (
  characterCount: number,
  maxCharacters = TRANSLATION_INPUT_MAX_CHARS,
) =>
  `FlowTranslate acepta hasta ${maxCharacters} caracteres por traduccion. Tu texto tiene ${characterCount}.`;

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
  trigger: TranslationTrigger,
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
  maxCharacters = TRANSLATION_INPUT_MAX_CHARS,
}: {
  sourceText: string;
  online: boolean;
  accessToken: string;
  authPending: boolean;
  status: TranslatorStatus;
  maxCharacters?: number;
}) => {
  const activeSourceText = sourceText.trim();
  const sourceCharacterCount = countTranslationInputCharacters(sourceText);
  const isSourceTooLong = sourceCharacterCount > maxCharacters;
  const canTranslate =
    Boolean(activeSourceText) &&
    !isSourceTooLong &&
    online &&
    Boolean(accessToken) &&
    status !== 'translating';

  const translateDisabledReason = !activeSourceText
    ? 'Agrega texto para responder.'
    : isSourceTooLong
      ? buildTranslationInputLimitMessage(sourceCharacterCount, maxCharacters)
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
    sourceCharacterCount,
    isSourceTooLong,
    canTranslate,
    translateDisabledReason,
  };
};
