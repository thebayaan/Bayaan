/**
 * Verse timing logic for the listening room: which verse is being recited,
 * where Left/Right should jump, and when a repeated verse should start over.
 *
 * Pure functions over the CDN timing files
 * (`cdn.thebayaan.com/timestamps/{rewayahId}/{surah}.json`), so the player can
 * be tested against real timing data without audio.
 */

/** One entry of a CDN timing file. Times are milliseconds into the track. */
export type TimingEntry = {
  surahNumber: number;
  ayahNumber: number;
  timestampFrom: number;
  timestampTo: number;
  durationMs: number;
};

export type VerseSpan = {ayah: number; fromMs: number; toMs: number};

export type VerseTimeline = {
  surahNumber: number;
  /** Verses 1..n in order. */
  verses: VerseSpan[];
};

/**
 * Builds a timeline the screen can trust, or null when the timings can't be
 * mapped to the Arabic text verse by verse.
 *
 * Only Hafs recitations whose entries line up one to one with the Hafs verse
 * count qualify. Other rewayat number and split verses differently (Warsh
 * counts the basmala of Al-Fatihah, for one), and the mobile app needs a whole
 * numbering service to translate them; until the TV ports that, those
 * recitations play without verse sync rather than show the wrong verse. An
 * `ayahNumber` 0 entry is the opening (isti'adha / basmala) before verse 1.
 */
export function buildTimeline(
  entries: readonly TimingEntry[],
  options: {surahNumber: number; hafsVerseCount: number; rewayahName: string},
): VerseTimeline | null {
  if (!/hafs/i.test(options.rewayahName)) return null;
  const verses = entries
    .filter(e => e.surahNumber === options.surahNumber && e.ayahNumber >= 1)
    .map(e => ({
      ayah: e.ayahNumber,
      fromMs: e.timestampFrom,
      toMs: e.timestampTo,
    }))
    .sort((a, b) => a.ayah - b.ayah);
  if (verses.length !== options.hafsVerseCount) return null;
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    if (v.ayah !== i + 1 || !(v.toMs > v.fromMs)) return null;
    if (i > 0 && v.fromMs < verses[i - 1].fromMs) return null;
  }
  return {surahNumber: options.surahNumber, verses};
}

/** The verse being recited at `positionMs`, or 0 during the opening. */
export function verseAt(timeline: VerseTimeline, positionMs: number): number {
  const {verses} = timeline;
  if (verses.length === 0 || positionMs < verses[0].fromMs) return 0;
  // Binary search for the last verse that has started.
  let lo = 0;
  let hi = verses.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (verses[mid].fromMs <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return verses[lo].ayah;
}

export function verseSpan(
  timeline: VerseTimeline,
  ayah: number,
): VerseSpan | null {
  return timeline.verses[ayah - 1] ?? null;
}

/**
 * Past this far into a verse, Left goes back to its start instead of to the
 * previous verse, like a track's previous button.
 */
export const RESTART_THRESHOLD_MS = 2000;

/**
 * Where Left (-1) or Right (+1) should seek to, in milliseconds, or null when
 * there's nowhere to go (Right on the last verse).
 */
export function stepTarget(
  timeline: VerseTimeline,
  positionMs: number,
  direction: 1 | -1,
): number | null {
  const current = verseAt(timeline, positionMs);
  const first = timeline.verses[0];
  if (!first) return null;
  if (direction === 1) {
    const next = verseSpan(timeline, current + 1);
    return next ? next.fromMs : null;
  }
  if (current === 0) return 0;
  const span = verseSpan(timeline, current);
  if (span && positionMs - span.fromMs > RESTART_THRESHOLD_MS) {
    return span.fromMs;
  }
  const prev = verseSpan(timeline, current - 1);
  return prev ? prev.fromMs : 0;
}

/** Repeat one verse `times` times in all (Infinity for until stopped). */
export type VerseRepeat = {ayah: number; times: number; played: number};

/**
 * Called on every position update while a verse repeat is on. When playback
 * runs past the end of the repeated verse with plays left, returns where to
 * seek back to and the updated count; once the count is used up it returns
 * `done` so playback carries on into the next verse.
 */
export function advanceRepeat(
  timeline: VerseTimeline,
  repeat: VerseRepeat,
  positionMs: number,
): {seekToMs: number | null; repeat: VerseRepeat; done: boolean} {
  const span = verseSpan(timeline, repeat.ayah);
  if (!span) return {seekToMs: null, repeat, done: true};
  if (positionMs < span.toMs) return {seekToMs: null, repeat, done: false};
  const played = repeat.played + 1;
  if (played >= repeat.times) {
    return {seekToMs: null, repeat: {...repeat, played}, done: true};
  }
  return {seekToMs: span.fromMs, repeat: {...repeat, played}, done: false};
}

/** Verse start positions as fractions of the track, for progress-bar ticks. */
export function verseTicks(
  timeline: VerseTimeline,
  durationMs: number,
): number[] {
  if (!(durationMs > 0)) return [];
  return timeline.verses
    .slice(1)
    .map(v => v.fromMs / durationMs)
    .filter(f => f > 0 && f < 1);
}
