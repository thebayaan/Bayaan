import {useCallback, useEffect, useState} from 'react';
import {storage} from '../services/storage';
import {DEFAULT_RECITER_KEY} from '../services/tvDataService';

export function useDefaultReciter(): {
  defaultReciterId: string | null;
  setDefaultReciter: (id: string) => void;
} {
  const [id, setId] = useState<string | null>(
    () => storage.getString(DEFAULT_RECITER_KEY) ?? null,
  );

  useEffect(() => {
    const listener = storage.addOnValueChangedListener(k => {
      if (k === DEFAULT_RECITER_KEY) {
        setId(storage.getString(DEFAULT_RECITER_KEY) ?? null);
      }
    });
    return () => listener.remove();
  }, []);

  const setDefaultReciter = useCallback((next: string): void => {
    storage.set(DEFAULT_RECITER_KEY, next);
    setId(next);
  }, []);

  return {defaultReciterId: id, setDefaultReciter};
}
