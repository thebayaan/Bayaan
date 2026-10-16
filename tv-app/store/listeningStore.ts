import {create} from 'zustand';
import {useTVPlayerStore} from './tvPlayerStore';
import type {VerseRepeat} from '../services/verseTimeline';

/**
 * Listening-room choices that sit on top of the player: repeating a verse or
 * the whole surah. Surah repeat rides the player's own repeat-one; verse
 * repeat is enforced by the listening room against the verse timings.
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
  | 'queue';

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
  reset: () => void;
};

export const useListeningStore = create<ListeningState>(set => ({
  trayOpen: false,
  setTrayOpen: trayOpen => set(trayOpen ? {trayOpen} : {trayOpen, panel: null}),
  panel: null,
  setPanel: panel => set({panel}),
  repeatPauseMs: 0,
  setRepeatPause: repeatPauseMs => set({repeatPauseMs}),
  repeat: {kind: 'off'},
  verseRepeat: null,
  sleepChoice: 0,

  setRepeat: (choice, currentAyah) => {
    useTVPlayerStore
      .getState()
      .setRepeat(choice.kind === 'surah' ? 'one' : 'off');
    set({
      repeat: choice,
      verseRepeat:
        choice.kind === 'verse' && currentAyah > 0
          ? {ayah: currentAyah, times: choice.times, played: 0}
          : null,
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

  reset: () => {
    useTVPlayerStore.getState().setRepeat('off');
    set({
      trayOpen: false,
      panel: null,
      repeatPauseMs: 0,
      repeat: {kind: 'off'},
      verseRepeat: null,
      sleepChoice: 0,
    });
  },
}));
