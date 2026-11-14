// @ai-generated
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expoAudioService} from '@/services/audio/ExpoAudioService';

// A seek this old counts as landed, even if it never reported back.
const PENDING_SEEK_MS = 3000;

// The seek the back / forward buttons last asked for, while it is in flight.
// One for the whole app: there is one player, whichever button was tapped.
let pendingSeek: {target: number; at: number} | null = null;

/**
 * Where the audio is right now, and how long the track is. The player's own
 * clock is exact. The store's position is only refreshed once a second on iOS
 * and every two on Android, so it is used only when the player has nothing
 * loaded to ask: a launch whose restore could not load the track, or an
 * Android stream that is buffering again.
 */
function playhead(): {position: number; duration: number} {
  const {playback, queue} = usePlayerStore.getState();
  const url = queue.tracks[queue.currentIndex]?.url;
  const live =
    !!url &&
    expoAudioService.isSourceReady(url) &&
    expoAudioService.getIsLoaded();
  return live
    ? {
        position: expoAudioService.getCurrentTime(),
        duration: expoAudioService.getDuration(),
      }
    : {position: playback.position, duration: playback.duration};
}

/**
 * The back / forward 15 seconds buttons: seeks by `seconds` from where the
 * audio really is, and stays inside the track.
 *
 * They used to add 15 to the store's position, which can be two seconds
 * old: a jump forward moved 13 to 15 seconds, a jump back 15 to 17.
 *
 * Quick taps add up. While a seek is in flight the player's clock can still
 * show the old time (on iOS until the seek lands), so the next tap starts
 * from that seek's target. Two quick taps move 30 seconds; they used to land
 * on the same target and move 15.
 */
export async function seekBy(seconds: number): Promise<void> {
  const {position, duration} = playhead();
  const inFlight =
    pendingSeek && Date.now() - pendingSeek.at < PENDING_SEEK_MS
      ? pendingSeek
      : null;
  const from = inFlight ? inFlight.target : position;
  const end = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  const target = Math.min(end, Math.max(0, from + seconds));

  const seek = {target, at: Date.now()};
  pendingSeek = seek;
  try {
    await usePlayerStore.getState().seekTo(target);
  } finally {
    // A newer tap owns the pending seek by now; leave its target alone.
    if (pendingSeek === seek) pendingSeek = null;
  }
}
