import {
  resolveCarRequest,
  CarQueuePlan,
  CarResolveContext,
  isUploadSpec,
} from '../resolveCarRequest';
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {
  buildCarSnapshot,
  CarSnapshotInput,
} from '@/services/car/snapshot/buildCarSnapshot';
import {CarItem, CarList} from '@/services/car/types';
import type {UploadedRecitation} from '@/types/uploads';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

function surahIds(plan: CarQueuePlan | null): (number | string)[] {
  return (plan?.tracks ?? []).map(t =>
    isUploadSpec(t) ? t.uploadId : t.surahId,
  );
}

function upload(
  id: string,
  overrides: Partial<UploadedRecitation> = {},
): UploadedRecitation {
  return {
    id,
    filePath: `${id}.mp3`,
    originalFilename: `${id}.mp3`,
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
    name: 'Hafs',
    style: 'murattal',
    server: 's',
    surah_total: list.length,
    surah_list: list,
    source_type: 'r2',
    created_at: 'x',
  };
}
const r1: Reciter = {
  id: 'r1',
  name: 'Mishary',
  date: null,
  image_url: null,
  rewayat: [rewayat('h', 'r1', [1, 2, 3, 4])],
};
const r2: Reciter = {
  id: 'r2',
  name: 'Sudais',
  date: null,
  image_url: null,
  rewayat: [rewayat('h2', 'r2', [1, null, 3])],
};
const surah = (id: number): Surah => ({
  id,
  name: `S${id}`,
  revelation_place: 'Makkah',
  revelation_order: id,
  bismillah_pre: true,
  name_arabic: '',
  verses_count: 1,
  pages: '1',
  translated_name_english: '',
});

function ctx(o: Partial<CarResolveContext> = {}): CarResolveContext {
  return {
    reciters: [r1, r2],
    topReciterId: 'r1',
    recentTracks: [],
    lovedTracks: [],
    downloads: [],
    systemPlaylists: [],
    playlistItems: {},
    uploads: [],
    ...o,
  };
}

