import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {SystemPlaylist} from '@/data/systemPlaylists';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {LovedTrack} from '@/services/player/store/lovedStore';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {UserPlaylist, PlaylistItem} from '@/services/database/DatabaseService';
import type {CustomReciter, UploadedRecitation} from '@/types/uploads';
import {
  CarArtwork,
  CarItem,
  CarList,
  CarReciter,
  CarSection,
  CarSnapshot,
  downloadKey,
} from '@/services/car/types';
import {
  buildSituationalPicks,
  countOf,
  SituationalReciter,
  surahCount,
} from './situational';
import {
  buildMoreFrom,
  buildOnRepeat,
  ReciterRewayahPick,
  SurahPlayCount,
} from './personalized';
import {
  isCarRecent,
  playableUploads,
  uploadIdSet,
  uploadSubtitle,
  uploadSurah,
  withDuplicateUploadDates,
  uploadTitle,
} from './uploads';
import {
  DEFAULT_SURAH_ARTWORK_BASE,
  normalizeSurahArtworkBase,
} from '@/utils/surahArtworkBase';

export interface CarSnapshotInput {
  now: Date;
  reciters: Reciter[];
  surahs: Surah[];
  favoriteReciterIds: string[];
  defaultReciterId: string | null;
  recentTracks: RecentlyPlayedTrack[];
  /** Days each surah was listened to recently (on-device history). */
  playCounts: SurahPlayCount[];
  lovedTracks: LovedTrack[];
  downloads: DownloadedSurah[];
  userPlaylists: UserPlaylist[];
  playlistItems: Record<string, PlaylistItem[]>;
  systemPlaylists: SystemPlaylist[];
  uploads: UploadedRecitation[];
  customReciters: CustomReciter[];
  surahToJuz: Record<number, number>;
  resolveReciterArtwork: (reciter: Reciter) => CarArtwork;
  surahArtworkBase?: string;
  /** False when the fork turns off `userUploads` (RFC-021): no Uploads row. */
  uploadsEnabled?: boolean;
}

// Re-exported for existing callers; the helper is shared with the widgets.
export {DEFAULT_SURAH_ARTWORK_BASE, normalizeSurahArtworkBase};

const ALL_SURAH_IDS = Array.from({length: 114}, (_, i) => i + 1);
const JUMP_BACK_IN_LIMIT = 10;

export function availableSurahIds(rewayat: Rewayat | undefined): number[] {
  if (!rewayat || rewayat.surah_list.length === 0) return [...ALL_SURAH_IDS];
  return rewayat.surah_list
    .filter((id): id is number => id !== null)
    .sort((a, b) => a - b);
}

/**
 * The rewayah with the given id, else the reciter's fullest rewayah (most
 * available surahs; the first one wins a tie). A reciter's first rewayah can
 * be a partial recording, which would hide surahs the car should offer.
 */
const LAST_JUZ = 30;

/**
 * Surahs grouped by the juz they start in. Some juz start no surah (Juz 2 is
 * all Al-Baqarah), so each group's title covers the juz up to the next
 * group: "Juz 1–2", then "Juz 3".
 */
export function juzGroups(
  juzMap: ReadonlyMap<number, number[]>,
): {number: number; title: string; surahIds: number[]}[] {
  const sorted = [...juzMap.entries()].sort(([a], [b]) => a - b);
  return sorted.map(([number, surahIds], index) => {
    const next = sorted[index + 1]?.[0];
    const last = next === undefined ? LAST_JUZ : next - 1;
    const title = last > number ? `Juz ${number}–${last}` : `Juz ${number}`;
    return {number, title, surahIds};
  });
}

export function findRewayat(
  reciter: Reciter,
  rewayatId: string | undefined,
): Rewayat | undefined {
  const exact = reciter.rewayat.find(r => r.id === rewayatId);
  if (exact) return exact;
  let best: Rewayat | undefined;
  let bestCount = -1;
  for (const rewayat of reciter.rewayat) {
    const count = availableSurahIds(rewayat).length;
    if (count > bestCount) {
      best = rewayat;
      bestCount = count;
    }
  }
  return best;
}

