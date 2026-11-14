// Some onnxruntime builds return garbage in a few of this model's output rows (on
// x86-64, 1.24.3 spoils every 32nd row: one token at 0 and the rest near -4e5). A
// real log-probability from this model never comes near this floor, so a row that
// goes below it means the whole run is not to be trusted.

/** Below this a log-probability is not the model's but a broken build's. */
export const CORRUPT_LOGP_FLOOR = -1000;

/**
 * The first output row holding a log-probability below the floor, or -1 when the
 * output is clean.
 * @param logp - [frames, tokens] row by row
 */
export function corruptRow(logp: Float32Array, frames: number): number {
  if (frames <= 0) return -1;
  const width = Math.floor(logp.length / frames);
  if (width <= 0) return -1;
  const end = width * frames;
  for (let i = 0; i < end; i += 1) {
    if (logp[i] < CORRUPT_LOGP_FLOOR) return Math.floor(i / width);
  }
  return -1;
}
