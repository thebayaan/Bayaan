// Fixed inputs for the second look's tests, built from arithmetic only, so a
// test needs no recording. The goldens in secondLook/__tests__/fixtures were
// made on these same inputs by the plain JavaScript the port comes from
// (scripts/second-look/gen_goldens.mjs holds a copy of these helpers).

const VOCAB = 31;
const WORD = 30;
const SURE = -0.03045921;
const REST = -6.9077554;

/** Two swaying tones and seeded noise, in [-1, 1]. */
export function testWave(samples: number): Float32Array {
  const out = new Float32Array(samples);
  let seed = 12345;
  for (let i = 0; i < samples; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
    const noise = ((seed >>> 16) & 0x7fff) / 32768 - 0.5;
    const sway = 0.5 + 0.5 * Math.sin((2 * Math.PI * 3 * i) / 16000);
    out[i] =
      sway * 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000) +
      (1 - sway) * 0.2 * Math.sin((2 * Math.PI * 1760 * i) / 16000) +
      0.05 * noise;
  }
  return out;
}

/**
 * Log-probabilities that say these tokens, each for two frames, with blanks, and
 * `quiet` blank frames each side.
 */
export function sayTokens(
  tokens: readonly number[],
  seedStart: number,
  quiet = 2,
): {logp: Float32Array; frames: number} {
  const sequence: number[] = new Array(quiet).fill(0);
  for (const token of tokens) sequence.push(token, token, 0);
  for (let i = 0; i < quiet; i++) sequence.push(0);
  const logp = new Float32Array(sequence.length * VOCAB);
  let seed = seedStart;
  sequence.forEach((said, t) => {
    for (let v = 0; v < VOCAB; v++) {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0;
      const noise = ((seed >>> 16) & 0x7fff) / 32768;
      logp[t * VOCAB + v] =
        v === said ? SURE - 0.25 * noise : REST + 1.5 * noise;
    }
  });
  return {logp, frames: sequence.length};
}

/** Words as tokens with the word separator between them. */
export function joinWords(
  words: readonly string[],
  tokensOf: (letters: string) => number[],
): number[] {
  const out: number[] = [];
  words.forEach((word, i) => {
    if (i > 0) out.push(WORD);
    out.push(...tokensOf(word));
  });
  return out;
}