function pickTopReciter(input: CarSnapshotInput): SituationalReciter | null {
  const recent = input.recentTracks.find(t => !t.isUserUpload);
  const candidates: {
    reciter: Reciter | undefined;
    rewayatId: string | undefined;
  }[] = [
    {
      reciter: recent
        ? input.reciters.find(r => r.id === recent.reciter.id)
        : undefined,
      rewayatId: recent?.rewayatId,
    },
    {
      reciter: input.reciters.find(r => r.id === input.defaultReciterId),
      rewayatId: undefined,
    },
  ];
  for (const candidate of candidates) {
    if (!candidate.reciter) continue;
    const rewayat = findRewayat(candidate.reciter, candidate.rewayatId);
    if (!rewayat) continue;
    return {
      reciterId: candidate.reciter.id,
      rewayatId: rewayat.id,
      name: candidate.reciter.name,
      surahIds: availableSurahIds(rewayat),
    };
  }
  return null;
}

function surahItem(
  id: string,
  reciter: Reciter,
  surah: Surah,
  extra: Partial<CarItem>,
  request: CarItem['action'],
): CarItem {
  return {
    id,
    title: surah.name,
    subtitle: reciter.name,
    artwork: {kind: 'surah', surahId: surah.id},
    ...extra,
    action: request,
  };
}

function uploadArtwork(
  upload: UploadedRecitation,
  input: CarSnapshotInput,
): CarArtwork {
  const surah = uploadSurah(upload, input.surahs);
  return surah
    ? {kind: 'surah', surahId: surah.id}
    : {kind: 'icon', name: 'uploads'};
}

function uploadItem(
  id: string,
  upload: UploadedRecitation,
  input: CarSnapshotInput,
  extra: Partial<CarItem>,
  request: CarItem['action'],
): CarItem {
  return {
    id,
    title: uploadTitle(upload, input.surahs),
    subtitle: uploadSubtitle(upload, input.reciters, input.customReciters),
    artwork: uploadArtwork(upload, input),
    ...extra,
    action: request,
  };
}

function buildJumpBackIn(input: CarSnapshotInput): CarItem[] {
  const uploadIds = uploadIdSet(input.uploads);
  const items: CarItem[] = [];
  input.recentTracks
    .filter(t => isCarRecent(t, uploadIds))
    .slice(0, JUMP_BACK_IN_LIMIT)
    .forEach(t => {
      if (t.isUserUpload) {
        const upload = input.uploads.find(u => u.id === t.userRecitationId);
        if (!upload) return;
        items.push(
          uploadItem(
            `recent:upload:${upload.id}`,
            upload,
            input,
            {progress: t.progress, duration: t.duration},
            {
              kind: 'play',
              request: {kind: 'resume', recitationId: upload.id},
            },
          ),
        );
        return;
      }
      const rewayatId = t.rewayatId || t.reciter.rewayat[0]?.id || '';
      items.push(
        surahItem(
          `recent:${t.reciter.id}:${rewayatId}:${t.surah.id}`,
          t.reciter,
          t.surah,
          {progress: t.progress, duration: t.duration},
          {
            kind: 'play',
            request: {
              kind: 'surah',
              reciterId: t.reciter.id,
              rewayatId,
              surahId: t.surah.id,
              startAt: t.progress * t.duration,
            },
          },
        ),
      );
    });
  return items;
}

function buildLovedList(input: CarSnapshotInput): CarList {
  const sorted = [...input.lovedTracks]
    .filter(t => !t.userRecitationId)
    .sort((a, b) => b.timestamp - a.timestamp);
  const items: CarItem[] = [];
  sorted.forEach(t => {
    const reciter = input.reciters.find(r => r.id === t.reciterId);
    const surah = input.surahs.find(s => s.id === Number(t.surahId));
    if (!reciter || !surah) return;
    items.push(
      surahItem(
        `loved:${t.reciterId}:${t.rewayatId}:${t.surahId}`,
        reciter,
        surah,
        {},
        {
          kind: 'play',
          request: {kind: 'loved', startIndex: items.length},
        },
      ),
    );
  });
  return {id: 'loved', title: 'Loved', items};
}

