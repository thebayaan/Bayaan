import {SURAHS} from '../../data/surahData';
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

export type UsePlayerReturn = {
  playRewayah: (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    startSurahNumber: number,
  ) => Promise<void>;
};

export function usePlayer(): UsePlayerReturn {
  const loadQueue = useTVPlayerStore(s => s.loadQueue);

  const playRewayah = async (
    reciterId: string,
    reciterName: string,
    rewayah: Rewayah,
    startSurahNumber: number,
  ): Promise<void> => {
    const queue = buildQueue(reciterId, reciterName, rewayah);
    const idx = queue.findIndex(q => q.surahNumber === startSurahNumber);
    await loadQueue(queue, idx >= 0 ? idx : 0);
  };

  return {playRewayah};
}
