// @ai-generated
// The Mushaf data loads after the splash (RFC-023 step 1), so a screen that
// reads it can open first. It starts the load if nothing did, and waits for one
// state, with one retry that knows which load to redo.
import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

export type MushafDataState = 'ready' | 'loading' | 'failed';

// Ready means the data and the fonts: a page that mounts before the fonts
// draws without them. The preload fails when either fails, and the pages stay
// blank either way, so both offer the retry.
// A failed read of the active rewayah drops its data after the preload
// finished: the preload stays 'ready', and the rewayah is 'error'.
function readMushafDataState(): MushafDataState {
  const preload = mushafPreloadService;
  const dk = digitalKhattDataService;
  if (preload.state === 'failed') return 'failed';
  if (preload.initialized && dk.initialized) return 'ready';
  return dk.getRewayahLoadState(dk.rewayah) === 'error' ? 'failed' : 'loading';
}

function subscribeMushafData(listener: () => void): () => void {
  const stopPreload = mushafPreloadService.subscribe(listener);
  const stopData = digitalKhattDataService.subscribeCacheChanges(listener);
  return () => {
    stopPreload();
    stopData();
  };
}

// A failed preload redoes the data and the fonts. Else the preload finished,
// and only the data of the active rewayah needs its load again.
function retryMushafLoad(): Promise<void> {
  if (mushafPreloadService.state === 'failed') {
    return mushafPreloadService.initialize();
  }
  const dk = digitalKhattDataService;
  return dk.ensureRewayahLoaded(dk.rewayah, {retry: true});
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
    retryMushafLoad()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  }, []);
  return {state: state === 'failed' && retrying ? 'loading' : state, retry};
}
