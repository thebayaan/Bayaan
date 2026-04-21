import {useMemo} from 'react';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {getReciterByIdSync} from '@/services/dataService';
import {mapRewayatNameToRewayahId} from '@/utils/rewayahLabels';
import type {RewayahId} from '@/store/mushafSettingsStore';

// Resolves the RewayahId for the currently-playing track. Defaults to Hafs
// when no track is playing, the track has no reciter/rewayat metadata, or
// the rewayah name doesn't match any of our 8 supported rewayat (e.g., the
// 10 Qira'at extensions like Khalaf 'an Hamzah).
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
      const mapped = mapRewayatNameToRewayahId(rewayat?.name);
      if (mapped) return mapped;
    }
    // Fallback: upload tracks carry a display-name tag instead of an id.
    if (track.rewayahName) {
      const mapped = mapRewayatNameToRewayahId(track.rewayahName);
      if (mapped) return mapped;
    }
    return 'hafs';
  }, [tracks, currentIndex]);
}
