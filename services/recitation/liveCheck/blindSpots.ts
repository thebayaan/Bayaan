import data from './blindSpots.json';

// Words the checker model misreads however well they are read. They are found offline,
// by running the live check over correct recitations by several reciters and keeping
// the places it calls bad for two or more of them (scripts/recitation-bench/fix2).
// The list holds places only: no text and no audio.

const BLIND = new Set<string>(data.words);

/** The model is known to misread this word when it is read right. */
export function isBlindSpot(
  surah: number,
  ayah: number,
  word: number,
): boolean {
  return BLIND.has(`${surah}:${ayah}:${word}`);
}
