// @ai-generated
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {hideTopSheet, showSheet} from '@/components/sheets/sheetControl'; // @ai

/** Matches the player's on-screen skip buttons. */
export const KEY_SEEK_SECONDS = 15;

/** Closes the action sheet on top, if one is open. */
export function closeTopSheet(): boolean {
  return hideTopSheet();
}

/** Closes the full player, if it's open. */
export function closeFullPlayer(): boolean {
  const player = usePlayerStore.getState();
  if (player.sheetMode !== 'full') return false;
  player.setSheetMode('hidden');
  return true;
}

function ready() {
  const player = usePlayerStore.getState();
  const {tracks, currentIndex} = player.queue;
  if (player.loading.trackLoading || tracks[currentIndex] == null) return null;
  return player;
}

/** Space: plays or pauses, as the play button does. */
export function togglePlayback(): void {
  const player = ready();
  if (!player) return;
  if (player.playback.state === 'playing') player.pause();
  else player.play();
}

/** ← / →: seeks back or forward, as the skip buttons do. */
export function seekBy(seconds: number): void {
  const player = ready();
  if (!player) return;
  player.seekTo(Math.max(0, player.playback.position + seconds));
}

/** ⌘← / ⌘→: the previous or next track, as the track buttons do. */
export function skipTrack(direction: 1 | -1): void {
  const player = ready();
  if (!player) return;
  if (direction === -1) {
    player.skipToPrevious();
  } else if (player.queue.currentIndex < player.queue.tracks.length - 1) {
    player.skipToNext();
  }
}

/**
 * ⌥Space in the reader: pauses or resumes the recitation, as the toolbar's
 * play button does. With nothing loaded it opens the playback options to
 * start one, as the iOS 26 toolbar does.
 */
export function toggleRecitation(currentPage: number): void {
  const recitation = useMushafPlayerStore.getState();
  switch (recitation.playbackState) {
    case 'playing':
      mushafAudioService.pause();
      recitation.setPlaybackState('paused');
      return;
    case 'paused':
      mushafAudioService.play();
      recitation.setPlaybackState('playing');
      return;
    case 'idle':
      useMushafPlayerStore.setState({currentPage});
      showSheet('mushaf-player-options', {payload: {currentPage}});
      return;
    case 'loading':
      return;
  }
}
