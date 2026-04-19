import {useEffect, useState} from 'react';
import fallbackReciters from '../../data/reciters-fallback.json';
import {fetchReciters, getCachedReciters} from '../services/tvDataService';
import type {Reciter} from '../types/reciter';

function seed(): Reciter[] {
  const cached = getCachedReciters();
  if (cached && cached.length > 0) return cached;
  return fallbackReciters as Reciter[];
}

export function useReciters(): {reciters: Reciter[]; loading: boolean} {
  const [reciters, setReciters] = useState<Reciter[]>(seed);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetchReciters()
      .then(r => {
        if (!cancelled && r.length > 0) setReciters(r);
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
