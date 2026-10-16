/**
 * Hide and reveal keeps one point in the Quran: every word up to and
 * including it is shown, everything after it is hidden. It only moves
 * forward, so starting mid-page shows what comes before, and a jump ahead
 * shows the ayat skipped over.
 */
export interface RevealedThrough {
  surah: number;
  ayah: number;
  /** Last Digital Khatt word position shown in that ayah. */
  position: number;
}

/** Position meaning "the whole ayah". */
export const WHOLE_AYAH = Number.MAX_SAFE_INTEGER;

export interface AyahRef {
  surah: number;
  ayah: number;
}

/** Quran facts reveal needs, injected so the logic stays pure. */
export interface RevealSource {
  /** Ayat in a surah. */
  ayahCount: (surah: number) => number;
  /** Last word position of an ayah, ayah marker excluded. */
  lastPosition: (surah: number, ayah: number) => number;
}

function compare(a: RevealedThrough, b: RevealedThrough): number {
  return a.surah - b.surah || a.ayah - b.ayah || a.position - b.position;
}

/** The later of the two points; `current` itself when it is not behind. */
export function advanceRevealed(
  current: RevealedThrough | null,
  next: RevealedThrough,
): RevealedThrough {
  if (current && compare(current, next) >= 0) return current;
  return next;
}

export function isRevealed(
  through: RevealedThrough | null,
  surah: number,
  ayah: number,
  position: number,
): boolean {
  if (!through) return false;
  if (surah !== through.surah) return surah < through.surah;
  if (ayah !== through.ayah) return ayah < through.ayah;
  return position <= through.position;
}

function nextAyah(ref: AyahRef, source: RevealSource): AyahRef | null {
  if (ref.ayah < source.ayahCount(ref.surah)) {
    return {surah: ref.surah, ayah: ref.ayah + 1};
  }
  return ref.surah < 114 ? {surah: ref.surah + 1, ayah: 1} : null;
}

function isComplete(through: RevealedThrough, source: RevealSource): boolean {
  return through.position >= source.lastPosition(through.surah, through.ayah);
}

/**
 * Peek one word: the next hidden word after the point, or the first word of
 * `start` (the page on screen) before anything is revealed.
 */
export function peekWord(
  through: RevealedThrough | null,
  start: AyahRef,
  source: RevealSource,
): RevealedThrough {
  if (!through) return {...start, position: 1};
  if (!isComplete(through, source)) {
    return {...through, position: through.position + 1};
  }
  const next = nextAyah(through, source);
  return next ? {...next, position: 1} : through;
}

/**
 * Peek an ayah: the rest of the ayah being recited, or the whole next one
 * when it is already shown.
 */
export function peekAyah(
  through: RevealedThrough | null,
  start: AyahRef,
  source: RevealSource,
): RevealedThrough {
  if (!through) return {...start, position: WHOLE_AYAH};
  if (!isComplete(through, source)) return {...through, position: WHOLE_AYAH};
  const next = nextAyah(through, source);
  return next ? {...next, position: WHOLE_AYAH} : through;
}
