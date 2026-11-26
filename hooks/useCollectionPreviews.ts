// @ai-generated
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {useLoved} from '@/hooks/useLoved';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {usePlaylists} from '@/hooks/usePlaylists';
import {useDownloads} from '@/services/player/store/downloadSelectors';
import {useUploadsStore} from '@/store/uploadsStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {
  CollectionCategoryId,
  CollectionPreviewData,
} from '@/components/collection/CollectionArt';
import type {VerseBookmark} from '@/types/verse-annotations';

/**
 * What each Collection category shows in place of an icon: the newest
 * thing inside it. A category with nothing in it gets null, which draws
 * the glass icon.
 */
export function useCollectionPreviews(): Record<
  CollectionCategoryId,
  CollectionPreviewData
> {
  const {lovedTracks} = useLoved();
  const {favoriteReciters} = useFavoriteReciters();
  const {playlists, getPlaylistItems} = usePlaylists();
  const downloads = useDownloads();
  const uploads = useUploadsStore(s => s.recitations);

  const [newestBookmark, setNewestBookmark] = useState<VerseBookmark | null>(
    null,
  );
  const [hasNotes, setHasNotes] = useState(false);
  const [playlistSurahs, setPlaylistSurahs] = useState<number[]>([]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      verseAnnotationService
        .getAllBookmarks()
        .then(b => {
          if (!live) return;
          setNewestBookmark(
            b.reduce<VerseBookmark | null>(
              (a, x) => (!a || x.createdAt > a.createdAt ? x : a),
              null,
            ),
          );
        })
        .catch(() => undefined);
      verseAnnotationService
        .getAllNotes()
        .then(n => live && setHasNotes(n.length > 0))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, []),
  );

  // The most recently changed playlist's first four surahs.
  const newestPlaylist = useMemo(
    () =>
      playlists.reduce<(typeof playlists)[number] | null>(
        (a, p) => (!a || p.updatedAt > a.updatedAt ? p : a),
        null,
      ),
    [playlists],
  );
  useEffect(() => {
    let live = true;
    if (!newestPlaylist) {
      setPlaylistSurahs([]);
      return;
    }
    getPlaylistItems(newestPlaylist.id)
      .then(items => {
        if (!live) return;
        setPlaylistSurahs(
          [...items]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .slice(0, 4)
            .map(i => Number(i.surahId)),
        );
      })
      .catch(() => live && setPlaylistSurahs([]));
    return () => {
      live = false;
    };
  }, [newestPlaylist, getPlaylistItems]);

  return useMemo(() => {
    const newestLoved = lovedTracks.reduce<(typeof lovedTracks)[number] | null>(
      (a, x) => (!a || x.timestamp > a.timestamp ? x : a),
      null,
    );
    const newestDownload = downloads
      .filter(d => d.status === 'completed')
      .reduce<
        (typeof downloads)[number] | null
      >((a, d) => (!a || d.downloadDate > a.downloadDate ? d : a), null);
    const reciters = [...favoriteReciters]
      .sort((a, b) => b.favoritedAt - a.favoritedAt)
      .slice(0, 2);
    return {
      loved: newestLoved
        ? {kind: 'cover', surahId: Number(newestLoved.surahId)}
        : null,
      // A small mosaic shows its first surah; lead with one Loved and
      // Downloads aren't already showing so the rows don't look the same.
      playlists:
        newestPlaylist && playlistSurahs.length > 0
          ? {
              kind: 'mosaic',
              surahIds: leadWithUnused(playlistSurahs, [
                newestLoved ? Number(newestLoved.surahId) : null,
                newestDownload ? Number(newestDownload.surahId) : null,
              ]),
            }
          : null,
      downloads: newestDownload
        ? {
            kind: 'cover',
            surahId: Number(newestDownload.surahId),
            badge: 'download',
          }
        : null,
      bookmarks: newestBookmark
        ? {
            kind: 'verse',
            surahNumber: newestBookmark.surahNumber,
            ayahNumber: newestBookmark.ayahNumber,
          }
        : null,
      notes: hasNotes ? {kind: 'note'} : null,
      reciters:
        reciters.length > 0
          ? {
              kind: 'faces',
              reciters: reciters.map(r => ({
                id: r.id,
                name: r.name,
                image_url: r.image_url,
              })),
            }
          : null,
      // The newest upload tagged with a surah, as a cover with an upload
      // badge like Downloads; untagged uploads keep the glass icon.
      uploads: (() => {
        const tagged = uploads
          .filter(u => u.surahNumber)
          .sort((a, b) => b.dateAdded - a.dateAdded)[0];
        return tagged?.surahNumber
          ? {kind: 'cover', surahId: tagged.surahNumber, badge: 'upload'}
          : null;
      })(),
    };
  }, [
    lovedTracks,
    downloads,
    favoriteReciters,
    newestPlaylist,
    playlistSurahs,
    newestBookmark,
    hasNotes,
    uploads,
  ]);
}

/** Moves the first surah not in `used` to the front, keeping the rest. */
function leadWithUnused(ids: number[], used: Array<number | null>): number[] {
  const i = ids.findIndex(id => !used.includes(id));
  return i <= 0 ? ids : [ids[i], ...ids.slice(0, i), ...ids.slice(i + 1)];
}

/** The first four surahs of each playlist, for their mosaic covers. */
export function usePlaylistCovers(
  playlists: Array<{id: string; updatedAt: number}>,
): Record<string, number[]> {
  const {getPlaylistItems} = usePlaylists();
  const [covers, setCovers] = useState<Record<string, number[]>>({});
  // Reload when any playlist changes, not on every render.
  const signature = playlists.map(p => `${p.id}:${p.updatedAt}`).join('|');
  useEffect(() => {
    let live = true;
    Promise.all(
      playlists.map(p =>
        getPlaylistItems(p.id)
          .then(
            items =>
              [
                p.id,
                [...items]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .slice(0, 4)
                  .map(i => Number(i.surahId)),
              ] as const,
          )
          .catch(() => [p.id, [] as number[]] as const),
      ),
    ).then(entries => {
      if (live) setCovers(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
    // `signature` stands for `playlists`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, getPlaylistItems]);
  return covers;
}
