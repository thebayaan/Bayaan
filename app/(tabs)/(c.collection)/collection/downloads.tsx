import React, {useCallback, useRef, useMemo, useState} from 'react'; // @ai
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ListRenderItem,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useLocalSearchParams} from 'expo-router'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {TrackItem} from '@/components/TrackItem';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {
  useDownloadActions,
  useDownloads,
} from '@/services/player/store/downloadSelectors';
import {getReciterByIdSync, getSurahById} from '@/services/dataService'; // @ai
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createDownloadedTrack} from '@/utils/track';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
// @ai-start
import {confirmDestructive} from '@/utils/confirmDestructive';
// @ai-end
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {shuffleArray} from '@/utils/arrayUtils';
import Color from 'color';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {CollectionEmptyState} from '@/components/collection/CollectionEmptyState'; // @ai
import {
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PANEL_MARGIN,
  PANEL_ROW_PADDING,
  PanelRow,
} from '@/components/collection/CollectionPanel'; // @ai
import {getReciterDisplayName} from '@/i18n/format';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {useIsStackRoot} from '@/components/tablet/useIsStackRoot'; // @ai
// @ai-start
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
import {
  DownloadOptionsMenu,
  type DownloadOptionsPayload,
} from '@/components/sheets/options/downloadOptions';
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
import {NativeSegmentedControl} from '@/components/native/NativeSegmentedControl';
import {ReciterImage} from '@/components/ReciterImage';
import {
  useCollectionViewPref,
  useCollectionViewStore,
} from '@/store/collectionViewStore';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {matchesQuery} from '@/utils/collectionSearch';
// @ai-end
// @ai-end

interface DownloadDataItem {
  download: DownloadedSurah;
  reciter: Reciter | null;
  surah: Surah | null;
}

// @ai-start
/** One row or tile of the list, in either grouping and either view. */
type GroupedItem =
  | {
      type: 'reciter';
      reciterId: string;
      reciter: Reciter | null;
      count: number;
      bytes: number;
    }
  | {
      type: 'track';
      downloadData: DownloadDataItem;
      inGroup: boolean;
      /** Ends of its rounded panel in the list view. */
      first: boolean;
      last: boolean;
    };
// @ai-end

