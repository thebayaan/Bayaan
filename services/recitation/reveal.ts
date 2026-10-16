/** Words of one ayah revealed so far, in Tilawa's segmentation. */
export interface RevealedAyah {
  /** Leading words revealed (word_index + 1 at most). */
  count: number;
  /** Tilawa's word count for the ayah. */
  total: number;
}

export type RevealedWords = Readonly<Record<string, RevealedAyah>>;

function parseKey(key: string): [number, number] {
  const [surah, ayah] = key.split(':').map(Number);
  return [surah, ayah];
}

/**
 * Hide-and-reveal state after a word_progress event. Words are revealed up to
 * the frontier word and never hidden again; moving on to the very next ayah
 * reveals the rest of the one just finished (its last words may never get
 * their own event before the cursor moves).
 */
export function nextRevealed(
  revealed: RevealedWords,
  previousKey: string | null,
  key: string,
  wordIndex: number,
  total: number,
): RevealedWords {
  const current = revealed[key];
  const count = Math.min(Math.max(current?.count ?? 0, wordIndex + 1), total);
  let next: Record<string, RevealedAyah> | null = null;
  if (!current || current.count !== count || current.total !== total) {
    next = {...revealed, [key]: {count, total}};
  }
  if (previousKey && previousKey !== key) {
    const [ps, pa] = parseKey(previousKey);
    const [s, a] = parseKey(key);
    const finished = (next ?? revealed)[previousKey];
    if (
      s === ps &&
      a === pa + 1 &&
      finished &&
      finished.count < finished.total
    ) {
      next = {
        ...(next ?? revealed),
        [previousKey]: {count: finished.total, total: finished.total},
      };
    }
  }
  return next ?? revealed;
}
