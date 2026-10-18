import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import type {CustomReciter, UploadedRecitation} from '@/types/uploads';

// Progress steps the key tracks. Jump back in rows show a progress bar, so
// the snapshot must follow playback, but per-second ticks must not rebuild it.
const PROGRESS_STEPS = 10;

function progressStep(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.floor(Math.min(Math.max(progress, 0), 1) * PROGRESS_STEPS);
}

// Identity, order and coarse progress (tenths) of recent entries. Untagged
// uploads share a placeholder reciter and surah, so the upload id is part of
// their identity.
export function recentTracksKey(tracks: RecentlyPlayedTrack[]): string {
  return tracks
    .map(
      t =>
        `${t.reciter.id}:${t.surah.id}:${t.rewayatId}:${
          t.isUserUpload ? 1 : 0
        }:${t.userRecitationId ?? ''}:${progressStep(t.progress)}`,
    )
    .join('|');
}

// Identity and order of uploads, plus only the tags the car shows (title,
// surah, reciter). loadRecitations copies every row, so the array identity
// alone would rebuild on every reload.
export function uploadsKey(
  uploads: UploadedRecitation[],
  customReciters: CustomReciter[],
): string {
  return JSON.stringify([
    uploads.map(u => [
      u.id,
      u.filePath.length > 0,
      u.type,
      u.surahNumber,
      u.title,
      u.reciterId,
      u.customReciterId,
    ]),
    customReciters.map(r => [r.id, r.name]),
  ]);
}
