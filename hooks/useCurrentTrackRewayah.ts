import {useMemo} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {getReciterByIdSync} from '@/services/dataService';
import {
  hasTextData,
  resolveRewayahFromName,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// Resolved rewayah for the currently-playing track, plus a flag describing
// whether the displayed id is a Hafs fallback (vs. the track's actual
// rewayah). Consumers that need to communicate the fallback to the user
// (e.g. the player's "Showing in Hafs" toast) read both fields; pure
// renderers can use `useCurrentTrackRewayah()` and ignore the flag.
export interface ResolvedTrackRewayah {
  id: RewayahId;
  isFallback: boolean;
}

// Resolution rules:
//   1. rewayatId + reciterId → look up the reciter, map its rewayat.name to
//      a canonical RewayahId.
//   2. Otherwise, if the track carries an upload-tag `rewayahName`, map that.
//   3. If neither resolves to a canonical id, OR the resolved id has no
//      bundled text data (12 of the 20 canonical rewayat — taxonomy only),
//      coerce to 'hafs' and mark `isFallback: true` so the UI can render
//      Hafs words while the player surface tells the user we fell back.
//   4. When the track carried no explicit rewayah info at all, default to
//      'hafs' silently (not a fallback — there was nothing to fall back from).
export function useCurrentTrackResolvedRewayah(): ResolvedTrackRewayah | null {
  const tracks = usePlayerStore(s => s.queue.tracks);
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  return useMemo(() => {
    const track = tracks[currentIndex];
    if (!track) return null;

    let resolved: RewayahId | null = null;
    let hadExplicitRewayah = false;

    if (track.rewayatId && track.reciterId) {
      hadExplicitRewayah = true;
      const reciter = getReciterByIdSync(track.reciterId);
      const rewayat = reciter?.rewayat.find(rw => rw.id === track.rewayatId);
      resolved = resolveRewayahFromName(rewayat?.name);
    } else if (track.rewayahName) {
      hadExplicitRewayah = true;
      resolved = resolveRewayahFromName(track.rewayahName);
    }

    if (resolved && hasTextData(resolved)) {
      return {id: resolved, isFallback: false};
    }

    return {id: 'hafs', isFallback: hadExplicitRewayah};
  }, [tracks, currentIndex]);
}

// Thin wrappers preserved for renderers that only need the id. Returning
// `null` (instead of a sentinel like 'hafs') keeps the "no track" signal
// distinct from "track exists, fell back to Hafs" for consumers that gate
// on track presence (notably usePlayingRewayahObserver).
export function useCurrentTrackRewayahOrNull(): RewayahId | null {
  const resolved = useCurrentTrackResolvedRewayah();
  return resolved ? resolved.id : null;
}

export function useCurrentTrackRewayah(): RewayahId {
  return useCurrentTrackRewayahOrNull() ?? 'hafs';
}
