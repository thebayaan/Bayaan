// @ai-start
import type {MomentPassage} from './passages';

export interface FeedCandidate {
  reciterId: string;
  rewayatId: string;
  passage: MomentPassage;
}

export interface FeedHistory {
  /** Reciter id to how many moments of theirs were played. */
  plays: Record<string, number>;
}

export interface FeedOptions {
  seed: number;
  length: number;
  favoriteIds?: Set<string>;
  history?: FeedHistory;
}

/** Small seeded PRNG so a session's order is stable and testable. */
/* eslint-disable no-bitwise */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

function reciterWeight(reciterId: string, options: FeedOptions): number {
  let weight = 1;
  // Discovery first: people already know their favorites.
  if (options.favoriteIds?.has(reciterId)) weight *= 0.4;
  const plays = options.history?.plays[reciterId] ?? 0;
  if (plays === 0) weight *= 1.5;
  else weight /= 1 + plays * 0.25;
  return weight;
}

/**
 * Orders candidates into a feed.
 *
 * A reciter does not come back within `min(15, reciters - 1)` cards, and the
 * same passage never plays twice in a row. When the rules cannot both hold
 * (very few reciters), the spacing rule is relaxed rather than ending early.
 */
export function buildFeed(
  candidates: FeedCandidate[],
  options: FeedOptions,
): FeedCandidate[] {
  if (candidates.length === 0) return [];
  const rand = mulberry32(options.seed);
  // Weight per reciter, not per clip, so a reciter with more timed surahs
  // does not crowd out the rest.
  const clipsPerReciter = new Map<string, number>();
  for (const c of candidates) {
    clipsPerReciter.set(
      c.reciterId,
      (clipsPerReciter.get(c.reciterId) ?? 0) + 1,
    );
  }
  const gap = Math.min(15, Math.max(0, clipsPerReciter.size - 1));
  const feed: FeedCandidate[] = [];
  const used = new Set<FeedCandidate>();

  while (feed.length < options.length) {
    const recent = new Set(feed.slice(-gap).map(c => c.reciterId));
    const lastPassage = feed[feed.length - 1]?.passage.id;
    const pool = candidates.filter(c => !used.has(c));
    if (pool.length === 0) {
      // Every candidate has been shown: start a fresh round.
      used.clear();
      continue;
    }

    let eligible = pool.filter(
      c => !recent.has(c.reciterId) && c.passage.id !== lastPassage,
    );
    if (eligible.length === 0) {
      eligible = pool.filter(
        c => c.reciterId !== feed[feed.length - 1]?.reciterId,
      );
    }
    if (eligible.length === 0) eligible = pool;

    const weights = eligible.map(
      c =>
        reciterWeight(c.reciterId, options) /
        (clipsPerReciter.get(c.reciterId) ?? 1),
    );
    const total = weights.reduce((sum, w) => sum + w, 0);
    let pick = rand() * total;
    let chosen = eligible[eligible.length - 1];
    for (let i = 0; i < eligible.length; i++) {
      pick -= weights[i];
      if (pick <= 0) {
        chosen = eligible[i];
        break;
      }
    }
    used.add(chosen);
    feed.push(chosen);
  }
  return feed;
}
// @ai-end
