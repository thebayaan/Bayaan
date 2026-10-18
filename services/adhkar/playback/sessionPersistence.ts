// Saved adhkar session (spec 3.5): survives app restarts until it is
// finished, closed, or stale.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {nextWindowBoundaryAfter} from '@/services/adhkar/timeWindows';
import {toSessionItems} from './sessionReducer';
import type {AdhkarSession, SavedSession, SessionItem} from './types';

const STORAGE_KEY = 'adhkar-session-v1';
const OTHER_LIST_TTL_MS = 24 * 60 * 60 * 1000;
const PERIOD_LISTS = new Set(['morning-adhkar', 'evening-adhkar']);

export function toSavedSession(session: AdhkarSession): SavedSession | null {
  const item = session.items[session.index];
  if (!item) return null;
  return {
    listId: session.listId,
    listTitle: session.listTitle,
    mode: session.mode,
    loop: session.loop,
    dhikrId: item.dhikrId,
    positionSec: session.positionSec,
    lastActiveAt: session.lastActiveAt,
  };
}

export function isSavedSessionStale(saved: SavedSession, now: number): boolean {
  if (PERIOD_LISTS.has(saved.listId)) {
    return now >= nextWindowBoundaryAfter(saved.lastActiveAt);
  }
  return now >= saved.lastActiveAt + OTHER_LIST_TTL_MS;
}

function isSavedSession(value: unknown): value is SavedSession {
  if (typeof value !== 'object' || value === null) return false;
  const v: Record<string, unknown> = {...value};
  return (
    typeof v.listId === 'string' &&
    typeof v.listTitle === 'string' &&
    (v.mode === 'single' || v.mode === 'all') &&
    typeof v.loop === 'boolean' &&
    typeof v.dhikrId === 'string' &&
    typeof v.positionSec === 'number' &&
    typeof v.lastActiveAt === 'number'
  );
}

export async function saveSession(
  session: AdhkarSession | null,
): Promise<void> {
  const saved = session ? toSavedSession(session) : null;
  if (!saved) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export async function loadSavedSession(): Promise<SavedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function loadListItems(listId: string): Promise<SessionItem[] | null> {
  if (listId === 'saved') {
    const saved = await adhkarService.getSaved();
    const rows = await Promise.all(
      saved.map(s => adhkarService.getDhikr(s.dhikrId)),
    );
    return toSessionItems(rows.filter(row => row !== null));
  }
  const data = await adhkarService.getAdhkarForSuperCategory(listId);
  if (!data) return null;
  return toSessionItems(data.categoryGroups.flatMap(g => g.adhkar));
}

// Settles once per process, when the launch restore finishes (or fails).
let markRestoreSettled: () => void = () => undefined;
const restoreSettled = new Promise<void>(resolve => {
  markRestoreSettled = resolve;
});

/**
 * Resolves when the launch restore has settled, or after timeoutMs. The
 * bayaan://adhkar-playing route waits on it during a cold launch.
 */
export function waitForSessionRestore(timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    restoreSettled.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function restoreNow(
  loadItems: (listId: string) => Promise<SessionItem[] | null>,
): Promise<void> {
  const saved = await loadSavedSession();
  if (!saved) return;
  if (isSavedSessionStale(saved, Date.now())) {
    await saveSession(null);
    return;
  }
  const items = await loadItems(saved.listId);
  const index = items?.findIndex(i => i.dhikrId === saved.dhikrId) ?? -1;
  if (!items || index < 0) {
    await saveSession(null);
    return;
  }
  // A session started meanwhile (the user pressed play during launch) wins.
  if (useAdhkarSessionStore.getState().session) return;
  useAdhkarSessionStore.getState().dispatch({
    type: 'restored',
    session: {
      listId: saved.listId,
      listTitle: saved.listTitle,
      items,
      index,
      mode: saved.mode,
      loop: saved.loop,
      status: 'paused',
      error: false,
      trackToken: 1,
      positionSec: saved.positionSec,
      lastActiveAt: saved.lastActiveAt,
    },
  });
}

/** Rebuilds the saved session as paused, or drops it (stale, list gone, dhikr gone). */
export async function restoreSavedSession(
  loadItems: (listId: string) => Promise<SessionItem[] | null> = loadListItems,
): Promise<void> {
  try {
    await restoreNow(loadItems);
  } finally {
    markRestoreSettled();
  }
}

/** Drops the live session if it is paused and stale (foreground return, tile render). */
export function dropStaleSession(now: number): void {
  const {session, dispatch} = useAdhkarSessionStore.getState();
  if (!session || session.status !== 'paused') return;
  const saved = toSavedSession(session);
  if (saved && isSavedSessionStale(saved, now)) dispatch({type: 'stop'});
}

/**
 * Saves on track change, status change, session end and app background, not
 * on every progress tick. Returns an unsubscribe function.
 */
export function startSessionSaving(): () => void {
  const unsubscribe = useAdhkarSessionStore.subscribe((state, prev) => {
    const a = state.session;
    const b = prev.session;
    if (a === b) return;
    if (
      !a ||
      !b ||
      a.trackToken !== b.trackToken ||
      a.status !== b.status ||
      a.positionSec !== b.positionSec ||
      a.loop !== b.loop
    ) {
      saveSession(a).catch(() => {});
    }
  });
  const appState = AppState.addEventListener('change', next => {
    if (next === 'active') {
      dropStaleSession(Date.now());
      return;
    }
    // Saving is best effort; a failed write must not crash the app.
    saveSession(useAdhkarSessionStore.getState().session).catch(() => {});
  });
  return () => {
    unsubscribe();
    appState.remove();
  };
}
