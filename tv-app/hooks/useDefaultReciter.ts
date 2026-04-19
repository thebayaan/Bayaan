import {useCallback, useEffect, useState} from 'react';
import {storage} from '../services/storage';

const KEY = 'bayaan_tv_default_reciter_id';

export function useDefaultReciter(): {
  defaultReciterId: string | null;
  setDefaultReciter: (id: string) => void;
} {
  const [id, setId] = useState<string | null>(
    () => storage.getString(KEY) ?? null,
  );

  useEffect(() => {
    const listener = storage.addOnValueChangedListener(k => {
      if (k === KEY) setId(storage.getString(KEY) ?? null);
    });
    return () => listener.remove();
  }, []);

  const setDefaultReciter = useCallback((next: string): void => {
    storage.set(KEY, next);
    setId(next);
  }, []);

  return {defaultReciterId: id, setDefaultReciter};
}
