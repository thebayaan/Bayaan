import {useCallback, useEffect, useState} from 'react';
import {storage} from '../services/storage';

const KEY = 'bayaan_tv_onboarded';

export function useOnboarded(): {
  onboarded: boolean;
  markOnboarded: () => void;
} {
  const [value, setValue] = useState<boolean>(
    () => storage.getString(KEY) === '1',
  );

  useEffect(() => {
    const listener = storage.addOnValueChangedListener(k => {
      if (k === KEY) setValue(storage.getString(KEY) === '1');
    });
    return () => listener.remove();
  }, []);

  const markOnboarded = useCallback((): void => {
    storage.set(KEY, '1');
    setValue(true);
  }, []);

  return {onboarded: value, markOnboarded};
}
