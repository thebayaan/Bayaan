// Phase 3 widget kinds and their change detection. Kept apart from
// widgetKinds.ts so the Phase 1 lists and tests stay as they are.
import type {WidgetSnapshot} from './snapshot';
import type {WidgetContent} from './content';
import {changedWidgetKinds, playingKey} from './widgetKinds';

export type ContentWidgetKind =
  | 'RecentlyPlayed'
  | 'LibraryShelf'
  | 'Bedtime'
  | 'Adhkar'
  | 'ReciterSpotlight'
  | 'BayaanNow';

export const ALL_CONTENT_WIDGET_KINDS: readonly ContentWidgetKind[] = [
  'RecentlyPlayed',
  'LibraryShelf',
  'Bedtime',
  'Adhkar',
  'ReciterSpotlight',
  'BayaanNow',
];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Adhkar depends on the date (reloaded elsewhere) and on adhkar playback.
export function changedContentKindsForSnapshot(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): ContentWidgetKind[] {
  if (!prev) return ['RecentlyPlayed', 'Bedtime', 'BayaanNow'];
  const recentChanged = !same(prev.recent, next.recent);
  const reciterChanged = !same(prev.defaultReciter, next.defaultReciter);
  // @ai-start
  // Their play buttons show pause while their surah or reciter plays.
  const playingChanged = !same(playingKey(prev), playingKey(next));
  const adhkarChanged = !same(prev.adhkar ?? null, next.adhkar ?? null);
  const kinds: ContentWidgetKind[] = [];
  if (recentChanged || reciterChanged || playingChanged)
    kinds.push('RecentlyPlayed');
  if (reciterChanged || playingChanged) kinds.push('Bedtime');
  if (playingChanged) kinds.push('LibraryShelf', 'ReciterSpotlight');
  if (adhkarChanged) kinds.push('Adhkar');
  if (
    recentChanged ||
    adhkarChanged ||
    changedWidgetKinds(prev, next).includes('ContinueListening')
  ) {
    kinds.push('BayaanNow');
  }
  // @ai-end
  return kinds;
}

export function changedContentKindsForContent(
  prev: WidgetContent | null,
  next: WidgetContent,
): ContentWidgetKind[] {
  if (!prev)
    return ['LibraryShelf', 'ReciterSpotlight', 'Bedtime', 'BayaanNow'];
  const kinds: ContentWidgetKind[] = [];
  if (
    !same(
      [prev.downloads, prev.downloadCount, prev.playlists],
      [next.downloads, next.downloadCount, next.playlists],
    )
  ) {
    kinds.push('LibraryShelf');
  }
  if (!same(prev.spotlight, next.spotlight)) kinds.push('ReciterSpotlight');
  if (prev.sleepTimerEndsAt !== next.sleepTimerEndsAt) {
    kinds.push('Bedtime', 'BayaanNow');
  }
  return kinds;
}
