import {useCallback, useMemo} from 'react';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {useContinueListening} from './useContinueListening';
import {openPlayer, surahTitle} from '../services/playbackRouting';
import {getCachedReciter} from '../services/tvDataService';
import {nowPlayingTile, type NowPlayingTile} from '../services/nowPlayingTile';
import {newestContinue, resumeContinue} from '../services/resumeContinue';

/**
 * The now-playing tile's content and its press, shared by the sidebar tile
 * and the pill on stacked screens (see services/nowPlayingTile).
 */
export function useNowPlayingTile(): {
  tile: NowPlayingTile | null;
  press: () => void;
} {
  const item = useTVPlayerStore(s => s.queue[s.currentIndex] ?? null);
  // A verse repeat's gap (held) is still listening, not a pause.
  const status = useTVPlayerStore(s => (s.held ? 'playing' : s.status));
  const finished = useTVPlayerStore(s => s.finished);
  // Progress in whole percent (-1 while the length is unknown): the tile
  // and pill redraw when the bar moves, not on every position event.
  const percent = useTVPlayerStore(s =>
    s.durationSeconds > 0
      ? Math.round((s.positionSeconds / s.durationSeconds) * 100)
      : -1,
  );
  const continueEntries = useContinueListening();
  const newest = item ? null : newestContinue(continueEntries);

  const resume = useMemo(() => {
    if (!newest) return null;
    const reciter = getCachedReciter(newest.reciterId);
    return {
      title: surahTitle(newest.surahNumber),
      subtitle: reciter?.name ?? '',
      entry: newest,
    };
  }, [newest]);

  const tile = nowPlayingTile({
    item,
    status,
    finished,
    positionSeconds: Math.max(0, percent),
    durationSeconds: percent < 0 ? 0 : 100,
    resume,
  });

  const action = tile?.action;
  const press = useCallback(() => {
    if (action === 'resume' && newest) {
      resumeContinue(newest, 'now-playing-tile');
      return;
    }
    const player = useTVPlayerStore.getState();
    if (action === 'replay') player.replay();
    // Paused or failed: resume or retry as the player opens.
    else if (action === 'toggle') player.toggle();
    openPlayer();
  }, [action, newest]);

  return {tile, press};
}
