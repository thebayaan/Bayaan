// @ai-generated
/**
 * Bookmarks, highlights and notes of the verses a verse sheet acts on, in
 * the shown rewayah's own verses (Release 1, decision 3; verse-units
 * contract section 3). Used by the verse actions sheet, its highlight and
 * note screens, and the note sheet.
 *
 * Storage stays Hafs-keyed: a selected verse is stored as one row at its
 * Hafs anchor ("S:A", or "S:A:W" for a verse that starts inside a Hafs
 * verse) with the selection's rewayah. Another rewayah's verses go through
 * the annotations store's unit API (selectUnitAnnotations,
 * setUnitsBookmarked, setUnitsHighlight, addUnitsNote), which reads every
 * row back in the shown rewayah by the rewayah it was saved in:
 *  - a row of the shown rewayah (or a legacy row) marks the verse holding
 *    the slot its verse_key names (unitForAnchor): a legacy Warsh row
 *    "103:2" marks Warsh 103:1 = Hafs 103:1 + 103:2;
 *  - a Hafs row marks every verse holding its Hafs verse (Hafs "1:7": Warsh
 *    1:6 and 1:7); a row of a third rewayah the verses holding its words;
 *  - a verse is marked when ANY row marks it; removing its mark deletes
 *    every row that marks it and keeps the other verses such a row marked
 *    on rows of their own; marking it writes a row at its anchor unless a
 *    row already marks it.
 * Hafs: a verse's only key is its own Hafs key, so the sheets read and
 * write exactly the rows they did before, call for call (every selected
 * key is added or removed, stored or not), each optimistic row with its
 * rewayah.
 */
import {useMemo} from 'react';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {
  selectUnitAnnotations,
  useVerseAnnotationsStore,
} from '@/store/verseAnnotationsStore';
import type {HighlightColor} from '@/types/verse-annotations';
import type {ReadyVerseSelection} from '@/components/share/rewayahVerseSelection';

/** A Hafs selection's keys (none for another rewayah, or while pending). */
function useHafsKeys(selection: ReadyVerseSelection | null): string[] {
  return useMemo(
    () =>
      selection && !selection.units
        ? selection.anchors.map(anchor => anchor.key)
        : [],
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
  const hafsKeys = useHafsKeys(selection);
  const units = selection?.units ?? null;
  const model = selection?.model ?? null;
  return useVerseAnnotationsStore(state => {
    if (units && model) {
      const marks = selectUnitAnnotations(state, model);
      return units.every(unit => marks.bookmarkedUnitKeys.has(unit.key));
    }
    return (
      hafsKeys.length > 0 && hafsKeys.every(key => state.isBookmarked(key))
    );
  });
}

/**
 * The first selected verse's highlight colour (another rewayah: the store's
 * pick among the rows that mark it, its own row first); null when none does
 * or while pending.
 */
export function useSelectionHighlightColor(
  selection: ReadyVerseSelection | null,
): HighlightColor | null {
  const hafsKeys = useHafsKeys(selection);
  const units = selection?.units ?? null;
  const model = selection?.model ?? null;
  return useVerseAnnotationsStore(state => {
    if (units && model) {
      const marks = selectUnitAnnotations(state, model);
      return marks.highlightColors[units[0].key] ?? null;
    }
    return (hafsKeys.length > 0 && state.highlights[hafsKeys[0]]) || null;
  });
}

/**
 * Bookmark the selected verses: one row per verse at its anchor, except a
 * verse a row already marks. Or remove their bookmarks: every row that
 * marks one of them. Hafs: adds or removes each selected Hafs key, as
 * before.
 */
export async function setSelectionBookmarked(
  selection: ReadyVerseSelection,
  bookmarked: boolean,
): Promise<void> {
  const store = useVerseAnnotationsStore.getState();
  const {units, model} = selection;
  if (units && model) {
    await store.setUnitsBookmarked(model, units, bookmarked);
    return;
  }
  for (const anchor of selection.anchors) {
    if (bookmarked) {
      await verseAnnotationService.addBookmark(
        anchor.key,
        anchor.surah,
        anchor.ayah,
        selection.rewayah,
      );
      store.addBookmark(anchor.key, selection.rewayah);
    } else {
      await verseAnnotationService.removeBookmark(anchor.key);
      store.removeBookmark(anchor.key);
    }
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
  const {units, model} = selection;
  if (units && model) {
    await store.setUnitsHighlight(model, units, color);
    return;
  }
  for (const anchor of selection.anchors) {
    if (color === null) {
      await verseAnnotationService.removeHighlight(anchor.key);
      store.removeHighlight(anchor.key);
    } else {
      await verseAnnotationService.upsertHighlight(
        anchor.key,
        anchor.surah,
        anchor.ayah,
        color,
        selection.rewayah,
      );
      store.setHighlight(anchor.key, color, selection.rewayah);
    }
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
  const {units, model} = selection;
  if (units && model) {
    await useVerseAnnotationsStore
      .getState()
      .addUnitsNote(model, units, content);
    return;
  }
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
    store.addNote(key, selection.rewayah);
  }
}
