import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {TrackItem} from '@/components/TrackItem';
import {
  getReciterById,
  getReciterByIdSync,
  getSurahById,
} from '@/services/dataService';
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
import {LovedHeader} from '@/components/playlist-detail/LovedHeader';
import {HeartIcon, CheckIcon} from '@/components/Icons';
import {
  useDownloadActions,
  useDownloadQueries,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {useCollectionDownloadState} from '@/hooks/useCollectionDownloadState';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-start
import {confirmDestructive} from '@/utils/confirmDestructive';
// @ai-end
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
// @ai-start
import {useTranslation} from 'react-i18next';
import {flipX} from '@/utils/rtl';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
// @ai-end

interface LovedTrack {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  userRecitationId?: string;
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
  const {t} = useTranslation(['collection', 'common']);
  const {lovedTracks, toggleLoved, unloveAll} = useLoved();
  const {addToQueue, updateQueue, play, toggleShuffle} = usePlayerActions();
  const shuffleEnabled = usePlayerStore(state => state.settings.shuffle);
  const {startNewChain} = useRecentlyPlayedStore();
  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
    setDownloading,
    clearDownloading,
    addDownload,
    setDownloadProgress,
  } = {...useDownloadQueries(), ...useDownloadActions()};

  const [lovedData, setLovedData] = useState<LovedTrackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloadingBulk, setIsDownloadingBulk] = useState(false);

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
    loadingText: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  // Use ref to track previous lovedTracks content to prevent infinite loops
  const prevLovedTracksRef = useRef<string>('');

  const loadLovedData = useCallback(async () => {
    try {
      setLoading(true);

      // Enrich with surah and reciter data
      const enrichedData = await Promise.all(
        lovedTracks.map(async track => {
          const [reciter, surah] = await Promise.all([
            getReciterById(track.reciterId),
            Promise.resolve(getSurahById(parseInt(track.surahId, 10))),
          ]);

          return {
            track: {
              reciterId: track.reciterId,
              surahId: track.surahId,
              rewayatId: track.rewayatId,
              userRecitationId: track.userRecitationId,
            },
            reciter: reciter || null,
            surah: surah || null,
          };
        }),
      );

      setLovedData(enrichedData);
    } catch (error) {
      console.error('Failed to load loved tracks:', error);
    } finally {
      setLoading(false);
    }
  }, [lovedTracks]);

  // Load loved tracks data
  useEffect(() => {
    // Create a stable string representation of lovedTracks
    const currentTracksString = JSON.stringify(
      lovedTracks.map(
        lt => `${lt.reciterId}:${lt.surahId}:${lt.rewayatId || ''}`,
      ),
    );

    // Only reload if the content actually changed
    if (prevLovedTracksRef.current !== currentTracksString) {
      prevLovedTracksRef.current = currentTracksString;
      loadLovedData();
    }
  }, [lovedTracks, loadLovedData]);

  // Handle surah press to play track
  const handleSurahPress = useCallback(
    async (track: LovedTrack, reciter: Reciter, surah: Surah) => {
      try {
        if (lovedData.length === 0) {
          console.warn('No loved tracks data loaded yet');
          return;
        }

        const selectedIndex = lovedData.findIndex(
          item =>
            item.reciter?.id === reciter.id &&
            item.surah?.id === surah.id &&
            (item.track.rewayatId || '') === (track.rewayatId || ''),
        );

        if (selectedIndex === -1) {
          console.warn('Selected track not found in loved tracks');
          return;
        }

        const artwork = getReciterArtwork(reciter);

        // Build all tracks with selected surah first
        const reorderedItems = [
          lovedData[selectedIndex],
          ...lovedData.slice(selectedIndex + 1),
          ...lovedData.slice(0, selectedIndex),
        ];

        const allTracks = reorderedItems
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
  const handleBulkDownload = useCallback(async () => {
    if (isDownloadingBulk) return;
    if (lovedData.length === 0) return;

    setIsDownloadingBulk(true);

    try {
      // Filter out items that are already downloaded
      const itemsToDownload = lovedData.filter(item => {
        if (!item.reciter || !item.surah) return false;
        if (item.track.rewayatId) {
          return !isDownloadedWithRewayat(
            item.track.reciterId,
            item.track.surahId,
            item.track.rewayatId,
          );
        }
        return !isDownloaded(item.track.reciterId, item.track.surahId);
      });

      if (itemsToDownload.length === 0) {
        Alert.alert(
          t('lovedScreen.alreadyDownloadedTitle'),
          t('lovedScreen.alreadyDownloadedMessage'),
        );
        setIsDownloadingBulk(false);
        return;
      }

      // Throttle progress updates to prevent AsyncStorage overload
      const progressUpdateThrottle = 300; // Only update every 300ms
      const lastProgressUpdateRef = {current: 0};

      // Download items sequentially with delays to prevent AsyncStorage overload
      for (let index = 0; index < itemsToDownload.length; index++) {
        const item = itemsToDownload[index];
        if (!item.reciter || !item.surah) continue;

        const surahId = parseInt(item.track.surahId, 10);
        // Generate download ID with rewayatId if provided for proper tracking
        const downloadId = item.track.rewayatId
          ? `${item.track.reciterId}-${surahId}-${item.track.rewayatId}`
          : `${item.track.reciterId}-${surahId}`;

        // Skip if already downloading - use rewayat-aware check if rewayatId is provided
        const isCurrentlyDownloading = item.track.rewayatId
          ? isDownloadingWithRewayat(
              item.track.reciterId,
              item.track.surahId,
              item.track.rewayatId,
            )
          : isDownloading(item.track.reciterId, item.track.surahId);

        if (isCurrentlyDownloading) {
          continue;
        }

        try {
          setDownloading(downloadId);

          // Download with throttled progress tracking
          const downloadResult = await downloadSurah(
            surahId,
            item.track.reciterId,
            item.track.rewayatId,
            progress => {
              // Throttle progress updates to prevent AsyncStorage queue overflow
              const now = Date.now();
              if (
                now - lastProgressUpdateRef.current <
                progressUpdateThrottle
              ) {
                return;
              }
              lastProgressUpdateRef.current = now;
              setDownloadProgress(downloadId, progress);
            },
          );

          // Add to downloads
          addDownload({
            reciterId: item.track.reciterId,
            surahId: item.track.surahId,
            rewayatId: item.track.rewayatId || '',
            filePath: downloadResult.filePath,
            fileSize: downloadResult.fileSize,
            downloadDate: Date.now(),
            status: 'completed',
          });

          clearDownloading(downloadId);

          // Small delay between downloads to let AsyncStorage catch up
          // Only add delay if not the last item
          if (index < itemsToDownload.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error('Error downloading surah:', error);
          clearDownloading(downloadId);
        }
      }

      Alert.alert(
        t('lovedScreen.downloadCompleteTitle'),
        t('lovedScreen.downloadCompleteMessage'),
      );
    } catch (error) {
      console.error('Error in bulk download:', error);
      Alert.alert(
        t('lovedScreen.downloadErrorTitle'),
        t('lovedScreen.downloadErrorMessage'),
      );
    } finally {
      setIsDownloadingBulk(false);
    }
  }, [
    isDownloadingBulk,
    lovedData,
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloadingWithRewayat,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
    t,
  ]);

  // Calculate download state for all loved tracks using custom hook
  const downloadState = useCollectionDownloadState(lovedData);

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
    showSheet('collection-options', {payload: optionsPayload});
  }, [optionsPayload]);

  const renderHeaderRight = useCallback(
    () => (
      <CollectionOptionsMenu payload={optionsPayload}>
        <Pressable onPress={handleOptionsMenu} hitSlop={8}>
          <Feather
            name="more-horizontal"
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      </CollectionOptionsMenu>
    ),
    [optionsPayload, handleOptionsMenu, theme.colors.text],
  );
  // @ai-end

  useCollectionNativeHeader({
    title: t('collectionScreen.loved'),
    scrollY,
    hasContent: lovedData.length > 0 && !loading,
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
      if (payload) showSheet('surah-options', {payload});
    },
    [buildOptions],
  );
  // @ai-end

  const ListHeaderComponent = useCallback(() => {
    return (
      <LovedHeader
        title={t('collectionScreen.loved')}
        subtitle={t('common:counts.surahs', {count: lovedData.length})}
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        onOptionsPress={USE_GLASS ? undefined : handleOptionsMenu}
        optionsMenu={
          <CollectionOptionsMenu payload={optionsPayload} layout="overlay" />
        }
        theme={theme}
      />
    );
  }, [
    lovedData.length,
    handlePlayAll,
    handleShuffle,
    handleOptionsMenu,
    optionsPayload,
    theme,
    t,
  ]);

  const renderItem: ListRenderItem<LovedTrackData> = ({item}) => {
    const {track, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    return (
      <View style={styles.listItem}>
        <TrackItem
          reciterId={track.reciterId}
          surahId={track.surahId}
          rewayatId={track.rewayatId}
          userRecitationId={track.userRecitationId}
          onPress={() => handleSurahPress(track, reciter, surah)}
          onPlayPress={() => handleSurahPress(track, reciter, surah)}
          onOptionsPress={() => handleShowOptions(track, reciter, surah)}
          onLongPress={() => handleShowOptions(track, reciter, surah)}
        />
      </View>
    );
  };

  const getItemKey = (item: LovedTrackData) =>
    `${item.track.reciterId}:${item.track.surahId}:${
      item.track.rewayatId || ''
    }`;

  if (loading) {
    return (
      <View style={styles.container}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            <Pressable
              style={styles.emptyHeaderBack}
              onPress={() => router.back()}
              hitSlop={8}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
                style={flipX}
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>
              {t('collectionScreen.loved')}
            </Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <Text style={styles.loadingText}>{t('common:status.loading')}</Text>
        </View>
      </View>
    );
  }

  if (lovedData.length === 0) {
    return (
      <View style={styles.container}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            <Pressable
              style={styles.emptyHeaderBack}
              onPress={() => router.back()}
              hitSlop={8}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
                style={flipX}
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>
              {t('collectionScreen.loved')}
            </Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <HeartIcon
              color={theme.colors.textSecondary}
              size={moderateScale(48)}
              filled={true}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {t('collectionScreen.empty.loved')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('lovedScreen.emptySubtitle')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="default" />

      {!USE_GLASS && (
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
          data={lovedData}
          renderItem={renderItem}
          keyExtractor={getItemKey}
          ListHeaderComponent={ListHeaderComponent}
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
