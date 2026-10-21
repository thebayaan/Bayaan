// @ai-start
import {buildMoment, ayahAt} from '../buildMoment';
import {buildFeed, mulberry32, FeedCandidate} from '../buildFeed';
import {MOMENT_PASSAGES, isWholeSurah, MomentPassage} from '../passages';
import type {AyahTimestamp} from '@/types/timestamps';

function timestamps(surah: number, lengthsSec: number[]): AyahTimestamp[] {
  let t = 2_000;
  return lengthsSec.map((len, i) => {
    const from = t;
    t += len * 1000;
    return {
      surahNumber: surah,
      ayahNumber: i + 1,
      timestampFrom: from,
      timestampTo: t,
      durationMs: len * 1000,
    };
  });
}

const ikhlas: MomentPassage = {
  id: '112:1-4',
  surah: 112,
  fromAyah: 1,
  toAyah: 4,
};

describe('buildMoment', () => {
  it('cuts whole ayat from the first start to the last end', () => {
    const clip = buildMoment(ikhlas, timestamps(112, [4, 3, 3, 5]));
    expect(clip).toEqual({
      startMs: 2_000,
      endMs: 17_000,
      ayat: [
        {ayah: 1, startMs: 2_000, endMs: 6_000},
        {ayah: 2, startMs: 6_000, endMs: 9_000},
        {ayah: 3, startMs: 9_000, endMs: 12_000},
        {ayah: 4, startMs: 12_000, endMs: 17_000},
      ],
    });
  });

  it('rejects a passage with a missing ayah', () => {
    const ts = timestamps(112, [4, 3, 3, 5]).filter(t => t.ayahNumber !== 3);
    expect(buildMoment(ikhlas, ts)).toBeNull();
  });

  it('rejects clips that are too short or too long', () => {
    expect(buildMoment(ikhlas, timestamps(112, [1, 1, 1, 1]))).toBeNull();
    expect(buildMoment(ikhlas, timestamps(112, [30, 30, 30, 30]))).toBeNull();
  });

  it('finds the playing ayah', () => {
    const clip = buildMoment(ikhlas, timestamps(112, [4, 3, 3, 5]))!;
    expect(ayahAt(clip, 0)).toBe(1);
    expect(ayahAt(clip, 6_500)).toBe(2);
    expect(ayahAt(clip, 16_999)).toBe(4);
  });
});

describe('passages', () => {
  it('have unique ids and valid ranges', () => {
    const ids = new Set(MOMENT_PASSAGES.map(p => p.id));
    expect(ids.size).toBe(MOMENT_PASSAGES.length);
    for (const p of MOMENT_PASSAGES)
      expect(p.toAyah).toBeGreaterThanOrEqual(p.fromAyah);
  });

  it('knows whole surahs', () => {
    expect(isWholeSurah(ikhlas)).toBe(true);
    expect(isWholeSurah(MOMENT_PASSAGES.find(p => p.id === '2:255')!)).toBe(
      false,
    );
  });
});

describe('buildFeed', () => {
  const reciters = Array.from({length: 20}, (_, i) => `r${i}`);
  const candidates: FeedCandidate[] = reciters.flatMap(reciterId =>
    MOMENT_PASSAGES.slice(0, 5).map(passage => ({
      reciterId,
      rewayatId: `${reciterId}-hafs`,
      passage,
    })),
  );

  it('is deterministic for a seed', () => {
    const a = buildFeed(candidates, {seed: 7, length: 30});
    const b = buildFeed(candidates, {seed: 7, length: 30});
    expect(a).toEqual(b);
    expect(mulberry32(1)()).toBe(mulberry32(1)());
  });

  it('does not repeat a reciter within 15 cards or a passage back to back', () => {
    const feed = buildFeed(candidates, {seed: 3, length: 60});
    expect(feed).toHaveLength(60);
    feed.forEach((item, i) => {
      const window = feed.slice(Math.max(0, i - 15), i).map(c => c.reciterId);
      expect(window).not.toContain(item.reciterId);
      if (i > 0) expect(item.passage.id).not.toBe(feed[i - 1].passage.id);
    });
  });

  it('still fills the feed with only two reciters', () => {
    const few = candidates.filter(
      c => c.reciterId === 'r0' || c.reciterId === 'r1',
    );
    const feed = buildFeed(few, {seed: 1, length: 12});
    expect(feed).toHaveLength(12);
    feed.forEach((item, i) => {
      if (i > 0) expect(item.reciterId).not.toBe(feed[i - 1].reciterId);
    });
  });

  it('shows favorites less often than new reciters', () => {
    const favoriteIds = new Set(reciters.slice(0, 10));
    let favorites = 0;
    for (let seed = 0; seed < 40; seed++) {
      const first = buildFeed(candidates, {seed, length: 1, favoriteIds})[0];
      if (favoriteIds.has(first.reciterId)) favorites++;
    }
    expect(favorites).toBeLessThan(20);
  });

  it('returns nothing for no candidates', () => {
    expect(buildFeed([], {seed: 1, length: 5})).toEqual([]);
  });
});
// @ai-end
