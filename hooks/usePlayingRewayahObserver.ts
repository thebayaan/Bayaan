import {useEffect, useRef} from 'react';
import {useCurrentTrackRewayahOrNull} from '@/hooks/useCurrentTrackRewayah';
import {getShortLabel} from '@/services/rewayah/RewayahIdentity';
import {showToast} from '@/utils/toastUtils';

// Observes the currently-playing track's resolved RewayahId and fires a
// "Now reading" toast whenever it transitions between tracks. The toast
// emphasizes the *reading* (qira'at / rewayah) rather than the playing —
// the fact that something is playing is already conveyed by the player
// UI; the rewayah transition is the information the user needs.
//
// Suppresses the toast on the very first observation — cold starts with a
// restored session would otherwise announce the restored track's rewayah
// at launch, which is noise. From the second observation onward, any
// change fires.
//
// Consumes `useCurrentTrackRewayahOrNull` (not the non-null wrapper) so
// both the "is there a track?" and "what rewayah?" signals come from a
// single coordinated selector — avoids a mid-update frame where a
// separately-subscribed hasTrack selector could disagree with the
// rewayah selector and record a stale marker.
//
// Tradeoff acknowledged: if the queue transiently empties between
// tracks (some store implementations wipe `tracks` before loading the
// next batch), the ref resets and the incoming track's rewayah is
// suppressed as a "first observation". Cleanest way to tighten this is
// on the store side (atomic queue replace); for now we accept the
// occasional missed toast over the risk of announcing on cold boot.
//
// Mount once at the player-sheet level. Per-track re-mounts would
// re-trigger the first-observation suppression and drop every toast.
export function usePlayingRewayahObserver(): void {
  const trackRewayah = useCurrentTrackRewayahOrNull();
  const lastAnnouncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (trackRewayah === null) {
      lastAnnouncedRef.current = null;
      return;
    }
    if (lastAnnouncedRef.current === null) {
      // First track seen since mount / since queue emptied — record and
      // suppress to avoid announcing a restored-state track on app boot.
      lastAnnouncedRef.current = trackRewayah;
      return;
    }
    if (lastAnnouncedRef.current === trackRewayah) return;
    lastAnnouncedRef.current = trackRewayah;
    showToast('Now reading', getShortLabel(trackRewayah));
  }, [trackRewayah]);
}
