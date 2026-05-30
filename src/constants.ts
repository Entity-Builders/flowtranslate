export const STORAGE_KEYS = {
  translations: 'flowtranslate_translations',
  selectedTranslation: 'flowtranslate_selected_translation_id',
  dismissedUpdateVersion: 'flowtranslate_update_dismissed_version',
} as const;

export const TARGET_LANGUAGES = [
  'English',
  'Spanish',
  'Portuguese',
  'French',
  'Italian',
  'German',
] as const;

export const DEFAULT_TARGET_LANGUAGE = 'English';
