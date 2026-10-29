// @ai-generated
// Shared by the Bookmarks and Notes lists so a saved verse opens the same
// way from either: restore its rewayah, then open its page with it selected.
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/store/mushafSettingsStore';
import {restoreSavedRewayah} from './restoreSavedRewayah';
import {
  savedVerseRouteParams,
  type SavedVerseRouteParams,
} from './unitAnnotations';

/**
 * Mushaf route params for a saved bookmark or note. Switches to the rewayah
 * it was saved in first, so the page and selection match what was saved.
 */
export async function savedVerseOpenParams(row: {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  rewayahId?: RewayahId | null;
}): Promise<SavedVerseRouteParams> {
  const verseKey = `${row.surahNumber}:${row.ayahNumber}`;
  await restoreSavedRewayah(row.rewayahId ?? undefined);
  const surahStartPages = digitalKhattDataService.getSurahStartPages();
  const fallbackPage = surahStartPages[row.surahNumber] || 1;
  const page = digitalKhattDataService.getPageForVerse(verseKey);
  // The page of the anchor's Hafs verse is the page the saved verse starts
  // on. A row saved in a non-Hafs rewayah also passes its anchor, so the
  // mushaf selects exactly that rewayah verse.
  return savedVerseRouteParams(row, page || fallbackPage);
}
