// @ai-generated
/**
 * Test helper for the verse sheets' bookmark / highlight tests: replaces the
 * annotations store's rows through the store's own mutations, as rows saved
 * in `savedIn`. A row is saved in the mushaf's rewayah unless told
 * otherwise (as the database service stamps it), so the mushaf's rewayah is
 * `savedIn` while the rows are added. Works with any annotations store that
 * keeps the mutations' contract, whether or not it records each row's
 * rewayah.
 */
import {
  useMushafSettingsStore,
  type RewayahId,
} from '@/store/mushafSettingsStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import type {HighlightColor} from '@/types/verse-annotations';

export function setStoredRows(
  bookmarks: readonly string[],
  highlights: Readonly<Record<string, HighlightColor>> = {},
  savedIn: RewayahId = 'warsh',
): void {
  const store = useVerseAnnotationsStore.getState();
  for (const key of [...store.bookmarkedVerseKeys]) store.removeBookmark(key);
  for (const key of Object.keys(store.highlights)) store.removeHighlight(key);
  for (const key of [...store.notedVerseKeys]) store.removeNote(key);
  const shown = useMushafSettingsStore.getState().rewayah;
  useMushafSettingsStore.setState({rewayah: savedIn});
  try {
    for (const key of bookmarks) store.addBookmark(key);
    for (const [key, color] of Object.entries(highlights)) {
      store.setHighlight(key, color);
    }
  } finally {
    useMushafSettingsStore.setState({rewayah: shown});
  }
}
