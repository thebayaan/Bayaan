import {useCallback, useMemo} from 'react';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {useContinueListening} from './useContinueListening';
import {
  findReciter,
  openPlayer,
  playOrOpen,
  surahTitle,
} from '../services/playbackRouting';
import {nowPlayingTile, type NowPlayingTile} from '../services/nowPlayingTile';

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
  const positionSeconds = useTVPlayerStore(s => s.positionSeconds);
  const durationSeconds = useTVPlayerStore(s => s.durationSeconds);
  const continueEntries = useContinueListening();
  // The newest entry that can still resume: one whose reciter is gone has
  // no name and only leads to an error.
  const resume = useMemo(() => {
    if (item) return null;
    for (const entry of continueEntries) {
      const reciter = findReciter(entry.reciterId);
      if (reciter) {
        return {
          title: surahTitle(entry.surahNumber),
          subtitle: reciter.name,
          entry,
        };
      }
    }
    return null;
  }, [item, continueEntries]);
  const newest = resume?.entry ?? null;

  const tile = nowPlayingTile({
    item,
    status,
    finished,
    positionSeconds,
    durationSeconds,
    resume,
  });

  const action = tile?.action;
  const press = useCallback(() => {
    if (action === 'resume' && newest) {
      void playOrOpen({
        reciterId: newest.reciterId,
        rewayahId: newest.rewayahId,
        surahNumber: newest.surahNumber,
        startSeconds: newest.positionSeconds,
        source: 'now-playing-tile',
      });
      return;
    }
    if (action === 'replay') useTVPlayerStore.getState().replay();
    openPlayer();
  }, [action, newest]);

  return {tile, press};
}
