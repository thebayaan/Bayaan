// @ai-generated
/**
 * The verse rows of the mushaf's list modes that show the mushaf selection
 * (useMushafVerseSelectionStore): the verse the reader was taken to by a
 * search result, a bookmark, a link or a similar verse.
 *
 * Same rule as the mushaf pages' selection layer (unitKeyedVerseLayers): a
 * selection in the shown rewayah's own numbering names its rows as they
 * are, a Hafs selection lights the rows holding those Hafs verses, and a
 * selection in another numbering lights nothing rather than the wrong verse.
 */
import type {ShownVerseUnits} from '@/services/mushaf/MushafVerseMapService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const NO_KEYS: readonly string[] = Object.freeze([]);

/**
 * @param shown the shown rewayah's units, or null for Hafs (rows are Hafs
 *   verses, keyed by their Hafs verse key)
 */
export function selectedRowKeys(
  shown: ShownVerseUnits | null,
  selectedRewayah: RewayahId | null,
  selectedVerseKeys: readonly string[],
): readonly string[] {
  if (!selectedRewayah || selectedVerseKeys.length === 0) return NO_KEYS;
  const shownRewayah = shown ? shown.rewayah : 'hafs';
  if (selectedRewayah === shownRewayah) return selectedVerseKeys;
  if (selectedRewayah === 'hafs' && shown) {
    const keys = shown.unitKeysForHafsKeys(selectedVerseKeys);
    return keys.length > 0 ? keys : NO_KEYS;
  }
  return NO_KEYS;
}