function buildDownloadsList(input: CarSnapshotInput): CarList {
  const items: CarItem[] = [];
  input.downloads
    .filter(d => d.status === 'completed')
    .forEach(d => {
      const reciter = input.reciters.find(r => r.id === d.reciterId);
      const surah = input.surahs.find(s => s.id === Number(d.surahId));
      if (!reciter || !surah) return;
      items.push(
        surahItem(
          `download:${d.reciterId}:${d.rewayatId}:${d.surahId}`,
          reciter,
          surah,
          {isDownloaded: true},
          {
            kind: 'play',
            request: {kind: 'downloads', startIndex: items.length},
          },
        ),
      );
    });
  return {id: 'downloads', title: 'Downloads', items};
}

function buildUploadsList(input: CarSnapshotInput): CarList {
  const uploads = playableUploads(input.uploads);
  const items = uploads.map((u, index) =>
    uploadItem(
      `upload:${u.id}`,
      u,
      input,
      {},
      {kind: 'play', request: {kind: 'uploads', startIndex: index}},
    ),
  );
  return {
    id: 'uploads',
    title: 'Uploads',
    items: withDuplicateUploadDates(items, uploads),
  };
}

function playlistEntries(
  input: CarSnapshotInput,
  nonEmptyListIds: Set<string>,
): CarItem[] {
  const user: CarItem[] = input.userPlaylists
    .filter(p => nonEmptyListIds.has(`playlist:${p.id}`))
    .map(p => ({
      id: `playlist:${p.id}`,
      title: p.name,
      subtitle: surahCount(p.itemCount),
      artwork: {kind: 'icon', name: 'playlist', hex: p.color},
      action: {
        kind: 'browse',
        target: {kind: 'list', listId: `playlist:${p.id}`},
      },
    }));
  const system: CarItem[] = [...input.systemPlaylists]
    .filter(p => nonEmptyListIds.has(`system:${p.id}`))
    .sort((a, b) => a.order - b.order)
    .map(p => ({
      id: `system:${p.id}`,
      title: p.title,
      subtitle: p.subtitle,
      artwork: {kind: 'icon', name: 'playlist', hex: p.backgroundColor},
      action: {
        kind: 'browse',
        target: {kind: 'list', listId: `system:${p.id}`},
      },
    }));
  return [...user, ...system];
}

function playlistLists(
  input: CarSnapshotInput,
  top: SituationalReciter | null,
): CarList[] {
  const lists: CarList[] = [];
  input.userPlaylists.forEach(p => {
    const items: CarItem[] = [];
    [...(input.playlistItems[p.id] ?? [])]
      .filter(i => !i.userRecitationId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach(i => {
        const reciter = input.reciters.find(r => r.id === i.reciterId);
        const surah = input.surahs.find(s => s.id === Number(i.surahId));
        if (!reciter || !surah) return;
        items.push(
          surahItem(
            `pl:${p.id}:${i.id}`,
            reciter,
            surah,
            {},
            {
              kind: 'play',
              request: {
                kind: 'playlist',
                playlistId: p.id,
                system: false,
                startIndex: items.length,
              },
            },
          ),
        );
      });
    lists.push({id: `playlist:${p.id}`, title: p.name, items});
  });
  input.systemPlaylists.forEach(p => {
    const items: CarItem[] = [];
    p.items.forEach(i => {
      const reciterId = i.reciterId ?? top?.reciterId;
      const reciter = input.reciters.find(r => r.id === reciterId);
      const surah = input.surahs.find(s => s.id === i.surahId);
      if (!reciter || !surah) return;
      const usesTopReciter = i.reciterId === undefined;
      if (usesTopReciter && !top?.surahIds.includes(i.surahId)) return;
      items.push(
        surahItem(
          `sys:${p.id}:${i.surahId}`,
          reciter,
          surah,
          {},
          {
            kind: 'play',
            request: {
              kind: 'playlist',
              playlistId: p.id,
              system: true,
              startIndex: items.length,
            },
          },
        ),
      );
    });
    lists.push({id: `system:${p.id}`, title: p.title, items});
  });
  return lists;
}

function reciterEntry(
  reciter: Reciter,
  input: CarSnapshotInput,
  isFavorite: boolean,
): CarReciter {
  return {
    id: reciter.id,
    name: reciter.name,
    artwork: input.resolveReciterArtwork(reciter),
    isFavorite,
    rewayat: reciter.rewayat.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style,
      surahIds: availableSurahIds(r),
    })),
  };
}

