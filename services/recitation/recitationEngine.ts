import * as FileSystem from 'expo-file-system/legacy';
import {InferenceSession, Tensor} from 'onnxruntime-react-native';
import {
  createZipformerSession,
  type OrtSessionLike,
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
}

export interface RecitationEngine {
  /** Queues a chunk of 16 kHz mono PCM. Calls are serialized internally. */
  feed: (pcm: Float32Array) => void;
  /** Flushes the tail of the current take. */
  stop: () => Promise<void>;
  /** Clears recognition state for a new take; keeps the model loaded. */
  reset: () => void;
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
        if (!isOrtTensor(value)) {
          throw new Error(`Feed ${name} is not an onnxruntime Tensor`);
        }
        ortFeeds[name] = value;
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
