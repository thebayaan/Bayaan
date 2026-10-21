// @ai-start
import {
  clipFromSnippet,
  parseCachedSnippetList,
  parseSnippet,
  parseSnippetResponse,
  shouldRefreshSnippets,
  Snippet,
  snippetToCandidate,
} from '../snippets';
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

describe('parseSnippet', () => {
  it('reads a well-formed snippet', () => {
    expect(parseSnippet(raw)).toEqual({...raw, reciterImageUrl: null});
  });

  it('drops snippets with bad ranges or ids', () => {
    expect(parseSnippet({...raw, id: ''})).toBeNull();
    expect(parseSnippet({...raw, surah: 115})).toBeNull();
    expect(parseSnippet({...raw, ayahTo: 0})).toBeNull();
    expect(parseSnippet({...raw, ayahFrom: 5, ayahTo: 4})).toBeNull();
    expect(parseSnippet({...raw, endMs: 2_000})).toBeNull();
    expect(parseSnippet({...raw, startMs: -1})).toBeNull();
    expect(parseSnippet({...raw, startMs: '2000'})).toBeNull();
    expect(parseSnippet(null)).toBeNull();
  });

  it('defaults weight to 1 and ignores clip URLs that are not http(s)', () => {
    const s = parseSnippet({...raw, weight: -3, clipUrl: 'file:///x.mp3'})!;
    expect(s.weight).toBe(1);
    expect(s.clipUrl).toBeNull();
    expect(parseSnippet({...raw, weight: undefined})!.weight).toBe(1);
  });
});

describe('parseSnippetResponse', () => {
  it('keeps valid snippets once each and the version', () => {
    const list = parseSnippetResponse({
      version: 12,
      snippets: [raw, {...raw}, {...raw, id: 'sn-2'}, {nope: true}],
    });
    expect(list?.version).toBe(12);
    expect(list?.snippets.map(s => s.id)).toEqual(['sn-1', 'sn-2']);
  });

  it('rejects a body that is not a list', () => {
    expect(parseSnippetResponse({error: 'Not found'})).toBeNull();
    expect(parseSnippetResponse('nope')).toBeNull();
  });

  it('reads back a cached list', () => {
    const cached = parseCachedSnippetList(
      JSON.stringify({
        version: 3,
        snippets: [raw],
        catalogVersion: 8,
        fetchedAt: 1000,
      }),
    );
    expect(cached).toMatchObject({
      version: 3,
      catalogVersion: 8,
      fetchedAt: 1000,
    });
    expect(cached?.snippets).toHaveLength(1);
    expect(parseCachedSnippetList('{broken')).toBeNull();
    expect(parseCachedSnippetList(null)).toBeNull();
  });
});

describe('shouldRefreshSnippets', () => {
  const cache = {
    version: 1,
    snippets: [],
    catalogVersion: 5,
    fetchedAt: 10_000,
  };
  const ctx = {now: 20_000, lastSeenCatalogVersion: 5, maxAgeMs: 60_000};

  it('refreshes with nothing cached', () => {
    expect(shouldRefreshSnippets(null, ctx)).toBe(true);
  });

  it('keeps a fresh list for the same catalog version', () => {
    expect(shouldRefreshSnippets(cache, ctx)).toBe(false);
    expect(
      shouldRefreshSnippets(cache, {...ctx, lastSeenCatalogVersion: null}),
    ).toBe(false);
  });

  it('refreshes when the catalog version moved on', () => {
    expect(
      shouldRefreshSnippets(cache, {...ctx, lastSeenCatalogVersion: 6}),
    ).toBe(true);
    expect(shouldRefreshSnippets({...cache, catalogVersion: null}, ctx)).toBe(
      true,
    );
  });

  it('refreshes an old list, or one from the future', () => {
    expect(shouldRefreshSnippets(cache, {...ctx, now: 80_001})).toBe(true);
    expect(shouldRefreshSnippets(cache, {...ctx, now: 5_000})).toBe(true);
  });
});

describe('snippetToCandidate', () => {
  it('carries the weight and the snippet', () => {
    const snippet = parseSnippet(raw)!;
    expect(snippetToCandidate(snippet)).toEqual({
      reciterId: 'r1',
      rewayatId: 'rw1',
      passage: {id: '112:1-4', surah: 112, fromAyah: 1, toAyah: 4},
      weight: 2,
      snippet,
    });
  });
});

describe('clipFromSnippet', () => {
  const snippet = parseSnippet(raw) as Snippet;

  it('uses the reciter timestamps, clamped to the snippet', () => {
    const clip = clipFromSnippet(
      {...snippet, startMs: 2_200, endMs: 16_800},
      timestamps(112, [4, 3, 3, 5]),
      () => 1,
    );
    expect(clip).toEqual({
      startMs: 2_200,
      endMs: 16_800,
      ayat: [
        {ayah: 1, startMs: 2_200, endMs: 6_000},
        {ayah: 2, startMs: 6_000, endMs: 9_000},
        {ayah: 3, startMs: 9_000, endMs: 12_000},
        {ayah: 4, startMs: 12_000, endMs: 16_800},
      ],
    });
  });

  it('splits by text length without timestamps', () => {
    const clip = clipFromSnippet(snippet, null, (_s, ayah) =>
      ayah === 1 ? 20 : 10,
    );
    expect(clip.startMs).toBe(2_000);
    expect(clip.endMs).toBe(17_000);
    expect(clip.ayat.map(a => [a.ayah, a.startMs, a.endMs])).toEqual([
      [1, 2_000, 8_000],
      [2, 8_000, 11_000],
      [3, 11_000, 14_000],
      [4, 14_000, 17_000],
    ]);
  });

  it('falls back to the split when the timestamps miss an ayah', () => {
    const ts = timestamps(112, [4, 3, 3, 5]).filter(t => t.ayahNumber !== 2);
    const clip = clipFromSnippet(snippet, ts, () => 1);
    expect(clip.ayat).toHaveLength(4);
    expect(clip.ayat[3].endMs).toBe(17_000);
  });
});
// @ai-end
