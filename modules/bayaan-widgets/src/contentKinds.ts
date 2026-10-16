// Phase 3 widget kinds and their change detection. Kept apart from
// widgetKinds.ts so the Phase 1 lists and tests stay as they are.
import type {WidgetSnapshot} from './snapshot';
import type {WidgetContent} from './content';
import {changedWidgetKinds} from './widgetKinds';

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

// Adhkar depends only on the date: never reloaded here.
export function changedContentKindsForSnapshot(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): ContentWidgetKind[] {
  if (!prev) return ['RecentlyPlayed', 'Bedtime', 'BayaanNow'];
  const recentChanged = !same(prev.recent, next.recent);
  const reciterChanged = !same(prev.defaultReciter, next.defaultReciter);
  const kinds: ContentWidgetKind[] = [];
  if (recentChanged || reciterChanged) kinds.push('RecentlyPlayed');
  if (reciterChanged) kinds.push('Bedtime');
  if (
    recentChanged ||
    changedWidgetKinds(prev, next).includes('ContinueListening')
  ) {
    kinds.push('BayaanNow');
  }
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
