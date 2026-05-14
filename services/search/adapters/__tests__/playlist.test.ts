import {
  buildPlaylistIndex,
  playlistToResult,
  type PlaylistSummary,
} from '../playlist';

describe('playlist adapter', () => {
  const rows: PlaylistSummary[] = [
    {id: 'system:loved', name: 'Loved tracks', itemCount: 14},
    {id: 'user:abc', name: 'Friday playlist', itemCount: 6},
  ];
  const idx = buildPlaylistIndex(rows);

  it('matches by name', () => {
    const hits = idx.search('Friday');
    expect(hits[0].id).toBe('playlist:user:abc');
  });

  it('playlistToResult shape', () => {
    const r = playlistToResult(rows[0], {
      textualScore: 1,
      personalBoost: 0,
      contextualBoost: 0,
      finalScore: 1,
      tier: 'exact',
      matchedField: 'name',
      matchedRange: null,
      signal: null,
    });
    expect(r.type).toBe('playlist');
    expect(r.title).toBe('Loved tracks');
  });
});
