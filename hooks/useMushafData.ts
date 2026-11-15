// @ai-generated
// The Mushaf data loads after the splash (RFC-023 step 1), so a screen that
// reads it can open first. It starts the load if nothing did, and waits for one
// state, with one retry.
import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

export type MushafDataState = 'ready' | 'loading' | 'failed';

// Ready means the data and the fonts: a page that mounts before the fonts
// draws without them. The preload fails when either fails, and the pages stay
// blank either way, so both offer the retry.
function readMushafDataState(): MushafDataState {
  const preload = mushafPreloadService;
  if (preload.state === 'failed') return 'failed';
  return preload.initialized && digitalKhattDataService.initialized
    ? 'ready'
    : 'loading';
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
  useEffect(() => {
    mushafPreloadService.startIfIdle();
  }, []);
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
