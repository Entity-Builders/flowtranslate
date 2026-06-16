import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

export type AppView = 'translate' | 'learning';

const readInitialView = (): AppView => {
  const saved = localStorage.getItem(STORAGE_KEYS.activeView);
  return saved === 'learning' ? 'learning' : 'translate';
};

export const useFlowtranslateView = () => {
  const [view, setView] = useState<AppView>(readInitialView);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeView, view);
  }, [view]);

  return { view, setView };
};
