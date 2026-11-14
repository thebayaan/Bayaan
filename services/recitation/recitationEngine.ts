import * as FileSystem from 'expo-file-system/legacy';
import {InferenceSession, Tensor} from 'onnxruntime-react-native';
import {
  costTable,
  createZipformerSession,
  DEFAULT_STRUCTURAL,
  type CorrectionAction,
  type ExpectedPassage,
  type MelFrameSpan,
  type OrtSessionLike,
  type RecitationMode,
  type SearchHint,
  type TensorLike,
  type WordVerdict,
  type WorkerOutbound,
} from '@tilawa/core';
import {
  atThreeDecimals,
  buildVocab,
  rejectReason,
  soundCount,
  type WordVocab,
} from './addedWord';
import followerConstants from './followerConstants.npl.json';
import type {RecitationAssetPaths} from './recitationAssets';
import type {
  AddedBefore,
  EngineWord,
  VerdictChange,
  VerdictState,
} from './wordMarks';

export const RECITATION_SAMPLE_RATE = 16000;

/** Words whose verdict changed in the last chunk (Bayaan's own message). */
export interface WordVerdictsMessage {
  type: 'word_verdicts';
  changes: VerdictChange[];
  /** Seconds of audio fed since the reset, at the end of this chunk. */
  audioTime: number;
  /**
   * Set when the engine found the reader in this chunk: these verdicts were
   * judged from the audio it replayed from this word on.
   */
  lock?: EngineWord;
}

/** What the engine reports: Tilawa's messages plus word verdicts. */
export type EngineMessage = WorkerOutbound | WordVerdictsMessage;

export interface RecitationStats {
  /** Seconds of audio fed to the engine. */
  audioSeconds: number;
  /** Wall time spent inside feed(), ONNX included. */
  busyMs: number;
  /** Wall time spent inside the ONNX session.run() calls. */
  ortMs: number;
  /** Slowest single feed() call. */
  maxFeedMs: number;
  /** Chunks waiting behind the one being processed. */
  backlog: number;
  /** Time to create the ONNX session and load the corpus. */
  loadMs: number;
  /** Chunks fed successfully. */
  chunks: number;
  /** Most recent engine failure, if any. */
  lastError: string | null;
}

export interface RecitationEngine {
  /**
   * Queues a chunk of 16 kHz mono PCM. Calls are serialized internally. A
   * flag the chunk raises is deferred (review_later) before the next chunk,
   * so listening goes on; the flag and its answer still reach onEvent.
   */
  feed: (pcm: Float32Array) => void;
  /**
   * Flushes the tail of the current take. Resolves with what the session
   * emitted at the end: final_sequence, structural corrections and the raw
   * transcript. Empty once the engine is disposed.
   */
  stop: () => Promise<WorkerOutbound[]>;
  /** Clears recognition state for a new take; keeps the model loaded. */
  reset: () => void;
  /** Biases ambiguous matches toward this ayah, e.g. the page on screen. */
  setHint: (hint: SearchHint | null) => void;
  /** 'correction' turns on the word and ayah checks that tracking skips. */
  setMode: (mode: RecitationMode) => void;
  /** Correction mode: the passage the reader is about to recite. */
  setExpected: (passage: ExpectedPassage | null) => void;
  /** Turns the structural rules (skipped and look-alike ayahs) on or off. */
  setStructural: (on: boolean) => void;
  /** Answers an open correction; resolves with the messages it caused. */
  correct: (action: CorrectionAction) => Promise<WorkerOutbound[]>;
  /**
   * The stream's log-mel frames [from, to), 100 a second from 0 at the reset, on one
   * clock whatever the engine restarted on the way, clipped to the last 10 s or so. A
   * copy, read at once, off the queue: the follower never waits for it. The recipe is
   * the second model's.
   */
  readMelFrames: (from: number, to: number) => MelFrameSpan;
  /**
   * Where the trackers have put a word, as known after the last chunk: its first
   * and last decoder frames, 25 a second from 0 at the reset, on the same one clock.
   * Null when none has heard it. Read at once, off the queue.
   */
  wordFrames: (word: EngineWord) => {from: number; to: number} | null;
  /** Seconds of audio when the cursor first entered an ayah this take, or null. */
  ayahEnteredAt: (surah: number, ayah: number) => number | null;
  /** Words in an ayah, in the engine's numbering. */
  wordCount: (surah: number, ayah: number) => number;
  getStats: () => RecitationStats;
  dispose: () => Promise<void>;
}

