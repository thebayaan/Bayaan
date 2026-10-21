// @ai-start
import {ayahAt} from '../buildMoment';
import {momentSourceFor, surahSource} from '../momentSource';
import {clipFromSnippet, parseSnippet} from '../snippets';
import type {AyahTimestamp} from '@/types/timestamps';

const raw = {
  id: 'sn-1',
  reciterId: 'r1',
  reciterName: 'Reciter One',
  reciterSlug: 'reciter-one',
  reciterImageUrl: null,
  rewayatId: 'rw1',
  rewayatName: 'Hafs',
  surah: 112,
  ayahFrom: 1,
  ayahTo: 4,
  startMs: 2_000,
  endMs: 17_000,
  clipUrl: 'https://cdn.example.test/clips/sn-1.mp3',
  weight: 2,
};

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

describe('momentSourceFor', () => {
  const card = {
    key: 'k',
    url: 'https://audio.example.test/112.mp3',
    clip: clipFromSnippet(
      parseSnippet(raw)!,
      timestamps(112, [4, 3, 3, 5]),
      () => 1,
    ),
  };

  it('seeks into the surah file without a downloaded clip', () => {
    expect(momentSourceFor(card, null)).toEqual({
      key: 'k',
      url: 'https://audio.example.test/112.mp3',
      startMs: 2_000,
      endMs: 17_000,
    });
  });

  it('plays a downloaded clip from 0 to its length, offset to surah time', () => {
    const source = momentSourceFor(
      card,
      'file:///cache/moments-clips/sn-1.mp3',
    );
    expect(source).toEqual({
      key: 'k',
      url: 'file:///cache/moments-clips/sn-1.mp3',
      startMs: 0,
      endMs: 15_000,
      offsetMs: 2_000,
      fallback: surahSource(card),
    });
    // 4.5 s into the clip is 6.5 s into the surah: the second ayah.
    expect(ayahAt(card.clip, 4_500 + source.offsetMs!)).toBe(2);
    expect(ayahAt(card.clip, source.endMs - 1 + source.offsetMs!)).toBe(4);
  });
});
// @ai-end
