import {
  buildCarSnapshot,
  CarSnapshotInput,
  availableSurahIds,
  normalizeSurahArtworkBase,
  DEFAULT_SURAH_ARTWORK_BASE,
  juzGroups,
} from '../buildCarSnapshot';
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SystemPlaylist} from '@/data/systemPlaylists';
import type {UploadedRecitation} from '@/types/uploads';
import {resolveCarRequest} from '@/services/car/playback/resolveCarRequest';
import type {CarItem, CarSnapshot} from '@/services/car/types';

function forNow(snap: CarSnapshot): CarItem[] {
  return snap.home.sections.find(s => s.id === 'for-now')?.items ?? [];
}

function upload(
  id: string,
  overrides: Partial<UploadedRecitation> = {},
): UploadedRecitation {
  return {
    id,
    filePath: `${id}.mp3`,
    originalFilename: `${id}.m4a`,
    duration: 60,
    dateAdded: 1,
    type: null,
    surahNumber: null,
    startVerse: null,
    endVerse: null,
    title: null,
    category: null,
    reciterId: null,
    customReciterId: null,
    isPersonal: false,
    rewayah: null,
    style: null,
    recordingType: null,
    ...overrides,
  };
}

function rewayat(
  id: string,
  reciterId: string,
  list: (number | null)[],
): Rewayat {
  return {
    id,
    reciter_id: reciterId,
    name: "Hafs A'n Assem",
    style: 'murattal',
    server: 'https://cdn.example.com',
    surah_total: list.length,
    surah_list: list,
    source_type: 'r2',
    created_at: '2026-01-01',
  };
}

function reciter(id: string, name: string, list: (number | null)[]): Reciter {
  return {
    id,
    name,
    date: null,
    image_url: null,
    rewayat: [rewayat(`${id}-hafs`, id, list)],
  };
}

function surah(id: number): Surah {
  return {
    id,
    name: `Surah ${id}`,
    revelation_place: 'Makkah',
    revelation_order: id,
    bismillah_pre: true,
    name_arabic: `س${id}`,
    verses_count: 10,
    pages: '1',
    translated_name_english: `T${id}`,
  };
}

const surahs = Array.from({length: 114}, (_, i) => surah(i + 1));
const mishary = reciter(
  'r1',
  'Mishary',
  surahs.map(s => s.id),
);
const sudais = reciter('r2', 'Sudais', [1, 2, null, 18]);

function recent(r: Reciter, s: number, progress: number): RecentlyPlayedTrack {
  return {
    reciter: r,
    surah: surah(s),
    rewayatId: r.rewayat[0].id,
    progress,
    duration: 600,
    timestamp: 1,
  };
}

function input(overrides: Partial<CarSnapshotInput> = {}): CarSnapshotInput {
  return {
    // Saturday afternoon: only the afternoon pick, which needs Quick Listen.
    now: new Date(2026, 9, 10, 14, 0),
    reciters: [mishary, sudais],
    surahs,
    favoriteReciterIds: [],
    defaultReciterId: 'r1',
    recentTracks: [],
    playCounts: [],
    lovedTracks: [],
    downloads: [],
    userPlaylists: [],
    playlistItems: {},
    systemPlaylists: [],
    uploads: [],
    customReciters: [],
    surahToJuz: {1: 1, 2: 1, 18: 15},
    resolveReciterArtwork: (r: Reciter) => ({
      kind: 'monogram',
      label: r.name.slice(0, 1),
      hex: '#333333',
    }),
    ...overrides,
  };
}

describe('availableSurahIds', () => {
  it('drops nulls and sorts', () => {
    expect(availableSurahIds(sudais.rewayat[0])).toEqual([1, 2, 18]);
  });
  it('returns all 114 when the list is empty', () => {
    expect(availableSurahIds(rewayat('x', 'y', [])).length).toBe(114);
  });
});

