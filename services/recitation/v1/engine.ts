import * as FileSystem from 'expo-file-system/legacy';
import * as ort from 'onnxruntime-react-native';
import {
  MODEL_REGISTRY,
  ortBackend,
  type CheckerEvent,
  type EngineEvent,
  type LoadedModel,
  type PositionEvent,
  type ReferenceAsset,
  type SessionPolicy,
  type TilawaSession,
} from '@tilawa/core-v1';
import {createTilawa, type Tilawa} from '@tilawa/core-v1/react-native';
import type {WorkerOutbound} from '@tilawa/core';
import type {
  EngineMessage,
  RecitationEngine,
  RecitationStats,
} from '../recitationEngine';
import type {V1AssetPaths} from './assets';
import type {V1MarkClass, V1MarkMessage, V1Timeline, WordTime} from './types';

// Tilawa 1.0 behind the app's engine interface. Its position events become the
// messages the follow-along already reads (word_progress, verse_match and the
// located / lost / tentative debug events), and its checker events become
// v1_mark messages for the app's own check. What only the 0.4 engine has (modes,
// passages, structural rules, corrections, log-mel frames) does nothing here.
//
// Free recitation: the reader may start anywhere, as with 0.4. A mistake is
// confirmed once the next word starts (what the bench measured), and the app's
// check decides whether it shows.

export const V1_POLICY: SessionPolicy = {
  confirm: {after: 'next-word'},
  minConfidence: 0.6,
  countSelfCorrections: false,
};

const MARK_CLASSES: ReadonlySet<string> = new Set<V1MarkClass>([
  'wrong_word',
  'omitted_word',
  'added_word',
  'skipped_passage',
]);

/** The mic's rate, as for the 0.4 engine (RECITATION_SAMPLE_RATE). */
const SAMPLE_RATE = 16000;

/** Seconds a model frame of the place timeline stands for (wordFrames' unit). */
const FRAME_SECONDS = 0.04;

export interface V1Engine extends RecitationEngine {
  /**
   * Ends Tilawa's session while the take still listens, so the mistakes it decides
   * only at the end reach the app (and its check) with the take's audio still there.
   * Feeding stops; stop() afterwards only returns the take's last messages.
   */
  settle: () => Promise<void>;
  /** Where the follower put words so far this take. */
  timeline: () => V1Timeline;
}

/** The pieces of the SDK the adapter uses, so tests can stand in for them. */
export interface V1Sdk {
  loadModel: (modelPath: string) => Promise<LoadedModel>;
  loadReference: (referencePath: string) => Promise<ReferenceAsset>;
  create: (model: LoadedModel, reference: ReferenceAsset) => Promise<Tilawa>;
}

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

const fullTier = () => {
  const full = MODEL_REGISTRY.tiers.find(t => t.tier === 'full');
  if (!full) throw new Error('No full tier in the model registry');
  return full;
};

export const defaultV1Sdk: V1Sdk = {
  async loadModel(modelPath) {
    const full = fullTier();
    const backend = await ortBackend(
      ort as never,
      stripFileScheme(modelPath),
      'onnxruntime-react-native',
      {executionProviders: ['cpu'], intraOpNumThreads: 1},
    );
    return {manifest: full.manifest, backend, supported: full.supported};
  },
  async loadReference(referencePath) {
    return JSON.parse(
      await FileSystem.readAsStringAsync(referencePath),
    ) as ReferenceAsset;
  },
  create: (model, reference) => createTilawa({model, reference, tier: 'full'}),
};

const wordKey = (w: {surah: number; ayah: number; word: number}) =>
  `${w.surah}:${w.ayah}:${w.word}`;

