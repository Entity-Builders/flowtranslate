import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

export type AppView = 'translate' | 'learning';

export const RESPONDER_ROUTE = '/';
export const LEARNING_ROUTE = '/aprender';
export const LEARNING_ALIAS_ROUTE = '/learning';

const viewForPathname = (pathname: string): AppView => {
  if (pathname === LEARNING_ROUTE || pathname === LEARNING_ALIAS_ROUTE) {
    return 'learning';
  }

  return 'translate';
};

const pathForView = (view: AppView) =>
  view === 'learning' ? LEARNING_ROUTE : RESPONDER_ROUTE;

const readInitialView = (): AppView => {
  if (typeof window !== 'undefined') {
    return viewForPathname(window.location.pathname);
  }

  if (typeof localStorage === 'undefined') return 'translate';

  const saved = localStorage.getItem(STORAGE_KEYS.activeView);
  return saved === 'learning' ? 'learning' : 'translate';
};

const normalizeLearningAlias = () => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== LEARNING_ALIAS_ROUTE) return;

  window.history.replaceState({}, '', LEARNING_ROUTE);
};

const pushViewPath = (view: AppView) => {
  if (typeof window === 'undefined') return;

  const targetPath = pathForView(view);
  if (window.location.pathname === targetPath) return;

  window.history.pushState({}, '', targetPath);
};

export const useFlowtranslateView = () => {
  const [view, setViewState] = useState<AppView>(readInitialView);

  useEffect(() => {
    normalizeLearningAlias();

    const handlePopState = () => {
      const nextView = viewForPathname(window.location.pathname);
      setViewState(nextView);
      if (nextView === 'learning') {
        normalizeLearningAlias();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeView, view);
  }, [view]);

  const setView = useCallback((nextView: AppView) => {
    setViewState(nextView);
    pushViewPath(nextView);
  }, []);

  return { view, setView };
};
