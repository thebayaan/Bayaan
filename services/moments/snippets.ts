// @ai-start
/**
 * Moments snippets served by the Bayaan backend (`GET /v1/snippets`).
 *
 * Everything here is pure: parsing the response, deciding when the cached
 * list is due for a refresh, and turning a snippet into a feed candidate and
 * a clip. The network and storage side lives in snippetSource.ts.
 */

import type {AyahTimestamp} from '@/types/timestamps';
import type {MomentClip} from './buildMoment';
import {buildMoment} from './buildMoment';
import type {FeedCandidate} from './buildFeed';
import type {MomentPassage} from './passages';

export interface Snippet {
  id: string;
  reciterId: string;
  reciterName: string;
  reciterSlug: string | null;
  reciterImageUrl: string | null;
  rewayatId: string;
  rewayatName: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  /** Position of the snippet's start in the reciter's surah file. */
  startMs: number;
  /** Position of the snippet's end in the reciter's surah file. */
  endMs: number;
  /** Pre-cut clip of exactly startMs..endMs, when the backend has one. */
  clipUrl: string | null;
  /** Feed weight multiplier; 1 is neutral. */
  weight: number;
}

export interface SnippetList {
  /** Monotonically increasing list version. */
  version: number;
  snippets: Snippet[];
}

export interface CachedSnippetList extends SnippetList {
  /** The response's ETag, sent back as If-None-Match to revalidate. */
  etag: string | null;
  /** When the list was last fetched or revalidated. */
  fetchedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** One snippet from the response, or null when it is malformed. */
export function parseSnippet(raw: unknown): Snippet | null {
  if (!isRecord(raw)) return null;
  const {id, reciterId, rewayatId, surah, ayahFrom, ayahTo, startMs, endMs} =
    raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof reciterId !== 'string' || !reciterId) return null;
  if (typeof rewayatId !== 'string' || !rewayatId) return null;
  if (!isPositiveInt(surah) || surah > 114) return null;
  if (!isPositiveInt(ayahFrom) || !isPositiveInt(ayahTo)) return null;
  if (ayahTo < ayahFrom) return null;
  if (typeof startMs !== 'number' || typeof endMs !== 'number') return null;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (startMs < 0 || endMs <= startMs) return null;

  const clipUrl = optionalString(raw.clipUrl);
  const weight =
    typeof raw.weight === 'number' &&
    Number.isFinite(raw.weight) &&
    raw.weight > 0
      ? raw.weight
      : 1;
  return {
    id,
    reciterId,
    reciterName: optionalString(raw.reciterName) ?? '',
    reciterSlug: optionalString(raw.reciterSlug),
    reciterImageUrl: optionalString(raw.reciterImageUrl),
    rewayatId,
    rewayatName: optionalString(raw.rewayatName) ?? '',
    surah,
    ayahFrom,
    ayahTo,
    startMs,
    endMs,
    clipUrl: clipUrl && /^https?:\/\//.test(clipUrl) ? clipUrl : null,
    weight,
  };
}

/**
 * The response body as a list, dropping malformed snippets. Null when the body
 * itself is not a snippet list.
 */
export function parseSnippetResponse(body: unknown): SnippetList | null {
  if (!isRecord(body) || !Array.isArray(body.snippets)) return null;
  const version =
    typeof body.version === 'number' && Number.isFinite(body.version)
      ? body.version
      : 0;
  const seen = new Set<string>();
  const snippets: Snippet[] = [];
  for (const raw of body.snippets) {
    const snippet = parseSnippet(raw);
    if (!snippet || seen.has(snippet.id)) continue;
    seen.add(snippet.id);
    snippets.push(snippet);
  }
  return {version, snippets};
}

/** A stored list read back from storage, or null when it is unusable. */
export function parseCachedSnippetList(
  raw: string | null,
): CachedSnippetList | null {
  if (!raw) return null;
  try {
    const body: unknown = JSON.parse(raw);
    const list = parseSnippetResponse(body);
    if (!list || !isRecord(body)) return null;
    const fetchedAt = typeof body.fetchedAt === 'number' ? body.fetchedAt : 0;
    const etag = optionalString(body.etag);
    return {...list, fetchedAt, etag};
  } catch {
    return null;
  }
}

/**
 * Whether the cached list is due to be revalidated: there is none, or it was
 * last checked more than `maxAgeMs` ago (or, with a clock that went back, in
 * the future). Revalidating sends the ETag, so an unchanged list costs a 304.
 */
export function shouldRefreshSnippets(
  cache: CachedSnippetList | null,
  now: number,
  maxAgeMs: number,
): boolean {
  if (!cache) return true;
  return now - cache.fetchedAt > maxAgeMs || now < cache.fetchedAt;
}

export function snippetPassage(snippet: Snippet): MomentPassage {
  return {
    id: `${snippet.surah}:${snippet.ayahFrom}-${snippet.ayahTo}`,
    surah: snippet.surah,
    fromAyah: snippet.ayahFrom,
    toAyah: snippet.ayahTo,
  };
}

export function snippetToCandidate(snippet: Snippet): FeedCandidate {
  return {
    reciterId: snippet.reciterId,
    rewayatId: snippet.rewayatId,
    passage: snippetPassage(snippet),
    weight: snippet.weight,
    snippet,
  };
}

const NO_LIMITS = {minMs: 0, maxMs: Number.POSITIVE_INFINITY};

/**
 * The clip for a snippet, in surah-file positions.
 *
 * Ayah boundaries come from the reciter's timestamps when they cover the
 * range. Without them the snippet is split across its ayat in proportion to
 * `ayahWeight` (the Arabic text length), so the caption still moves along.
 */
export function clipFromSnippet(
  snippet: Snippet,
  timestamps: AyahTimestamp[] | null,
  ayahWeight: (surah: number, ayah: number) => number,
): MomentClip {
  const {startMs, endMs} = snippet;
  const timed = timestamps
    ? buildMoment(snippetPassage(snippet), timestamps, NO_LIMITS)
    : null;
  if (timed) {
    const last = timed.ayat.length - 1;
    return {
      startMs,
      endMs,
      ayat: timed.ayat.map((a, i) => ({
        ayah: a.ayah,
        startMs:
          i === 0 ? startMs : Math.min(Math.max(a.startMs, startMs), endMs),
        endMs: i === last ? endMs : Math.min(Math.max(a.endMs, startMs), endMs),
      })),
    };
  }

  const ayahs: number[] = [];
  for (let a = snippet.ayahFrom; a <= snippet.ayahTo; a++) ayahs.push(a);
  const weights = ayahs.map(a => Math.max(1, ayahWeight(snippet.surah, a)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const length = endMs - startMs;
  let at = startMs;
  return {
    startMs,
    endMs,
    ayat: ayahs.map((ayah, i) => {
      const from = at;
      at = i === ayahs.length - 1 ? endMs : at + (length * weights[i]) / total;
      return {ayah, startMs: Math.round(from), endMs: Math.round(at)};
    }),
  };
}
// @ai-end
