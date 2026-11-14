// @ai-generated
import {useLovedStore} from '@/services/player/store/lovedStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlaylistsStore} from '@/store/playlistsStore';

/**
 * Removes every reference to uploads that have just been deleted.
 *
 * Deleting an upload only removed its file and its row. It stayed in the
 * play queue with a dead path, and stayed listed in Loved and in playlists
 * as a row that could not be played (in Loved, tapping it started the next
 * surah instead).
 *
 * Each place is cleaned on its own, so a failure in one leaves the others
 * done.
 */
export async function forgetDeletedUploads(
  userRecitationIds: readonly string[],
): Promise<void> {
  if (userRecitationIds.length === 0) return;
  const deleted = new Set(userRecitationIds);

  // The queue first: if one of them is playing, this moves on to the next
  // track (or stops when nothing is left) before anything else.
  try {
    const {queue, removeFromQueue} = usePlayerStore.getState();
    const indices: number[] = [];
    queue.tracks.forEach((track, index) => {
      if (track.userRecitationId && deleted.has(track.userRecitationId)) {
        indices.push(index);
      }
    });
    if (indices.length > 0) await removeFromQueue(indices);
  } catch (error) {
    console.warn(
      '[uploads] Could not remove deleted uploads from the queue:',
      error,
    );
  }

  useLovedStore.getState().removeUploads(userRecitationIds);

  try {
    await usePlaylistsStore.getState().removeUploads(userRecitationIds);
  } catch (error) {
    console.warn(
      '[uploads] Could not remove deleted uploads from playlists:',
      error,
    );
  }
}
