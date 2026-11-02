// @ai-generated
// Shared by the Bookmarks and Notes lists so a saved verse opens the same
// way from either, at once: the reader restores its rewayah and opens its page
// with it selected when the Mushaf data is ready (app/mushaf.tsx).
import type {RewayahId} from '@/store/mushafSettingsStore';
import {
  savedVerseRouteParams,
  type SavedVerseRouteParams,
} from './unitAnnotations';

export type SavedVerseOpenParams = Omit<SavedVerseRouteParams, 'page'> & {
  /** The rewayah the row was saved in; absent for a legacy row. */
  rewayah?: RewayahId;
};

/**
 * Mushaf route params for a saved bookmark or note: the verse, its anchor and
 * its rewayah, with no page. A page lookup here needs the Mushaf data, which
 * loads after the splash, and a wait for it would hold the tap.
 */
export function savedVerseOpenParams(row: {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  rewayahId?: RewayahId | null;
}): SavedVerseOpenParams {
  const {surah, ayah, anchor} = savedVerseRouteParams(row, 1);
  const params: SavedVerseOpenParams = {surah, ayah};
  if (anchor) params.anchor = anchor;
  if (row.rewayahId) params.rewayah = row.rewayahId;
  return params;
}
