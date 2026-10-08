// @ai-generated
/**
 * Bookmarks, highlights and notes of the verses a verse sheet acts on, in
 * the shown rewayah's own verses (Release 1, decision 3; verse-units
 * contract section 3). Used by the verse actions sheet, its highlight and
 * note screens, and the note sheet.
 *
 * Storage stays Hafs-keyed: a selected verse is stored as one row at its
 * Hafs anchor ("S:A", or "S:A:W" for a verse that starts inside a Hafs
 * verse) with the selection's rewayah. Read back, a row marks the verse
 * holding the slot its verse_key names (RewayahVerseUnits.unitForAnchor):
 *  - a verse is marked when ANY row marks it: the row at its own anchor, or
 *    a row saved before Release 1 on a Hafs verse whose first word it holds
 *    (a legacy Warsh row "103:2" marks Warsh 103:1 = Hafs 103:1 + 103:2);
 *  - removing a verse's mark deletes every row that marks it, legacy rows
 *    included, so no row is left that still marks it on the mushaf;
 *  - marking it writes a row at its anchor unless a row already marks it.
 * Hafs: a verse's only key is its own Hafs key, so the sheets read and
 * write exactly the rows they did before, call for call (every selected
 * key is added or removed, stored or not).
 *
 * The annotations store keys rows by verse_key alone here, so every row is
 * read as a row of the shown rewayah (exact for that rewayah's rows and for
 * legacy rows). Once the store keeps each row's rewayah
 * (fix/r1-v-collections), the non-Hafs paths below delegate to its unit
 * API, which also maps rows saved in Hafs or a third rewayah (integrator
 * patch fix/vu/v-sheets/integrator-annotations-unit-api.patch).
 */
