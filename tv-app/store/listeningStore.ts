import {create} from 'zustand';
import {useTVPlayerStore} from './tvPlayerStore';
import {
  advanceRepeat,
  type VerseRepeat,
  type VerseTimeline,
} from '../services/verseTimeline';
import type {QueueItem} from '../types/player';

/**
 * Listening-room choices that sit on top of the player: repeating a verse or
 * the whole surah. Surah repeat rides the player's own repeat-one; verse
 * repeat is enforced app-wide against the verse timings (see
 * startVerseRepeatSync), so it keeps going while the listener browses.
 */
export type RepeatChoice =
  | {kind: 'off'}
  | {kind: 'verse'; times: number}
  | {kind: 'surah'};

/** The order the Repeat control steps through. */
export const REPEAT_CYCLE: readonly RepeatChoice[] = [
  {kind: 'off'},
  {kind: 'verse', times: 3},
  {kind: 'verse', times: Infinity},
  {kind: 'surah'},
];

export function repeatLabel(choice: RepeatChoice): string {
  switch (choice.kind) {
    case 'off':
      return 'Off';
    case 'surah':
      return 'Surah';
    case 'verse':
      return Number.isFinite(choice.times)
        ? `Verse · ${choice.times}×`
        : 'Verse · ∞';
  }
}

function sameChoice(a: RepeatChoice, b: RepeatChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'verse' && b.kind === 'verse') return a.times === b.times;
  return true;
}

/** The choice after `current` in REPEAT_CYCLE, skipping verse repeat without timings. */
export function nextRepeatChoice(
  current: RepeatChoice,
  verseRepeatAvailable: boolean,
): RepeatChoice {
  const options = verseRepeatAvailable
    ? REPEAT_CYCLE
    : REPEAT_CYCLE.filter(c => c.kind !== 'verse');
  const index = options.findIndex(c => sameChoice(c, current));
  return options[(index + 1) % options.length];
}

/** How many times a repeated verse plays in all, as offered in the Repeat panel. */
export const REPEAT_TIMES: readonly number[] = [2, 3, 5, 10, Infinity];

/** Pause before each replay of a repeated verse, for reciting it back. */
export const REPEAT_PAUSES: readonly number[] = [0, 2000, 5000];

export function timesLabel(times: number): string {
  return Number.isFinite(times) ? `${times}×` : '∞';
}

export function pauseLabel(ms: number): string {
  return ms === 0 ? 'None' : `${ms / 1000} s`;
}

/** The settings panel open beside the tray, if any. */
export type PanelKey =
  | 'repeat'
  | 'speed'
  | 'onScreen'
  | 'reciter'
  | 'sleep'
  | 'sound'
  | 'queue'
  | 'save';

/** The footer chip for a repeat choice, or null when repeat is off. */
export function repeatChip(choice: RepeatChoice): string | null {
  switch (choice.kind) {
    case 'off':
      return null;
    case 'surah':
      return 'Repeat surah';
    case 'verse':
      return Number.isFinite(choice.times)
        ? `Repeat verse ${choice.times}×`
        : 'Repeat verse';
  }
}

/** The footer chip for the sleep timer, or null when it is off. */
export function sleepChip(sleepOn: boolean, minutes: number): string | null {
  if (!sleepOn || minutes === 0) return null;
  return minutes < 0 ? 'Sleep at end of surah' : `Sleep ${minutes} min`;
}

/**
 * The small status chips beside the footer's progress line: whatever is
 * changing how this listening sounds, in tray order.
 */
export function footerChips(input: {
  repeat: RepeatChoice;
  speed: number;
  /** The ambience playing, by name, or null. */
  ambient: string | null;
  sleepOn: boolean;
  sleepChoice: number;
}): string[] {
  return [
    repeatChip(input.repeat),
    input.speed !== 1 ? `${input.speed}×` : null,
    input.ambient,
    sleepChip(input.sleepOn, input.sleepChoice),
  ].filter((c): c is string => c !== null);
}

/** Sleep timer steps in minutes; -1 is "end of surah", 0 is off. */
export const SLEEP_CYCLE: readonly number[] = [0, 15, 30, 60, -1];

/** Playback speeds the Speed control steps through. */
export const SPEED_CYCLE: readonly number[] = [
  0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
];

/** The value after `current` in `cycle`, or the first one if it isn't listed. */
export function nextInCycle(cycle: readonly number[], current: number): number {
  const index = cycle.indexOf(current);
  return cycle[(index + 1) % cycle.length];
}

export function sleepLabel(minutes: number): string {
  if (minutes === 0) return 'Off';
  if (minutes < 0) return 'End of surah';
  return `${minutes} min`;
}

