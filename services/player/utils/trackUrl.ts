// @ai-generated
import type {Track} from '@/types/audio';
import {getReciterByIdSync} from '@/services/dataService';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {useUploadsStore} from '@/store/uploadsStore';
import {resolveRecitationPath} from '@/services/uploads/UploadsService';
import {setTrackUrlResolver} from '@/services/player/store/playerStore';

const isRemote = (url: string): boolean => /^https?:\/\//i.test(url);

/**
 * The url a queue track should be played from right now.
 *
 * A track's `url` is fixed when its queue is built (and the queue is saved
 * across launches), but the right source changes underneath it:
 * - a surah downloaded since then should play from its file, so a queue
 *   started online keeps going offline;
 * - a surah whose download was removed points at a file that is gone, and
 *   has to stream again;
 * - a local path saved before an iOS app update points into the old app
 *   container. Downloads and uploads store file names for that reason, so
 *   the path is rebuilt from the name.
 *
 * A remote url is never swapped for another remote url: that would be a
 * different recording.
 */
export function resolveTrackUrl(track: Track): string {
  if (track.isUserUpload) {
    if (!track.userRecitationId) return track.url;
    const recitation = useUploadsStore
      .getState()
      .recitations.find(r => r.id === track.userRecitationId);
    return recitation ? resolveRecitationPath(recitation.filePath) : track.url;
  }

  if (!track.reciterId || !track.surahId) return track.url;
  const reciter = getReciterByIdSync(track.reciterId);
  if (!reciter) return track.url;

  try {
    // Local when a finished download exists for this recording.
    const best = generateSmartAudioUrl(reciter, track.surahId, track.rewayatId);
    if (!isRemote(best)) return best;
    // No download (any more): a saved local path is dead, so stream.
    if (!isRemote(track.url)) return best;
  } catch {
    // The reciter no longer has this rewayah: keep what the queue has.
  }
  return track.url;
}

/**
 * Hands the resolver to the player store. The store cannot import this
 * module (it is imported by modules that this one needs). Called once at
 * boot, from restoreSession().
 */
export function registerTrackUrlResolver(): void {
  setTrackUrlResolver(resolveTrackUrl);
}
