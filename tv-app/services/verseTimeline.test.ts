import fatiha from './__fixtures__/timings/hafs-001.json';
import ikhlas from './__fixtures__/timings/hafs-112.json';
import ikhlasPreroll from './__fixtures__/timings/hafs-preroll-112.json';
import warshFatiha from './__fixtures__/timings/warsh-001.json';
import {
  advanceRepeat,
  buildTimeline,
  RESTART_THRESHOLD_MS,
  stepTarget,
  verseAt,
  verseTicks,
  type VerseTimeline,
} from './verseTimeline';

const HAFS = "Hafs A'n Assem";

function timeline(
  entries: typeof fatiha,
  surahNumber: number,
  hafsVerseCount: number,
): VerseTimeline {
  const t = buildTimeline(entries, {
    surahNumber,
    hafsVerseCount,
    rewayahName: HAFS,
  });
  if (!t) throw new Error('expected a timeline');
  return t;
}

describe('buildTimeline', () => {
  it('accepts Hafs timings that match the verse count', () => {
    const t = timeline(fatiha, 1, 7);
    expect(t.verses).toHaveLength(7);
    expect(t.verses[0]).toEqual({ayah: 1, fromMs: 100, toMs: 5240});
  });

  it('drops the opening entry and keeps verses 1..n', () => {
    const t = timeline(ikhlasPreroll, 112, 4);
    expect(t.verses.map(v => v.ayah)).toEqual([1, 2, 3, 4]);
    expect(t.verses[0].fromMs).toBe(7928);
  });

  it('rejects other rewayat even when the count matches', () => {
    expect(
      buildTimeline(warshFatiha, {
        surahNumber: 1,
        hafsVerseCount: 7,
        rewayahName: "Warsh A'n Nafi'",
      }),
    ).toBeNull();
  });

  it('rejects timings whose count does not match the text', () => {
    expect(
      buildTimeline(ikhlas.slice(0, 3), {
        surahNumber: 112,
        hafsVerseCount: 4,
        rewayahName: HAFS,
      }),
    ).toBeNull();
  });
});

describe('verseAt', () => {
  const t = timeline(ikhlasPreroll, 112, 4);

  it('is 0 during the opening', () => {
    expect(verseAt(t, 0)).toBe(0);
    expect(verseAt(t, 7927)).toBe(0);
  });

  it('follows the verse boundaries', () => {
    expect(verseAt(t, 7928)).toBe(1);
    expect(verseAt(t, 13723)).toBe(1);
    expect(verseAt(t, 13724)).toBe(2);
    expect(verseAt(t, 10_000_000)).toBe(4);
  });
});

describe('stepTarget', () => {
  const t = timeline(fatiha, 1, 7);

  it('moves to the next verse start', () => {
    expect(stepTarget(t, 1000, 1)).toBe(t.verses[1].fromMs);
  });

  it('has nowhere to go after the last verse', () => {
    expect(stepTarget(t, t.verses[6].fromMs + 10, 1)).toBeNull();
  });

  it('restarts the verse when well into it', () => {
    const v3 = t.verses[2];
    expect(stepTarget(t, v3.fromMs + RESTART_THRESHOLD_MS + 1, -1)).toBe(
      v3.fromMs,
    );
  });

  it('goes to the previous verse near the start of one', () => {
    const v3 = t.verses[2];
    expect(stepTarget(t, v3.fromMs + 500, -1)).toBe(t.verses[1].fromMs);
  });

  it('goes to the very start from the opening or verse 1', () => {
    const pre = timeline(ikhlasPreroll, 112, 4);
    expect(stepTarget(pre, 3000, -1)).toBe(0);
    expect(stepTarget(pre, pre.verses[0].fromMs + 100, -1)).toBe(0);
  });
});

describe('advanceRepeat', () => {
  const t = timeline(ikhlas, 112, 4);
  const v2 = t.verses[1];

  it('waits until the verse ends', () => {
    const r = advanceRepeat(t, {ayah: 2, times: 3, played: 0}, v2.toMs - 1);
    expect(r).toEqual({
      seekToMs: null,
      repeat: {ayah: 2, times: 3, played: 0},
      done: false,
    });
  });

  it('seeks back while plays are left, then lets playback go on', () => {
    let repeat = {ayah: 2, times: 3, played: 0};
    const seeks: (number | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const r = advanceRepeat(t, repeat, v2.toMs + 5);
      seeks.push(r.seekToMs);
      repeat = r.repeat;
      if (r.done) break;
    }
    expect(seeks).toEqual([v2.fromMs, v2.fromMs, null]);
    expect(repeat.played).toBe(3);
  });

  it('repeats forever with Infinity', () => {
    const r = advanceRepeat(
      t,
      {ayah: 2, times: Infinity, played: 1000},
      v2.toMs,
    );
    expect(r.seekToMs).toBe(v2.fromMs);
    expect(r.done).toBe(false);
  });
});

describe('verseTicks', () => {
  it('marks each verse start after the first as a fraction', () => {
    const t = timeline(ikhlas, 112, 4);
    const ticks = verseTicks(t, 20_000);
    expect(ticks).toEqual([7266 / 20_000, 9555 / 20_000, 11970 / 20_000]);
  });

  it('is empty without a duration', () => {
    expect(verseTicks(timeline(ikhlas, 112, 4), 0)).toEqual([]);
  });
});