describe('resolveCarRequest', () => {
  it('plays 15 random picks, each in a rewayah that has the surah', () => {
    const plan = resolveCarRequest({kind: 'random'}, ctx());
    expect(plan?.tracks).toHaveLength(15);
    expect(plan?.startIndex).toBe(0);
    expect(plan?.chain).toBe('new');
    plan?.tracks.forEach(track => {
      if (isUploadSpec(track)) throw new Error('expected a surah');
      const reciter = [r1, r2].find(r => r.id === track.reciterId);
      const rewayah = reciter?.rewayat.find(w => w.id === track.rewayatId);
      expect(rewayah?.surah_list).toContain(track.surahId);
    });
  });

  it('returns null for random with no reciters', () => {
    expect(resolveCarRequest({kind: 'random'}, ctx({reciters: []}))).toBeNull();
  });

  it('queues the rest of the rewayah starting at the chosen surah, wrapping around', () => {
    const plan = resolveCarRequest(
      {kind: 'surah', reciterId: 'r1', rewayatId: 'h', surahId: 3},
      ctx(),
    );
    expect(surahIds(plan)).toEqual([3, 4, 1, 2]);
    expect(plan?.startIndex).toBe(0);
    expect(plan?.chain).toBe('new');
  });

  it('returns null for a surah the rewayah lacks', () => {
    expect(
      resolveCarRequest(
        {kind: 'surah', reciterId: 'r2', rewayatId: 'h2', surahId: 2},
        ctx(),
      ),
    ).toBeNull();
  });

  it('returns null for an unknown reciter', () => {
    expect(
      resolveCarRequest(
        {kind: 'surah', reciterId: 'nope', rewayatId: 'h', surahId: 1},
        ctx(),
      ),
    ).toBeNull();
  });

  it('falls back to the first rewayah when the id is stale', () => {
    const plan = resolveCarRequest(
      {kind: 'surah', reciterId: 'r1', rewayatId: 'stale', surahId: 1},
      ctx(),
    );
    expect(plan?.tracks[0]).toEqual({
      reciterId: 'r1',
      rewayatId: 'h',
      surahId: 1,
    });
  });

  it('resumes the most recent non-upload track at its position', () => {
    const plan = resolveCarRequest(
      {kind: 'resume'},
      ctx({
        recentTracks: [
          {
            reciter: r2,
            surah: surah(3),
            rewayatId: 'h2',
            progress: 0.5,
            duration: 200,
            timestamp: 2,
            isUserUpload: true,
          },
          {
            reciter: r1,
            surah: surah(2),
            rewayatId: 'h',
            progress: 0.25,
            duration: 400,
            timestamp: 1,
          },
        ],
      }),
    );
    expect(plan?.tracks[0]).toEqual({
      reciterId: 'r1',
      rewayatId: 'h',
      surahId: 2,
    });
    expect(plan?.startPosition).toBe(100);
    expect(plan?.chain).toBe('resume');
    expect(plan?.recentIndex).toBe(1);
  });

  it('resumes a recent upload on its own at its position', () => {
    const uploadRecent: RecentlyPlayedTrack = {
      reciter: r1,
      surah: surah(2),
      rewayatId: '',
      progress: 0.5,
      duration: 120,
      timestamp: 2,
      isUserUpload: true,
      userRecitationId: 'u1',
    };
    const catalogRecent: RecentlyPlayedTrack = {
      reciter: r1,
      surah: surah(2),
      rewayatId: 'h',
      progress: 0.25,
      duration: 400,
      timestamp: 1,
    };
    const context = ctx({
      recentTracks: [uploadRecent, catalogRecent],
      uploads: [upload('u1')],
    });
    const bare = resolveCarRequest({kind: 'resume'}, context);
    expect(bare?.tracks).toEqual([{uploadId: 'u1'}]);
    expect(bare?.startPosition).toBe(60);
    expect(bare?.chain).toBe('resume');
    expect(bare?.recentIndex).toBe(0);
    expect(
      resolveCarRequest({kind: 'resume', recitationId: 'u1'}, context),
    ).toEqual(bare);
    expect(
      resolveCarRequest({kind: 'resume', recitationId: 'gone'}, context),
    ).toBeNull();

    // A deleted upload is skipped, like Jump back in skips it.
    const orphaned = resolveCarRequest(
      {kind: 'resume'},
      ctx({recentTracks: [uploadRecent, catalogRecent]}),
    );
    expect(orphaned?.recentIndex).toBe(1);
    expect(orphaned?.tracks[0]).toEqual({
      reciterId: 'r1',
      rewayatId: 'h',
      surahId: 2,
    });
  });

  it('queues every upload in list order from the start index', () => {
    const plan = resolveCarRequest(
      {kind: 'uploads', startIndex: 1},
      ctx({
        uploads: [upload('a'), upload('b', {filePath: ''}), upload('c')],
      }),
    );
    expect(plan?.tracks).toEqual([{uploadId: 'a'}, {uploadId: 'c'}]);
    expect(plan?.startIndex).toBe(1);
    expect(plan?.chain).toBe('new');
    expect(resolveCarRequest({kind: 'uploads'}, ctx())).toBeNull();
  });

  it('returns null for resume with no history', () => {
    expect(resolveCarRequest({kind: 'resume'}, ctx())).toBeNull();
  });

  it('plays loved tracks newest first from the start index, skipping uploads', () => {
    const plan = resolveCarRequest(
      {kind: 'loved', startIndex: 1},
      ctx({
        lovedTracks: [
          {reciterId: 'r1', surahId: '1', rewayatId: 'h', timestamp: 1},
          {reciterId: 'r1', surahId: '2', rewayatId: 'h', timestamp: 3},
          {
            reciterId: 'r1',
            surahId: '9',
            rewayatId: 'h',
            timestamp: 2,
            userRecitationId: 'u',
          },
        ],
      }),
    );
    expect(surahIds(plan)).toEqual([2, 1]);
    expect(plan?.startIndex).toBe(1);
    expect(plan?.shuffle).toBe(false);
  });

  it('marks shuffle for shuffle loved', () => {
    const plan = resolveCarRequest(
      {kind: 'loved', shuffle: true},
      ctx({
        lovedTracks: [
          {reciterId: 'r1', surahId: '1', rewayatId: 'h', timestamp: 1},
        ],
      }),
    );
    expect(plan?.shuffle).toBe(true);
  });

  it('fills system playlist items without a reciter using the top reciter', () => {
    const plan = resolveCarRequest(
      {kind: 'playlist', playlistId: 'p', system: true},
      ctx({
        systemPlaylists: [
          {
            id: 'p',
            title: 'P',
            description: '',
            backgroundColor: '#000',
            type: 'surah-only',
            items: [{surahId: 1}, {surahId: 4}, {surahId: 1, reciterId: 'r2'}],
            heightMultiplier: 1,
            column: 'left',
            order: 1,
          },
        ],
      }),
    );
    expect(plan?.tracks).toEqual([
      {reciterId: 'r1', rewayatId: 'h', surahId: 1},
      {reciterId: 'r1', rewayatId: 'h', surahId: 4},
      {reciterId: 'r2', rewayatId: 'h2', surahId: 1},
    ]);
  });

  it('plays user playlist items in order and skips uploads', () => {
    const plan = resolveCarRequest(
      {kind: 'playlist', playlistId: 'u1', system: false},
      ctx({
        playlistItems: {
          u1: [
            {
              id: 'b',
              playlistId: 'u1',
              surahId: '2',
              reciterId: 'r1',
              orderIndex: 1,
              addedAt: 1,
            },
            {
              id: 'a',
              playlistId: 'u1',
              surahId: '1',
              reciterId: 'r1',
              orderIndex: 0,
              addedAt: 1,
            },
            {
              id: 'c',
              playlistId: 'u1',
              surahId: '3',
              reciterId: 'r1',
              orderIndex: 2,
              addedAt: 1,
              userRecitationId: 'x',
            },
          ],
        },
      }),
    );
    expect(surahIds(plan)).toEqual([1, 2]);
  });

  it('plays completed downloads only', () => {
    const plan = resolveCarRequest(
      {kind: 'downloads'},
      ctx({
        downloads: [
          {
            reciterId: 'r1',
            surahId: '1',
            rewayatId: 'h',
            filePath: 'a',
            fileSize: 1,
            downloadDate: 1,
            status: 'completed',
          },
          {
            reciterId: 'r1',
            surahId: '2',
            rewayatId: 'h',
            filePath: 'b',
            fileSize: 1,
            downloadDate: 1,
            status: 'error',
          },
        ],
      }),
    );
    expect(surahIds(plan)).toEqual([1]);
  });

  it('clamps an out-of-range start index', () => {
    const plan = resolveCarRequest(
      {kind: 'loved', startIndex: 99},
      ctx({
        lovedTracks: [
          {reciterId: 'r1', surahId: '1', rewayatId: 'h', timestamp: 1},
        ],
      }),
    );
    expect(plan?.startIndex).toBe(0);
  });
});

