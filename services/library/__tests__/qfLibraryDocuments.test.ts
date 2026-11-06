import {
  decodePlaylistEntries,
  fitsDocumentLimit,
  libraryCodec,
  lovedDocumentSurah,
  playlistEntries,
} from '@/services/library/qfLibraryDocuments';

describe('qfLibraryDocuments', () => {
  it('round-trips favourite reciters in favourite order', () => {
    const codec = libraryCodec('library', 'reciters')!;
    const value = {
      v: [
        ['b', 1],
        ['a', 2],
      ],
    };
    const entries = codec.decode(value)!;
    expect(entries).toEqual({b: '1', a: '2'});
    expect(codec.encode(entries)).toEqual(value);
  });

  it('keys loved tracks by reciter and rewayah', () => {
    const codec = libraryCodec('library', 'loved-18')!;
    const value = {
      v: [
        ['reciter', 'hafs', 1],
        ['reciter', 'warsh', 2],
        ['reciter', '', 3],
      ],
    };
    const entries = codec.decode(value)!;
    expect(entries).toEqual({
      'reciter|hafs': '1',
      'reciter|warsh': '2',
      'reciter|': '3',
    });
    expect(codec.encode(entries)).toEqual(value);
  });

  it.each([
    {
      v: [
        ['a', 1],
        ['a', 2],
      ],
    },
    {v: [['a', -1]]},
    {v: [['bad id!', 1]]},
    {v: [], extra: true},
    {v: 'nope'},
  ])('refuses favourites it cannot read (%j)', value => {
    expect(libraryCodec('library', 'reciters')!.decode(value)).toBeUndefined();
  });

  it('refuses duplicate or malformed loved tracks', () => {
    const codec = libraryCodec('library', 'loved-2')!;
    expect(
      codec.decode({
        v: [
          ['r', 'hafs', 1],
          ['r', 'hafs', 2],
        ],
      }),
    ).toBeUndefined();
    expect(codec.decode({v: [['r', 'hafs']]})).toBeUndefined();
  });

  it('only knows Bayaan document keys', () => {
    expect(libraryCodec('library', 'loved-0')).toBeUndefined();
    expect(libraryCodec('library', 'loved-115')).toBeUndefined();
    expect(libraryCodec('library', 'other')).toBeUndefined();
    expect(libraryCodec('adhkar', 'saved')).toBeDefined();
    expect(libraryCodec('adhkar', 'other')).toBeUndefined();
    expect(libraryCodec('playlists', 'playlist_1')).toBeDefined();
    expect(libraryCodec('playlists', 'bad key')).toBeUndefined();
    expect(lovedDocumentSurah('loved-114')).toBe(114);
  });

  it('round-trips a playlist through its entries', () => {
    const playlist = {
      name: 'Morning',
      color: '#fff',
      description: null,
      createdAt: 10,
      items: [
        [18, 'r', 'hafs'],
        [36, 'r', ''],
      ] as [number, string, string][],
    };
    const codec = libraryCodec('playlists', 'p1')!;
    const entries = codec.decode(playlist)!;
    expect(entries).toEqual(playlistEntries(playlist));
    expect(decodePlaylistEntries(entries)).toEqual(playlist);
    expect(codec.encode(entries)).toEqual(playlist);
    expect(
      codec.decode({...playlist, items: [[115, 'r', 'hafs']]}),
    ).toBeUndefined();
  });

  it('measures documents in UTF-8 bytes', () => {
    expect(fitsDocumentLimit({v: 'x'.repeat(16_000)})).toBe(true);
    expect(fitsDocumentLimit({v: 'ب'.repeat(8_200)})).toBe(false);
  });
});
