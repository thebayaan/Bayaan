import {SURAHS} from '../../data/surahData';
import {recordVisit} from '../services/recentlyPlayedStore';
import {buildAudioUrl} from '../services/tvDataService';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import type {QueueItem} from '../types/player';
import type {Rewayah} from '../types/reciter';

const surahNameMap = new Map<number, string>(SURAHS.map(s => [s.id, s.name]));

function buildQueue(
  reciterId: string,
  reciterName: string,
  rewayah: Rewayah,
): QueueItem[] {
  return rewayah.surah_list
    .filter(n => Number.isFinite(n) && n > 0)
    .map(n => ({
      reciterId,
      rewayahId: rewayah.id,
      surahNumber: n,
      audioUrl: buildAudioUrl(rewayah.server, n),
      title: surahNameMap.get(n) ?? `Surah ${n}`,
      subtitle: reciterName,
    }));
}

function shuffleInPlace<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type UsePlayerReturn = {
  playRewayah: (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    startSurahNumber: number,
  ) => Promise<void>;
  shufflePlayRewayah: (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
  ) => Promise<void>;
};

export function usePlayer(): UsePlayerReturn {
  const loadQueue = useTVPlayerStore(s => s.loadQueue);
  const setShuffle = useTVPlayerStore(s => s.setShuffle);

  const playRewayah = async (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    startSurahNumber: number,
  ): Promise<void> => {
    const queue = buildQueue(reciterId, reciterName, rewayah);
    const idx = queue.findIndex(q => q.surahNumber === startSurahNumber);
    recordVisit(reciterId);
    await loadQueue(queue, idx >= 0 ? idx : 0);
  };

  const shufflePlayRewayah = async (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
  ): Promise<void> => {
    const queue = shuffleInPlace(buildQueue(reciterId, reciterName, rewayah));
    if (queue.length === 0) return;
    setShuffle(true);
    recordVisit(reciterId);
    await loadQueue(queue, 0);
  };

  return {playRewayah, shufflePlayRewayah};
}
