import React, {useCallback, useRef, useMemo, useState} from 'react'; // @ai
import {
  View,
  Pressable,
  StyleSheet,
  Alert,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useLocalSearchParams} from 'expo-router'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {TrackItem} from '@/components/TrackItem';
import {getReciterByIdSync, getSurahById} from '@/services/dataService'; // @ai
// @ai-start
import {SurahOptionsProvider} from '@/components/sheets/options/surahOptions';
import type {SurahOptionsBuilder} from '@/components/sheets/options/SurahOptionsContext';
// @ai-end
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {ListRenderItem} from 'react-native';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {shuffleArray} from '@/utils/arrayUtils';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {useUploadsStore} from '@/store/uploadsStore';
import {createUserUploadTrack} from '@/utils/track';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {HeartIcon, CheckIcon} from '@/components/Icons';
import {
  useDownloadActions,
  useDownloadQueries,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {bulkDownloadSurahs} from '@/services/player/bulkDownloadSurahs'; // @ai
import {useCollectionDownloadState} from '@/hooks/useCollectionDownloadState';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SheetManager} from 'react-native-actions-sheet';
// @ai-start
import {confirmDestructive} from '@/utils/confirmDestructive';
// @ai-end
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
// @ai-start
import {useTranslation} from 'react-i18next';
import {CollectionEmptyState} from '@/components/collection/CollectionEmptyState'; // @ai
import {
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PanelRow,
} from '@/components/collection/CollectionPanel'; // @ai
import {flipX} from '@/utils/rtl';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {useIsStackRoot} from '@/components/tablet/useIsStackRoot'; // @ai
import {queueFromIndex} from '@/utils/queueFromIndex'; // @ai
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
import {
  CollectionHeaderActions,
  CollectionScreenHeader,
  CollectionSearchField,
} from '@/components/collection/CollectionScreenHeader';
import {SurahCover} from '@/components/collection/CollectionArt';
import {
  CollectionGridTile,
  GRID_GAP,
  GRID_PADDING,
  useGridTileWidth,
} from '@/components/collection/CollectionGridTile';
import {useCollectionViewPref} from '@/store/collectionViewStore';
import {getReciterDisplayName, getSurahDisplayName} from '@/i18n/format';
import {matchesQuery} from '@/utils/collectionSearch';
import {PlayIcon, ShuffleIcon, DownloadIcon} from '@/components/Icons';
// @ai-end

interface LovedTrack {
  /** The saved entry's own identity; unique in the list. @ai */
  key: string; // @ai
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  userRecitationId?: string;
  /** When it was loved. @ai */
  timestamp: number; // @ai
}

interface LovedTrackData {
  track: LovedTrack;
  reciter: Reciter | null;
  surah: Surah | null;
}

