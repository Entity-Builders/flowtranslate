export const STORAGE_KEYS = {
  activeView: 'flowtranslate_active_view',
  commercialAttribution: 'flowtranslate_commercial_attribution',
  guestDeviceId: 'flowtranslate_guest_device_id',
  pendingGuestSyncUserId: 'flowtranslate_pending_guest_sync_user_id',
  pendingTranslationResume: 'flowtranslate_pending_translation_resume',
  responderPromiseSeen: 'flowtranslate_responder_promise_seen',
} as const;

export const FLOWTRANSLATE_GUEST_DEVICE_HEADER =
  'X-Flowtranslate-Guest-Device-Id';

export const MAX_LEARNING_HISTORY = 20;

export const TRANSLATION_INPUT_MAX_CHARS = 500;

export const TRANSLATION_IDLE_DELAY_MS = 700;
