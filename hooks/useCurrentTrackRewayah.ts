import {useMemo} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {getReciterByIdSync} from '@/services/dataService';
import {
  resolveRewayahFromName,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// Resolves the RewayahId for the currently-playing track. Defaults to Hafs
// when no track is playing, the track has no reciter/rewayat metadata, or
// the rewayah name doesn't map to one of our canonical slugs.
export function useCurrentTrackRewayah(): RewayahId {
  const tracks = usePlayerStore(s => s.queue.tracks);
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  return useMemo(() => {
    const track = tracks[currentIndex];
    if (!track) return 'hafs';
    // Prefer rewayatId → look up name via reciter record.
    if (track.rewayatId && track.reciterId) {
      const reciter = getReciterByIdSync(track.reciterId);
      const rewayat = reciter?.rewayat.find(rw => rw.id === track.rewayatId);
      const mapped = resolveRewayahFromName(rewayat?.name);
      if (mapped) return mapped;
    }
    // Fallback: upload tracks carry a display-name tag instead of an id.
    if (track.rewayahName) {
      const mapped = resolveRewayahFromName(track.rewayahName);
      if (mapped) return mapped;
    }
    return 'hafs';
  }, [tracks, currentIndex]);
}
