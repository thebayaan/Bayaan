// services/widgets/syncWidgets.ts
import {AppState, Platform} from 'react-native';
import {
  changedWidgetKinds,
  isWidgetsAvailable,
  reloadWidgets,
  writeSnapshot,
  cacheArtwork,
  hasArtwork,
  addWidgetCommandListener,
  takeQueuedCommands,
  selectFreshCommands,
  markCommandsHandled,
  WidgetKind,
  WidgetSnapshot,
} from 'bayaan-widgets';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useReciterStore} from '@/store/reciterStore';
import {useThemeStore} from '@/store/themeStore';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore'; // @ai
import {getReciterByIdSync} from '@/services/dataService';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {
  buildSnapshot,
  artworkFileName,
  cardSurahId,
  surahArtworkFileName,
  surahArtworkUrl,
} from './buildSnapshot';
import {collectSnapshotInput} from './collectSnapshotInput';
import {handleWidgetCommand} from './handleWidgetCommand';
import {noteSnapshotForLiveActivity} from './live-activity/syncLiveActivity';
import {enabledKinds} from './enabledWidgets';

const DEBOUNCE_MS = 1000;
const ARTWORK_RETRY_MS = 10 * 60 * 1000;
// Widgets showing artwork that the snapshot does not reference. They render
// from the shared artwork cache, so a file cached here can be one they wait on.
export const ARTWORK_KINDS: WidgetKind[] = [
  'QuickSurah',
  'PinnedReciter',
  'ContinueReading',
];

let lastSnapshot: WidgetSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let playerReady = false;
// Set once restoreSession has populated the queue and saved position, so a
// cold-start command does not run against an empty or stale player store.
let sessionRestored = false;
const artworkFailures = new Map<string, number>();
const artworkInFlight = new Set<string>();

type SnapshotListener = (
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
) => void;
const snapshotListeners = new Set<SnapshotListener>();

// Phase 3 widgets reload from the same written snapshots (syncContentWidgets).
export function addSnapshotListener(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

function notifySnapshotListeners(
  prev: WidgetSnapshot | null,
  next: WidgetSnapshot,
): void {
  for (const listener of snapshotListeners) {
    try {
      listener(prev, next);
    } catch (error) {
      console.error('[WidgetSync] Snapshot listener failed:', error);
    }
  }
}

// Surah cards for every track, plus reciter photos as their fallback.
function artworkJobs(snapshot: WidgetSnapshot): Map<string, string> {
  const jobs = new Map<string, string>();
  const reciterIds = new Set<string>();
  const tracks = [
    ...(snapshot.nowPlaying ? [snapshot.nowPlaying.track] : []),
    ...snapshot.upNext,
    ...snapshot.recent,
  ];
  for (const t of tracks) {
    const cardId = cardSurahId(t.surahId, t.isUserUpload);
    if (cardId !== null)
      jobs.set(surahArtworkFileName(cardId), surahArtworkUrl(cardId));
    if (!t.isUserUpload && t.reciterId) reciterIds.add(t.reciterId);
  }
  if (snapshot.defaultReciter) reciterIds.add(snapshot.defaultReciter.id);
  for (const id of reciterIds) {
    const file = artworkFileName(id);
    if (hasArtwork(file)) continue;
    const reciter = getReciterByIdSync(id);
    if (!reciter) continue;
    const url = getReciterArtwork(reciter);
    if (!url.startsWith('data:')) jobs.set(file, url);
  }
  return jobs;
}

async function ensureArtwork(snapshot: WidgetSnapshot): Promise<boolean> {
  let added = false;
  for (const [file, url] of artworkJobs(snapshot)) {
    if (hasArtwork(file)) continue;
    const failedAt = artworkFailures.get(url);
    if (failedAt !== undefined && Date.now() - failedAt < ARTWORK_RETRY_MS)
      continue;
    if (artworkInFlight.has(url)) continue;
    artworkInFlight.add(url);
    try {
      const ok = await cacheArtwork(url, file);
      if (ok) {
        artworkFailures.delete(url);
        added = true;
      } else {
        artworkFailures.set(url, Date.now());
      }
    } catch (error) {
      artworkFailures.set(url, Date.now());
      console.error('[WidgetSync] Failed to cache artwork:', error);
    } finally {
      artworkInFlight.delete(url);
    }
  }
  return added;
}

// forceContinueListening writes and reloads Continue Listening even when
// nothing changed, so a fresh generatedAt supersedes a widget's optimistic
// playback override after a command that turned out to be a no-op.
export function flushWidgetSnapshot(forceContinueListening = false): void {
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    const next = buildSnapshot(collectSnapshotInput(new Date()));
    const prev = lastSnapshot;
    const changed = changedWidgetKinds(prev, next);
    const kinds =
      forceContinueListening && !changed.includes('ContinueListening')
        ? [...changed, 'ContinueListening' as const]
        : changed;
    // Adhkar playback has no WidgetKind; the content sync reloads its widgets. // @ai
    const adhkarChanged = // @ai
      JSON.stringify(prev?.adhkar ?? null) !== JSON.stringify(next.adhkar); // @ai
    if (kinds.length === 0 && !adhkarChanged) return; // @ai
    writeSnapshot(next);
    reloadWidgets(enabledKinds(kinds));
    lastSnapshot = next;
    notifySnapshotListeners(prev, next);
    noteSnapshotForLiveActivity(next);
    // Artwork arrives async; rebuild once so the snapshot references the
    // files. The diff against lastSnapshot picks up the new artworkFile.
    ensureArtwork(next)
      .then(added => {
        if (!added) return;
        flushWidgetSnapshot();
        reloadWidgets(enabledKinds(ARTWORK_KINDS));
      })
      .catch(error => {
        console.error('[WidgetSync] Artwork sync failed:', error);
      });
  } catch (error) {
    console.error('[WidgetSync] Failed to flush snapshot:', error);
  }
}

