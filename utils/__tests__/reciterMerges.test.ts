// @ai-generated
import type {Reciter, Rewayat} from '@/data/reciterData';
import {
  RECITER_MERGES,
  canonicalReciterId,
  canonicalReciterSlug,
  foldMergedReciters,
  remapMergedReciterJson,
  remapMergedReciterRefs,
} from '../reciterMerges';

const YASER = '37761060-bd83-4b46-8fec-e71627eb0531';
const YASSER = 'b5312425-cc6b-4e53-b862-5b389c5dea94';
const HADR = '489595b0-83f5-46f4-85c1-e415fc674a42';
const MURATTAL = '13e951aa-4d66-436d-8d83-e539b6518aa3';

function rewayat(id: string, reciterId: string, style: string): Rewayat {
  return {
    id,
    reciter_id: reciterId,
    name: "Hafs A'n Assem",
    style,
    server: `https://cdn.example/${id}`,
    surah_total: 114,
    surah_list: [1, 2],
    source_type: 'bayaan',
    created_at: '2026-04-08',
  };
}

function reciter(id: string, name: string, rw: Rewayat[]): Reciter {
  return {id, name, slug: null, date: null, image_url: null, rewayat: rw};
}

const yaser = reciter(YASER, 'Yaser Salamah', [rewayat(HADR, YASER, 'hadr')]);
const yasser = reciter(YASSER, 'Yasser Salamah', [
  rewayat(MURATTAL, YASSER, 'murattal'),
]);
const other = reciter('other', 'Zaki Daghistani', []);

describe('foldMergedReciters', () => {
  it('lists Yasser Salamah once with both Hafs recitations', () => {
    const folded = foldMergedReciters([yaser, yasser, other]);
    expect(folded.map(r => r.id)).toEqual([YASSER, 'other']);
    expect(folded[0].name).toBe('Yasser Salamah');
    expect(folded[0].rewayat.map(r => [r.id, r.reciter_id])).toEqual([
      [MURATTAL, YASSER],
      [HADR, YASSER],
    ]);
  });

  it('returns the same list once the backend has merged them', () => {
    const list = [yasser, other];
    expect(foldMergedReciters(list)).toBe(list);
  });

  it('keeps the duplicate when the reciter it merges into is missing', () => {
    expect(foldMergedReciters([yaser, other]).map(r => r.id)).toEqual([
      YASER,
      'other',
    ]);
  });

  it('does not add a recitation the kept reciter already has', () => {
    const merged = reciter(YASSER, 'Yasser Salamah', [
      rewayat(MURATTAL, YASSER, 'murattal'),
      rewayat(HADR, YASSER, 'hadr'),
    ]);
    expect(foldMergedReciters([yaser, merged])[0].rewayat).toHaveLength(2);
  });
});

describe('canonical lookups', () => {
  it('sends the old id and slug to the kept reciter', () => {
    expect(canonicalReciterId(YASER)).toBe(YASSER);
    expect(canonicalReciterSlug('yaser-salamah')).toBe('yasser-salamah');
    expect(canonicalReciterId('other')).toBe('other');
    expect(RECITER_MERGES).toHaveLength(1);
  });
});

describe('remapMergedReciterRefs', () => {
  it('moves ids, built ids, names and slugs but not file names', () => {
    const saved = {
      tracks: [{reciterId: YASER, surahId: '1', rewayatId: HADR}],
      downloads: [
        {
          id: `${YASER}-1-${HADR}`,
          reciterId: YASER,
          filePath: `001_${YASER}_${HADR}.mp3`,
        },
      ],
      progressMap: {[`${YASER}:1`]: 30},
      recent: {
        reciter: {id: YASER, name: 'Yaser Salamah', slug: 'yaser-salamah'},
      },
      mushaf: {reciterName: 'Yaser Salamah'},
    };
    expect(remapMergedReciterRefs(saved)).toEqual({
      tracks: [{reciterId: YASSER, surahId: '1', rewayatId: HADR}],
      downloads: [
        {
          id: `${YASSER}-1-${HADR}`,
          reciterId: YASSER,
          filePath: `001_${YASER}_${HADR}.mp3`,
        },
      ],
      progressMap: {[`${YASSER}:1`]: 30},
      recent: {
        reciter: {id: YASSER, name: 'Yasser Salamah', slug: 'yasser-salamah'},
      },
      mushaf: {reciterName: 'Yasser Salamah'},
    });
  });

  it('keeps one copy when both reciters were saved', () => {
    const saved = {
      favoriteReciterIds: [YASSER, YASER],
      favoriteReciters: {
        [YASSER]: {id: YASSER, favoritedAt: 1},
        [YASER]: {id: YASER, favoritedAt: 2},
      },
    };
    expect(remapMergedReciterRefs(saved)).toEqual({
      favoriteReciterIds: [YASSER],
      favoriteReciters: {[YASSER]: {id: YASSER, favoritedAt: 1}},
    });
  });

  it('returns the same object when nothing refers to a merged reciter', () => {
    const saved = {tracks: [{reciterId: 'other'}]};
    expect(remapMergedReciterRefs(saved)).toBe(saved);
  });
});

describe('remapMergedReciterJson', () => {
  it('leaves unrelated and non-JSON text unchanged', () => {
    const text = JSON.stringify({a: 1});
    expect(remapMergedReciterJson(text)).toBe(text);
    expect(remapMergedReciterJson(`not json ${YASER}`)).toBe(
      `not json ${YASER}`,
    );
  });

  it('rewrites saved JSON that mentions the old id', () => {
    expect(
      JSON.parse(remapMergedReciterJson(JSON.stringify({id: YASER}))),
    ).toEqual({id: YASSER});
  });
});
