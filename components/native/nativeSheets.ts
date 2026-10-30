// @ai-generated
import type {ReactNode} from 'react';

/**
 * Heights a native sheet can rest at. The first is where it opens. `fit`
 * sizes the sheet to its content (a menu), up to the large height.
 */
export type NativeSheetDetent = 'medium' | 'large' | {height: number};
export type NativeSheetSizing = NativeSheetDetent[] | 'fit';

/**
 * Sheets presented as SwiftUI sheets on iPhone (detents, the system grabber,
 * the page behind kept live up to the medium detent). Off: every sheet stays
 * on react-native-actions-sheet. `sheetControl` decides which sheets go
 * native.
 */
export const nativeSheetsEnabled = false;

/** One presented sheet. A sheet shown over another stacks a level. */
export interface NativeSheetLevel {
  key: number;
  id: string;
  content: ReactNode;
  detents: NativeSheetDetent[];
  /** Sized to its content: the content reports its height (`fitNativeSheet`). */
  fit: boolean;
  /** Registered as fitted (its body measures), even while `fit` is off. */
  fitted: boolean;
  /** False while the level animates out. */
  presented: boolean;
}

interface Pending {
  /** Resolves the `presentNativeSheet` promise with the hide result. */
  resolve: (result: unknown) => void;
  result: unknown;
  /** `hideNativeSheet` calls waiting for this level to be gone. */
  waiters: (() => void)[];
}

let levels: NativeSheetLevel[] = [];
const pending = new Map<number, Pending>();
const listeners = new Set<() => void>();
let nextKey = 1;
let hostMounted = false;

function publish(next: NativeSheetLevel[]) {
  levels = next;
  listeners.forEach(listener => listener());
}

export function subscribeNativeSheets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNativeSheetLevels(): NativeSheetLevel[] {
  return levels;
}

/** `NativeSheetHost` (mounted once at the root on iOS) reports itself. */
export function setNativeSheetHostMounted(mounted: boolean): void {
  hostMounted = mounted;
}

export function isNativeSheetPresented(id: string): boolean {
  return levels.some(level => level.id === id && level.presented);
}

/**
 * Resolves once no sheet is animating out. SwiftUI can't present a sheet
 * from one that is being dismissed.
 */
export function nativeSheetsSettled(): Promise<void> {
  const closing = () => levels.some(level => !level.presented);
  if (!closing()) return Promise.resolve();
  return new Promise(resolve => {
    const listener = () => {
      if (closing()) return;
      listeners.delete(listener);
      resolve();
    };
    listeners.add(listener);
  });
}

export function hasNativeSheet(): boolean {
  return levels.some(level => level.presented);
}

/**
 * Presents `content` as a native sheet. With `stack`, it goes over the
 * sheets already up (presented from inside the top one); otherwise it
 * replaces what the top sheet shows. Resolves with the value the sheet is
 * hidden with, once it is gone. Null when no host is mounted, so callers
 * fall back to their React Native sheet.
 */
export function presentNativeSheet(
  id: string,
  content: ReactNode,
  stack: boolean,
  sizing: NativeSheetSizing = ['medium', 'large'],
): Promise<unknown> | null {
  if (!hostMounted) return null;
  const fit = sizing === 'fit';
  // A fitted sheet opens at medium until its content has been measured.
  const detents: NativeSheetDetent[] = fit ? ['medium'] : sizing;
  const top = levels[levels.length - 1];
  const key = nextKey++;
  const promise = new Promise<unknown>(resolve => {
    pending.set(key, {resolve, result: undefined, waiters: []});
  });
  if (!stack && top?.presented) {
    // Replacing: the old content's promise resolves as if it were hidden.
    finish(top.key);
    publish([
      ...levels.slice(0, -1),
      {key, id, content, detents, fit, fitted: fit, presented: true},
    ]);
  } else {
    publish([
      ...levels,
      {key, id, content, detents, fit, fitted: fit, presented: true},
    ]);
  }
  return promise;
}

/**
 * Dismisses the sheet `id` (and anything stacked on it), resolving its
 * `presentNativeSheet` promise with `result`. Resolves once it is fully
 * gone, so a React Native modal shown next never races the dismissal.
 */
export function hideNativeSheet(id: string, result?: unknown): Promise<void> {
  const index = levels.findIndex(level => level.id === id && level.presented);
  if (index < 0) return Promise.resolve();
  const entry = pending.get(levels[index].key);
  if (entry) entry.result = result;
  const gone = new Promise<void>(resolve => {
    if (entry) entry.waiters.push(resolve);
    else resolve();
  });
  publish(
    levels.map((item, i) => (i >= index ? {...item, presented: false} : item)),
  );
  return gone;
}

/**
 * A fitted level's content reports its height (sheet chrome included). Too
 * tall for the screen, the sheet goes full height and its content scrolls.
 */
export function fitNativeSheet(
  key: number,
  height: number,
  maxHeight: number,
): void {
  const detents: NativeSheetDetent[] =
    height >= maxHeight ? ['large'] : [{height: Math.ceil(height)}];
  const level = levels.find(item => item.key === key);
  if (!level?.fit || sameDetents(level.detents, detents)) return;
  publish(levels.map(item => (item.key === key ? {...item, detents} : item)));
}

/**
 * Gives a fitted level fixed detents for a while (a full-screen view inside
 * a menu sheet), or `null` to size it to its content again.
 */
export function setNativeSheetDetents(
  key: number,
  detents: NativeSheetDetent[] | null,
): void {
  publish(
    levels.map(item =>
      item.key !== key || !item.fitted
        ? item
        : detents
          ? {...item, fit: false, detents}
          : {...item, fit: true},
    ),
  );
}

function sameDetents(a: NativeSheetDetent[], b: NativeSheetDetent[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The host reports a level swiped away (no longer presented). */
export function notifyNativeSheetClosing(key: number): void {
  publish(
    levels.map(level =>
      level.key === key ? {...level, presented: false} : level,
    ),
  );
}

/** The host reports a level fully dismissed (by a hide or a swipe). */
export function notifyNativeSheetDismissed(key: number): void {
  const index = levels.findIndex(level => level.key === key);
  if (index < 0) return;
  // Dismissing a level takes every level stacked on it with it.
  levels.slice(index).forEach(level => finish(level.key));
  publish(levels.slice(0, index));
}

function finish(key: number) {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);
  entry.resolve(entry.result);
  entry.waiters.forEach(resolve => resolve());
}
