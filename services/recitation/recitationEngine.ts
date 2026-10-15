import * as FileSystem from 'expo-file-system/legacy';
import {InferenceSession, Tensor} from 'onnxruntime-react-native';
import {
  createZipformerSession,
  type OrtSessionLike,
  type SearchHint,
  type TensorLike,
  type WorkerOutbound,
} from '@tilawa/core';
import type {RecitationAssetPaths} from './recitationAssets';

export const RECITATION_SAMPLE_RATE = 16000;

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
  /** Queues a chunk of 16 kHz mono PCM. Calls are serialized internally. */
  feed: (pcm: Float32Array) => void;
  /** Flushes the tail of the current take. */
  stop: () => Promise<void>;
  /** Clears recognition state for a new take; keeps the model loaded. */
  reset: () => void;
  /** Biases ambiguous matches toward this ayah, e.g. the page on screen. */
  setHint: (hint: SearchHint | null) => void;
  getStats: () => RecitationStats;
  dispose: () => Promise<void>;
}

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

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

export async function createRecitationEngine(
  assets: RecitationAssetPaths,
  onEvent: (msg: WorkerOutbound) => void,
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

  const session = await createZipformerSession({
    session: timedSession,
    Tensor,
    corpus: async () =>
      JSON.parse(await FileSystem.readAsStringAsync(assets.corpusPath)),
    onEvent,
    // The structural rules only serve correction mode; tracking skips them.
    structural: false,
    // Skips a whole-Quran search over the transcript at stop().
    enableFallback: false,
    // Engine state changes (located, lost, idle) arrive as debug events.
    debug: true,
  });
  stats.loadMs = performance.now() - loadStart;

  // feed() must not be re-entered, so chunks go through one promise chain.
  let queue: Promise<void> = Promise.resolve();
  let disposed = false;

  function enqueue(task: () => Promise<void>): Promise<void> {
    stats.backlog += 1;
    queue = queue
      .then(async () => {
        stats.backlog -= 1;
        if (disposed) return;
        await task();
      })
      .catch(error => {
        stats.lastError =
          error instanceof Error ? error.message : String(error);
        console.warn('[recitation] engine task failed', error);
      });
    return queue;
  }

  return {
    feed(pcm) {
      void enqueue(async () => {
        const start = performance.now();
        await session.feed(pcm);
        const elapsed = performance.now() - start;
        stats.busyMs += elapsed;
        stats.maxFeedMs = Math.max(stats.maxFeedMs, elapsed);
        stats.audioSeconds += pcm.length / RECITATION_SAMPLE_RATE;
        stats.chunks += 1;
      });
    },
    stop() {
      return enqueue(async () => {
        await session.stop();
      });
    },
    reset() {
      void enqueue(async () => {
        session.reset();
        stats.audioSeconds = 0;
        stats.busyMs = 0;
        stats.ortMs = 0;
        stats.maxFeedMs = 0;
        stats.chunks = 0;
        stats.lastError = null;
      });
    },
    setHint(hint) {
      void enqueue(async () => {
        session.setHint(hint);
      });
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
