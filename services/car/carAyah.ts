import {SURAHS} from '@/data/surahData';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {timestampService} from '@/services/timestamps/TimestampService';
import type {AyahTimestamp} from '@/types/timestamps';
import type {Track} from '@/types/audio';

/** The ayah playing at `positionMs`, or null before the first ayah starts. */
export function ayahAt(
  timestamps: AyahTimestamp[],
  positionMs: number,
): number | null {
  let low = 0;
  let high = timestamps.length - 1;
  let found: AyahTimestamp | null = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timestamps[mid].timestampFrom <= positionMs) {
      found = timestamps[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found ? found.ayahNumber : null;
}

export function ayahLabel(ayah: number, versesCount: number): string {
  return `Ayah ${ayah} of ${versesCount}`;
}

/** Timestamps exist per rewayah and surah; uploads have none. */
function timestampKey(track: Track | undefined): string | null {
  if (!track || track.isUserUpload || !track.rewayatId) return null;
  const surah = Number(track.surahId);
  if (!Number.isInteger(surah) || surah <= 0) return null;
  return `${track.rewayatId}-${surah}`;
}

/**
 * While a car is connected, reports "Ayah 12 of 110" for the playing surah
 * (null when the reciter has no ayah timestamps), so the car's Now Playing
 * can show where in the surah the recitation is.
 */
export function startCarAyahTracker(
  onLabel: (label: string | null) => void,
): () => void {
  let key: string | null = null;
  let timestamps: AyahTimestamp[] | null = null;
  let lastLabel: string | null = null;
  let disposed = false;

  const emit = (label: string | null): void => {
    if (label === lastLabel) return;
    lastLabel = label;
    onLabel(label);
  };

  const update = (): void => {
    const {queue, playback} = usePlayerStore.getState();
    const track = queue.tracks[queue.currentIndex];
    const nextKey = timestampKey(track);
    if (nextKey !== key) {
      key = nextKey;
      timestamps = null;
      emit(null);
      if (!track?.rewayatId || nextKey === null) return;
      const loadingKey = nextKey;
      timestampService
        .getTimestampsForSurah(track.rewayatId, Number(track.surahId))
        .then(loaded => {
          if (disposed || key !== loadingKey) return;
          timestamps = loaded && loaded.length > 0 ? loaded : null;
          update();
        })
        .catch(() => undefined);
      return;
    }
    if (!timestamps || !track) return;
    const surah = SURAHS.find(s => s.id === Number(track.surahId));
    const ayah = ayahAt(timestamps, playback.position * 1000);
    emit(ayah !== null && surah ? ayahLabel(ayah, surah.verses_count) : null);
  };

  const unsubscribe = usePlayerStore.subscribe(update);
  update();
  return () => {
    disposed = true;
    unsubscribe();
    emit(null);
  };
}