// @ai-start
const LovedScreen = () => {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The iPad sidebar opens this as the first screen of the Collection stack.
  // Back then has nothing to pop and used to switch to the Home tab, so the
  // arrow is left out there, as the system header does on iPadOS 26. @ai
  const isStackRoot = useIsStackRoot(); // @ai
  const {t} = useTranslation(['collection', 'common']);
  const {lovedTracks, toggleLoved, unloveAll} = useLoved();
  const {addToQueue, updateQueue, play, toggleShuffle} = usePlayerActions();
  const shuffleEnabled = usePlayerStore(state => state.settings.shuffle);
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain);
  const {
    isDownloaded,
    isDownloadedForPlayback,
    isDownloading,
    isDownloadingWithRewayat,
    setDownloading,
    clearDownloading,
    addDownload,
    setDownloadProgress,
  } = {...useDownloadQueries(), ...useDownloadActions()};

  // @ai-start
  // Each loved track with its reciter and surah, read straight from the
  // catalogue in memory (it is loaded before any screen shows). This used to
  // be an async reload behind a "Loading…" view on every change, so unloving
  // one surah blanked the whole screen and threw the list back to the top.
  //
  // A surah loved before rewayat were saved has none, and it plays in the
  // reciter's first rewayah. The row takes that rewayah here, once, so that
  // playing it, downloading it and its downloaded badge all mean the same
  // file. "Download all" used to save such a surah under an empty rewayah
  // that playback never looks up: the row showed as downloaded and then
  // failed to play offline. An upload keeps no rewayah; it is its own file.
  const lovedDataUnsorted = useMemo<LovedTrackData[]>(
    () =>
      lovedTracks.map(track => {
        const reciter = getReciterByIdSync(track.reciterId) ?? null;
        return {
          track: {
            // Built from what is saved, not from the rewayah the row takes
            // below: an old entry and a newer one for the reciter's first
            // rewayah would otherwise share a key.
            key: `${track.reciterId}:${track.surahId}:${
              track.rewayatId || ''
            }:${track.userRecitationId || ''}`,
            reciterId: track.reciterId,
            surahId: track.surahId,
            rewayatId: track.userRecitationId
              ? track.rewayatId
              : track.rewayatId || reciter?.rewayat[0]?.id,
            userRecitationId: track.userRecitationId,
            timestamp: track.timestamp,
          },
          reciter,
          surah: getSurahById(parseInt(track.surahId, 10)) ?? null,
        };
      }),
    [lovedTracks],
  );
  // @ai-start
  // The order picked in the view and sort menu. Playing follows it too.
  const {view, sort} = useCollectionViewPref('loved');
  const lovedData = useMemo(() => {
    const list = [...lovedDataUnsorted];
    const surahName = (d: LovedTrackData) =>
      d.surah ? getSurahDisplayName(d.surah) : '';
    const reciterName = (d: LovedTrackData) =>
      d.reciter ? getReciterDisplayName(d.reciter) : '';
    switch (sort) {
      case 'surah':
        list.sort(
          (a, b) =>
            Number(a.track.surahId) - Number(b.track.surahId) ||
            reciterName(a).localeCompare(reciterName(b)),
        );
        break;
      case 'reciter':
        list.sort(
          (a, b) =>
            reciterName(a).localeCompare(reciterName(b)) ||
            Number(a.track.surahId) - Number(b.track.surahId),
        );
        break;
      case 'title':
        list.sort((a, b) => surahName(a).localeCompare(surahName(b)));
        break;
      default:
        list.sort((a, b) => b.track.timestamp - a.track.timestamp);
    }
    return list;
  }, [lovedDataUnsorted, sort]);
  // @ai A search typed on the Collection tab arrives as `q`.
  const {q: initialQuery} = useLocalSearchParams<{q?: string}>(); // @ai
  const [searching, setSearching] = useState(Boolean(initialQuery));
  const [query, setQuery] = useState(initialQuery ?? '');
  const visibleData = useMemo(
    () =>
      searching && query.trim()
        ? lovedData.filter(d =>
            matchesQuery(query, [
              d.surah ? getSurahDisplayName(d.surah) : '',
              d.surah?.name,
              d.surah?.translated_name_english,
              d.reciter ? getReciterDisplayName(d.reciter) : '',
              d.reciter?.name,
              d.track.surahId,
            ]),
          )
        : lovedData,
    [lovedData, searching, query],
  );
  const tileWidth = useGridTileWidth(3);
  const reciterCount = useMemo(
    () => new Set(lovedData.map(d => d.track.reciterId)).size,
    [lovedData],
  );
  // @ai-end
  // What "Download all" is about. Uploads are files on the device already;
  // downloading one fetched the catalogue recording of its surah instead.
  const downloadableLoved = useMemo(
    () => lovedData.filter(item => !item.track.userRecitationId),
    [lovedData],
  );
  // A second tap while a batch runs must not start another one.
  const bulkDownloadInFlightRef = useRef(false);
  // @ai-end

  // Scroll tracking for sticky header
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContentContainer: {
      flexGrow: 1,
    },
    listItem: {
      marginVertical: moderateScale(2),
    },
    // @ai-start
    gridRow: {
      gap: GRID_GAP,
      paddingHorizontal: GRID_PADDING,
      marginBottom: moderateScale(16),
    },
    // @ai-end
    fixedBackButton: {
      position: 'absolute',
      top: insets.top + moderateScale(10),
      left: moderateScale(15),
      zIndex: 5,
      padding: moderateScale(8),
    },
    emptyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: moderateScale(12),
      paddingHorizontal: moderateScale(16),
    },
    emptyHeaderBack: {
      width: moderateScale(36),
      height: moderateScale(36),
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyHeaderTitle: {
      flex: 1,
      fontSize: moderateScale(17),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptyContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: moderateScale(32),
      paddingBottom: moderateScale(60),
    },
    emptyIcon: {
      marginBottom: moderateScale(16),
    },
    emptyTitle: {
      fontSize: moderateScale(17),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: moderateScale(8),
    },
    emptySubtitle: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: moderateScale(20),
    },
  });

  // Handle surah press to play track
  const handleSurahPress = useCallback(
    async (track: LovedTrack, reciter: Reciter, surah: Surah) => {
      try {
        if (lovedData.length === 0) {
          console.warn('No loved tracks data loaded yet');
          return;
        }

        // @ai The row that was tapped, by its own identity. Matching on
        // reciter, surah and rewayah could pick another row of the same
        // recitation (an upload, or an entry saved without a rewayah).
        const selectedIndex = lovedData.findIndex(
          item => item.track.key === track.key,
        );

        if (selectedIndex === -1) {
          console.warn('Selected track not found in loved tracks');
          return;
        }

        const artwork = getReciterArtwork(reciter);

        // @ai-start
        // One entry per loved row in list order, null where a row cannot be
        // played (its reciter left the catalogue, or its upload was deleted).
        const rowTracks = lovedData.map(item => {
          const itemReciter = item.reciter;
          const itemSurah = item.surah;
          if (!itemReciter || !itemSurah) return null;
          if (item.track.userRecitationId) {
            const upload = useUploadsStore
              .getState()
              .recitations.find(r => r.id === item.track.userRecitationId);
            return upload ? createUserUploadTrack(upload) : null;
          }
          const itemRewayatId =
            item.track.rewayatId || itemReciter.rewayat[0]?.id;
          return {
            id: `${itemReciter.id}:${itemSurah.id}`,
            url: generateSmartAudioUrl(
              itemReciter,
              itemSurah.id.toString(),
              itemRewayatId,
            ),
            title: itemSurah.name,
            artist: itemReciter.name,
            reciterId: itemReciter.id,
            artwork: getReciterArtwork(itemReciter),
            surahId: itemSurah.id.toString(),
            reciterName: itemReciter.name,
            rewayatId: itemRewayatId,
          };
        });

        // Nothing to play for the tapped row (its upload was deleted).
        // Starting the next row instead would play, and record in Continue
        // Listening, something the user did not tap.
        if (!rowTracks[selectedIndex]) return;

        // Keep the list's order and start at the tapped row. The queue used
        // to be rotated to put that row first, so Previous could never reach
        // the rows above it.
        const queue = queueFromIndex(rowTracks, selectedIndex);

        await updateQueue(queue.tracks, queue.startIndex);
        // @ai-end

        const rewayatId = track.rewayatId || reciter.rewayat[0]?.id;
        startNewChain(reciter, surah, 0, 0, rewayatId);
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [lovedData, startNewChain, updateQueue],
  );

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    if (lovedData.length === 0) return;

    try {
      const allTracks = lovedData
        .filter(item => item.reciter && item.surah)
        .map(item => {
          if (item.track.userRecitationId) {
            const upload = useUploadsStore
              .getState()
              .recitations.find(r => r.id === item.track.userRecitationId);
            if (upload) return createUserUploadTrack(upload);
            return null;
          }
          const itemRewayatId =
            item.track.rewayatId || item.reciter!.rewayat[0]?.id;
          return {
            id: `${item.reciter!.id}:${item.surah!.id}`,
            url: generateSmartAudioUrl(
              item.reciter!,
              item.surah!.id.toString(),
              itemRewayatId,
            ),
            title: item.surah!.name,
            artist: item.reciter!.name,
            reciterId: item.reciter!.id,
            artwork: getReciterArtwork(item.reciter!),
            surahId: item.surah!.id.toString(),
            reciterName: item.reciter!.name,
            rewayatId: itemRewayatId,
          };
        })
        .filter((qt): qt is NonNullable<typeof qt> => qt !== null);

      if (allTracks.length === 0) return;

      await updateQueue(allTracks, 0);

      const firstItem = lovedData.find(item => item.reciter && item.surah);
      if (firstItem?.reciter && firstItem?.surah) {
        const rewayatId =
          firstItem.track.rewayatId || firstItem.reciter.rewayat[0]?.id;
        startNewChain(firstItem.reciter, firstItem.surah, 0, 0, rewayatId);
      }
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  }, [lovedData, startNewChain, updateQueue]);

  // Shuffle all tracks
  const handleShuffle = useCallback(async () => {
    if (lovedData.length === 0) return;

    try {
      const shuffledItems = shuffleArray([...lovedData]).filter(
        item => item.reciter && item.surah,
      );

      if (shuffledItems.length === 0) return;

      // Enable shuffle mode
      if (!shuffleEnabled) {
        toggleShuffle();
      }

      const allTracks = shuffledItems
        .map(item => {
          if (item.track.userRecitationId) {
            const upload = useUploadsStore
              .getState()
              .recitations.find(r => r.id === item.track.userRecitationId);
            if (upload) return createUserUploadTrack(upload);
            return null;
          }
          const itemRewayatId =
            item.track.rewayatId || item.reciter!.rewayat[0]?.id;
          return {
            id: `${item.reciter!.id}:${item.surah!.id}`,
            url: generateSmartAudioUrl(
              item.reciter!,
              item.surah!.id.toString(),
              itemRewayatId,
            ),
            title: item.surah!.name,
            artist: item.reciter!.name,
            reciterId: item.reciter!.id,
            artwork: getReciterArtwork(item.reciter!),
            surahId: item.surah!.id.toString(),
            reciterName: item.reciter!.name,
            rewayatId: itemRewayatId,
          };
        })
        .filter((qt): qt is NonNullable<typeof qt> => qt !== null);

      await updateQueue(allTracks, 0);

      const firstItem = shuffledItems[0];
      if (firstItem.reciter && firstItem.surah) {
        const rewayatId =
          firstItem.track.rewayatId || firstItem.reciter.rewayat[0]?.id;
        startNewChain(firstItem.reciter, firstItem.surah, 0, 0, rewayatId);
      }
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [lovedData, startNewChain, updateQueue, shuffleEnabled, toggleShuffle]);

  // Handle bulk download
  // @ai-start
  const handleBulkDownload = useCallback(async () => {
    if (bulkDownloadInFlightRef.current) return;

    const items = downloadableLoved.flatMap(item =>
      item.reciter && item.surah
        ? [
            {
              surahId: item.surah.id,
              reciterId: item.track.reciterId,
              rewayatId: item.track.rewayatId,
            },
          ]
        : [],
    );
    if (items.length === 0) return;

    bulkDownloadInFlightRef.current = true;
    try {
      // The same batch the reciter profile uses: it skips what is already
      // downloaded or downloading, and counts what failed.
      const summary = await bulkDownloadSurahs(items, {
        downloadSurah,
        isDownloaded,
        // Skips what already plays offline, the way the row's badge counts
        // it: a surah an older version downloaded without a rewayah plays
        // that file in the reciter's first rewayah, the one its row takes.
        isDownloadedWithRewayat: isDownloadedForPlayback,
        isDownloading,
        isDownloadingWithRewayat,
        setDownloading,
        clearDownloading,
        addDownload,
        setDownloadProgress,
      });

      // This used to say "Download Complete" whatever happened, also when
      // the device was offline and every surah had failed.
      if (summary.failed > 0 && summary.downloaded > 0) {
        Alert.alert(
          t('lovedScreen.downloadPartialTitle'),
          t('lovedScreen.downloadPartialMessage', {
            downloaded: summary.downloaded,
            failed: summary.failed,
          }),
        );
      } else if (summary.failed > 0) {
        Alert.alert(
          t('lovedScreen.downloadErrorTitle'),
          t('lovedScreen.downloadFailedMessage'),
        );
      } else if (summary.downloaded > 0) {
        Alert.alert(
          t('lovedScreen.downloadCompleteTitle'),
          t('lovedScreen.downloadCompleteMessage'),
        );
      } else if (summary.skipped === summary.total) {
        Alert.alert(
          t('lovedScreen.alreadyDownloadedTitle'),
          t('lovedScreen.alreadyDownloadedMessage'),
        );
      }
    } catch (error) {
      console.error('Error in bulk download:', error);
      Alert.alert(
        t('lovedScreen.downloadErrorTitle'),
        t('lovedScreen.downloadErrorMessage'),
      );
    } finally {
      bulkDownloadInFlightRef.current = false;
    }
  }, [
    downloadableLoved,
    isDownloaded,
    isDownloadedForPlayback,
    isDownloadingWithRewayat,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
    t,
  ]);
  // @ai-end

  // Calculate download state for all loved tracks using custom hook
  const downloadState = useCollectionDownloadState(downloadableLoved); // @ai

  // Handle options menu
  // @ai-start
  const optionsPayload = useMemo<CollectionOptionsPayload>(
    () => ({
      title: t('collectionScreen.loved'),
      subtitle: t('common:counts.surahs', {count: lovedData.length}),
      options: [
        {
          label: downloadState.allDownloaded
            ? t('lovedScreen.allDownloaded')
            : t('lovedScreen.downloadAll'),
          icon: 'download',
          onPress: handleBulkDownload,
          disabled: downloadState.allDownloaded || downloadState.hasNoTracks,
          customIcon:
            downloadState.allDownloaded && !downloadState.hasNoTracks ? (
              <CheckIcon color={theme.colors.text} size={moderateScale(20)} />
            ) : undefined,
        },
        {
          label: t('lovedScreen.unloveAll'),
          icon: 'heart',
          destructive: true,
          customIcon: (
            <HeartIcon color="#ff4444" size={moderateScale(20)} filled={true} />
          ),
          // @ai-start
          onPress: () =>
            confirmDestructive({
              title: t('lovedScreen.unloveAllTitle'),
              message: t('lovedScreen.unloveAllConfirm'),
              confirmText: t('common:actions.remove'),
              cancelText: t('common:actions.cancel'),
              onConfirm: unloveAll,
            }),
          // @ai-end
        },
      ],
    }),
    [
      lovedData.length,
      downloadState,
      handleBulkDownload,
      unloveAll,
      theme.colors.text,
      t,
    ],
  );

  const handleOptionsMenu = useCallback(() => {
    SheetManager.show('collection-options', {payload: optionsPayload});
  }, [optionsPayload]);

  const renderHeaderRight = useCallback(
    () =>
      searching ? null : (
        <CollectionHeaderActions
          screen="loved"
          onSearch={() => setSearching(true)}
          extra={
            <CollectionOptionsMenu payload={optionsPayload}>
              <Pressable
                onPress={handleOptionsMenu}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('collectionScreen.actions.moreOptions')}>
                <Feather
                  name="more-horizontal"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
              </Pressable>
            </CollectionOptionsMenu>
          }
        />
      ),
    [optionsPayload, handleOptionsMenu, theme.colors.text, searching],
  );
  // @ai-end

  useCollectionNativeHeader({
    title: t('collectionScreen.loved'),
    scrollY,
    hasContent: lovedData.length > 0, // @ai
    headerRight: lovedData.length > 0 ? renderHeaderRight : undefined,
  });

  // @ai-start
  // The options payload for a loved track, used by the sheet (phones) and by
  // the native menu on each row (tablets).
  const buildOptions = useCallback<SurahOptionsBuilder>(
    (surah, row) => {
      const reciterId = row?.reciterId;
      const reciter = reciterId ? getReciterByIdSync(reciterId) : undefined;
      if (!reciter) return null;
      return {
        surah,
        reciterId,
        rewayatId: row?.rewayatId,
        onAddToQueue: async (s: Surah) => {
          if (row?.userRecitationId) {
            const upload = useUploadsStore
              .getState()
              .recitations.find(r => r.id === row.userRecitationId);
            if (upload) {
              await addToQueue([createUserUploadTrack(upload)]);
              return;
            }
          }
          const rewayatId = row?.rewayatId || reciter.rewayat[0]?.id;
          const artwork = getReciterArtwork(reciter);
          const queueTrack = {
            id: `${reciter.id}:${s.id}`,
            url: generateSmartAudioUrl(reciter, s.id.toString(), rewayatId),
            title: s.name,
            artist: reciter.name,
            reciterId: reciter.id,
            artwork,
            surahId: s.id.toString(),
            reciterName: reciter.name,
            rewayatId,
          };
          await addToQueue([queueTrack]);
        },
      };
    },
    [addToQueue],
  );

  // Handle show options for a track
  const handleShowOptions = useCallback(
    (track: LovedTrack, _reciter: Reciter, surah: Surah) => {
      const payload = buildOptions(surah, {
        reciterId: track.reciterId,
        rewayatId: track.rewayatId,
        userRecitationId: track.userRecitationId,
      });
      if (payload) SheetManager.show('surah-options', {payload});
    },
    [buildOptions],
  );
  // @ai-end

  const ListHeaderComponent = useCallback(() => {
    if (searching) {
      return (
        <CollectionSearchField
          value={query}
          onChangeText={setQuery}
          onCancel={() => {
            setSearching(false);
            setQuery('');
          }}
          placeholder={t('collectionScreen.search.placeholderIn', {
            name: t('collectionScreen.loved'),
          })}
          resultLabel={
            query.trim()
              ? t('collectionScreen.search.matches', {
                  count: visibleData.length,
                })
              : undefined
          }
          style={{
            paddingHorizontal: GRID_PADDING,
            paddingTop: USE_GLASS ? moderateScale(8) : insets.top + 8,
            paddingBottom: moderateScale(12),
          }}
        />
      );
    }
    return (
      <CollectionScreenHeader
        category="loved"
        preview={null}
        title={t('collectionScreen.loved')}
        meta={t('collectionScreen.meta.pair', {
          a: t('common:counts.tracks', {count: lovedData.length}),
          b: t('common:counts.reciters', {count: reciterCount}),
        })}
        primary={{
          label: t('collectionScreen.actions.playAll'),
          icon: (
            <PlayIcon
              color={theme.colors.background}
              size={moderateScale(15)}
            />
          ),
          onPress: handlePlayAll,
        }}
        secondary={[
          {
            label: t('common:actions.shuffle'),
            icon: (
              <ShuffleIcon color={theme.colors.text} size={moderateScale(15)} />
            ),
            onPress: handleShuffle,
          },
          {
            label: downloadState.allDownloaded
              ? t('lovedScreen.allDownloaded')
              : t('lovedScreen.downloadAll'),
            icon: downloadState.allDownloaded ? (
              <CheckIcon color={theme.colors.text} size={moderateScale(15)} />
            ) : (
              <DownloadIcon
                color={theme.colors.text}
                size={moderateScale(15)}
              />
            ),
            onPress: handleBulkDownload,
            disabled: downloadState.allDownloaded || downloadState.hasNoTracks,
          },
        ]}
        actions={renderHeaderRight()}
      />
    );
  }, [
    searching,
    query,
    visibleData.length,
    lovedData.length,
    reciterCount,
    downloadState,
    handlePlayAll,
    handleShuffle,
    handleBulkDownload,
    renderHeaderRight,
    insets.top,
    theme,
    t,
  ]);

  const renderItem: ListRenderItem<LovedTrackData> = ({item, index}) => {
    const {track, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    // @ai-start
    if (view === 'grid') {
      return (
        <CollectionGridTile
          width={tileWidth}
          art={
            <SurahCover
              surahId={surah.id}
              size={tileWidth}
              radius={moderateScale(14)}
            />
          }
          title={getSurahDisplayName(surah)}
          subtitle={getReciterDisplayName(reciter)}
          onPress={() => handleSurahPress(track, reciter, surah)}
          onLongPress={() => handleShowOptions(track, reciter, surah)}
        />
      );
    }
    // @ai-end

    return (
      <PanelRow first={index === 0} last={index === visibleData.length - 1}>
        <TrackItem
          transparent
          reciterId={track.reciterId}
          surahId={track.surahId}
          rewayatId={track.rewayatId}
          userRecitationId={track.userRecitationId}
          // The cover already says which surah it is. @ai
          art={
            <SurahCover
              surahId={surah.id}
              size={PANEL_ART_SIZE}
              radius={PANEL_ART_RADIUS}
            />
          }
          showSurahNumber={false}
          onPress={() => handleSurahPress(track, reciter, surah)}
          onPlayPress={() => handleSurahPress(track, reciter, surah)}
          onOptionsPress={() => handleShowOptions(track, reciter, surah)}
          onLongPress={() => handleShowOptions(track, reciter, surah)}
        />
      </PanelRow>
    );
  };

  const getItemKey = (item: LovedTrackData) => item.track.key; // @ai

  if (lovedData.length === 0) {
    // @ai The empty screen keeps the full screen's frame.
    return (
      <CollectionEmptyState
        category="loved"
        title={t('collectionScreen.loved')}
        meta={t('collectionScreen.emptyState.loved.meta')}
        heading={t('collectionScreen.emptyState.loved.heading')}
        message={t('collectionScreen.emptyState.loved.message')}
        showBack={!isStackRoot}
        link={{
          label: t('collectionScreen.emptyState.loved.link'),
          onPress: () =>
            router.push('/(tabs)/(a.home)/reciter/browse' as never),
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="default" />

      {/* Not at the stack root: nothing to go back to. @ai */}
      {!USE_GLASS && !isStackRoot && (
        <RNAnimated.View
          style={[
            styles.fixedBackButton,
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
              style={flipX}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      {/* @ai-start */}
      <SurahOptionsProvider build={buildOptions}>
        <RNAnimated.FlatList
          key={view} // @ai a FlatList can't change its columns in place
          data={visibleData} // @ai
          renderItem={renderItem}
          keyExtractor={getItemKey}
          ListHeaderComponent={ListHeaderComponent()} // @ai an element, so typing keeps focus
          numColumns={view === 'grid' ? 3 : 1} // @ai
          columnWrapperStyle={
            view === 'grid' ? styles.gridRow : undefined // @ai
          }
          keyboardShouldPersistTaps="handled" // @ai
          keyboardDismissMode="on-drag" // @ai
          contentContainerStyle={[
            styles.listContentContainer,
            {paddingBottom: listBottomPadding}, // @ai
          ]}
          contentInsetAdjustmentBehavior="automatic"
          onScroll={RNAnimated.event(
            [{nativeEvent: {contentOffset: {y: scrollY}}}],
            {useNativeDriver: true},
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        />
      </SurahOptionsProvider>
      {/* @ai-end */}
      {!USE_GLASS && (
        <CollectionStickyHeader
          title={t('collectionScreen.loved')}
          scrollY={scrollY}
        />
      )}
    </View>
  );
};
// @ai-end

export default LovedScreen;