export async function createTilawaV1Engine(
  assets: V1AssetPaths,
  onEvent: (msg: EngineMessage) => void,
  sdk: V1Sdk = defaultV1Sdk,
): Promise<V1Engine> {
  const loadStart = performance.now();
  const [model, reference] = await Promise.all([
    sdk.loadModel(assets.modelPath),
    sdk.loadReference(assets.referencePath),
  ]);
  let tilawa: Tilawa;
  try {
    tilawa = await sdk.create(model, reference);
  } catch (error) {
    await model.backend.release().catch(() => undefined);
    throw error;
  }
  const wordCounts = new Map<string, number>();
  for (const a of (reference as {ayahs?: {s: number; a: number; w: string[]}[]})
    .ayahs ?? []) {
    wordCounts.set(`${a.s}:${a.a}`, a.w.length);
  }
  const stats: RecitationStats = {
    audioSeconds: 0,
    busyMs: 0,
    ortMs: 0,
    maxFeedMs: 0,
    backlog: 0,
    loadMs: performance.now() - loadStart,
    chunks: 0,
    lastError: null,
  };

  let disposed = false;
  let session: TilawaSession | null = null;
  let unsubscribe: (() => void) | null = null;
  let settled = false;
  // Every call to the session goes through one chain, in call order.
  let chain: Promise<unknown> = Promise.resolve();

  // The take's places, from the locked position events.
  let words = new Map<string, WordTime>();
  let ayahEntered = new Map<string, number>();
  let path: [number, {surah: number; ayah: number; word: number}][] = [];
  let lockedAt: {surah: number; ayah: number; word: number} | null = null;
  let tracking: 'none' | 'locked' | 'searching' = 'none';
  // Ayat the cursor left, reported as recited, in order.
  let recited: {surah: number; ayah: number; confidence: number}[] = [];
  let lastConfidence = 0;

  const totalWords = (surah: number, ayah: number) =>
    wordCounts.get(`${surah}:${ayah}`) ?? 0;

  const debug = (event: string, data: Record<string, unknown>) =>
    onEvent({type: 'debug', event, at: Date.now(), data});

  function verseMatch(
    surah: number,
    ayah: number,
    confidence: number,
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

  function leaveAyah(next: {surah: number; ayah: number} | null): void {
    if (!lockedAt) return;
    if (next && next.surah === lockedAt.surah && next.ayah === lockedAt.ayah) {
      return;
    }
    const {surah, ayah} = lockedAt;
    const last = recited[recited.length - 1];
    if (last && last.surah === surah && last.ayah === ayah) return;
    recited.push({surah, ayah, confidence: lastConfidence});
    onEvent(verseMatch(surah, ayah, lastConfidence));
  }

  function onPosition(e: PositionEvent): void {
    const best = e.observed[0];
    const t = e.timeMs / 1000;
    if (e.state === 'locked' && best) {
      const at = {
        surah: best.word.surah,
        ayah: best.word.ayah,
        word: best.word.word - 1,
      };
      if (tracking !== 'locked') {
        tracking = 'locked';
        debug('located', at);
      }
      lastConfidence = best.confidence;
      const key = wordKey(at);
      const before = lockedAt ? words.get(wordKey(lockedAt)) : undefined;
      if (before && lockedAt && wordKey(lockedAt) !== key) {
        before.to = Math.max(before.to, t);
      }
      const known = words.get(key);
      if (known) known.to = Math.max(known.to, t);
      else words.set(key, {from: t, to: t});
      const ayahKey = `${at.surah}:${at.ayah}`;
      if (!ayahEntered.has(ayahKey)) ayahEntered.set(ayahKey, t);
      if (!lockedAt || wordKey(lockedAt) !== key) {
        path.push([t, at]);
        leaveAyah(at);
        lockedAt = at;
        onEvent({
          type: 'word_progress',
          surah: at.surah,
          ayah: at.ayah,
          word_index: at.word,
          total_words: totalWords(at.surah, at.ayah),
          matched_indices: [],
        });
      }
      return;
    }
    if (e.state === 'lost' || e.state === 'acquiring') {
      if (tracking === 'locked') debug('lost', {state: e.state});
      tracking = 'searching';
    }
    // Not locked: the best guess, which the app shows only on the open page.
    if (tracking !== 'locked' && best) {
      debug('tentative', {
        surah: best.word.surah,
        ayah: best.word.ayah,
        word: best.word.word - 1,
        totalWords: totalWords(best.word.surah, best.word.ayah),
      });
    }
  }

  function onChecker(e: CheckerEvent): void {
    if (!MARK_CLASSES.has(e.errorClass)) return;
    const msg: V1MarkMessage = {
      type: 'v1_mark',
      id: e.id,
      state: e.state,
      errorClass: e.errorClass as V1MarkClass,
      surah: e.location.surah,
      ayah: e.location.ayah,
      word: e.location.word - 1,
      totalWords: totalWords(e.location.surah, e.location.ayah),
      audioTime: e.timeMs / 1000,
      confidence: e.confidence,
    };
    onEvent(msg);
  }

  function listen(e: EngineEvent): void {
    if (disposed) return;
    if (e.type === 'position') onPosition(e);
    else if (e.type === 'checker') onChecker(e);
  }

  function startSession(): TilawaSession {
    const next = tilawa.startFreeRecitation(V1_POLICY);
    unsubscribe = next.subscribe(listen);
    session = next;
    settled = false;
    return next;
  }

  function closeSession(): void {
    unsubscribe?.();
    unsubscribe = null;
    session?.dispose();
    session = null;
  }

  function enqueue<T>(task: () => Promise<T>, fallback: T): Promise<T> {
    stats.backlog += 1;
    const result = chain.then(async () => {
      stats.backlog -= 1;
      if (disposed) return fallback;
      try {
        return await task();
      } catch (error) {
        stats.lastError =
          error instanceof Error ? error.message : String(error);
        console.warn('[recitation] v1 engine task failed', error);
        return fallback;
      }
    });
    chain = result;
    return result;
  }

  /** Ends the session once, and lets the cursor's last ayah count if it reached its end. */
  async function endSession(): Promise<void> {
    if (!session || settled) return;
    settled = true;
    await session.end();
    if (
      lockedAt &&
      lockedAt.word >= totalWords(lockedAt.surah, lockedAt.ayah) - 1
    ) {
      leaveAyah(null);
    }
  }

  function clearTake(): void {
    words = new Map();
    ayahEntered = new Map();
    path = [];
    lockedAt = null;
    tracking = 'none';
    recited = [];
    lastConfidence = 0;
    stats.audioSeconds = 0;
    stats.busyMs = 0;
    stats.maxFeedMs = 0;
    stats.chunks = 0;
    stats.lastError = null;
  }

  return {
    feed(pcm) {
      void enqueue(async () => {
        if (settled) return;
        const current = session ?? startSession();
        const start = performance.now();
        await current.pushAudio(pcm, SAMPLE_RATE);
        const elapsed = performance.now() - start;
        stats.busyMs += elapsed;
        stats.maxFeedMs = Math.max(stats.maxFeedMs, elapsed);
        stats.audioSeconds += pcm.length / SAMPLE_RATE;
        stats.chunks += 1;
      }, undefined);
    },
    settle() {
      return enqueue(endSession, undefined);
    },
    stop() {
      return enqueue(async () => {
        await endSession();
        const out: WorkerOutbound[] = [];
        if (recited.length > 0) {
          out.push({
            type: 'final_sequence',
            verses: recited.map(v => ({
              surah: v.surah,
              ayah: v.ayah,
              confidence: v.confidence,
            })),
            confidence: lastConfidence,
          });
        }
        return out;
      }, [] as WorkerOutbound[]);
    },
    reset() {
      void enqueue(async () => {
        closeSession();
        clearTake();
        startSession();
      }, undefined);
    },
    // 0.4's search hint, modes, passages and structural rules: Tilawa 1.0 has none.
    setHint: () => undefined,
    setMode: () => undefined,
    setExpected: () => undefined,
    setStructural: () => undefined,
    correct: async () => [],
    readMelFrames: from => ({
      first: from,
      frames: 0,
      data: new Float32Array(0),
    }),
    wordFrames(word) {
      const time = words.get(wordKey(word));
      if (!time) return null;
      return {
        from: Math.floor(time.from / FRAME_SECONDS),
        to: Math.ceil(time.to / FRAME_SECONDS),
      };
    },
    ayahEnteredAt: (surah, ayah) => ayahEntered.get(`${surah}:${ayah}`) ?? null,
    wordCount: totalWords,
    getStats: () => ({...stats}),
    timeline: () => ({words, ayahEntered, path}),
    async dispose() {
      disposed = true;
      await chain.catch(() => undefined);
      closeSession();
      await tilawa.dispose();
      await model.backend.release();
    },
  };
}
