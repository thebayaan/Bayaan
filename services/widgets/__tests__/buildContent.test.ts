// services/widgets/__tests__/buildContent.test.ts
import type {DownloadedSurah} from '@/services/player/store/downloadStore';
import type {
  PlaylistItem,
  UserPlaylist,
} from '@/services/database/DatabaseService';
import type {Reciter} from '@/data/reciterData';
import {isWidgetContent} from 'bayaan-widgets';
import {buildContent, ContentInput, spotlightSurahIds} from '../buildContent';

function download(o: Partial<DownloadedSurah>): DownloadedSurah {
  return {
    reciterId: 'r1',
    surahId: '67',
    rewayatId: 'rw1',
    filePath: '/x',
    fileSize: 1,
    downloadDate: 1,
    status: 'completed',
    ...o,
  };
}

function reciter(id: string, surahList: (number | null)[]): Reciter {
  return {
    id,
    name: `Reciter ${id}`,
    date: null,
    image_url: null,
    rewayat: [
      {
        id: `${id}-rw`,
        reciter_id: id,
        name: 'Hafs',
        style: 'murattal',
        server: '',
        surah_total: surahList.length,
        surah_list: surahList,
        source_type: 'r2',
        created_at: '',
      },
    ],
  };
}

function playlist(id: string, updatedAt: number): UserPlaylist {
  return {
    id,
    name: `List ${id}`,
    color: '#000000',
    createdAt: 0,
    updatedAt,
    itemCount: 0,
  };
}

function item(
  id: string,
  surahId: string,
  orderIndex: number,
  extra: Partial<PlaylistItem> = {},
): PlaylistItem {
  return {
    id,
    playlistId: 'p',
    surahId,
    reciterId: 'r1',
    orderIndex,
    addedAt: 0,
    ...extra,
  };
}

const base: ContentInput = {
  now: 1_000,
  downloads: [],
  playlists: [],
  spotlight: [],
  sleepTimerEnd: null,
  surahName: id => (id >= 1 && id <= 114 ? `Surah ${id}` : null),
  reciterName: id => (id === 'gone' ? null : `Name ${id}`),
};

describe('buildContent', () => {
  it('keeps completed downloads, newest first, capped at 8', () => {
    const downloads = [
      download({surahId: '1', downloadDate: 5}),
      download({surahId: '2', downloadDate: 9, rewayatId: ''}),
      download({surahId: '3', downloadDate: 7, status: 'downloading'}),
      download({surahId: '999', downloadDate: 8}),
      ...Array.from({length: 10}, (_, i) =>
        download({surahId: String(10 + i), downloadDate: i - 20}),
      ),
    ];
    const out = buildContent({...base, downloads});
    expect(out.downloads[0]).toEqual({
      surahId: 2,
      surahName: 'Surah 2',
      reciterId: 'r1',
      reciterName: 'Name r1',
      rewayatId: null,
      itemId: null,
    });
    expect(out.downloads.map(d => d.surahId).slice(0, 2)).toEqual([2, 1]);
    expect(out.downloads).toHaveLength(8);
    expect(out.downloadCount).toBe(13);
  });

  it('orders playlists by last update, items by order, skipping uploads', () => {
    const playlists = [
      {playlist: playlist('old', 1), items: [item('a', '1', 0)]},
      {
        playlist: playlist('new', 9),
        items: [
          item('c', '36', 2),
          item('u', '0', 1, {userRecitationId: 'up1'}),
          item('b', '18', 0, {rewayatId: 'rw2', reciterId: 'gone'}),
        ],
      },
    ];
    const out = buildContent({...base, playlists});
    expect(out.playlists.map(p => p.id)).toEqual(['new', 'old']);
    expect(out.playlists[0]).toEqual({
      id: 'new',
      name: 'List new',
      itemCount: 3,
      items: [
        {
          surahId: 18,
          surahName: 'Surah 18',
          reciterId: 'gone',
          reciterName: '',
          rewayatId: 'rw2',
          itemId: 'b',
        },
        {
          surahId: 36,
          surahName: 'Surah 36',
          reciterId: 'r1',
          reciterName: 'Name r1',
          rewayatId: null,
          itemId: 'c',
        },
      ],
    });
  });

  it('caps playlists at 20 and cards at 8', () => {
    const playlists = Array.from({length: 25}, (_, i) => ({
      playlist: playlist(`p${i}`, i),
      items: Array.from({length: 12}, (_, j) =>
        item(`i${j}`, String(j + 1), j),
      ),
    }));
    const out = buildContent({...base, playlists});
    expect(out.playlists).toHaveLength(20);
    expect(out.playlists[0].items).toHaveLength(8);
    expect(out.playlists[0].itemCount).toBe(12);
  });

  it('dedupes spotlight reciters and lists the popular surahs they have', () => {
    const a = reciter('a', [1, 2, 18, 36, 67, null]);
    const b = reciter('b', [114]);
    const out = buildContent({...base, spotlight: [a, b, a, reciter('', [1])]});
    expect(out.spotlight).toEqual([
      {
        id: 'a',
        name: 'Reciter a',
        artworkFile: 'reciter-a.jpg',
        surahIds: [1, 18, 36],
      },
      {id: 'b', name: 'Reciter b', artworkFile: 'reciter-b.jpg', surahIds: []},
    ]);
    expect(spotlightSurahIds(reciter('c', [56, 55]))).toEqual([55, 56]);
  });

  it('keeps a future sleep timer and drops a past one', () => {
    expect(buildContent({...base, sleepTimerEnd: 5_000}).sleepTimerEndsAt).toBe(
      5_000,
    );
    expect(
      buildContent({...base, sleepTimerEnd: 500}).sleepTimerEndsAt,
    ).toBeNull();
  });

  it('produces a valid content document', () => {
    expect(isWidgetContent(buildContent(base))).toBe(true);
  });
});
