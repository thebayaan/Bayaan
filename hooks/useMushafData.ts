// @ai-generated
// The Mushaf data loads after the splash (RFC-023 step 1), so a screen that
// reads it waits for one state, with one retry that knows which load to redo.
import {useCallback, useState, useSyncExternalStore} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

export type MushafDataState = 'ready' | 'loading' | 'failed';

function readMushafDataState(): MushafDataState {
  const dk = digitalKhattDataService;
  if (dk.initialized) return 'ready';
  const failed =
    mushafPreloadService.state === 'failed' ||
    dk.getRewayahLoadState(dk.rewayah) === 'error';
  return failed ? 'failed' : 'loading';
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
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    setRetrying(true);
    retryMushafLoad()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  }, []);
  return {state: state === 'failed' && retrying ? 'loading' : state, retry};
}
