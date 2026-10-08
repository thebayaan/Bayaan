// @ai-generated
import {useMemo} from 'react';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {UnitAnnotations} from '@/services/verse-annotations/unitAnnotations';
import {
  selectUnitAnnotations,
  useVerseAnnotationsStore,
} from '@/store/verseAnnotationsStore';

/**
 * Bookmarks, notes and highlights of the store in the verse units of the
 * shown `rewayah` (decision 3): `bookmarkedUnitKeys`, `notedUnitKeys` and
 * `highlightColors` are keyed by the rewayah's own verse keys, so a split
 * Hafs verse's two parts are marked separately. Null while the rewayah's
 * units are not ready (loading, refused or unavailable): mark nothing then.
 *
 * Rows still load per surah through loadAnnotationsForSurah(s), as before.
 * Hafs: the keys equal the Hafs keys of the Hafs rows (unchanged tints).
 */
export function useUnitAnnotations(
  rewayah: RewayahId | null,
): UnitAnnotations | null {
  const {units} = useRewayahVerseUnits(rewayah);
  const bookmarkRows = useVerseAnnotationsStore(s => s.bookmarkRows);
  const noteRows = useVerseAnnotationsStore(s => s.noteRows);
  const highlightRows = useVerseAnnotationsStore(s => s.highlightRows);
  return useMemo(
    () =>
      units
        ? selectUnitAnnotations({bookmarkRows, noteRows, highlightRows}, units)
        : null,
    [units, bookmarkRows, noteRows, highlightRows],
  );
}
