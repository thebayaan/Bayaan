// @ai-generated
import {useMemo} from 'react';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {
  describeSavedVerse,
  isHafsSaved,
  type SavedVerseDescription,
  type SavedVerseRef,
} from '@/services/verse-annotations/unitAnnotations';

/**
 * How a bookmark or note reads in the rewayah it was saved in: its own verse
 * label and text (see describeSavedVerse). Loads that rewayah's words on
 * demand and keeps them in memory while the row is mounted (as the row's
 * text preview did before), so rows of several rewayat never evict each
 * other's words. Hafs rows need nothing: they keep their Hafs label and
 * preview ('hafs').
 */
export function useSavedVerseDescription(
  row: SavedVerseRef,
): SavedVerseDescription {
  const hafs = isHafsSaved(row);
  const source = useRewayahVerseUnits(hafs ? null : (row.rewayahId ?? null));
  const {verseKey} = row;
  // Rows are rebuilt by their screens on every render: key on content.
  const keysSignature = row.verseKeys?.join(',') ?? '';
  const rowRewayah = row.rewayahId ?? null;
  return useMemo(
    () =>
      describeSavedVerse(
        {
          verseKey,
          verseKeys: keysSignature ? keysSignature.split(',') : undefined,
          rewayahId: rowRewayah,
        },
        source,
      ),
    [verseKey, keysSignature, rowRewayah, source],
  );
}

/**
 * The same description without a hook and without loading or building
 * anything, for event handlers (an options sheet opened from a row already
 * on screen, whose units its label loaded). 'loading' when they are not
 * built.
 */
export function describeSavedVerseNow(
  row: SavedVerseRef,
): SavedVerseDescription {
  if (isHafsSaved(row) || !row.rewayahId) {
    return describeSavedVerse(row, {units: null, status: 'unavailable'});
  }
  return describeSavedVerse(row, {
    units: rewayahVerseUnitsService.peek(row.rewayahId),
    status: rewayahVerseUnitsService.getStatus(row.rewayahId),
  });
}
