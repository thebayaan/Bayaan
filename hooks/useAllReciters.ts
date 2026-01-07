import { useMemo, useCallback } from 'react';
import { RECITERS, Reciter } from '@/data/reciterData';
import { useLocalRecitersStore } from '@/store/localRecitersStore';

interface UseAllRecitersResult {
  allReciters: Reciter[];
  getReciterById: (id: string) => Reciter | undefined;
}

export function useAllReciters(): UseAllRecitersResult {
  const localReciters = useLocalRecitersStore(state => state.localReciters);

  const allReciters = useMemo(() => {
    return [...localReciters, ...RECITERS];
  }, [localReciters]);

  const getReciterById = useCallback((id: string) => {
    // First check local reciters as they might override or be more frequently accessed in "My Reciters" context
    const local = localReciters.find(r => r.id === id);
    if (local) return local;

    // Then check static reciters
    return RECITERS.find(r => r.id === id);
  }, [localReciters]);

  return {
    allReciters,
    getReciterById
  };
}