// Trailing throttle: the first change starts the timer and later changes do
// not reset it, so continuous updates (playback ticks) still flush every
// DEBOUNCE_MS. Android pauses JS timers while the app is backgrounded, so
// flush right away then; changedWidgetKinds keeps playback ticks from writing.
// iOS keeps timers running during background audio, so it keeps the throttle.
function schedule(): void {
  if (Platform.OS === 'android' && AppState.currentState === 'background') {
    flushWidgetSnapshot();
    return;
  }
  if (timer) return;
  timer = setTimeout(flushWidgetSnapshot, DEBOUNCE_MS);
}

let draining = false;
let redrainRequested = false;

export async function drainWidgetCommands(): Promise<void> {
  if (!playerReady || !sessionRestored) return;
  if (draining) {
    redrainRequested = true;
    return;
  }
  draining = true;
  let handled = 0;
  let takenThrough = 0; // @ai
  try {
    do {
      redrainRequested = false;
      // @ai-start
      const taken = takeQueuedCommands();
      for (const q of taken) {
        takenThrough = Math.max(takenThrough, q.enqueuedAt);
      }
      for (const command of selectFreshCommands(taken, Date.now())) {
        // @ai-end
        handled += 1;
        try {
          await handleWidgetCommand(command);
        } catch (error) {
          console.error('[WidgetSync] Failed to handle widget command:', error);
        }
      }
    } while (redrainRequested);
  } finally {
    draining = false;
    // @ai-start
    // Stale commands count too: their intents are waiting all the same.
    if (takenThrough > 0) markCommandsHandled(takenThrough);
    // @ai-end
  }
  if (handled > 0) flushWidgetSnapshot(true);
}

export function markPlayerReadyForWidgets(): void {
  playerReady = true;
  void drainWidgetCommands();
}

export function markSessionRestoredForWidgets(): void {
  sessionRestored = true;
  void drainWidgetCommands();
}

// The root layout starts sync only after restoreSession has finished.
export function startWidgetSync(): () => void {
  if (!isWidgetsAvailable()) return () => undefined;
  markSessionRestoredForWidgets();
  const unsubs = [
    usePlayerStore.subscribe(schedule),
    useRecentlyPlayedStore.subscribe(schedule),
    useReciterStore.subscribe(schedule),
    useThemeStore.subscribe(schedule),
    useAdhkarSessionStore.subscribe(schedule), // @ai
  ];
  const appState = AppState.addEventListener('change', state => {
    if (state === 'background') flushWidgetSnapshot();
    if (state === 'active') void drainWidgetCommands();
  });
  const commands = addWidgetCommandListener(() => void drainWidgetCommands());
  schedule();
  return () => {
    unsubs.forEach(u => u());
    appState.remove();
    commands.remove();
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
