// services/widgets/live-activity/ayahLayer.ts
// Pure math for the per-ayah Live Activity layer.
import type {AyahTimestamp} from '@/types/timestamps';
import {
  safeActivityRate,
  type NowPlayingAyah,
  type WidgetNowPlaying,
} from 'bayaan-widgets';
import {binarySearchAyah} from '@/utils/timestampUtils';
import type {TimingNumbering} from '@/utils/timestampNumbering';

// ActivityKit caps the whole content state at 4 KB; leave room for the rest.
export const MAX_AYAH_TEXT_BYTES = 600;
// Fire just after a boundary so the position lands inside the next ayah.
export const BOUNDARY_SLACK_MS = 50;

const ELLIPSIS = '…';

export function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function truncateWordByBytes(word: string, maxBytes: number): string {
  let out = '';
  let bytes = 0;
  for (const ch of word) {
    const size = utf8Length(ch);
    if (bytes + size > maxBytes) break;
    out += ch;
    bytes += size;
  }
  return out;
}

/** Whole words that fit in maxBytes, followed by an ellipsis when cut. */
export function truncateUtf8Words(text: string, maxBytes: number): string {
  if (utf8Length(text) <= maxBytes) return text;
  const budget = maxBytes - utf8Length(` ${ELLIPSIS}`);
  let out = '';
  for (const word of text.split(' ')) {
    const candidate = out ? `${out} ${word}` : word;
    if (utf8Length(candidate) > budget) break;
    out = candidate;
  }
  if (out) return `${out} ${ELLIPSIS}`;
  // The first word alone is over budget: cut it at a character boundary.
  const head = text.split(' ')[0] ?? '';
  return `${truncateWordByBytes(
    head,
    maxBytes - utf8Length(ELLIPSIS),
  )}${ELLIPSIS}`;
}

/** Track position in seconds at nowMs, extrapolated from the snapshot. */
export function positionAt(
  np: WidgetNowPlaying,
  generatedAt: number,
  nowMs: number,
): number {
  const raw = np.isPlaying
    ? np.positionSec +
      ((nowMs - generatedAt) / 1000) * safeActivityRate(np.rate)
    : np.positionSec;
  return Math.min(Math.max(raw, 0), Math.max(np.durationSec, 0));
}

export function currentAyahTimestamp(
  timestamps: AyahTimestamp[],
  positionSec: number,
): AyahTimestamp | null {
  return binarySearchAyah(timestamps, positionSec * 1000);
}

/** Wall ms until the next ayah starts, or null after the last one starts. */
export function msUntilNextAyah(
  timestamps: AyahTimestamp[],
  positionSec: number,
  rate: number,
): number | null {
  const positionMs = positionSec * 1000;
  const next = timestamps.find(t => t.timestampFrom > positionMs);
  if (!next) return null;
  return (next.timestampFrom - positionMs) / safeActivityRate(rate);
}

/**
 * The Hafs ayah being recited while timing entry `t` plays. A timing set's
 * entry numbers are its own (rewayah) numbers, so translate through the
 * surah's numbering. Null hides the ayah line (surah-level activity): a
 * disabled numbering, or an entry that recites no Hafs verse (a pre-roll).
 */
export function hafsActivityAyah(
  numbering: TimingNumbering,
  t: AyahTimestamp,
  hafsVerseCount: number,
  verseText: (verseKey: string) => string,
): NowPlayingAyah | null {
  if (numbering.mode === 'disabled') return null;
  const first = numbering.hafsKeysForEntry(t.ayahNumber)[0];
  const ayah = first ? Number(first.split(':')[1]) : NaN;
  if (!Number.isInteger(ayah) || ayah < 1) return null;
  return buildActivityAyah(
    ayah,
    hafsVerseCount,
    verseText(`${numbering.surah}:${ayah}`),
  );
}

export function buildActivityAyah(
  number: number,
  count: number,
  verseText: string,
): NowPlayingAyah {
  return {
    number,
    count,
    text: truncateUtf8Words(verseText, MAX_AYAH_TEXT_BYTES),
  };
}