function reciterBrowseItem(reciter: CarReciter): CarItem {
  return {
    id: `reciter:${reciter.id}`,
    title: reciter.name,
    artwork: reciter.artwork,
    action: {kind: 'browse', target: {kind: 'reciter', reciterId: reciter.id}},
  };
}

export function buildCarSnapshot(input: CarSnapshotInput): CarSnapshot {
  const top = pickTopReciter(input);
  const favorites = new Set(input.favoriteReciterIds);

  const reciters: CarReciter[] = [
    ...input.reciters
      .filter(r => favorites.has(r.id))
      .map(r => reciterEntry(r, input, true)),
    ...input.reciters
      .filter(r => !favorites.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => reciterEntry(r, input, false)),
  ];
  const favoriteReciters = reciters
    .filter(r => r.isFavorite)
    .map(reciterBrowseItem);

  const lastRecent = input.recentTracks.find(t => !t.isUserUpload);
  const lastRewayat = lastRecent
    ? findRewayat(lastRecent.reciter, lastRecent.rewayatId)
    : undefined;
  const playlistListsAll = playlistLists(input, top);
  const nonEmptyLists = playlistListsAll.filter(list => list.items.length > 0);
  const nonEmptyListIds = new Set(nonEmptyLists.map(list => list.id));

  const situational = buildSituationalPicks({
    now: input.now,
    topReciter: top,
    lastPlayed:
      lastRecent && lastRewayat
        ? {
            reciterId: lastRecent.reciter.id,
            rewayatId: lastRewayat.id,
            reciterName: lastRecent.reciter.name,
            surahId: lastRecent.surah.id,
            completed: lastRecent.progress >= 0.95,
            surahIds: availableSurahIds(lastRewayat),
          }
        : null,
    systemPlaylists: input.systemPlaylists
      .filter(p => nonEmptyListIds.has(`system:${p.id}`))
      .map(p => ({
        id: p.id,
        title: p.title,
        color: p.backgroundColor,
        surahCount:
          nonEmptyLists.find(list => list.id === `system:${p.id}`)?.items
            .length ?? 0,
      })),
    surahName: (id: number): string =>
      input.surahs.find(s => s.id === id)?.name ?? `Surah ${id}`,
  });

  const jumpBackIn = buildJumpBackIn(input);
  const findPick = (
    recentReciter: Reciter,
    rewayatId: string,
    surahId: number,
  ): ReciterRewayahPick | null => {
    const reciter =
      input.reciters.find(r => r.id === recentReciter.id) ?? recentReciter;
    const rewayat = findRewayat(reciter, rewayatId);
    if (!rewayat || !availableSurahIds(rewayat).includes(surahId)) return null;
    return {
      reciterId: reciter.id,
      rewayatId: rewayat.id,
      reciterName: reciter.name,
    };
  };
  const onRepeat = buildOnRepeat(
    input.playCounts,
    input.surahs,
    input.recentTracks,
    top,
    findPick,
  );
  const moreFrom = buildMoreFrom(top, input.surahs, input.recentTracks);
  const loved = buildLovedList(input);
  const downloads = buildDownloadsList(input);
  const uploadsEnabled = input.uploadsEnabled ?? true;
  const uploads = buildUploadsList(input);
  const playlists = playlistEntries(input, nonEmptyListIds);

  // Resume leads the top row, then the time-of-day picks, then Loved.
  // Like the picks, each card's title is what plays and its subtitle why.
  const forNow: CarItem[] = [];
  if (jumpBackIn.length > 0) {
    forNow.push({
      id: 'now:resume',
      title: jumpBackIn[0].title,
      subtitle: 'Resume',
      artwork: jumpBackIn[0].artwork,
      action: {kind: 'play', request: {kind: 'resume'}},
    });
  }
  forNow.push(...situational);
  if (loved.items.length > 0) {
    forNow.push({
      id: 'now:shuffle-loved',
      title: 'Loved',
      subtitle: 'Shuffle',
      artwork: {kind: 'icon', name: 'loved'},
      action: {kind: 'play', request: {kind: 'loved', shuffle: true}},
    });
  }

  const allSections: CarSection[] = [
    {id: 'for-now', title: 'For right now', style: 'cards', items: forNow},
    {
      // The phone Home card's car twin, always on offer. One self-explaining
      // row, so no header.
      id: 'surprise',
      title: '',
      style: 'rows',
      items:
        input.reciters.length > 0
          ? [
              {
                id: 'surprise:random',
                title: 'Surprise me',
                subtitle: 'Any surah, any reciter',
                artwork: {kind: 'icon', name: 'random'},
                action: {kind: 'play', request: {kind: 'random'}},
              },
            ]
          : [],
    },
    {
      id: 'jump-back-in',
      title: 'Jump back in',
      style: 'rows',
      items: jumpBackIn,
    },
    {id: 'on-repeat', title: 'On repeat', style: 'cards', items: onRepeat},
    {
      id: 'more-from',
      title: moreFrom.title,
      style: 'cards',
      items: moreFrom.items,
    },
    {
      id: 'your-reciters',
      title: 'Your reciters',
      style: 'circles',
      items: favoriteReciters,
    },
    {
      id: 'your-playlists',
      title: 'Your playlists',
      style: 'rows',
      items: playlists,
    },
  ];
  const sections = allSections.filter(section => section.items.length > 0);

  const lists: Record<string, CarList> = {
    loved,
    downloads,
    ...(uploadsEnabled ? {uploads} : {}),
    playlists: {id: 'playlists', title: 'Playlists', items: playlists},
    'favorite-reciters': {
      id: 'favorite-reciters',
      title: 'Favorite reciters',
      items: favoriteReciters,
    },
  };
  nonEmptyLists.forEach(list => {
    lists[list.id] = list;
  });

  const libraryAll: CarItem[] = [
    {
      id: 'lib:loved',
      title: 'Loved',
      subtitle: surahCount(loved.items.length),
      artwork: {kind: 'icon', name: 'loved'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'loved'}},
    },
    {
      id: 'lib:playlists',
      title: 'Playlists',
      subtitle: countOf(playlists.length, 'playlist'),
      artwork: {kind: 'icon', name: 'playlists'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'playlists'}},
    },
    {
      id: 'lib:downloads',
      title: 'Downloads',
      subtitle: surahCount(downloads.items.length),
      artwork: {kind: 'icon', name: 'downloads'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'downloads'}},
    },
    {
      id: 'lib:uploads',
      title: 'Uploads',
      subtitle: countOf(uploads.items.length, 'recitation'),
      artwork: {kind: 'icon', name: 'uploads'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'uploads'}},
    },
    {
      id: 'lib:favorite-reciters',
      title: 'Favorite reciters',
      subtitle: countOf(favoriteReciters.length, 'reciter'),
      artwork: {kind: 'icon', name: 'reciters'},
      action: {
        kind: 'browse',
        target: {kind: 'list', listId: 'favorite-reciters'},
      },
    },
  ];
  const library = uploadsEnabled
    ? libraryAll
    : libraryAll.filter(item => item.id !== 'lib:uploads');

  const juzMap = new Map<number, number[]>();
  input.surahs.forEach(s => {
    const juz = input.surahToJuz[s.id];
    if (juz === undefined) return;
    juzMap.set(juz, [...(juzMap.get(juz) ?? []), s.id]);
  });

  return {
    version: 1,
    generatedAt: input.now.toISOString(),
    topReciterId: top?.reciterId ?? null,
    home: {sections},
    library,
    lists,
    reciters,
    surahs: input.surahs.map(s => ({
      id: s.id,
      name: s.name,
      nameArabic: s.name_arabic,
      translation: s.translated_name_english,
      versesCount: s.verses_count,
    })),
    juz: juzGroups(juzMap),
    downloadedKeys: input.downloads
      .filter(d => d.status === 'completed')
      .map(d => downloadKey(d.reciterId, d.rewayatId, Number(d.surahId))),
    surahArtworkBase: normalizeSurahArtworkBase(input.surahArtworkBase),
  };
}