const STRUCTURAL_OFF = {ayahOrder: false, similarVerse: false} as const;
// Heard sounds after a word before Tilawa judges it (its default is 6).
// Measured on five reciters with planted mistakes: 2 cuts the median time
// to a verdict from 1.8 s to 1.2 s with the same catches and false marks.
const COMMIT_DWELL = followerConstants.engine.commitDwell;
// Upper bound on flags deferred after one chunk or around one stop().
const MAX_DRAIN = 64;

function isOrtTensor(value: unknown): value is Tensor {
  return value instanceof Tensor;
}

function toTensorLike(tensor: Tensor): TensorLike {
  const {data, dims, type} = tensor;
  if (
    data instanceof Float32Array ||
    data instanceof BigInt64Array ||
    data instanceof Int32Array
  ) {
    return {data, dims, type};
  }
  throw new Error(`Unsupported ONNX output type: ${type}`);
}

function toOrtTensor(value: TensorLike): Tensor {
  const {data, dims} = value;
  if (data instanceof Float32Array) return new Tensor('float32', data, dims);
  if (data instanceof BigInt64Array) return new Tensor('int64', data, dims);
  return new Tensor('int32', data, dims);
}

/** The word a located / relocated debug event says the engine locked onto. */
function lockedWord(msg: WorkerOutbound): EngineWord | null {
  if (msg.type !== 'debug') return null;
  if (msg.event !== 'located' && msg.event !== 'relocated') return null;
  const at = msg.event === 'relocated' ? msg.data.to : msg.data;
  if (!at || typeof at !== 'object') return null;
  const {surah, ayah, word} = at as Record<string, unknown>;
  return typeof surah === 'number' &&
    typeof ayah === 'number' &&
    typeof word === 'number'
    ? {surah, ayah, word}
    : null;
}

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

