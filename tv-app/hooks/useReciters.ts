import {useEffect, useState} from 'react';
import {fetchReciters, getCachedReciters} from '../services/tvDataService';
import type {Reciter} from '../types/reciter';

export function useReciters(): {reciters: Reciter[]; loading: boolean} {
  const [reciters, setReciters] = useState<Reciter[]>(
    () => getCachedReciters() ?? [],
  );
  const [loading, setLoading] = useState<boolean>(reciters.length === 0);

  useEffect(() => {
    let cancelled = false;
    fetchReciters()
      .then(r => {
        if (!cancelled) setReciters(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {reciters, loading};
}