type ListeningState = {
  /** Whether the controls tray is up; Back lowers it before leaving the player. */
  trayOpen: boolean;
  setTrayOpen: (open: boolean) => void;
  /** Back closes an open panel before it lowers the tray. */
  panel: PanelKey | null;
  setPanel: (panel: PanelKey | null) => void;
  /**
   * A panel to open again, with the tray, when the player mounts next: the
   * Save panel after the playlist editor it opened (the player unmounts
   * under the editor). The player takes it once.
   */
  reopen: PanelKey | null;
  setReopen: (panel: PanelKey | null) => void;
  /** Milliseconds to wait before each replay of a repeated verse. */
  repeatPauseMs: number;
  setRepeatPause: (ms: number) => void;
  repeat: RepeatChoice;
  /** The sleep step last picked, so the control can show and advance it. */
  sleepChoice: number;
  /** The live verse repeat, set when verse repeat starts on a verse. */
  verseRepeat: VerseRepeat | null;
  setRepeat: (choice: RepeatChoice, currentAyah: number) => void;
  /** Changes how many times the verse repeats without restarting the count. */
  setRepeatTimes: (times: number) => void;
  setVerseRepeat: (repeat: VerseRepeat | null) => void;
  setSleepChoice: (minutes: number) => void;
  /** The track a verse repeat belongs to (see itemKey); another track ends it. */
  repeatKey: string | null;
  /** The verse timings the listening room last loaded, and for which track. */
  timeline: {key: string; timeline: VerseTimeline | null} | null;
  setTimeline: (key: string, timeline: VerseTimeline | null) => void;
  reset: () => void;
};

/** Identifies a track: the same surah by another reciter or rewayah differs. */
export function itemKey(item: QueueItem | undefined): string {
  return item ? `${item.reciterId}:${item.rewayahId}:${item.surahNumber}` : '';
}

function currentKey(): string {
  const {queue, currentIndex} = useTVPlayerStore.getState();
  return itemKey(queue[currentIndex]);
}

export const useListeningStore = create<ListeningState>(set => ({
  trayOpen: false,
  setTrayOpen: trayOpen => set(trayOpen ? {trayOpen} : {trayOpen, panel: null}),
  panel: null,
  setPanel: panel => set({panel}),
  reopen: null,
  setReopen: reopen => set({reopen}),
  repeatPauseMs: 0,
  setRepeatPause: repeatPauseMs => set({repeatPauseMs}),
  repeat: {kind: 'off'},
  verseRepeat: null,
  sleepChoice: 0,
  repeatKey: null,
  timeline: null,

  setRepeat: (choice, currentAyah) => {
    useTVPlayerStore
      .getState()
      .setRepeat(choice.kind === 'surah' ? 'one' : 'off');
    // During the opening (the basmala, verse 0) "this verse" is verse 1.
    const verse = choice.kind === 'verse';
    set({
      repeat: choice,
      verseRepeat: verse
        ? {ayah: Math.max(1, currentAyah), times: choice.times, played: 0}
        : null,
      repeatKey: verse ? currentKey() : null,
    });
  },

  setRepeatTimes: times =>
    set(state => ({
      repeat: {kind: 'verse', times},
      verseRepeat: state.verseRepeat ? {...state.verseRepeat, times} : null,
    })),

  setVerseRepeat: verseRepeat => set({verseRepeat}),

  setSleepChoice: minutes => {
    useTVPlayerStore.getState().setSleep(minutes);
    set({sleepChoice: minutes});
  },

  setTimeline: (key, timeline) => {
    const current = useListeningStore.getState().timeline;
    if (current?.key === key && current.timeline === timeline) return;
    set({timeline: {key, timeline}});
  },

  reset: () => {
    useTVPlayerStore.getState().setRepeat('off');
    set({
      trayOpen: false,
      panel: null,
      reopen: null,
      repeatPauseMs: 0,
      repeat: {kind: 'off'},
      verseRepeat: null,
      sleepChoice: 0,
      repeatKey: null,
      timeline: null,
    });
  },
}));

/** Positions reported this soon after a seek may still be from before it. */
const SEEK_SETTLE_MS = 600;
let lastSeekAt = 0;

/** Call on any seek inside the surah, so stale positions don't count. */
export function noteRepeatSeek(): void {
  lastSeekAt = Date.now();
}

/**
 * Verse repeat, checked on every position update: sends playback back to the
 * verse start until the count runs out, then lets it carry on. With a pause
 * set, the player holds at the verse start before each replay so the
 * listener can recite it back. Exported for tests; startVerseRepeatSync runs
 * it.
 */
export function checkVerseRepeat(): void {
  const listening = useListeningStore.getState();
  const {verseRepeat, repeatKey, timeline, repeatPauseMs} = listening;
  if (!verseRepeat) return;
  const key = currentKey();
  // A new surah (or reciter) ends the verse repeat from the last one.
  if (repeatKey !== null && key !== repeatKey) {
    listening.setRepeat({kind: 'off'}, 0);
    return;
  }
  const player = useTVPlayerStore.getState();
  if (player.pending || player.held || player.status !== 'playing') return;
  if (!timeline?.timeline || timeline.key !== key) return;
  if (Date.now() - lastSeekAt < SEEK_SETTLE_MS) return;
  const result = advanceRepeat(
    timeline.timeline,
    verseRepeat,
    player.positionSeconds * 1000,
  );
  if (result.seekToMs !== null) {
    noteRepeatSeek();
    player.seekTo(result.seekToMs / 1000);
    listening.setVerseRepeat(result.repeat);
    if (repeatPauseMs > 0) player.hold(repeatPauseMs);
  } else if (result.done) {
    listening.setRepeat({kind: 'off'}, 0);
  }
}

let repeatSyncStarted = false;

/** Starts enforcing verse repeat app-wide; safe to call more than once. */
export function startVerseRepeatSync(): void {
  if (repeatSyncStarted) return;
  repeatSyncStarted = true;
  useTVPlayerStore.subscribe((state, prev) => {
    if (
      state.positionSeconds !== prev.positionSeconds ||
      state.currentIndex !== prev.currentIndex ||
      state.queue !== prev.queue
    ) {
      checkVerseRepeat();
    }
  });
}