export async function createRecitationEngine(
  assets: RecitationAssetPaths,
  onEvent: (msg: EngineMessage) => void,
): Promise<RecitationEngine> {
  const stats: RecitationStats = {
    audioSeconds: 0,
    busyMs: 0,
    ortMs: 0,
    maxFeedMs: 0,
    backlog: 0,
    loadMs: 0,
    chunks: 0,
    lastError: null,
  };
  const loadStart = performance.now();
  const ortSession = await InferenceSession.create(
    stripFileScheme(assets.modelPath),
  );

  // Adapter between onnxruntime-react-native's Tensor and Tilawa's narrower
  // TensorLike, timing each run so ONNX cost can be split from JS cost.
  const timedSession: OrtSessionLike = {
    async run(feeds) {
      const ortFeeds: Record<string, Tensor> = {};
      for (const [name, value] of Object.entries(feeds)) {
        // Recurrent state comes back as the plain TensorLike we returned from
        // the previous run, so rewrap it.
        ortFeeds[name] = isOrtTensor(value) ? value : toOrtTensor(value);
      }
      const start = performance.now();
      const outputs = await ortSession.run(ortFeeds);
      stats.ortMs += performance.now() - start;
      const result: Record<string, TensorLike> = {};
      for (const [name, value] of Object.entries(outputs)) {
        result[name] = toTensorLike(value);
      }
      return result;
    },
  };

  // Where the engine found the reader during the chunk being fed, if it did.
  let chunkLock: EngineWord | null = null;
  // Samples fed since the reset, counting a chunk that failed: the second look's
  // audio ring holds every chunk and must keep the same clock.
  let fedSamples = 0;
  const ayahEntered = new Map<string, number>();
  const onSessionEvent = (msg: WorkerOutbound) => {
    chunkLock = lockedWord(msg) ?? chunkLock;
    if (msg.type === 'word_progress') {
      const key = `${msg.surah}:${msg.ayah}`;
      if (!ayahEntered.has(key)) {
        ayahEntered.set(key, fedSamples / RECITATION_SAMPLE_RATE);
      }
    }
    onEvent(msg);
  };

  const session = await createZipformerSession({
    session: timedSession,
    Tensor,
    corpus: async () =>
      JSON.parse(await FileSystem.readAsStringAsync(assets.corpusPath)),
    onEvent: onSessionEvent,
    // The structural rules only serve correction mode; tracking skips them.
    structural: false,
    // Skips a whole-Quran search over the transcript at stop().
    enableFallback: false,
    // Engine state changes (located, lost, idle) arrive as debug events.
    debug: true,
    // A flag deferred at once keeps the decoder and the tracker (Bayaan's
    // engine patch). Restarting them at the flagged word lost the reader soon
    // after most flags; on the planted-mistake bench keeping them removed 40%
    // of false marks and caught more mistakes.
    keepContextOnDefer: true,
    // Did the reader leave out an ayah's last word (Bayaan's engine patch)?
    junction: followerConstants.junction,
    config: {
      commitDwell: COMMIT_DWELL,
      // A word split by the engine's 300-sound segment cut is judged from all
      // its sounds, not the few after the cut (Bayaan's engine patch).
      wholeWordAtCut: true,
      // Extra sounds between two words, for the added-word mark (same patch).
      gapReport: followerConstants.gapReport,
      // A long jump forward does not make one alignment across all the text jumped
      // over, which cost seconds a chunk on a long surah (same patch).
      cutAtJump: followerConstants.engine.cutAtJump,
    },
  });
  stats.loadMs = performance.now() - loadStart;

  // The session must not be re-entered, so every call goes through one
  // promise chain. A failed task resolves to its fallback and the chain goes
  // on.
  let queue: Promise<unknown> = Promise.resolve();
  let disposed = false;

  // Each word's last reported verdict, so a chunk reports only changes.
  const verdictStates = new Map<string, VerdictState>();
  // Each skipped word's last reported junction result, for the same reason.
  const junctionResults = new Map<string, boolean>();
  // The runs of extra sounds this tracker has shown, and whether the rule passed
  // each; a run first seen in the chunk where it locked never passes.
  const gapsSeen = new Map<string, boolean>();
  // The right words whose added mark has been reported this take.
  const addedReported = new Set<string>();
  // A lock in tracking mode: correction mode starts with the next chunk, so the
  // runs the lock replayed are first seen there, and count as the lock's.
  let mode: RecitationMode = 'tracking';
  let lockEcho = false;
  // Built in small steps after the load; until then no run can pass.
  let vocab: WordVocab | null = null;
  void buildVocab(session.corpus).then(built => {
    vocab = built;
  });

  /** The news that this word has an extra word before it, if there is any. */
  function addedBeforeOf(
    v: WordVerdict,
    key: string,
    locking: boolean,
  ): AddedBefore | null {
    const gap = v.gap;
    if (!gap) return null;
    const seenKey = `${v.wordIndex}:${gap.from}:${gap.to}:${atThreeDecimals(gap.fitL)}:${atThreeDecimals(gap.fitR)}`;
    let passes = gapsSeen.get(seenKey);
    if (passes === undefined) {
      if (!locking && !vocab) return null;
      passes =
        !locking &&
        rejectReason(gap, v.wordIndex, {
          corpus: session.corpus,
          table: costTable(),
          vocab,
        }) === null;
      gapsSeen.set(seenKey, passes);
    }
    if (!passes || addedReported.has(key)) return null;
    addedReported.add(key);
    const {wordSurah, wordAyah, wordInAyah} = session.corpus;
    return {
      sounds: soundCount(gap.chars),
      noGap: gap.noGap,
      left: {
        surah: wordSurah[gap.leftWord],
        ayah: wordAyah[gap.leftWord],
        word: wordInAyah[gap.leftWord],
      },
    };
  }

  /**
   * Whether the junction result is news: only on a skipped verdict, where unsaid
   * makes a mark and said can drop one. On any other verdict said is nothing.
   */
  function junctionNews(v: WordVerdict, key: string): boolean {
    if (v.junctionMissing === undefined) junctionResults.delete(key);
    if (v.state !== 'skipped' || v.junctionMissing === undefined) return false;
    if (junctionResults.get(key) === v.junctionMissing) return false;
    junctionResults.set(key, v.junctionMissing);
    return true;
  }

  function reportVerdicts(lock: EngineWord | null): void {
    if (lock) gapsSeen.clear();
    const locking = lock !== null || lockEcho;
    lockEcho = lock !== null && mode === 'tracking';
    const changes: VerdictChange[] = [];
    for (const v of session.verdicts()) {
      const key = `${v.surah}:${v.ayah}:${v.word}`;
      const repeat = verdictStates.get(key) === v.state;
      const news = junctionNews(v, key);
      const addedBefore = addedBeforeOf(v, key, locking);
      if (repeat && !news && !addedBefore) continue;
      verdictStates.set(key, v.state);
      const change: VerdictChange = {
        surah: v.surah,
        ayah: v.ayah,
        word: v.word,
        totalWords: session.wordCount(v.surah, v.ayah),
        state: v.state,
      };
      if (repeat) change.repeat = true;
      if (addedBefore) change.addedBefore = addedBefore;
      // The scores behind a verdict, so the marks can tell the reader's slip from
      // the alignment's (wordMarks), and the second judge knows when to wake.
      if (v.state !== 'pending') {
        const num = (x: unknown) => (typeof x === 'number' ? x : null);
        change.detail = {
          gop: num(v.gop),
          heardRatio: num(v.heardRatio),
          distance: num(v.distance),
        };
        if (v.state === 'skipped' && v.junctionMissing !== undefined) {
          change.detail.junctionMissing = v.junctionMissing;
        }
      }
      changes.push(change);
    }
    if (changes.length > 0) {
      onEvent({
        type: 'word_verdicts',
        changes,
        audioTime: fedSamples / RECITATION_SAMPLE_RATE,
        ...(lock ? {lock} : {}),
      });
    }
  }

  function deferOpenIssues(): WorkerOutbound[] {
    const out: WorkerOutbound[] = [];
    for (
      let i = 0;
      i < MAX_DRAIN && session.correction.state.phase !== 'idle';
      i++
    ) {
      out.push(...session.correct('review_later'));
    }
    return out;
  }

  function enqueue<T>(task: () => Promise<T>, fallback: T): Promise<T> {
    stats.backlog += 1;
    const result = queue.then(async () => {
      stats.backlog -= 1;
      if (disposed) return fallback;
      try {
        return await task();
      } catch (error) {
        stats.lastError =
          error instanceof Error ? error.message : String(error);
        console.warn('[recitation] engine task failed', error);
        return fallback;
      }
    });
    queue = result;
    return result;
  }

  return {
    feed(pcm) {
      void enqueue(async () => {
        const start = performance.now();
        chunkLock = null;
        fedSamples += pcm.length;
        await session.feed(pcm);
        // Tilawa drops every chunk while a flag is open, so this chunk's flags
        // are deferred now, before the next one, and then its verdicts are
        // read. correct() hands its messages to onSessionEvent as feed() does,
        // so the listener hears each flag and its answer.
        if (session.correction.state.phase === 'error') deferOpenIssues();
        reportVerdicts(chunkLock);
        chunkLock = null;
        const elapsed = performance.now() - start;
        stats.busyMs += elapsed;
        stats.maxFeedMs = Math.max(stats.maxFeedMs, elapsed);
        stats.audioSeconds += pcm.length / RECITATION_SAMPLE_RATE;
        stats.chunks += 1;
      }, undefined);
    },
    stop() {
      return enqueue(async () => {
        // Tilawa skips the flush while a flag is open, and raises the
        // structural flags one per correct() after it: defer them all so the
        // take ends with its final_sequence and every flag.
        const out = deferOpenIssues();
        out.push(...(await session.stop()));
        out.push(...deferOpenIssues());
        return out;
      }, [] as WorkerOutbound[]);
    },
    reset() {
      void enqueue(async () => {
        session.reset();
        verdictStates.clear();
        junctionResults.clear();
        gapsSeen.clear();
        addedReported.clear();
        ayahEntered.clear();
        lockEcho = false;
        fedSamples = 0;
        stats.audioSeconds = 0;
        stats.busyMs = 0;
        stats.ortMs = 0;
        stats.maxFeedMs = 0;
        stats.chunks = 0;
        stats.lastError = null;
      }, undefined);
    },
    setHint(hint) {
      void enqueue(async () => {
        session.setHint(hint);
      }, undefined);
    },
    setMode(next) {
      void enqueue(async () => {
        session.setMode(next);
        mode = next;
      }, undefined);
    },
    setExpected(passage) {
      void enqueue(async () => {
        session.setExpected(passage);
      }, undefined);
    },
    setStructural(on) {
      void enqueue(
        () => session.setStructural(on ? DEFAULT_STRUCTURAL : STRUCTURAL_OFF),
        undefined,
      );
    },
    correct(action) {
      return enqueue(
        async () => session.correct(action),
        [] as WorkerOutbound[],
      );
    },
    readMelFrames(from, to) {
      return session.readMelFrames(from, to);
    },
    wordFrames(word) {
      return session.wordFrames(word.surah, word.ayah, word.word);
    },
    ayahEnteredAt(surah, ayah) {
      return ayahEntered.get(`${surah}:${ayah}`) ?? null;
    },
    wordCount(surah, ayah) {
      return session.wordCount(surah, ayah);
    },
    getStats() {
      return {...stats};
    },
    async dispose() {
      disposed = true;
      await queue;
      await ortSession.release();
    },
  };
}
