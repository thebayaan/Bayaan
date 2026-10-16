import {EMPTY_ARTWORK_REQUESTS, parseArtworkRequests} from '../artworkRequests';

describe('parseArtworkRequests', () => {
  it('keeps valid, unique surah ids and reciter ids', () => {
    expect(
      parseArtworkRequests(
        JSON.stringify({
          surahIds: [18, 18, 0, 115, 2.5, '36', 36],
          reciterIds: ['r1', '', 'r1', 7, 'r2'],
        }),
      ),
    ).toEqual({surahIds: [18, 36], reciterIds: ['r1', 'r2']});
  });

  it('returns empty requests for garbage', () => {
    expect(parseArtworkRequests('nope')).toEqual(EMPTY_ARTWORK_REQUESTS);
    expect(parseArtworkRequests('[]')).toEqual(EMPTY_ARTWORK_REQUESTS);
    expect(parseArtworkRequests('{}')).toEqual(EMPTY_ARTWORK_REQUESTS);
  });
});