describe('resolveCarRequest index alignment with buildCarSnapshot', () => {
  const surahs = Array.from({length: 114}, (_, i) => surah(i + 1));
  const full: Reciter = {
    id: 'r1',
    name: 'Mishary',
    date: null,
    image_url: null,
    rewayat: [
      rewayat(
        'h',
        'r1',
        surahs.map(s => s.id),
      ),
    ],
  };
  const partial: Reciter = {
    id: 'r2',
    name: 'Sudais',
    date: null,
    image_url: null,
    rewayat: [rewayat('h2', 'r2', [1, 2, null, 18])],
  };
  const uploads: UploadedRecitation[] = [
    upload('u-new', {type: 'surah', surahNumber: 36, reciterId: 'r1'}),
    upload('u-empty', {filePath: ''}),
    upload('u-other', {type: 'other', title: 'Dua Qunoot'}),
    upload('u-untagged'),
  ];
  const resolveCtx: CarResolveContext = {
    reciters: [full, partial],
    uploads,
    topReciterId: 'r2',
    recentTracks: [
      {
        reciter: partial,
        surah: surah(1),
        rewayatId: 'h2',
        progress: 0.1,
        duration: 10,
        timestamp: 1,
      },
    ],
    lovedTracks: [
      {reciterId: 'r1', surahId: '5', rewayatId: 'h', timestamp: 1},
      {reciterId: 'gone', surahId: '6', rewayatId: 'h', timestamp: 9},
      {reciterId: 'r2', surahId: '7', rewayatId: 'h2', timestamp: 5},
      {reciterId: 'r1', surahId: '999', rewayatId: 'h', timestamp: 4},
      {
        reciterId: 'r1',
        surahId: '8',
        rewayatId: 'h',
        timestamp: 3,
        userRecitationId: 'u',
      },
      {reciterId: 'r1', surahId: '9', rewayatId: 'h', timestamp: 2},
    ],
    downloads: [
      {
        reciterId: 'gone',
        surahId: '1',
        rewayatId: 'h',
        filePath: 'a',
        fileSize: 1,
        downloadDate: 1,
        status: 'completed',
      },
      {
        reciterId: 'r1',
        surahId: '3',
        rewayatId: 'h',
        filePath: 'b',
        fileSize: 1,
        downloadDate: 1,
        status: 'error',
      },
      {
        reciterId: 'r2',
        surahId: '50',
        rewayatId: 'h2',
        filePath: 'c',
        fileSize: 1,
        downloadDate: 1,
        status: 'completed',
      },
      {
        reciterId: 'r1',
        surahId: '300',
        rewayatId: 'h',
        filePath: 'd',
        fileSize: 1,
        downloadDate: 1,
        status: 'completed',
      },
      {
        reciterId: 'r1',
        surahId: '4',
        rewayatId: 'h',
        filePath: 'e',
        fileSize: 1,
        downloadDate: 1,
        status: 'completed',
      },
    ],
    systemPlaylists: [
      {
        id: 'sp',
        title: 'SP',
        description: '',
        backgroundColor: '#000',
        type: 'surah-only',
        items: [
          {surahId: 3},
          {surahId: 18},
          {surahId: 4, reciterId: 'r1'},
          {surahId: 2},
          {surahId: 5, reciterId: 'gone'},
          {surahId: 6, reciterId: 'r2'},
        ],
        heightMultiplier: 1,
        column: 'left',
        order: 1,
      },
    ],
    playlistItems: {
      u1: [
        {
          id: 'c',
          playlistId: 'u1',
          surahId: '12',
          reciterId: 'r2',
          orderIndex: 3,
          addedAt: 1,
        },
        {
          id: 'a',
          playlistId: 'u1',
          surahId: '10',
          reciterId: 'r1',
          orderIndex: 0,
          addedAt: 1,
        },
        {
          id: 'x',
          playlistId: 'u1',
          surahId: '11',
          reciterId: 'r1',
          orderIndex: 1,
          addedAt: 1,
          userRecitationId: 'z',
        },
        {
          id: 'd',
          playlistId: 'u1',
          surahId: '13',
          reciterId: 'gone',
          orderIndex: 2,
          addedAt: 1,
        },
        {
          id: 'e',
          playlistId: 'u1',
          surahId: '400',
          reciterId: 'r1',
          orderIndex: 4,
          addedAt: 1,
        },
        {
          id: 'f',
          playlistId: 'u1',
          surahId: '14',
          reciterId: 'r1',
          orderIndex: 5,
          addedAt: 1,
        },
      ],
    },
  };
  const snapshot = buildCarSnapshot({
    now: new Date(2026, 9, 10, 14, 0),
    reciters: resolveCtx.reciters,
    surahs,
    favoriteReciterIds: [],
    defaultReciterId: 'r1',
    recentTracks: resolveCtx.recentTracks,
    playCounts: [],
    lovedTracks: resolveCtx.lovedTracks,
    downloads: resolveCtx.downloads,
    userPlaylists: [
      {
        id: 'u1',
        name: 'U1',
        color: '#fff',
        createdAt: 1,
        updatedAt: 1,
        itemCount: 6,
      },
    ],
    playlistItems: resolveCtx.playlistItems,
    systemPlaylists: resolveCtx.systemPlaylists,
    uploads,
    customReciters: [],
    surahToJuz: {},
    resolveReciterArtwork: (): CarItem['artwork'] => ({
      kind: 'surah',
      surahId: 1,
    }),
  } satisfies CarSnapshotInput);

  function assertAligned(list: CarList | undefined): void {
    expect(list).toBeDefined();
    const items = list?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    items.forEach(item => {
      if (item.action.kind !== 'play') throw new Error('expected play item');
      const plan = resolveCarRequest(item.action.request, resolveCtx);
      expect(plan).not.toBeNull();
      expect(plan?.tracks).toHaveLength(items.length);
      const track = plan?.tracks[plan.startIndex];
      if (!track || isUploadSpec(track)) throw new Error('expected a surah');
      const reciterName = resolveCtx.reciters.find(
        r => r.id === track?.reciterId,
      )?.name;
      expect(reciterName).toBe(item.subtitle);
      expect(`S${track?.surahId}`).toBe(item.title);
    });
  }

  it('loved', () => assertAligned(snapshot.lists.loved));
  it('downloads', () => assertAligned(snapshot.lists.downloads));
  it('user playlist', () => assertAligned(snapshot.lists['playlist:u1']));
  it('system playlist', () => assertAligned(snapshot.lists['system:sp']));
  it('uploads', () => {
    const items = snapshot.lists.uploads.items;
    expect(items.map(i => i.title)).toEqual([
      'S36',
      'Dua Qunoot',
      'u-untagged',
    ]);
    items.forEach(item => {
      if (item.action.kind !== 'play') throw new Error('expected play item');
      const plan = resolveCarRequest(item.action.request, resolveCtx);
      expect(plan?.tracks).toHaveLength(items.length);
      const track = plan?.tracks[plan.startIndex];
      if (!track || !isUploadSpec(track)) throw new Error('expected an upload');
      expect(item.id).toBe(`upload:${track.uploadId}`);
    });
  });
});
