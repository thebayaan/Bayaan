import {AppState} from 'react-native';
import type {WorkerOutbound} from '@tilawa/core';
import type {EngineMessage} from '@/services/recitation/recitationEngine';
import type {VerdictChange} from '@/services/recitation/wordMarks';

/**
 * The edges of recitation recognition (engine, microphone, model files,
 * analytics, players) as Jest mocks, shared by the recitation tests.
 *
 * Wire them from a test file with a `mock`-prefixed import, so modules loaded
 * inside jest.isolateModules get these same objects:
 *
 *   import * as mockRecitation from '@/test-utils/recitationMocks';
 *   jest.mock('@/services/recitation/micStream', () => mockRecitation.micStreamModule);
 */

export const mockEngine = {
  feed: jest.fn(),
  stop: jest.fn(async (): Promise<WorkerOutbound[]> => []),
  reset: jest.fn(),
  setHint: jest.fn(),
  setMode: jest.fn(),
  setExpected: jest.fn(),
  setStructural: jest.fn(),
  correct: jest.fn(async (): Promise<WorkerOutbound[]> => []),
  readMelFrames: jest.fn((from: number, _to: number) => ({
    first: from,
    frames: 0,
    data: new Float32Array(0),
  })),
  wordFrames: jest.fn(
    (_word: {
      surah: number;
      ayah: number;
      word: number;
    }): {from: number; to: number} | null => null,
  ),
  ayahEnteredAt: jest.fn(
    (_surah: number, _ayah: number): number | null => null,
  ),
  wordCount: jest.fn((_surah: number, _ayah: number): number => 10),
  getStats: jest.fn(() => ({
    audioSeconds: 10,
    busyMs: 2000,
    ortMs: 1000,
    maxFeedMs: 120,
    backlog: 0,
    loadMs: 900,
    chunks: 20,
    lastError: null,
  })),
  dispose: jest.fn(async () => undefined),
};

export const engineControl: {
  /** Delivers an engine event, as the loaded session would. */
  sendEvent: ((msg: EngineMessage) => void) | null;
  /** When set, loading the model waits for it. */
  gate: Promise<void> | null;
} = {sendEvent: null, gate: null};

export const recitationEngineModule = {
  RECITATION_SAMPLE_RATE: 16000,
  createRecitationEngine: jest.fn(
    async (_assets: unknown, onEvent: (msg: EngineMessage) => void) => {
      if (engineControl.gate) await engineControl.gate;
      engineControl.sendEvent = onEvent;
      return mockEngine;
    },
  ),
};

export const mockMic = {
  stop: jest.fn(async () => undefined),
  resume: jest.fn(async () => undefined),
};

export const micControl: {
  granted: boolean;
  /** The chunk callback the service passed to startMicStream. */
  chunk: ((pcm: Float32Array, rate: number) => void) | null;
  /** The interruption callback the service passed to startMicStream. */
  interrupt: ((...args: unknown[]) => void) | null;
} = {granted: true, chunk: null, interrupt: null};

export const micStreamModule = {
  requestMicPermission: jest.fn(async () => micControl.granted),
  startMicStream: jest.fn(
    async (
      onChunk: (pcm: Float32Array, rate: number) => void,
      onInterrupt: (...args: unknown[]) => void,
    ) => {
      micControl.chunk = onChunk;
      micControl.interrupt = onInterrupt;
      return mockMic;
    },
  ),
};

export const recitationAssetsModule = {
  getRecitationAssets: jest.fn(async () => ({
    modelPath: 'file:///model.onnx',
    corpusPath: 'file:///corpus.json',
  })),
  ensureRecitationAssets: jest.fn(),
  deleteRecitationAssets: jest.fn(async () => undefined),
  secondLookModelPath: jest.fn(async (): Promise<string | null> => null),
  ensureSecondLookModel: jest.fn(async () => undefined),
};

export const mockAnalytics = {
  trackRecitationTrackingStarted: jest.fn(),
  trackRecitationTrackingLocked: jest.fn(),
  trackRecitationTrackingStopped: jest.fn(),
  trackRecitationModelDownloaded: jest.fn(),
  trackRecitationTrackingError: jest.fn(),
  trackRecitationIdentifyStarted: jest.fn(),
  trackRecitationIdentifyEnded: jest.fn(),
};

