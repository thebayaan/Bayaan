// @ai-generated
// The Mushaf data loads after the splash (RFC-023 step 1), so a screen that
// reads it waits for one state, with one retry.
import {useCallback, useState, useSyncExternalStore} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

export type MushafDataState = 'ready' | 'loading' | 'failed';

function readMushafDataState(): MushafDataState {
  if (digitalKhattDataService.initialized) return 'ready';
  return mushafPreloadService.state === 'failed' ? 'failed' : 'loading';
}

function subscribeMushafData(listener: () => void): () => void {
  const stopPreload = mushafPreloadService.subscribe(listener);
  const stopData = digitalKhattDataService.subscribeCacheChanges(listener);
  return () => {
    stopPreload();
    stopData();
  };
}

export function useMushafData(): {
  state: MushafDataState;
  retry: () => void;
} {
  const state = useSyncExternalStore(subscribeMushafData, readMushafDataState);
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    setRetrying(true);
    // The preload redoes the data and the fonts.
    mushafPreloadService
      .initialize()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  }, []);
  return {state: state === 'failed' && retrying ? 'loading' : state, retry};
}
