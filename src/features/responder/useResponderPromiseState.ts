import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '../../constants';

const readResponderPromiseSeen = () =>
  localStorage.getItem(STORAGE_KEYS.responderPromiseSeen) === 'true';

export const useResponderPromiseState = () => {
  const [hasSeenResponderPromise, setHasSeenResponderPromise] = useState(
    readResponderPromiseSeen,
  );

  const markResponderPromiseSeen = useCallback(() => {
    setHasSeenResponderPromise(true);
    localStorage.setItem(STORAGE_KEYS.responderPromiseSeen, 'true');
  }, []);

  return {
    hasSeenResponderPromise,
    markResponderPromiseSeen,
  };
};