import {useMemo} from 'react';
import {
  formatAnchorKey,
  type RewayahVerseUnits,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import type {HighlightColor} from '@/types/verse-annotations';
import type {ReadyVerseSelection} from '@/components/share/rewayahVerseSelection';

/**
 * Every verse_key a stored row can have to mark `unit` (the inverse of
 * unitForAnchor): the Hafs location of each of its slots, "S:A" for a Hafs
 * verse's first slot and "S:A:W" for slot W, in slot order, so the unit's
 * own anchor comes first.
 */
export function unitRowKeys(
  model: RewayahVerseUnits,
  unit: VerseUnit,
): string[] {
  const anchor = model.hafsAnchor(unit);
  const keys: string[] = [];
  let ayah = anchor.ayah;
  let range = model.hafsVerseWordRange(anchor.hafsKey);
  for (let id = unit.firstWordId; id <= unit.lastWordId; id++) {
    // A surah's Hafs verses are consecutive runs of slot ids.
    while (range && id > range.last) {
      ayah += 1;
      range = model.hafsVerseWordRange(`${unit.surah}:${ayah}`);
    }
    if (!range) break;
    keys.push(formatAnchorKey(`${unit.surah}:${ayah}`, id - range.first + 1));
  }
  return keys.length > 0 ? keys : [anchor.key];
}

/**
 * Per selected verse, the verse_keys whose rows mark it (unitRowKeys), its
 * own anchor first. Hafs: [[verseKey], ...], the keys the sheets used before.
 */
export function selectionRowKeys(selection: ReadyVerseSelection): string[][] {
  const {units, model} = selection;
  if (!units || !model) return selection.anchors.map(anchor => [anchor.key]);
  return units.map(unit => unitRowKeys(model, unit));
}

/**
 * The rows a removal deletes: every stored row (`stored`) that marks a
 * selected verse. Hafs: every selected key, stored or not, as the sheets
 * always removed them.
 */
function removalKeys(
  selection: ReadyVerseSelection,
  rowKeys: readonly (readonly string[])[],
  stored: (key: string) => boolean,
): string[] {
  if (!selection.units) return rowKeys.map(keys => keys[0]);
  return rowKeys.flatMap(keys => keys.filter(stored));
}

/** The first colour among `keys` (a verse's row keys, own anchor first). */
function firstHighlightColor(
  keys: readonly string[] | undefined,
  highlights: Readonly<Record<string, HighlightColor>>,
): HighlightColor | null {
  for (const key of keys ?? []) {
    const color = highlights[key];
    if (color) return color;
  }
  return null;
}

/** selectionRowKeys of a selection (none while it is pending). */
function useRowKeys(selection: ReadyVerseSelection | null): string[][] {
  return useMemo(
    () => (selection ? selectionRowKeys(selection) : []),
    [selection],
  );
}

/**
 * True when every selected verse is bookmarked (by any row that marks it);
 * false while the selection is pending.
 */
export function useSelectionBookmarked(
  selection: ReadyVerseSelection | null,
): boolean {
  const rowKeys = useRowKeys(selection);
  return useVerseAnnotationsStore(
    state =>
      rowKeys.length > 0 &&
      rowKeys.every(keys => keys.some(key => state.isBookmarked(key))),
  );
}

/**
 * The first selected verse's highlight colour: its own anchor's row, else
 * the earliest row that marks it; null when none does or while pending.
 */
export function useSelectionHighlightColor(
  selection: ReadyVerseSelection | null,
): HighlightColor | null {
  const rowKeys = useRowKeys(selection);
  return useVerseAnnotationsStore(state =>
    firstHighlightColor(rowKeys[0], state.highlights),
  );
}

/**
 * Bookmark the selected verses: one row per verse at its anchor, except a
 * verse a row already marks (it keeps that row rather than getting a
 * second one). Or remove their bookmarks: every row that marks one of them.
 * Hafs: adds or removes each selected Hafs key, as before.
 */
export async function setSelectionBookmarked(
  selection: ReadyVerseSelection,
  bookmarked: boolean,
): Promise<void> {
  const store = useVerseAnnotationsStore.getState();
  const rowKeys = selectionRowKeys(selection);
  if (!bookmarked) {
    const keys = removalKeys(selection, rowKeys, k => store.isBookmarked(k));
    for (const key of keys) {
      await verseAnnotationService.removeBookmark(key);
      store.removeBookmark(key);
    }
    return;
  }
  for (const [i, anchor] of selection.anchors.entries()) {
    // Hafs adds every selected key, as before (the insert is OR IGNORE).
    if (selection.units && rowKeys[i].some(key => store.isBookmarked(key))) {
      continue;
    }
    await verseAnnotationService.addBookmark(
      anchor.key,
      anchor.surah,
      anchor.ayah,
      selection.rewayah,
    );
    store.addBookmark(anchor.key);
  }
}

/**
 * Colour the selected verses (one row per verse at its anchor), or with
 * null remove their highlights (every row that marks one of them). Hafs:
 * each selected Hafs key, as before.
 */
export async function setSelectionHighlight(
  selection: ReadyVerseSelection,
  color: HighlightColor | null,
): Promise<void> {
  const store = useVerseAnnotationsStore.getState();
  if (color === null) {
    const {highlights} = store;
    const keys = removalKeys(
      selection,
      selectionRowKeys(selection),
      k => !!highlights[k],
    );
    for (const key of keys) {
      await verseAnnotationService.removeHighlight(key);
      store.removeHighlight(key);
    }
    return;
  }
  for (const anchor of selection.anchors) {
    await verseAnnotationService.upsertHighlight(
      anchor.key,
      anchor.surah,
      anchor.ayah,
      color,
      selection.rewayah,
    );
    store.setHighlight(anchor.key, color);
  }
}

/**
 * Save a note on the selected verses: verse_key = the first verse's anchor,
 * verse_keys = every verse's anchor when there are several, with the
 * selection's rewayah. Hafs: the Hafs keys, as before.
 */
export async function addSelectionNote(
  selection: ReadyVerseSelection,
  content: string,
): Promise<void> {
  const [first] = selection.anchors;
  if (!first) return;
  const keys = selection.anchors.map(anchor => anchor.key);
  await verseAnnotationService.addNote(
    first.key,
    first.surah,
    first.ayah,
    content,
    keys.length > 1 ? keys : undefined,
    selection.rewayah,
  );
  const store = useVerseAnnotationsStore.getState();
  for (const key of keys) {
    store.addNote(key);
  }
}
