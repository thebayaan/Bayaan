import {useCallback, useMemo, useRef} from 'react';
import {useDefaultReciter} from '../../hooks/useDefaultReciter';
import {usePlayer} from '../../hooks/usePlayer';
import {featuredFirst, pickPlayableRewayah} from '../../services/browseCatalog';
import {rewayahForSurah} from '../../services/listeningChoices';
import type {ShelfSurah} from '../../services/libraryShelf';
import {fetchRewayat, getCachedRewayat} from '../../services/tvDataService';
import {useNavStore} from '../../store/navStore';
import type {Reciter, Rewayah} from '../../types/reciter';

async function rewayatFor(reciter: Reciter): Promise<Rewayah[]> {
  const cached = getCachedRewayat(reciter.id);
  if (cached && cached.length > 0) return cached;
  if (reciter.rewayat && reciter.rewayat.length > 0) return reciter.rewayat;
  return fetchRewayat(reciter.id);
}

/**
 * What OK does on the Library: resume an unfinished surah where it stopped,
 * play a loved surah in the voice it was loved in, or play a surah in the
 * default reciter (first run). One press at a time.
 */
export function useLibraryPlayback(
  reciters: readonly Reciter[],
  reciterById: ReadonlyMap<string, Reciter>,
): {
  defaultReciter: Reciter | null;
  playTile: (tile: ShelfSurah) => Promise<void>;
  playInDefault: (surahNumber: number) => Promise<void>;
} {
  const {defaultReciterId} = useDefaultReciter();
  const {playRewayah, resumeContinue} = usePlayer();
  const push = useNavStore(s => s.push);
  const busy = useRef(false);

  const defaultReciter = useMemo<Reciter | null>(
    () =>
      (defaultReciterId ? reciterById.get(defaultReciterId) : undefined) ??
      featuredFirst(reciters)[0] ??
      null,
    [defaultReciterId, reciterById, reciters],
  );

  const once = useCallback(async (run: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      await run();
    } finally {
      busy.current = false;
    }
  }, []);

  const playTile = useCallback(
    (tile: ShelfSurah) =>
      once(async () => {
        const reciter = reciterById.get(tile.reciterId);
        if (!reciter) return;
        const rewayat = await rewayatFor(reciter);
        const saved = rewayat.find(
          r =>
            r.id === tile.rewayahId && r.surah_list.includes(tile.surahNumber),
        );
        const rewayah =
          saved ??
          rewayahForSurah({...reciter, rewayat}, tile.surahNumber) ??
          rewayat[0];
        if (!rewayah) return;
        push({screen: 'nowPlaying'});
        // Resume only in the recitation the position belongs to.
        if (tile.progress && saved) {
          await resumeContinue(
            reciter.id,
            reciter.name,
            rewayah,
            tile.surahNumber,
            tile.progress.positionSeconds,
          );
        } else {
          await playRewayah(
            reciter.id,
            reciter.name,
            rewayah,
            tile.surahNumber,
          );
        }
      }),
    [once, reciterById, push, resumeContinue, playRewayah],
  );

  const playInDefault = useCallback(
    (surahNumber: number) =>
      once(async () => {
        // The default reciter first; if they lack this surah, the first
        // featured reciter who has it, so a press always plays something.
        const candidates = [
          ...(defaultReciter ? [defaultReciter] : []),
          ...featuredFirst(reciters).filter(r => r.id !== defaultReciter?.id),
        ].slice(0, 12);
        for (const candidate of candidates) {
          const rewayah = pickPlayableRewayah(
            await rewayatFor(candidate),
            surahNumber,
          );
          if (!rewayah || !rewayah.surah_list.includes(surahNumber)) continue;
          await playRewayah(candidate.id, candidate.name, rewayah, surahNumber);
          push({screen: 'nowPlaying'});
          return;
        }
      }),
    [once, defaultReciter, reciters, playRewayah, push],
  );

  return {defaultReciter, playTile, playInDefault};
}
