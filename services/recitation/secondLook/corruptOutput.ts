// A guard on the second model's output. onnxruntime-node 1.24.3 on x86-64 spoils
// every 32nd output row of the int8 model (one token at 0, the rest near -4e5); the
// same has not been ruled out for other builds. A run with such a row is not scored:
// the check fails open, so the mark shows.

const VOCAB = 31;
/** No real row of log-probabilities comes near this. */
const FLOOR = -1000;

/** The first row whose smallest value is under the floor, or -1 when none is. */
export function corruptRow(
  logp: Float32Array,
  frames: number,
  vocab = VOCAB,
): number {
  for (let t = 0; t < frames; t++) {
    const row = t * vocab;
    for (let k = 0; k < vocab; k++) {
      if (!(logp[row + k] >= FLOOR)) return t;
    }
  }
  return -1;
}