// @ai-start
export default function DownloadsScreen() {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The iPad sidebar opens this as the first screen of the Collection stack.
  // Back then has nothing to pop and used to switch to the Home tab, so the
  // arrow is left out there, as the system header does on iPadOS 26. @ai
  const isStackRoot = useIsStackRoot(); // @ai
  const {t} = useTranslation(['collection', 'common']);
  const downloads = useDownloads();
  const {removeDownload, clearAllDownloads} = useDownloadActions();
  const {updateQueue, addToQueue, play} = usePlayerActions();

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // @ai-start
  // Each download with its reciter and surah, read from the catalogue in
  // memory. This was an async lookup per row with no cancellation: every
  // row reloaded the whole catalogue, and an older run could finish last
  // and put a removed row back.
  const downloadData = useMemo<DownloadDataItem[]>(
    () =>
      downloads.map(download => ({
        download,
        reciter: getReciterByIdSync(download.reciterId) ?? null,
        surah: getSurahById(parseInt(download.surahId, 10)) ?? null,
      })),
    [downloads],
  );
  // @ai-end
  const nativeMenus = useNativeOptionsMenu(); // @ai

  // @ai-start
  const {view, sort} = useCollectionViewPref('downloads');
  const grouping = useCollectionViewStore(s => s.downloadsGrouping);
  const setGrouping = useCollectionViewStore(s => s.setDownloadsGrouping);
  // @ai A search typed on the Collection tab arrives as `q`.
  const {q: initialQuery} = useLocalSearchParams<{q?: string}>(); // @ai
  const [searching, setSearching] = useState(Boolean(initialQuery));
  const [query, setQuery] = useState(initialQuery ?? '');
  const reciterTileWidth = useGridTileWidth(3);
  const surahTileWidth = useGridTileWidth(3);
  const formatSize = useCallback(
    (bytes: number) =>
      bytes >= 1024 * 1024 * 1024
        ? t('collectionScreen.summary.sizeGB', {
            size: localizeDigits((bytes / (1024 * 1024 * 1024)).toFixed(1)),
          })
        : t('collectionScreen.summary.sizeMB', {
            size: localizeDigits(
              Math.max(1, Math.round(bytes / (1024 * 1024))),
            ),
          }),
    [t],
  );
  // The order picked in the view and sort menu; Play all follows it.
  const sortedData = useMemo(() => {
    const list = [...downloadData];
    if (sort === 'surah') {
      list.sort(
        (a, b) =>
          Number(a.download.surahId) - Number(b.download.surahId) ||
          (a.reciter ? getReciterDisplayName(a.reciter) : '').localeCompare(
            b.reciter ? getReciterDisplayName(b.reciter) : '',
          ),
      );
    } else if (sort === 'size') {
      list.sort(
        (a, b) => (b.download.fileSize || 0) - (a.download.fileSize || 0),
      );
    } else {
      list.sort(
        (a, b) =>
          (b.download.downloadDate || 0) - (a.download.downloadDate || 0),
      );
    }
    return list;
  }, [downloadData, sort]);
  const visibleData = useMemo(
    () =>
      searching && query.trim()
        ? sortedData.filter(d =>
            matchesQuery(query, [
              d.surah ? getSurahDisplayName(d.surah) : '',
              d.surah?.name,
              d.surah?.translated_name_english,
              d.reciter ? getReciterDisplayName(d.reciter) : '',
              d.reciter?.name,
              d.download.surahId,
            ]),
          )
        : sortedData,
    [sortedData, searching, query],
  );
  const totalBytes = useMemo(
    () => downloads.reduce((sum, d) => sum + (d.fileSize || 0), 0),
    [downloads],
  );
  // @ai-end

  // @ai-start
  const optionsPayload = useMemo<CollectionOptionsPayload>(
    () => ({
      title: t('common:terms.downloads'),
      subtitle: t('downloadsScreen.surahsDownloaded', {
        count: downloads.length,
      }),
      options: [
        {
          label: t('downloadsScreen.removeAll'),
          icon: 'trash-2',
          destructive: true,
          // @ai-start
          onPress: () =>
            confirmDestructive({
              title: t('downloadsScreen.removeAllTitle'),
              message: t('downloadsScreen.removeAllConfirm'),
              confirmText: t('common:actions.remove'),
              cancelText: t('common:actions.cancel'),
              onConfirm: clearAllDownloads,
            }),
          // @ai-end
        },
      ],
    }),
    [downloads.length, clearAllDownloads, t],
  );

  const handleOptionsMenu = useCallback(() => {
    SheetManager.show('collection-options', {payload: optionsPayload});
  }, [optionsPayload]);

  const renderHeaderRight = useCallback(
    () =>
      searching ? null : (
        <CollectionHeaderActions
          screen="downloads"
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
    title: t('common:terms.downloads'),
    scrollY,
    hasContent: downloads.length > 0,
    headerRight: downloads.length > 0 ? renderHeaderRight : undefined,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        // @ai-start
        groupHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: moderateScale(12),
          // Lines up with the rows' artwork; about 35pt between panels.
          paddingHorizontal: PANEL_MARGIN + PANEL_ROW_PADDING,
          paddingTop: moderateScale(28),
          paddingBottom: moderateScale(8),
        },
        groupFace: {
          width: moderateScale(40),
          height: moderateScale(40),
          borderRadius: moderateScale(20),
        },
        groupName: {
          fontSize: moderateScale(16),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
        },
        groupMeta: {
          fontSize: moderateScale(12),
          fontFamily: theme.fonts.medium,
          color: theme.colors.textSecondary,
          marginTop: moderateScale(1),
        },
        // @ai-end
        headerContainer: {
          width: '100%',
          overflow: 'hidden',
        },
        contentArea: {
          width: '100%',
          alignItems: 'center',
          paddingTop: USE_GLASS
            ? moderateScale(16)
            : insets.top + moderateScale(40),
          paddingBottom: moderateScale(10),
          overflow: 'hidden',
          backgroundColor: theme.colors.background,
        },
        contentCenter: {
          alignItems: 'center',
          paddingHorizontal: moderateScale(20),
        },
        heroIconContainer: {
          width: moderateScale(64),
          height: moderateScale(64),
          borderRadius: moderateScale(32),
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.1)
            .toString(),
        },
        heroIconInner: {
          width: moderateScale(56),
          height: moderateScale(56),
          borderRadius: moderateScale(28),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
        },
        title: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
          letterSpacing: latinLetterSpacing(-0.3),
        },
        subtitle: {
          fontSize: moderateScale(12),
          color: theme.colors.text,
          fontFamily: theme.fonts.regular,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        actionButtons: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: moderateScale(4),
          paddingBottom: moderateScale(12),
          paddingHorizontal: moderateScale(20),
          gap: moderateScale(16),
        },
        circleButton: {
          width: moderateScale(42),
          height: moderateScale(42),
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
          padding: moderateScale(8),
        },
        playButton: {
          width: moderateScale(42),
          height: moderateScale(42),
          backgroundColor: theme.colors.text,
        },
        playIconContainer: {
          paddingLeft: moderateScale(4),
        },
        disabledButton: {
          opacity: 0.4,
        },
        listContentContainer: {
          flexGrow: 1,
        },
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
      }),
    [theme, insets.top],
  );

  // @ai-start
  const groupedItems = useMemo<GroupedItem[]>(() => {
    if (grouping === 'surah') {
      return visibleData.map((downloadData, i) => ({
        type: 'track',
        downloadData,
        inGroup: false,
        first: i === 0,
        last: i === visibleData.length - 1,
      }));
    }
    // By reciter: a heading (or tile) for each reciter, its surahs under
    // it in the list. Reciters keep the order of their first surah in the
    // sort, so "Size" puts the reciter whose downloads are largest first.
    const order: string[] = [];
    const byReciter: Record<string, DownloadDataItem[]> = {};
    for (const item of visibleData) {
      const rid = item.download.reciterId;
      if (!byReciter[rid]) {
        byReciter[rid] = [];
        order.push(rid);
      }
      byReciter[rid].push(item);
    }
    if (sort === 'size') {
      const size = (rid: string) =>
        byReciter[rid].reduce((n, d) => n + (d.download.fileSize || 0), 0);
      order.sort((a, b) => size(b) - size(a));
    } else if (sort === 'surah') {
      const name = (rid: string) => {
        const r = byReciter[rid][0].reciter;
        return r ? getReciterDisplayName(r) : rid;
      };
      order.sort((a, b) => name(a).localeCompare(name(b)));
    }
    const items: GroupedItem[] = [];
    for (const rid of order) {
      const group = byReciter[rid];
      items.push({
        type: 'reciter',
        reciterId: rid,
        reciter: group[0].reciter,
        count: group.length,
        bytes: group.reduce((n, d) => n + (d.download.fileSize || 0), 0),
      });
      if (view === 'list') {
        group.forEach((downloadData, i) =>
          items.push({
            type: 'track',
            downloadData,
            inGroup: true,
            first: i === 0,
            last: i === group.length - 1,
          }),
        );
      }
    }
    return items;
  }, [visibleData, grouping, view, sort]);
  // @ai-end

  const handleSurahPress = useCallback(
    async (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
      try {
        const track = createDownloadedTrack(
          reciter,
          surah,
          download.filePath,
          download.rewayatId,
        );
        await updateQueue([track], 0);
        await play();
      } catch (error) {
        console.error('Error playing downloaded surah', error);
      }
    },
    [updateQueue, play],
  );

  const handleRemoveDownload = useCallback(
    (download: DownloadedSurah) => {
      removeDownload(
        download.reciterId,
        download.surahId,
        download.rewayatId || undefined,
      );
    },
    [removeDownload],
  );

  // @ai-start
  const buildDownloadOptions = useCallback(
    (
      download: DownloadedSurah,
      reciter: Reciter,
      surah: Surah,
    ): DownloadOptionsPayload => ({
      download,
      surah,
      reciterId: download.reciterId,
      rewayatId: download.rewayatId,
      onPlay: () => handleSurahPress(download, reciter, surah),
      onAddToQueue: () => {
        addToQueue([
          createDownloadedTrack(
            reciter,
            surah,
            download.filePath,
            download.rewayatId,
          ),
        ]);
      },
      onRemoveDownload: () => handleRemoveDownload(download),
    }),
    [handleSurahPress, addToQueue, handleRemoveDownload],
  );

  const handleShowOptions = useCallback(
    (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
      SheetManager.show('download-options', {
        payload: buildDownloadOptions(download, reciter, surah),
      });
    },
    [buildDownloadOptions],
  );
  // @ai-end

  const buildReciterGroupOptions = useCallback(
    (reciterId: string): CollectionOptionsPayload => {
      const reciterDownloads = downloadData.filter(
        item => item.download.reciterId === reciterId,
      );
      const firstReciter = reciterDownloads[0]?.reciter;
      const reciterName = firstReciter
        ? getReciterDisplayName(firstReciter)
        : t('common:terms.reciter');

      return {
        title: reciterName,
        subtitle: t('downloadsScreen.surahsDownloaded', {
          count: reciterDownloads.length,
        }),
        options: [
          {
            label: t('downloadsScreen.playAll'),
            icon: 'play',
            customIcon: (
              <PlayIcon color={theme.colors.text} size={moderateScale(20)} />
            ),
            onPress: async () => {
              const tracks = reciterDownloads
                .filter(item => item.reciter && item.surah)
                .map(item =>
                  createDownloadedTrack(
                    item.reciter!,
                    item.surah!,
                    item.download.filePath,
                    item.download.rewayatId,
                  ),
                );
              if (tracks.length > 0) {
                await updateQueue(tracks, 0);
                await play();
              }
            },
          },
          {
            label: t('downloadsScreen.removeAll'),
            icon: 'trash-2',
            destructive: true,
            // @ai-start
            onPress: () =>
              confirmDestructive({
                title: t('downloadsScreen.removeAllTitle'),
                message: t('downloadsScreen.removeReciterConfirm', {
                  reciter: reciterName,
                }),
                confirmText: t('common:actions.remove'),
                cancelText: t('common:actions.cancel'),
                onConfirm: async () => {
                  for (const item of reciterDownloads) {
                    await removeDownload(
                      item.download.reciterId,
                      item.download.surahId,
                      item.download.rewayatId || undefined,
                    );
                  }
                },
              }),
            // @ai-end
          },
        ],
      };
    },
    [downloadData, updateQueue, play, removeDownload, theme.colors.text, t],
  );

  const handleReciterGroupOptions = useCallback(
    (reciterId: string) => {
      SheetManager.show('collection-options', {
        payload: buildReciterGroupOptions(reciterId),
      });
    },
    [buildReciterGroupOptions],
  );

  const handlePlayAll = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      const trackPromises = downloadData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        return createDownloadedTrack(
          item.reciter,
          item.surah,
          item.download.filePath,
          item.download.rewayatId,
        );
      });

      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length === 0) return;

      await updateQueue(validTracks, 0);
      await play();
    } catch (error) {
      console.error('Error playing all downloads:', error);
    }
  }, [downloadData, updateQueue, play]);

  const handleShuffle = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      const shuffledItems = shuffleArray([...downloadData]).filter(
        item => item.reciter && item.surah,
      );

      if (shuffledItems.length === 0) return;

      const tracks = shuffledItems.map(item =>
        createDownloadedTrack(
          item.reciter!,
          item.surah!,
          item.download.filePath,
          item.download.rewayatId,
        ),
      );

      await updateQueue(tracks, 0);
      await play();
    } catch (error) {
      console.error('Error shuffling downloads:', error);
    }
  }, [downloadData, updateQueue, play]);

  const hasDownloads = downloadData.length > 0;

  if (downloads.length === 0) {
    // @ai The empty screen keeps the full screen's frame.
    return (
      <CollectionEmptyState
        category="downloads"
        title={t('common:terms.downloads')}
        meta={t('collectionScreen.emptyState.downloads.meta')}
        heading={t('collectionScreen.emptyState.downloads.heading')}
        message={t('collectionScreen.emptyState.downloads.message')}
        showBack={!isStackRoot}
        link={{
          label: t('collectionScreen.emptyState.downloads.link'),
          onPress: () => router.push('/(tabs)/(b.surahs)' as never),
        }}
      />
    );
  }

  // @ai-start
  const groupingControl = (
    <NativeSegmentedControl
      values={[
        t('collectionScreen.downloads.allSurahs'),
        t('collectionScreen.downloads.byReciter'),
      ]}
      selectedIndex={grouping === 'surah' ? 0 : 1}
      onChange={index => setGrouping(index === 0 ? 'surah' : 'reciter')}
      accessibilityLabel={t('collectionScreen.downloads.groupingLabel')}
      style={{marginTop: moderateScale(14), height: moderateScale(34)}}
    />
  );
  const listHeader = searching ? (
    <View
      style={{
        paddingHorizontal: GRID_PADDING,
        paddingTop: USE_GLASS ? moderateScale(8) : insets.top + 8,
        paddingBottom: moderateScale(12),
      }}>
      <CollectionSearchField
        value={query}
        onChangeText={setQuery}
        onCancel={() => {
          setSearching(false);
          setQuery('');
        }}
        placeholder={t('collectionScreen.search.placeholderIn', {
          name: t('common:terms.downloads'),
        })}
        resultLabel={
          query.trim()
            ? t('collectionScreen.search.matches', {count: visibleData.length})
            : undefined
        }
      />
      {groupingControl}
    </View>
  ) : (
    <CollectionScreenHeader
      category="downloads"
      preview={null}
      title={t('common:terms.downloads')}
      meta={t('collectionScreen.meta.pair', {
        a: t('common:counts.surahs', {count: downloads.length}),
        b: formatSize(totalBytes),
      })}
      primary={{
        label: t('collectionScreen.actions.playAll'),
        icon: (
          <PlayIcon color={theme.colors.background} size={moderateScale(15)} />
        ),
        onPress: handlePlayAll,
        disabled: !hasDownloads,
      }}
      secondary={[
        {
          label: t('common:actions.shuffle'),
          icon: (
            <ShuffleIcon color={theme.colors.text} size={moderateScale(15)} />
          ),
          onPress: handleShuffle,
          disabled: !hasDownloads,
        },
      ]}
      actions={renderHeaderRight()}>
      {groupingControl}
    </CollectionScreenHeader>
  );
  // @ai-end

  // @ai-start
  const renderItem: ListRenderItem<GroupedItem> = ({item}) => {
    if (item.type === 'reciter') {
      const name = item.reciter
        ? getReciterDisplayName(item.reciter)
        : item.reciterId;
      const subtitle = t('collectionScreen.meta.pair', {
        a: t('common:counts.surahs', {count: item.count}),
        b: formatSize(item.bytes),
      });
      const open = () =>
        router.push(`/collection/reciter-downloads/${item.reciterId}`);
      if (view === 'grid') {
        return (
          <CollectionGridTile
            width={reciterTileWidth}
            art={
              <ReciterImage
                imageUrl={item.reciter?.image_url ?? undefined}
                reciterName={item.reciter?.name ?? ''}
                style={{
                  width: reciterTileWidth,
                  height: reciterTileWidth,
                  borderRadius: moderateScale(18),
                }}
                profileIconSize={reciterTileWidth * 0.3}
              />
            }
            title={name}
            subtitle={subtitle}
            onPress={open}
            onLongPress={() => handleReciterGroupOptions(item.reciterId)}
          />
        );
      }
      return (
        <Pressable
          onPress={open}
          onLongPress={() => handleReciterGroupOptions(item.reciterId)}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${subtitle}`}
          style={({pressed}) => [
            styles.groupHeader,
            pressed && {opacity: 0.6},
          ]}>
          <ReciterImage
            imageUrl={item.reciter?.image_url ?? undefined}
            reciterName={item.reciter?.name ?? ''}
            style={styles.groupFace}
            profileIconSize={moderateScale(16)}
          />
          <View style={{flex: 1, minWidth: 0}}>
            <Text style={styles.groupName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.groupMeta} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
            style={flipX}
          />
        </Pressable>
      );
    }

    const {download, reciter, surah} = item.downloadData;

    if (!reciter || !surah) {
      return null;
    }

    if (view === 'grid') {
      return (
        <CollectionGridTile
          width={surahTileWidth}
          art={
            <SurahCover
              surahId={surah.id}
              size={surahTileWidth}
              radius={moderateScale(14)}
            />
          }
          title={getSurahDisplayName(surah)}
          subtitle={getReciterDisplayName(reciter)}
          onPress={() => handleSurahPress(download, reciter, surah)}
          onLongPress={() => handleShowOptions(download, reciter, surah)}
        />
      );
    }

    return (
      <PanelRow first={item.first} last={item.last}>
        <TrackItem
          transparent
          // Under its reciter's heading the name would repeat. @ai
          hideReciterName={item.inGroup}
          reciterId={download.reciterId}
          surahId={download.surahId}
          rewayatId={download.rewayatId}
          // The cover already says which surah it is. @ai
          art={
            <SurahCover
              surahId={surah.id}
              size={PANEL_ART_SIZE}
              radius={PANEL_ART_RADIUS}
            />
          }
          showSurahNumber={false}
          onPress={() => handleSurahPress(download, reciter, surah)}
          onPlayPress={() => handleSurahPress(download, reciter, surah)}
          onOptionsPress={() => handleShowOptions(download, reciter, surah)}
          onLongPress={() => handleShowOptions(download, reciter, surah)}
          optionsMenu={
            nativeMenus ? (
              <DownloadOptionsMenu
                payload={buildDownloadOptions(download, reciter, surah)}
              />
            ) : undefined
          }
        />
      </PanelRow>
    );
  };
  const columns = view === 'grid' ? 3 : 1;
  // @ai-end

  return (
    <View style={styles.container}>
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

      <RNAnimated.FlatList
        key={`${grouping}-${view}`} // @ai columns can't change in place
        data={groupedItems}
        renderItem={renderItem}
        // @ai-start
        keyExtractor={item =>
          item.type === 'reciter'
            ? `reciter-${item.reciterId}`
            : `track-${item.downloadData.download.reciterId}-${item.downloadData.download.surahId}-${item.downloadData.download.rewayatId}`
        }
        ListHeaderComponent={listHeader}
        numColumns={columns}
        columnWrapperStyle={
          columns > 1
            ? {
                gap: GRID_GAP,
                paddingHorizontal: GRID_PADDING,
                marginBottom: moderateScale(18),
              }
            : undefined
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // @ai-end
        contentContainerStyle={[
          styles.listContentContainer,
          {paddingBottom: listBottomPadding}, // @ai
        ]}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader
          title={t('common:terms.downloads')}
          scrollY={scrollY}
        />
      )}
    </View>
  );
}
// @ai-end