function systemPlaylist(
  id: string,
  items: SystemPlaylist['items'],
): SystemPlaylist {
  return {
    id,
    title: `Playlist ${id}`,
    description: '',
    backgroundColor: '#123456',
    type: 'surah-only',
    items,
    heightMultiplier: 1,
    column: 'left',
    order: 1,
  };
}

describe('buildCarSnapshot', () => {
  it('handles empty stores without throwing and keeps Home non-empty when system playlists exist', () => {
    const snap = buildCarSnapshot(
      input({
        systemPlaylists: [
          {
            id: 'juz-amma',
            title: 'Juz Amma',
            description: '',
            backgroundColor: '#123456',
            type: 'surah-only',
            items: [{surahId: 78}],
            heightMultiplier: 1,
            column: 'left',
            order: 1,
          },
        ],
      }),
    );
    expect(snap.version).toBe(1);
    // A new user still gets something to play: Surprise me.
    expect(snap.home.sections.map(s => s.id)).toEqual([
      'surprise',
      'more-from',
      'your-playlists',
    ]);
    expect(snap.library.map(i => i.id)).toEqual([
      'lib:loved',
      'lib:playlists',
      'lib:downloads',
      'lib:uploads',
      'lib:favorite-reciters',
    ]);
    expect(snap.library.map(i => i.subtitle)).toEqual([
      'None yet',
      '1 playlist',
      'None yet',
      'None yet',
      'None yet',
    ]);
  });

  it('uses the most recent reciter as top reciter, else the default', () => {
    expect(buildCarSnapshot(input()).topReciterId).toBe('r1');
    expect(
      buildCarSnapshot(input({recentTracks: [recent(sudais, 2, 0.5)]}))
        .topReciterId,
    ).toBe('r2');
  });

  it('builds Jump back in with fractional progress and a resume start position', () => {
    const snap = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 2, 0.5)]}),
    );
    const section = snap.home.sections.find(s => s.id === 'jump-back-in');
    expect(section?.items[0].progress).toBe(0.5);
    expect(section?.items[0].duration).toBe(600);
    expect(section?.items[0].action).toEqual({
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: 'r2',
        rewayatId: 'r2-hafs',
        surahId: 2,
        startAt: 300,
      },
    });
  });

  it('skips recent uploads whose recitation is gone', () => {
    const upload: RecentlyPlayedTrack = {
      ...recent(sudais, 2, 0.5),
      isUserUpload: true,
    };
    const snap = buildCarSnapshot(input({recentTracks: [upload]}));
    expect(
      snap.home.sections.find(s => s.id === 'jump-back-in'),
    ).toBeUndefined();
    expect(forNow(snap).find(i => i.id === 'now:resume')).toBeUndefined();
  });

  it('puts Surprise me in its own untitled row right after For right now', () => {
    const snap = buildCarSnapshot(
      input({recentTracks: [recent(mishary, 1, 0.1)]}),
    );
    const ids = snap.home.sections.map(s => s.id);
    expect(ids.slice(0, 2)).toEqual(['for-now', 'surprise']);
    const surprise = snap.home.sections[1];
    expect(surprise.title).toBe('');
    expect(surprise.style).toBe('rows');
    expect(surprise.items).toEqual([
      {
        id: 'surprise:random',
        title: 'Surprise me',
        subtitle: 'Any surah, any reciter',
        artwork: {kind: 'icon', name: 'random'},
        action: {kind: 'play', request: {kind: 'random'}},
      },
    ]);
  });

  it('leads For right now with Resume and ends it with Loved on shuffle', () => {
    const snap = buildCarSnapshot(
      input({
        recentTracks: [recent(mishary, 1, 0.1)],
        lovedTracks: [
          {reciterId: 'r1', surahId: '1', rewayatId: 'r1-hafs', timestamp: 1},
        ],
      }),
    );
    const ids = forNow(snap).map(i => i.id);
    expect(ids[0]).toBe('now:resume');
    expect(ids[ids.length - 1]).toBe('now:shuffle-loved');
    expect(forNow(snap)[ids.length - 1].subtitle).toBe('Shuffle');
    expect(snap.home.sections[0].id).toBe('for-now');
  });

  it('draws Library, Shuffle Loved and playlists with the Collection icon tiles', () => {
    const snap = buildCarSnapshot(
      input({
        lovedTracks: [
          {reciterId: 'r1', surahId: '1', rewayatId: 'r1-hafs', timestamp: 1},
        ],
        userPlaylists: [
          {
            id: 'p1',
            name: 'Commute',
            color: '#22C55E',
            createdAt: 1,
            updatedAt: 1,
            itemCount: 1,
          },
        ],
        playlistItems: {
          p1: [
            {
              id: 'i1',
              playlistId: 'p1',
              surahId: '1',
              reciterId: 'r1',
              orderIndex: 0,
              addedAt: 1,
            },
          ],
        },
        systemPlaylists: [systemPlaylist('juz-amma', [{surahId: 1}])],
      }),
    );
    expect(snap.library.map(i => i.artwork)).toEqual([
      {kind: 'icon', name: 'loved'},
      {kind: 'icon', name: 'playlists'},
      {kind: 'icon', name: 'downloads'},
      {kind: 'icon', name: 'uploads'},
      {kind: 'icon', name: 'reciters'},
    ]);
    expect(
      forNow(snap).find(i => i.id === 'now:shuffle-loved')?.artwork,
    ).toEqual({kind: 'icon', name: 'loved'});
    expect(snap.lists.playlists.items.map(i => i.artwork)).toEqual([
      {kind: 'icon', name: 'playlist', hex: '#22C55E'},
      {kind: 'icon', name: 'playlist', hex: '#123456'},
    ]);
  });

  it('always lists Uploads in Library after Downloads, empty when there are none', () => {
    const snap = buildCarSnapshot(input());
    expect(snap.library.map(i => i.title)).toEqual([
      'Loved',
      'Playlists',
      'Downloads',
      'Uploads',
      'Favorite reciters',
    ]);
    expect(snap.library[3].action).toEqual({
      kind: 'browse',
      target: {kind: 'list', listId: 'uploads'},
    });
    expect(snap.lists.uploads).toEqual({
      id: 'uploads',
      title: 'Uploads',
      items: [],
    });
  });

  it('lists uploads in store order with the phone titles and subtitles', () => {
    const snap = buildCarSnapshot(
      input({
        uploads: [
          upload('a', {type: 'surah', surahNumber: 18, reciterId: 'r1'}),
          upload('b', {
            type: 'other',
            title: 'Dua Qunoot',
            customReciterId: 'c1',
          }),
          upload('gone', {filePath: ''}),
          upload('c'),
          upload('d', {type: 'other', category: 'lecture'}),
          upload('e', {type: 'surah', surahNumber: 2, reciterId: 'unknown'}),
        ],
        customReciters: [{id: 'c1', name: 'Dad', imageUri: null, createdAt: 1}],
      }),
    );
    expect(
      snap.lists.uploads.items.map(i => [
        i.id,
        i.title,
        i.subtitle,
        i.artwork,
        i.action,
      ]),
    ).toEqual([
      [
        'upload:a',
        'Surah 18',
        'Mishary',
        {kind: 'surah', surahId: 18},
        {kind: 'play', request: {kind: 'uploads', startIndex: 0}},
      ],
      [
        'upload:b',
        'Dua Qunoot',
        'Dad',
        {kind: 'icon', name: 'uploads'},
        {kind: 'play', request: {kind: 'uploads', startIndex: 1}},
      ],
      [
        'upload:c',
        'c',
        'Untagged',
        {kind: 'icon', name: 'uploads'},
        {kind: 'play', request: {kind: 'uploads', startIndex: 2}},
      ],
      [
        'upload:d',
        'd',
        'd',
        {kind: 'icon', name: 'uploads'},
        {kind: 'play', request: {kind: 'uploads', startIndex: 3}},
      ],
      [
        'upload:e',
        'Surah 2',
        'e',
        {kind: 'surah', surahId: 2},
        {kind: 'play', request: {kind: 'uploads', startIndex: 4}},
      ],
    ]);
  });

  it('adds the upload date when two uploads would show the same row', () => {
    const march18 = new Date(2025, 2, 18, 7, 27).getTime();
    const april2 = new Date(2025, 3, 2, 20, 0).getTime();
    const snap = buildCarSnapshot(
      input({
        uploads: [
          upload('a', {
            type: 'surah',
            surahNumber: 11,
            reciterId: 'r1',
            dateAdded: april2,
          }),
          upload('b', {type: 'other', title: 'Qunoot', reciterId: 'r1'}),
          upload('c', {
            type: 'surah',
            surahNumber: 11,
            reciterId: 'r1',
            dateAdded: march18,
          }),
        ],
      }),
    );
    expect(snap.lists.uploads.items.map(i => [i.title, i.subtitle])).toEqual([
      ['Surah 11', 'Mishary · Apr 2, 2025'],
      ['Qunoot', 'Mishary'],
      ['Surah 11', 'Mishary · Mar 18, 2025'],
    ]);
  });

  it('includes recent uploads in Jump back in and Resume, aligned with the resolver', () => {
    const uploads = [
      upload('u1', {type: 'surah', surahNumber: 36, reciterId: 'r2'}),
    ];
    const recentTracks: RecentlyPlayedTrack[] = [
      {
        ...recent(sudais, 36, 0.5),
        rewayatId: '',
        duration: 120,
        isUserUpload: true,
        userRecitationId: 'u1',
      },
      {
        ...recent(sudais, 2, 0.5),
        isUserUpload: true,
        userRecitationId: 'deleted',
      },
      recent(mishary, 1, 0.1),
    ];
    const snap = buildCarSnapshot(input({uploads, recentTracks}));
    const rows =
      snap.home.sections.find(s => s.id === 'jump-back-in')?.items ?? [];
    expect(rows.map(i => [i.id, i.title, i.subtitle, i.progress])).toEqual([
      ['recent:upload:u1', 'Surah 36', 'Sudais', 0.5],
      ['recent:r1:r1-hafs:1', 'Surah 1', 'Mishary', 0.1],
    ]);
    expect(rows[0].artwork).toEqual({kind: 'surah', surahId: 36});
    expect(rows[0].action).toEqual({
      kind: 'play',
      request: {kind: 'resume', recitationId: 'u1'},
    });
    const resume = forNow(snap).find(i => i.id === 'now:resume');
    expect(resume?.title).toBe('Surah 36');
    expect(resume?.subtitle).toBe('Resume');

    // The top reciter still ignores uploads.
    expect(snap.topReciterId).toBe('r1');

    const ctx = {
      reciters: [mishary, sudais],
      topReciterId: snap.topReciterId,
      recentTracks,
      lovedTracks: [],
      downloads: [],
      systemPlaylists: [],
      playlistItems: {},
      uploads,
    };
    if (rows[0].action.kind !== 'play') throw new Error('expected play');
    if (resume?.action.kind !== 'play') throw new Error('expected play');
    const fromRow = resolveCarRequest(rows[0].action.request, ctx);
    expect(fromRow?.tracks).toEqual([{uploadId: 'u1'}]);
    expect(resolveCarRequest(resume.action.request, ctx)).toEqual(fromRow);
  });

  it('orders favorites first in reciters and marks them', () => {
    const snap = buildCarSnapshot(input({favoriteReciterIds: ['r2']}));
    expect(snap.reciters.map(r => r.id)).toEqual(['r2', 'r1']);
    expect(snap.reciters[0].isFavorite).toBe(true);
    expect(snap.reciters[0].rewayat[0].surahIds).toEqual([1, 2, 18]);
  });

  it('lists only completed downloads and records their keys', () => {
    const snap = buildCarSnapshot(
      input({
        downloads: [
          {
            reciterId: 'r1',
            surahId: '1',
            rewayatId: 'r1-hafs',
            filePath: 'a',
            fileSize: 1,
            downloadDate: 1,
            status: 'completed',
          },
          {
            reciterId: 'r1',
            surahId: '2',
            rewayatId: 'r1-hafs',
            filePath: 'b',
            fileSize: 1,
            downloadDate: 1,
            status: 'downloading',
          },
        ],
      }),
    );
    expect(snap.lists.downloads.items.length).toBe(1);
    expect(snap.downloadedKeys).toEqual(['r1:r1-hafs:1']);
  });

  it('skips loved items whose reciter is unknown', () => {
    const snap = buildCarSnapshot(
      input({
        lovedTracks: [
          {reciterId: 'gone', surahId: '1', rewayatId: 'x', timestamp: 1},
        ],
      }),
    );
    expect(snap.lists.loved.items).toEqual([]);
  });

  it('groups surahs by starting juz', () => {
    const snap = buildCarSnapshot(input());
    expect(snap.juz.find(j => j.number === 1)?.surahIds).toEqual([1, 2]);
  });

  it('offers Up next only from 95 percent progress', () => {
    const almost = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 1, 0.949)]}),
    );
    const done = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 1, 0.95)]}),
    );
    expect(forNow(almost).map(i => i.id)).toEqual(['now:resume']);
    expect(forNow(done).map(i => i.id)).toEqual(['now:resume', 'now:upnext']);
  });

  it('excludes system playlist items the top reciter lacks', () => {
    const snap = buildCarSnapshot(
      input({
        recentTracks: [recent(sudais, 1, 0.1)],
        systemPlaylists: [systemPlaylist('p1', [{surahId: 3}, {surahId: 18}])],
      }),
    );
    expect(snap.lists['system:p1'].items.map(i => i.id)).toEqual(['sys:p1:18']);
  });

  it('sizes a time-of-day playlist card by what the top reciter can play', () => {
    const snap = buildCarSnapshot(
      input({
        recentTracks: [recent(sudais, 1, 0.1)],
        systemPlaylists: [
          systemPlaylist('quick-listen', [{surahId: 3}, {surahId: 18}]),
        ],
      }),
    );
    const card = forNow(snap).find(i => i.id === 'now:afternoon');
    expect(card?.subtitle).toBe('1 surah');
  });

  it('leaves out playlists that resolve to no items', () => {
    const snap = buildCarSnapshot(
      input({
        systemPlaylists: [
          systemPlaylist('p1', [{surahId: 3, reciterId: 'gone'}]),
        ],
      }),
    );
    expect(snap.lists['system:p1']).toBeUndefined();
    expect(snap.lists.playlists.items).toEqual([]);
    expect(snap.home.sections.map(s => s.id)).toEqual([
      'surprise',
      'more-from',
    ]);
  });

  it('skips a situational playlist pick that resolves to no items', () => {
    const snap = buildCarSnapshot(
      input({
        now: new Date(2026, 9, 7, 8, 0), // Wednesday morning
        recentTracks: [recent(sudais, 1, 0.1)],
        systemPlaylists: [
          systemPlaylist('morning-reflections', [{surahId: 3}]),
        ],
      }),
    );
    const ids = snap.home.sections.flatMap(s => s.items.map(i => i.id));
    expect(ids).not.toContain('now:morning');
  });

  it('emits the surah artwork base, defaulting to the Bayaan CDN', () => {
    expect(buildCarSnapshot(input()).surahArtworkBase).toBe(
      DEFAULT_SURAH_ARTWORK_BASE,
    );
    expect(
      buildCarSnapshot(
        input({surahArtworkBase: 'https://cdn.fork.example/surah'}),
      ).surahArtworkBase,
    ).toBe('https://cdn.fork.example/surah/');
  });

  it('drops the Uploads row and list when uploads are off', () => {
    const on = buildCarSnapshot(input());
    expect(on.library.map(i => i.id)).toContain('lib:uploads');
    expect(on.lists.uploads).toBeDefined();
    const off = buildCarSnapshot(input({uploadsEnabled: false}));
    expect(off.library.map(i => i.id)).not.toContain('lib:uploads');
    expect(off.lists.uploads).toBeUndefined();
    expect(off.library.map(i => i.id)).toEqual(
      on.library.map(i => i.id).filter(id => id !== 'lib:uploads'),
    );
  });

  it('accepts only https surah artwork bases', () => {
    expect(normalizeSurahArtworkBase(undefined)).toBe(
      DEFAULT_SURAH_ARTWORK_BASE,
    );
    expect(normalizeSurahArtworkBase(' https://a.example/s/// ')).toBe(
      'https://a.example/s/',
    );
    [
      '',
      'http://a.example/s/',
      'https://',
      'https://a.example/s?x=1',
      'https://a.example/a b/',
      'https://a.example/../s',
      'file:///data/',
    ].forEach(raw =>
      expect(normalizeSurahArtworkBase(raw)).toBe(DEFAULT_SURAH_ARTWORK_BASE),
    );
  });

  it('falls back to the fullest rewayah when the first is partial', () => {
    const partialFirst: Reciter = {
      ...mishary,
      rewayat: [
        rewayat('r1-dorai', 'r1', [12, 14, 25]),
        rewayat(
          'r1-hafs',
          'r1',
          surahs.map(s => s.id),
        ),
      ],
    };
    const snap = buildCarSnapshot(
      input({
        now: new Date(2026, 9, 9, 12, 30), // Friday noon
        reciters: [partialFirst, sudais],
      }),
    );
    const forNow = snap.home.sections.find(s => s.id === 'for-now');
    const kahf = forNow?.items.find(i => i.id === 'now:kahf');
    expect(kahf?.action).toEqual({
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: 'r1',
        rewayatId: 'r1-hafs',
        surahId: 18,
      },
    });
  });

  it('titles juz groups to cover juz that start no surah', () => {
    expect(
      juzGroups(
        new Map([
          [3, [3]],
          [1, [1, 2]],
          [30, [78, 79]],
          [4, [4]],
        ]),
      ).map(g => [g.number, g.title, g.surahIds]),
    ).toEqual([
      [1, 'Juz 1–2', [1, 2]],
      [3, 'Juz 3', [3]],
      [4, 'Juz 4–29', [4]],
      [30, 'Juz 30', [78, 79]],
    ]);
  });

  it('builds On repeat from play counts with the reciter last played', () => {
    const snap = buildCarSnapshot(
      input({
        recentTracks: [recent(sudais, 18, 1)],
        playCounts: [
          {surahId: 1, count: 1, lastPlayed: 5},
          {surahId: 2, count: 3, lastPlayed: 1},
          {surahId: 18, count: 3, lastPlayed: 9},
        ],
      }),
    );
    const section = snap.home.sections.find(s => s.id === 'on-repeat');
    expect(section?.style).toBe('cards');
    expect(section?.items.map(i => [i.id, i.subtitle, i.action])).toEqual([
      [
        'repeat:18',
        'Sudais',
        {
          kind: 'play',
          request: {
            kind: 'surah',
            reciterId: 'r2',
            rewayatId: 'r2-hafs',
            surahId: 18,
          },
        },
      ],
      [
        'repeat:2',
        'Sudais',
        {
          kind: 'play',
          request: {
            kind: 'surah',
            reciterId: 'r2',
            rewayatId: 'r2-hafs',
            surahId: 2,
          },
        },
      ],
    ]);
  });

  it('offers well-known surahs by the top reciter that were not played recently', () => {
    const snap = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 18, 0.5)]}),
    );
    const section = snap.home.sections.find(s => s.id === 'more-from');
    expect(section?.title).toBe('More from Sudais');
    const ids = section?.items.map(i => i.id) ?? [];
    expect(ids).not.toContain('more:r2:18');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(id => id.startsWith('more:r2:'))).toBe(true);
  });
});
