import {useEffect, useRef} from 'react';
import {useCurrentTrackResolvedRewayah} from '@/hooks/useCurrentTrackRewayah';
import {getShortLabel} from '@/services/rewayah/RewayahIdentity';
import {showToast} from '@/utils/toastUtils';

// Observes the currently-playing track's resolved rewayah and fires a
// "Now reading" toast whenever it transitions between tracks. When the
// resolver had to coerce to Hafs because the track's rewayah isn't one of
// the 8 with bundled text data, the toast switches to "Showing in Hafs"
// instead — the missing rewayah's name is intentionally omitted because
// (a) the user already sees the rewayah in the player UI, and (b) we'd be
// announcing a name we can't actually render text for.
//
// Suppresses the toast on the very first observation — cold starts with a
// restored session would otherwise announce the restored track's rewayah
// at launch, which is noise. From the second observation onward, any
// change to (id, isFallback) fires.
//
// Mount once at the player-sheet level. Per-track re-mounts would
// re-trigger the first-observation suppression and drop every toast.
export function usePlayingRewayahObserver(): void {
  const resolved = useCurrentTrackResolvedRewayah();
  const lastAnnouncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (resolved === null) {
      lastAnnouncedRef.current = null;
      return;
    }
    // Encode both id and fallback state into the dedupe key so a transition
    // between "Hafs (genuine)" and "Hafs (fallback)" still fires a toast.
    const key = `${resolved.id}|${resolved.isFallback ? 'fb' : 'ok'}`;
    if (lastAnnouncedRef.current === null) {
      lastAnnouncedRef.current = key;
      return;
    }
    if (lastAnnouncedRef.current === key) return;
    lastAnnouncedRef.current = key;
    if (resolved.isFallback) {
      showToast('Showing in Hafs');
      return;
    }
    showToast('Now reading', getShortLabel(resolved.id));
  }, [resolved]);
}
