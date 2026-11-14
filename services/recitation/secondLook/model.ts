import type {InferenceSession as OrtSession} from 'onnxruntime-react-native';
import {NUM_BINS} from './fbank';

// quran-asr-small under onnxruntime-react-native. Inputs and outputs as in the
// model's export: x [N, T, 80] float32, x_lens [N] int64; log_probs [N, T', 31]
// float32, log_probs_len [N] int64. One output frame is 40 ms.

export interface ModelOutput {
  /** [frames, 31] row by row. */
  logp: Float32Array;
  frames: number;
}

export interface SecondLookModel {
  /** From log-mel frames: data is [frames, 80] row by row. */
  run: (data: Float32Array, frames: number) => Promise<ModelOutput>;
  release: () => Promise<void>;
}

// One thread, as measured. Without the arena a 5.5 s slice peaks 11 MB lower for
// the same time per run (scripts/recitation-bench/judge/memory.mjs: 209 against
// 220 MB, 49 against 48 ms).
const SESSION_OPTIONS: OrtSession.SessionOptions = {
  executionProviders: ['cpu'],
  intraOpNumThreads: 1,
  interOpNumThreads: 1,
  enableCpuMemArena: false,
  enableMemPattern: false,
};

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

export async function loadSecondLookModel(
  path: string,
): Promise<SecondLookModel> {
  // Here rather than at the top: importing it needs the native module, and this
  // file loads with the follow-along service.
  const {InferenceSession, Tensor} =
    require('onnxruntime-react-native') as typeof import('onnxruntime-react-native');
  const session = await InferenceSession.create(
    stripFileScheme(path),
    SESSION_OPTIONS,
  );
  return {
    async run(data, frames) {
      const lens = new BigInt64Array(1);
      lens[0] = BigInt(frames);
      const out = await session.run({
        x: new Tensor('float32', data, [1, frames, NUM_BINS]),
        x_lens: new Tensor('int64', lens, [1]),
      });
      const logp = out.log_probs.data as Float32Array;
      const length = Number(out.log_probs_len.data[0]);
      return {
        logp: logp.slice(0, length * out.log_probs.dims[2]),
        frames: length,
      };
    },
    release: () => session.release(),
  };
}