export const analyticsModule = {analyticsService: mockAnalytics};

export const playerControl = {playing: false};
export const mockPlayerPause = jest.fn();

export const playerStoreModule = {
  usePlayerStore: {
    getState: () => ({
      playback: {state: playerControl.playing ? 'playing' : 'paused'},
      pause: mockPlayerPause,
    }),
  },
};

export const mushafPlayerStoreModule = {
  useMushafPlayerStore: {
    getState: () => ({playbackState: 'idle', stop: jest.fn()}),
  },
};

export const digitalKhattModule = {
  digitalKhattDataService: {
    getVerseWords: jest.fn((): unknown[] => []),
    tryGetVerseText: jest.fn((): string | null => null),
    getPageForVerse: jest.fn((): number | undefined => 1),
  },
};

/** Puts every control back to its default; call with jest.clearAllMocks(). */
export function resetRecitationControls(): void {
  engineControl.sendEvent = null;
  engineControl.gate = null;
  micControl.granted = true;
  micControl.chunk = null;
  micControl.interrupt = null;
  playerControl.playing = false;
}

/**
 * Spies on AppState.addEventListener and returns a trigger for the most
 * recent 'change' listener.
 */
export function captureAppStateChange(): {fire: (next: string) => void} {
  let handler: ((next: string) => void) | null = null;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((type: string, listener: (next: never) => void) => {
      if (type === 'change') handler = listener as (next: string) => void;
      return {remove: jest.fn()} as unknown as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  return {fire: next => handler?.(next)};
}

/** Lets pending promise callbacks run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

export function wordProgress(
  surah: number,
  ayah: number,
  wordIndex: number,
  totalWords: number,
  matched: number[] = [],
): WorkerOutbound {
  return {
    type: 'word_progress',
    surah,
    ayah,
    word_index: wordIndex,
    total_words: totalWords,
    matched_indices: matched,
  };
}

/** The engine's guess at the reader's place while ayat still tie (debug event). */
export function tentative(
  surah: number,
  ayah: number,
  word: number,
  totalWords: number,
): WorkerOutbound {
  return {
    type: 'debug',
    event: 'tentative',
    at: 0,
    data: {type: 'tentative', surah, ayah, word, totalWords},
  };
}

export function verseMatch(
  surah: number,
  ayah: number,
  confidence = 0.9,
): WorkerOutbound {
  return {
    type: 'verse_match',
    surah,
    ayah,
    verse_text: '',
    surah_name: '',
    confidence,
    surrounding_verses: [],
  };
}

export function verseCandidate(surah: number, ayah: number): WorkerOutbound {
  return {
    type: 'verse_candidate',
    candidates: [{surah, ayah, confidence: 0.5, rank: 0, source: 'discovery'}],
    stable: false,
    final_flush: false,
  };
}

export function finalSequence(
  verses: {surah: number; ayah: number; confidence: number}[],
): WorkerOutbound {
  return {type: 'final_sequence', verses, confidence: 0.9};
}

/** Words whose verdict changed in a chunk, as the engine reports them. */
export function wordVerdicts(
  changes: (Omit<VerdictChange, 'totalWords'> & {totalWords?: number})[],
  lock?: {surah: number; ayah: number; word: number},
  audioTime = 1,
): EngineMessage {
  return {
    type: 'word_verdicts',
    changes: changes.map(c => ({totalWords: 10, ...c})),
    audioTime,
    ...(lock ? {lock} : {}),
  };
}

/** An engine debug event: 'located', 'lost', 'idle', 'locateFailed'... */
export function engineDebug(event: string): WorkerOutbound {
  return {type: 'debug', event, at: 0, data: {type: event}} as WorkerOutbound;
}

/** A live or structural flag, as the engine raises it in correction mode. */
export function correctionError(
  surah: number,
  ayah: number,
  word: number,
  kind:
    | 'possible_omission'
    | 'possible_substitution'
    | 'possible_vowel'
    | 'possible_repetition'
    | 'possible_skipped_ayah'
    | 'unclear_ayah',
  source?: 'ayah_order' | 'similar_verse',
): WorkerOutbound {
  return {
    type: 'correction',
    state: {
      phase: 'error',
      issue: {surah, ayah, word, wordIndex: word, kind, source},
      resume: null,
      attempt: 0,
      outcome: null,
    },
    totalWords: 10,
  };
}
