// The adhkar reader's session: one list open at a time, its counts, and its
// own audio engine for the recitations (kept apart from the Quran player;
// audioFocus.ts pauses the Quran while a dhikr plays). Built by a factory so
// tests can hand in a fake engine; adhkarSessionStore.ts wires the real one.
import {create, type StoreApi, type UseBoundStore} from 'zustand';
import type {AudioEngine, EngineEvent} from '../services/audioEngineTypes';
import {
  next as nextDhikr,
  prev as prevDhikr,
  press as pressDhikr,
  restart as restartSession,
  isUnderway,
  startSession,
  trackEnded,
  type AdvanceMode,
  type SessionState,
} from './adhkarSession';

export type {AdvanceMode};

/** After OK completes a dhikr, the full ring shows this long before moving on. */
export const ADVANCE_DELAY_MS = 650;
/** Silence between repetitions of one dhikr (auto-advance). */
export const REPLAY_GAP_MS = 600;
/** Silence before the next dhikr starts (auto-advance). */
export const NEXT_GAP_MS = 1200;

export type AdhkarAudio =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type AdhkarSessionStore = {
  session: SessionState | null;
  /** Recitation URL of each dhikr (null when it has none). */
  urls: readonly (string | null)[];
  /** The viewer's own Auto-advance choice, kept between visits. */
  autoAdvance: boolean;
  /**
   * How this visit advances when a start mode chose it ("Listen through",
   * "Count each for me"); null follows `autoAdvance`. Never persisted.
   */
  sessionAdvance: AdvanceMode | null;
  audio: AdhkarAudio;
  /** The listener wants recitations to play as they move through the list. */
  wantsAudio: boolean;
  /** The list picked up where it was left earlier today. */
  resumed: boolean;

  open: (
    listId: string,
    targets: readonly number[],
    urls: readonly (string | null)[],
    options?: {autoplay?: boolean; advance?: AdvanceMode},
  ) => void;
  /** OK: count one, moving on when the count is reached. */
  press: () => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  togglePlay: () => void;
  /** The Auto-advance chip: this visit's mode when one was chosen, else the
   *  viewer's saved choice. */
  setAutoAdvance: (on: boolean) => void;
  close: () => void;
};

type Options = {
  createEngine: () => AudioEngine;
  /** Where the auto-advance choice is kept between visits. */
  loadAutoAdvance?: () => boolean | null;
  saveAutoAdvance?: (on: boolean) => void;
  /** Today's date key, so a list left part way resumes the same day only. */
  dayKey?: () => string;
};

/** How the session advances as a recitation ends, all choices applied. */
export function advanceModeOf(state: {
  autoAdvance: boolean;
  sessionAdvance: AdvanceMode | null;
}): AdvanceMode {
  return state.sessionAdvance ?? (state.autoAdvance ? 'count' : 'off');
}

