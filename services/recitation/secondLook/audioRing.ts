import {SAMPLE_RATE} from './fbank';

// The last seconds of the raw audio a take fed to the engine. It counts samples
// from the same start as the engine and is pushed the same chunks, so a time in
// seconds means the same moment on both.

const RING_SECONDS = 30;

export interface AudioRing {
  /** Adds a chunk of 16 kHz mono audio. */
  push: (pcm: Float32Array) => void;
  /**
   * A copy of the audio between two times, in seconds of the audio fed since
   * the reset, rounded outwards to whole samples and clipped to what was fed
   * and is still held.
   */
  slice: (from: number, to: number) => Float32Array;
  /** The same by sample number, from 0 at the reset. */
  samples: (start: number, end: number) => Float32Array;
  /** Samples fed since the reset. */
  heard: () => number;
  /** Starts the clock again and lets the audio go. */
  reset: () => void;
}

export function createAudioRing(seconds: number = RING_SECONDS): AudioRing {
  const capacity = seconds * SAMPLE_RATE;
  let samples: Float32Array | null = null;
  let fed = 0;
  const samplesBetween = (from: number, to: number): Float32Array => {
    const start = Math.max(fed - capacity, 0, from);
    const end = Math.min(fed, to);
    if (!samples || end <= start) return new Float32Array(0);
    const out = new Float32Array(end - start);
    const at = start % capacity;
    const toEnd = Math.min(out.length, capacity - at);
    out.set(samples.subarray(at, at + toEnd));
    out.set(samples.subarray(0, out.length - toEnd), toEnd);
    return out;
  };
  return {
    push(pcm) {
      samples ??= new Float32Array(capacity);
      const kept = pcm.length > capacity ? pcm.subarray(-capacity) : pcm;
      const at = (fed + pcm.length - kept.length) % capacity;
      const toEnd = Math.min(kept.length, capacity - at);
      samples.set(kept.subarray(0, toEnd), at);
      samples.set(kept.subarray(toEnd), 0);
      fed += pcm.length;
    },
    slice(from, to) {
      return samplesBetween(
        Math.floor(from * SAMPLE_RATE),
        Math.ceil(to * SAMPLE_RATE),
      );
    },
    samples: samplesBetween,
    heard: () => fed,
    reset() {
      samples = null;
      fed = 0;
    },
  };
}

/** The current take's audio. */
export const recentAudio = createAudioRing();
