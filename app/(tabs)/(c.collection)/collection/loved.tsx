import React, {useState, useEffect, useCallback, useRef} from 'react';
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
import {getReciterById, getSurahById} from '@/services/dataService';
import {moderateScale} from 'react-native-size-matters';
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
import {SheetManager} from 'react-native-actions-sheet';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';

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

const LovedScreen = () => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      paddingBottom: moderateScale(65),
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
      lovedTracks.map(t => `${t.reciterId}:${t.surahId}:${t.rewayatId || ''}`),
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
          .filter((t): t is NonNullable<typeof t> => t !== null);

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
        .filter((t): t is NonNullable<typeof t> => t !== null);

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
        .filter((t): t is NonNullable<typeof t> => t !== null);

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
          'Already Downloaded',
          'All loved surahs are already downloaded.',
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
        'Download Complete',
        'All loved surahs have been downloaded.',
      );
    } catch (error) {
      console.error('Error in bulk download:', error);
      Alert.alert('Download Error', 'Some downloads may have failed.');
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
  ]);

  // Calculate download state for all loved tracks using custom hook
  const downloadState = useCollectionDownloadState(lovedData);

  // Handle options menu
  const handleOptionsMenu = useCallback(() => {
    SheetManager.show('collection-options', {
      payload: {
        title: 'Loved',
        subtitle: `${lovedData.length} ${
          lovedData.length === 1 ? 'surah' : 'surahs'
        }`,
        options: [
          {
            label: downloadState.allDownloaded
              ? 'All Downloaded'
              : 'Download All',
            icon: 'download',
            onPress: handleBulkDownload,
            disabled: downloadState.allDownloaded || downloadState.hasNoTracks,
            customIcon:
              downloadState.allDownloaded && !downloadState.hasNoTracks ? (
                <CheckIcon color={theme.colors.text} size={moderateScale(20)} />
              ) : undefined,
          },
          {
            label: 'Unlove All Surahs',
            icon: 'heart',
            destructive: true,
            customIcon: (
              <HeartIcon
                color="#ff4444"
                size={moderateScale(20)}
                filled={true}
              />
            ),
            onPress: () => unloveAll(),
          },
        ],
      },
    });
  }, [
    lovedData.length,
    downloadState,
    handleBulkDownload,
    unloveAll,
    theme.colors.text,
  ]);

  const renderHeaderRight = useCallback(
    () => (
      <Pressable onPress={handleOptionsMenu} hitSlop={8}>
        <Feather
          name="more-horizontal"
          size={moderateScale(20)}
          color={theme.colors.text}
        />
      </Pressable>
    ),
    [handleOptionsMenu, theme.colors.text],
  );

  useCollectionNativeHeader({
    title: 'Loved',
    scrollY,
    hasContent: lovedData.length > 0 && !loading,
    headerRight: lovedData.length > 0 ? renderHeaderRight : undefined,
  });

  // Handle show options for a track
  const handleShowOptions = useCallback(
    (track: LovedTrack, reciter: Reciter, surah: Surah) => {
      SheetManager.show('surah-options', {
        payload: {
          surah,
          reciterId: track.reciterId,
          rewayatId: track.rewayatId,
          onAddToQueue: async (s: Surah) => {
            if (track.userRecitationId) {
              const upload = useUploadsStore
                .getState()
                .recitations.find(r => r.id === track.userRecitationId);
              if (upload) {
                await addToQueue([createUserUploadTrack(upload)]);
                return;
              }
            }
            const rewayatId = track.rewayatId || reciter.rewayat[0]?.id;
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
        },
      });
    },
    [addToQueue],
  );

  const ListHeaderComponent = useCallback(() => {
    return (
      <LovedHeader
        title="Loved"
        subtitle={`${lovedData.length} ${
          lovedData.length === 1 ? 'surah' : 'surahs'
        }`}
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        onOptionsPress={USE_GLASS ? undefined : handleOptionsMenu}
        theme={theme}
      />
    );
  }, [
    lovedData.length,
    handlePlayAll,
    handleShuffle,
    handleOptionsMenu,
    theme,
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
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>Loved</Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <Text style={styles.loadingText}>Loading...</Text>
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
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>Loved</Text>
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
          <Text style={styles.emptyTitle}>No loved surahs yet</Text>
          <Text style={styles.emptySubtitle}>Love surahs to see them here</Text>
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
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={lovedData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      {!USE_GLASS && (
        <CollectionStickyHeader title="Loved" scrollY={scrollY} />
      )}
    </View>
  );
};

export default LovedScreen;
