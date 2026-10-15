// services/widgets/syncConfiguredWidgets.ts
import {AppState} from 'react-native';
import {
  cacheArtwork,
  hasArtwork,
  isWidgetsAvailable,
  localDayKey,
  planTasbeehOps,
  readArtworkRequests,
  reloadWidgets,
  takePendingTasbeeh,
  writeCatalog,
  WidgetArtworkRequests,
  WidgetKind,
} from 'bayaan-widgets';
import {RECITERS} from '@/data/reciterData';
import {useAdhkarStore} from '@/store/adhkarStore';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterByIdSync} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {
  artworkFileName,
  surahArtworkFileName,
  surahArtworkUrl,
} from './buildSnapshot';
import {buildCatalog, TASBEEH_ADHKAR} from './buildCatalog';
import {ARTWORK_KINDS, flushWidgetSnapshot} from './syncWidgets';
import {enabledKinds, isWidgetEnabled} from './enabledWidgets';

// Quick Surah defaults, Pinned Reciter's popular rows, Continue Reading's empty state.
export const ALWAYS_CACHED_SURAHS: readonly number[] = [1, 18, 36, 56, 67];
const CATALOG_KINDS: WidgetKind[] = ['QuickSurah', 'PinnedReciter', 'Tasbeeh'];
const ARTWORK_RETRY_MS = 10 * 60 * 1000;

let lastCatalogJson: string | null = null;
let consuming = false;
const artworkFailures = new Map<string, number>();
const artworkInFlight = new Set<string>();

export function configuredArtworkJobs(
  requests: WidgetArtworkRequests,
  isCached: (file: string) => boolean,
  artworkUrlFor: (reciterId: string) => string | null,
): Map<string, string> {
  const jobs = new Map<string, string>();
  for (const id of new Set([...ALWAYS_CACHED_SURAHS, ...requests.surahIds])) {
    const file = surahArtworkFileName(id);
    if (!isCached(file)) jobs.set(file, surahArtworkUrl(id));
  }
  for (const id of requests.reciterIds) {
    const file = artworkFileName(id);
    if (isCached(file)) continue;
    const url = artworkUrlFor(id);
    if (url) jobs.set(file, url);
  }
  return jobs;
}

function reciterArtworkUrl(reciterId: string): string | null {
  const reciter = getReciterByIdSync(reciterId);
  if (!reciter) return null;
  const url = getReciterArtwork(reciter);
  return url.startsWith('data:') ? null : url;
}

export async function ensureConfiguredArtwork(): Promise<boolean> {
  let added = false;
  const jobs = configuredArtworkJobs(
    readArtworkRequests(),
    hasArtwork,
    reciterArtworkUrl,
  );
  for (const [file, url] of jobs) {
    const failedAt = artworkFailures.get(url);
    if (failedAt !== undefined && Date.now() - failedAt < ARTWORK_RETRY_MS) {
      continue;
    }
    if (artworkInFlight.has(url)) continue;
    artworkInFlight.add(url);
    try {
      if (await cacheArtwork(url, file)) {
        artworkFailures.delete(url);
        added = true;
      } else {
        artworkFailures.set(url, Date.now());
      }
    } catch (error) {
      artworkFailures.set(url, Date.now());
      console.error('[WidgetSync] Failed to cache configured artwork:', error);
    } finally {
      artworkInFlight.delete(url);
    }
  }
  if (added) reloadWidgets(enabledKinds(ARTWORK_KINDS));
  return added;
}

export function syncCatalog(): void {
  try {
    const catalog = buildCatalog(
      RECITERS,
      isWidgetEnabled('Tasbeeh') ? TASBEEH_ADHKAR : [],
    );
    const json = JSON.stringify(catalog);
    if (json === lastCatalogJson) return;
    writeCatalog(catalog);
    reloadWidgets(enabledKinds(CATALOG_KINDS));
    lastCatalogJson = json;
  } catch (error) {
    console.error('[WidgetSync] Failed to write the widget catalog:', error);
  }
}

// Applies Tasbeeh taps made on the widget. One flush at the end instead of
// one per increment.
export async function consumeTasbeehIncrements(
  now: Date = new Date(),
): Promise<void> {
  if (consuming) return;
  consuming = true;
  let applied = false;
  try {
    const ops = planTasbeehOps(takePendingTasbeeh(), localDayKey(now));
    const store = useAdhkarStore.getState();
    // takePendingTasbeeh clears the native queue, so apply each op on its own
    // and keep going when one fails.
    for (const [dhikrId, op] of Object.entries(ops)) {
      try {
        if (op.reset) {
          await store.resetCount(dhikrId);
          applied = true;
        }
        for (let i = 0; i < op.increments; i++) {
          await store.incrementCount(dhikrId);
          applied = true;
        }
      } catch (error) {
        console.error(
          `[WidgetSync] Failed to apply widget tasbeeh taps for ${dhikrId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error('[WidgetSync] Failed to apply widget tasbeeh taps:', error);
  } finally {
    consuming = false;
  }
  if (applied) flushWidgetSnapshot();
}

function refresh(): void {
  // Ayah of the Day depends only on the date; a push is cheap and repairs a
  // stale ayah (and, on Android, a lost midnight alarm).
  reloadWidgets(['AyahOfTheDay']);
  syncCatalog();
  consumeTasbeehIncrements().catch(error => {
    console.error('[WidgetSync] Tasbeeh sync failed:', error);
  });
  ensureConfiguredArtwork().catch(error => {
    console.error('[WidgetSync] Configured artwork sync failed:', error);
  });
}

// Started by the root layout next to startWidgetSync.
export function startConfiguredWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  refresh();
  const unsubs = [
    // RECITERS is filled in place; the default reciter refresh follows a load.
    useReciterStore.subscribe(() => syncCatalog()),
    useAdhkarStore.subscribe((state, prev) => {
      if (!consuming && state.dhikrCounts !== prev.dhikrCounts) {
        flushWidgetSnapshot();
      }
    }),
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') refresh();
  });
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
  };
}
