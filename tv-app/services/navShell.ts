/**
 * The navigation shell's rules, kept free of React so they can be tested:
 * which screens stay mounted under a stacked screen, where the now-playing
 * pill shows, and what the remote's Back does next.
 */
import type {ScreenEntry, TabKey} from '../store/navStore';
import {screenOwnsPlayPause} from './remoteKeys';

export type StackLayer = {
  entry: ScreenEntry;
  /** Stable while the entry stays at this depth, so it is never remounted. */
  key: string;
  /** The top of the stack: shown and focusable. */
  active: boolean;
};

/**
 * The stacked screens to render, bottom first. Every covered screen stays
 * mounted (hidden) so Back returns to its exact focus, scroll and state,
 * except the two that play audio and handle the remote's keys while
 * mounted (see screenOwnsPlayPause): the player, whose state lives in the
 * player store, and the adhkar reader, whose session (and place in the
 * list) the session store keeps. Unmounting stops the reader's recitation,
 * so it never plays over the player opened from it; both remount when
 * uncovered.
 */
export function stackLayers(stack: readonly ScreenEntry[]): StackLayer[] {
  const top = stack.length - 1;
  const layers: StackLayer[] = [];
  stack.forEach((entry, i) => {
    if (i < top && screenOwnsPlayPause(entry)) return;
    layers.push({
      entry,
      key: `${i}:${JSON.stringify(entry)}`,
      active: i === top,
    });
  });
  return layers;
}

/**
 * Stacked screens that show the now-playing pill, the way back to the player
 * from screens without the sidebar. Not the player itself, and not the
 * playlist editor (a form, left with Back).
 */
export function showsNowPlayingPill(entry: ScreenEntry): boolean {
  return (
    entry.screen === 'reciterDetail' ||
    entry.screen === 'playlist' ||
    entry.screen === 'adhkarReader'
  );
}

export type BackState = {
  stack: readonly ScreenEntry[];
  tab: TabKey;
  menuOpen: boolean;
  overlayOpen: boolean;
  /** The listening room's settings panel and tray (player only). */
  panelOpen: boolean;
  trayOpen: boolean;
  /** Settings' side picker (Settings only). */
  pickerOpen: boolean;
  sidebarFocused: boolean;
};

export type BackStep =
  | 'closeMenu'
  | 'closeOverlay'
  | 'closePanel'
  | 'closePicker'
  | 'lowerTray'
  | 'pop'
  | 'focusSidebar'
  | 'goHome'
  | 'exit';

/**
 * What Back does (after a screen's own handler passed): close what is open
 * on top, then go back a screen. On a root place it steps out one level at a
 * time: from the content to the sidebar, from another place to Home, and
 * only from Home's sidebar out of the app, so a press deep in a rail never
 * leaves while a recitation plays.
 */
export function backStep(s: BackState): BackStep {
  const top = s.stack[s.stack.length - 1];
  if (s.menuOpen) return 'closeMenu';
  if (s.overlayOpen) return 'closeOverlay';
  if (top?.screen === 'nowPlaying') {
    if (s.panelOpen) return 'closePanel';
    if (s.trayOpen) return 'lowerTray';
  }
  if (top) return 'pop';
  if (s.tab === 'settings' && s.pickerOpen) return 'closePicker';
  if (!s.sidebarFocused) return 'focusSidebar';
  if (s.tab !== 'home') return 'goHome';
  return 'exit';
}