function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function createAdhkarSessionStore({
  createEngine,
  loadAutoAdvance = () => null,
  saveAutoAdvance = () => {},
  dayKey = localDayKey,
}: Options): UseBoundStore<StoreApi<AdhkarSessionStore>> {
  let engine: AudioEngine | null = null;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Bumped by every load, replay and stop, so a late promise from an older
  // one never starts audio.
  let token = 0;
  // The clip's end may be reported once per play; `armed` waits until the
  // clip is seen away from its end, so a stale position can't end it early.
  let endHandled = true;
  let armed = false;
  let lastPosition = -1;
  let loadedIndex = -1;
  // OK was pressed while this recitation played: its end doesn't count again.
  let countedThisPlay = false;
  // The advance a start mode chose for this visit, for the chip to turn back on.
  let plannedAdvance: AdvanceMode | null = null;
  // Lists left part way, per day, so reopening one picks up where it was.
  const left = new Map<string, {day: string; state: SessionState}>();

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function schedule(ms: number, fn: () => void): void {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  }

  return create<AdhkarSessionStore>((set, get) => {
    function ensureEngine(): AudioEngine {
      if (engine) return engine;
      const made = createEngine();
      engine = made;
      unsubscribe = made.subscribe(onEvent);
      return made;
    }

    function onEvent(e: EngineEvent): void {
      const {audio} = get();
      if (audio !== 'playing') return;
      if (e.status === 'error') {
        token += 1;
        set({audio: 'error'});
        return;
      }
      const known = e.durationSeconds > 0;
      const atEnd = known && e.positionSeconds >= e.durationSeconds - 1;
      if (e.status === 'paused') {
        // A media element reports a pause as it reaches the end.
        if (atEnd && armed && !endHandled) {
          endHandled = true;
          onTrackEnded();
        } else if (!atEnd && armed) {
          // Another engine took the player (the Quran started): stand down.
          token += 1;
          clearTimer();
          set({audio: 'paused', wantsAudio: false});
        }
        return;
      }
      if (known && e.positionSeconds < e.durationSeconds - 0.5) armed = true;
      const nearEnd = known && e.positionSeconds >= e.durationSeconds - 0.25;
      const stalled = atEnd && e.positionSeconds === lastPosition;
      lastPosition = e.positionSeconds;
      if (endHandled || !armed) return;
      if (nearEnd || stalled || e.status === 'idle') {
        endHandled = true;
        onTrackEnded();
      }
    }

    function onTrackEnded(): void {
      const {session} = get();
      if (!session) return;
      armed = false;
      const result = trackEnded(session, advanceModeOf(get()), countedThisPlay);
      countedThisPlay = false;
      set({session: result.state});
      if (result.action === 'stop') {
        set({audio: 'ended'});
        return;
      }
      if (result.action === 'replay') {
        engine?.seek(0);
        schedule(REPLAY_GAP_MS, replay);
        return;
      }
      schedule(NEXT_GAP_MS, () => {
        const current = get().session;
        if (current) moveTo(nextDhikr(current));
      });
    }

    async function loadCurrent(): Promise<void> {
      const {session, urls} = get();
      if (!session) return;
      const url = urls[session.index] ?? null;
      token += 1;
      const mine = token;
      endHandled = true;
      armed = false;
      countedThisPlay = false;
      lastPosition = -1;
      loadedIndex = -1;
      if (!url) {
        set({audio: 'idle'});
        return;
      }
      set({audio: 'loading'});
      const audioEngine = ensureEngine();
      try {
        await audioEngine.load(url);
        if (mine !== token) return;
        loadedIndex = session.index;
        await audioEngine.play();
        if (mine !== token) return;
        endHandled = false;
        set({audio: 'playing'});
      } catch {
        if (mine === token) set({audio: 'error'});
      }
    }

    async function replay(): Promise<void> {
      if (!engine) return;
      token += 1;
      const mine = token;
      endHandled = true;
      armed = false;
      countedThisPlay = false;
      lastPosition = -1;
      try {
        await engine.play();
        if (mine !== token) return;
        endHandled = false;
        set({audio: 'playing'});
      } catch {
        if (mine === token) set({audio: 'error'});
      }
    }

    function stopAudio(audio: AdhkarAudio): void {
      token += 1;
      endHandled = true;
      engine?.pause();
      set({audio});
    }

    function remember(state: SessionState): void {
      if (state.finished) left.delete(state.listId);
      else left.set(state.listId, {day: dayKey(), state});
    }

    function moveTo(state: SessionState): void {
      clearTimer();
      const before = get().session;
      set({session: state});
      remember(state);
      if (state.finished) {
        stopAudio('ended');
        return;
      }
      if (before && before.index === state.index && !before.finished) return;
      if (get().wantsAudio) void loadCurrent();
      else stopAudio('idle');
    }

    return {
      session: null,
      urls: [],
      // Off until the viewer turns it on, like the phone's explicit Play all.
      autoAdvance: loadAutoAdvance() ?? false,
      sessionAdvance: null,
      audio: 'idle',
      wantsAudio: false,
      resumed: false,

      open: (listId, targets, urls, options = {}) => {
        get().close();
        const saved = left.get(listId);
        const resumable =
          saved &&
          saved.day === dayKey() &&
          saved.state.targets.length === targets.length;
        const session = resumable
          ? saved.state
          : startSession(listId, targets, 0);
        const autoplay = options.autoplay ?? true;
        plannedAdvance = options.advance ?? null;
        set({
          session,
          urls,
          audio: 'idle',
          wantsAudio: autoplay,
          sessionAdvance: plannedAdvance,
          resumed: isUnderway(session),
        });
        if (autoplay && targets.length > 0) void loadCurrent();
      },

      press: () => {
        const {session, audio} = get();
        if (!session) return;
        // Counting along with a recitation that counts itself: this press is
        // its saying, so the clip's end must not count it again.
        if (audio === 'playing' && advanceModeOf(get()) !== 'off') {
          countedThisPlay = true;
        }
        const result = pressDhikr(session);
        set({session: result.state});
        remember(result.state);
        if (!result.advance) return;
        schedule(ADVANCE_DELAY_MS, () => {
          const current = get().session;
          if (current) moveTo(nextDhikr(current));
        });
      },

      next: () => {
        const {session} = get();
        if (session) moveTo(nextDhikr(session));
      },

      prev: () => {
        const {session} = get();
        if (!session) return;
        if (session.finished) {
          // Back from the closing card: the last dhikr shows, quietly.
          const reopened = prevDhikr(session);
          clearTimer();
          set({session: reopened});
          remember(reopened);
          stopAudio('idle');
          return;
        }
        moveTo(prevDhikr(session));
      },

      restart: () => {
        const {session} = get();
        if (!session) return;
        clearTimer();
        const fresh = restartSession(session);
        set({session: fresh, resumed: false});
        remember(fresh);
        if (get().wantsAudio) void loadCurrent();
        else stopAudio('idle');
      },

      togglePlay: () => {
        const {audio, session} = get();
        if (!session || session.finished) return;
        if (audio === 'playing' || audio === 'loading') {
          clearTimer();
          stopAudio('paused');
          set({wantsAudio: false});
          return;
        }
        set({wantsAudio: true});
        if (audio === 'paused' && loadedIndex === session.index && engine) {
          const resume = engine;
          token += 1;
          const mine = token;
          set({audio: 'playing'});
          resume.play().then(
            () => {
              if (mine === token) endHandled = false;
            },
            () => {
              if (mine === token) set({audio: 'error'});
            },
          );
          return;
        }
        void loadCurrent();
      },

      setAutoAdvance: on => {
        if (get().sessionAdvance !== null) {
          const planned =
            plannedAdvance && plannedAdvance !== 'off'
              ? plannedAdvance
              : 'count';
          set({sessionAdvance: on ? planned : 'off'});
          return;
        }
        set({autoAdvance: on});
        saveAutoAdvance(on);
      },

      close: () => {
        clearTimer();
        token += 1;
        endHandled = true;
        loadedIndex = -1;
        const current = engine;
        engine = null;
        if (current) {
          current.pause();
          unsubscribe?.();
          current.destroy();
        }
        unsubscribe = null;
        countedThisPlay = false;
        plannedAdvance = null;
        set({
          session: null,
          urls: [],
          audio: 'idle',
          wantsAudio: false,
          sessionAdvance: null,
          resumed: false,
        });
      },
    };
  });
}
