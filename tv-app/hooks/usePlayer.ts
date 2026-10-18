import {recordVisit} from '../services/recentlyPlayedStore';
import {rewayahQueue, shuffled} from '../services/playbackRouting';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import type {Rewayah} from '../types/reciter';

/**
 * Loads a rewayah into the player without opening it. Screens start playback
 * with playOrOpen (services/playbackRouting); this is for the player itself,
 * e.g. switching reciter mid-surah.
 */
export type UsePlayerReturn = {
  playRewayah: (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    startSurahNumber: number,
    opts?: {shuffle?: boolean; startSeconds?: number},
  ) => Promise<void>;
  shufflePlayRewayah: (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
  ) => Promise<void>;
  resumeContinue: (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    surahNumber: number,
    positionSeconds: number,
  ) => Promise<void>;
};

export function usePlayer(): UsePlayerReturn {
  const loadQueue = useTVPlayerStore(s => s.loadQueue);

  const playRewayah = async (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    startSurahNumber: number,
    opts: {shuffle?: boolean; startSeconds?: number} = {},
  ): Promise<void> => {
    const queue = rewayahQueue({id: reciterId, name: reciterName}, rewayah);
    const idx = queue.findIndex(q => q.surahNumber === startSurahNumber);
    recordVisit(reciterId);
    await loadQueue(queue, idx >= 0 ? idx : 0, opts);
  };

  const shufflePlayRewayah = async (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
  ): Promise<void> => {
    const queue = shuffled(
      rewayahQueue({id: reciterId, name: reciterName}, rewayah),
    );
    if (queue.length === 0) return;
    recordVisit(reciterId);
    await loadQueue(queue, 0, {shuffle: true});
  };

  const resumeContinue = (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    surahNumber: number,
    positionSeconds: number,
  ): Promise<void> =>
    playRewayah(reciterId, reciterName, rewayah, surahNumber, {
      startSeconds: positionSeconds,
    });

  return {playRewayah, shufflePlayRewayah, resumeContinue};
}
