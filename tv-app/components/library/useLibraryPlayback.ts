import {useCallback, useMemo} from 'react';
import {useDefaultReciter} from '../../hooks/useDefaultReciter';
import {featuredFirst} from '../../services/browseCatalog';
import {getContinueListening} from '../../services/continueListeningStore';
import type {ShelfSurah} from '../../services/libraryShelf';
import {
  playOrOpen,
  surahTitle,
  voiceForSurah,
} from '../../services/playbackRouting';
import {showToast} from '../../store/toastStore';
import type {Reciter} from '../../types/reciter';

/**
 * What OK does on the Library: play a loved surah in the voice it was loved
 * in (picking up where it stopped when it was left unfinished), or play a
 * surah in the default reciter (first run). playOrOpen opens the player at
 * once, and the surah already playing just opens it.
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

  const defaultReciter = useMemo<Reciter | null>(
    () =>
      (defaultReciterId ? reciterById.get(defaultReciterId) : undefined) ??
      featuredFirst(reciters)[0] ??
      null,
    [defaultReciterId, reciterById, reciters],
  );

  const playTile = useCallback(async (tile: ShelfSurah): Promise<void> => {
    // Continue listening is not listed here (it lives on Home), but a loved
    // surah left partway still resumes. The saved rewayah plays when it
    // still has the surah (else another of the reciter's); the position only
    // counts in the recitation it belongs to, which playOrOpen keeps.
    const unfinished = getContinueListening().find(
      e => e.reciterId === tile.reciterId && e.surahNumber === tile.surahNumber,
    );
    const rewayahId = tile.rewayahId || unfinished?.rewayahId || undefined;
    await playOrOpen({
      reciterId: tile.reciterId,
      rewayahId,
      surahNumber: tile.surahNumber,
      startSeconds:
        unfinished && (!rewayahId || unfinished.rewayahId === rewayahId)
          ? unfinished.positionSeconds
          : undefined,
      source: 'library',
    });
  }, []);

  const playInDefault = useCallback(
    async (surahNumber: number): Promise<void> => {
      // The default reciter first; if they lack this surah, the first
      // featured reciter who has it, so a press always plays something.
      const candidates = [
        ...(defaultReciter ? [defaultReciter] : []),
        ...featuredFirst(reciters).filter(r => r.id !== defaultReciter?.id),
      ];
      const voice = voiceForSurah(candidates, surahNumber);
      if (!voice) {
        showToast(`No reciter has ${surahTitle(surahNumber)} yet.`, 'error');
        return;
      }
      await playOrOpen({...voice, source: 'library-default'});
    },
    [defaultReciter, reciters],
  );

  return {defaultReciter, playTile, playInDefault};
}
