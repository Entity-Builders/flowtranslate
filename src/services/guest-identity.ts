import { STORAGE_KEYS } from '../constants';

const fallbackRandomId = () =>
  `ft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ft-${crypto.randomUUID()}`;
  }

  return fallbackRandomId();
};

const isUsableDeviceId = (value: string | null) =>
  Boolean(
    value &&
      value.length >= 16 &&
      value.length <= 128 &&
      /^[a-zA-Z0-9._:-]+$/.test(value),
  );

export const getOrCreateGuestDeviceId = () => {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.guestDeviceId);
    if (isUsableDeviceId(existing)) return existing as string;

    const nextId = createDeviceId();
    localStorage.setItem(STORAGE_KEYS.guestDeviceId, nextId);
    return nextId;
  } catch {
    return createDeviceId();
  }
};
