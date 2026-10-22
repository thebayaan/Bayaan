// @ai-start
/**
 * Pure helpers behind the Moments feed's paging and playback: which page the
 * list is settling on, which idle players to load neighbors into, and whether
 * a playback update changes anything a card shows.
 */

import type {MomentsPlaybackState} from './MomentsAudioService';

/** The page an offset is closest to, clamped to the list. */
export function pageAt(
  offset: number,
  pageHeight: number,
  count: number,
): number {
  if (pageHeight <= 0 || count <= 0) return 0;
  const page = Math.round(offset / pageHeight);
  return Math.min(Math.max(page, 0), count - 1);
}

/**
 * Decides the active page as early as it is known, so audio can switch
 * before the list stops moving:
 * - on release, when the platform gives the snap target (iOS), that page,
 *   at most one page from where the drag began;
 * - during the snap or a programmatic scroll, the page the offset crosses
 *   into while moving toward it (never while the finger is still down, and
 *   never on a snap back, so audio does not flip back and forth);
 * - when momentum ends, the page the list landed on.
 * Each method returns the page to make active, or null to leave it as is.
 */
export class PageTracker {
  private dragging = false;
  private target: number | null = null;
  private pageHeight: number;
  private count: number;
  /** The last offset seen, to tell which way the list is moving. */
  private lastOffset = 0;
  /** The page the current drag started on. */
  private dragStartPage = 0;

  constructor(pageHeight: number, count: number) {
    this.pageHeight = pageHeight;
    this.count = count;
  }

  setLayout(pageHeight: number, count: number): void {
    this.pageHeight = pageHeight;
    this.count = count;
  }

  beginDrag(offset?: number): null {
    this.dragging = true;
    this.target = null;
    if (offset != null) this.lastOffset = offset;
    this.dragStartPage = pageAt(this.lastOffset, this.pageHeight, this.count);
    return null;
  }

  endDrag(offset: number, targetOffset?: number | null): number | null {
    this.dragging = false;
    this.lastOffset = offset;
    if (targetOffset != null) {
      // Paging moves one page per swipe at most, whatever the target says.
      const page = pageAt(targetOffset, this.pageHeight, this.count);
      this.target = Math.min(
        Math.max(page, this.dragStartPage - 1),
        this.dragStartPage + 1,
      );
      return this.target;
    }
    // Released right on a page: no snap will follow.
    const page = pageAt(offset, this.pageHeight, this.count);
    return Math.abs(offset - page * this.pageHeight) < 1 ? page : null;
  }

  /** A scroll the app started (auto-advance), heading for `page`. */
  expect(page: number): void {
    this.target = page;
  }

  scroll(offset: number): number | null {
    const heading = offset - this.lastOffset;
    this.lastOffset = offset;
    if (this.dragging || this.target !== null) return null;
    const page = pageAt(offset, this.pageHeight, this.count);
    const toPage = page * this.pageHeight - offset;
    // Only a page the list is moving toward (or resting on): a snap back
    // from just past the midpoint must not flip to the page it is leaving.
    if (Math.abs(toPage) < 1 || toPage * heading > 0) return page;
    return null;
  }

  endMomentum(offset: number): number {
    this.target = null;
    this.lastOffset = offset;
    return pageAt(offset, this.pageHeight, this.count);
  }
}

/**
 * Which slots to load which wanted keys into. Slots already holding a wanted
 * key keep it, the active slot is never touched, and the rest are filled in
 * the order `wanted` lists (most important first).
 */
export function planPreload(
  slotKeys: (string | null)[],
  activeSlot: number,
  wanted: string[],
): {slot: number; key: string}[] {
  const taken = new Set<number>([activeSlot]);
  const missing: string[] = [];
  for (const key of new Set(wanted)) {
    if (slotKeys[activeSlot] === key) continue;
    const held = slotKeys.findIndex((k, i) => k === key && !taken.has(i));
    if (held >= 0) taken.add(held);
    else missing.push(key);
  }
  const plan: {slot: number; key: string}[] = [];
  for (const key of missing) {
    const free = slotKeys.findIndex((_, i) => !taken.has(i));
    if (free < 0) break;
    taken.add(free);
    plan.push({slot: free, key});
  }
  return plan;
}

/** Whether two playback states show the same thing on a card. */
export function samePlayback(
  a: MomentsPlaybackState | null | undefined,
  b: MomentsPlaybackState | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.key === b.key &&
    a.positionMs === b.positionMs &&
    a.playing === b.playing &&
    a.buffering === b.buffering
  );
}

/**
 * Props comparator for a memoized card: shallow, except `playback`, which is
 * a fresh object on every status tick and is compared by value.
 */
export function cardPropsEqual<P extends {playback?: unknown}>(
  prev: P,
  next: P,
): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (key === 'playback') continue;
    if (prev[key as keyof P] !== next[key as keyof P]) return false;
  }
  return samePlayback(
    prev.playback as MomentsPlaybackState | null | undefined,
    next.playback as MomentsPlaybackState | null | undefined,
  );
}
// @ai-end
