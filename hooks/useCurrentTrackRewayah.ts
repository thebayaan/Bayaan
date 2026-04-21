import {useMemo} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {getReciterByIdSync} from '@/services/dataService';
import {
  resolveRewayahFromName,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// Resolves the RewayahId for the currently-playing track, or `null` when
// there is no track at all. Returning `null` (instead of a sentinel like
// 'hafs') keeps the "no track" signal distinct from "track exists but
// unresolvable rewayah, default to Hafs" so callers that care about the
// distinction — notably usePlayingRewayahObserver — can gate correctly.
//
// Resolution rules when a track is present:
//   1. rewayatId + reciterId → look up the reciter record, map its
//      rewayat.name to a canonical RewayahId.
//   2. Upload tracks carry a display-name tag (rewayahName) — map that.
//   3. Fallback to 'hafs' when the name doesn't resolve.
export function useCurrentTrackRewayahOrNull(): RewayahId | null {
  const tracks = usePlayerStore(s => s.queue.tracks);
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  return useMemo(() => {
    const track = tracks[currentIndex];
    if (!track) return null;
    if (track.rewayatId && track.reciterId) {
      const reciter = getReciterByIdSync(track.reciterId);
      const rewayat = reciter?.rewayat.find(rw => rw.id === track.rewayatId);
      const mapped = resolveRewayahFromName(rewayat?.name);
      if (mapped) return mapped;
    }
    if (track.rewayahName) {
      const mapped = resolveRewayahFromName(track.rewayahName);
      if (mapped) return mapped;
    }
    return 'hafs';
  }, [tracks, currentIndex]);
}

// Non-null convenience wrapper for renderers that always need a concrete
// rewayah to display text in — `null` (no track) maps to Hafs, the
// universally-safe display fallback.
export function useCurrentTrackRewayah(): RewayahId {
  return useCurrentTrackRewayahOrNull() ?? 'hafs';
}
