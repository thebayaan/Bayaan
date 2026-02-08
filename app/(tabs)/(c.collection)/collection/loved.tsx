import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {TrackItem} from '@/components/TrackItem';
import {getReciterById, getSurahById} from '@/services/dataService';
import {moderateScale} from 'react-native-size-matters';
import {ListRenderItem} from 'react-native';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {shuffleArray} from '@/utils/arrayUtils';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {LovedHeader} from '@/components/playlist-detail/LovedHeader';
import {
  useDownloadActions,
  useDownloadQueries,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {useCollectionDownloadState} from '@/hooks/useCollectionDownloadState';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SheetManager} from 'react-native-actions-sheet';

interface LovedTrack {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
}

interface LovedTrackData {
  track: LovedTrack;
  reciter: Reciter | null;
  surah: Surah | null;
}

const LovedScreen = () => {
  const {theme} = useTheme();
  const {lovedTracks, toggleLoved} = useLoved();
  const {pause, addToQueue, updateQueue, play, toggleShuffle} =
    usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);
  const shuffleEnabled = usePlayerStore(state => state.settings.shuffle);
  const {addRecentTrack} = useRecentlyPlayedStore();
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
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: moderateScale(32),
    },
    listItem: {
      marginVertical: moderateScale(2),
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
          });

        if (allTracks.length === 0) return;

        await updateQueue(allTracks, 0);

        const rewayatId = track.rewayatId || reciter.rewayat[0]?.id;
        addRecentTrack(reciter, surah, 0, 0, rewayatId);
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [lovedData, addRecentTrack, updateQueue],
  );

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    if (lovedData.length === 0) return;

    try {
      if (playbackState === 'playing') {
        await pause();
        return;
      }

      const allTracks = lovedData
        .filter(item => item.reciter && item.surah)
        .map(item => {
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
        });

      if (allTracks.length === 0) return;

      await updateQueue(allTracks, 0);

      const firstItem = lovedData.find(item => item.reciter && item.surah);
      if (firstItem?.reciter && firstItem?.surah) {
        const rewayatId =
          firstItem.track.rewayatId || firstItem.reciter.rewayat[0]?.id;
        addRecentTrack(firstItem.reciter, firstItem.surah, 0, 0, rewayatId);
      }
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  }, [lovedData, pause, playbackState, addRecentTrack, updateQueue]);

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

      const allTracks = shuffledItems.map(item => {
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
      });

      await updateQueue(allTracks, 0);

      const firstItem = shuffledItems[0];
      if (firstItem.reciter && firstItem.surah) {
        const rewayatId =
          firstItem.track.rewayatId || firstItem.reciter.rewayat[0]?.id;
        addRecentTrack(firstItem.reciter, firstItem.surah, 0, 0, rewayatId);
      }
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [lovedData, addRecentTrack, updateQueue, shuffleEnabled, toggleShuffle]);

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

  // Handle show options for a track
  const handleShowOptions = useCallback(
    (track: LovedTrack, reciter: Reciter, surah: Surah) => {
      SheetManager.show('surah-options', {
        payload: {
          surah,
          reciterId: track.reciterId,
          rewayatId: track.rewayatId,
          onAddToQueue: async (s: Surah) => {
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

  // Calculate download state for all loved tracks using custom hook
  const downloadState = useCollectionDownloadState(lovedData);

  const ListHeaderComponent = useCallback(() => {
    return (
      <LovedHeader
        title="Loved Surahs"
        subtitle={`${lovedData.length} ${
          lovedData.length === 1 ? 'surah' : 'surahs'
        }`}
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        onDownloadPress={handleBulkDownload}
        theme={theme}
        allDownloaded={downloadState.allDownloaded}
        hasNoTracks={downloadState.hasNoTracks}
      />
    );
  }, [
    lovedData.length,
    handlePlayAll,
    handleShuffle,
    handleBulkDownload,
    theme,
    downloadState.allDownloaded,
    downloadState.hasNoTracks,
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
          onPress={() => handleSurahPress(track, reciter, surah)}
          onPlayPress={() => handleSurahPress(track, reciter, surah)}
          onOptionsPress={() => handleShowOptions(track, reciter, surah)}
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
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="default" />
      <RNAnimated.FlatList
        data={lovedData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No loved surahs yet</Text>
        }
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <CollectionStickyHeader title="Loved Surahs" scrollY={scrollY} />
    </View>
  );
};

export default LovedScreen;
