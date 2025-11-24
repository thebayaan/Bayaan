import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {TrackItem} from '@/components/TrackItem';
import {getReciterById, getSurahById} from '@/services/dataService';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {FlatList, ListRenderItem} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useLoved} from '@/hooks/useLoved';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {shuffleArray} from '@/utils/arrayUtils';
import {State as TrackPlayerState} from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {LovedHeader} from '@/components/playlist-detail/LovedHeader';
import {useDownload} from '@/services/player/store/downloadStore';
import {downloadSurah} from '@/services/downloadService';
import {useCollectionDownloadState} from '@/hooks/useCollectionDownloadState';

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
  const {pause, playback} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const playerStore = usePlayerStore();
  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
    setDownloading,
    clearDownloading,
    addDownload,
    setDownloadProgress,
  } = useDownload();

  const [lovedData, setLovedData] = useState<LovedTrackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloadingBulk, setIsDownloadingBulk] = useState(false);

  // Track current operation to prevent race conditions
  const currentOperationRef = useRef<string | null>(null);

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
    rightAction: {
      flex: 1,
      backgroundColor: '#ff4444',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingRight: moderateScale(20),
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      paddingVertical: moderateScale(10),
    },
    deleteText: {
      color: 'white',
      fontSize: moderateScale(14),
      fontWeight: '600',
      marginLeft: moderateScale(8),
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
        // Safety check: ensure we have data loaded
        if (lovedData.length === 0) {
          console.warn('No loved tracks data loaded yet');
          return;
        }

        // Find the index of the selected track in lovedData
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

        // Generate unique operation ID to prevent race conditions
        const operationId = `${Date.now()}-${reciter.id}-${surah.id}`;
        currentOperationRef.current = operationId;

        // OPTIMIZATION: Ensure download store is "warm" (hydrated) before checking
        useDownloadStore.getState();

        // Get artwork once (same for all tracks)
        const artwork = getReciterArtwork(reciter);

        // Create ONLY first track (instant!)
        const rewayatId = track.rewayatId || reciter.rewayat[0]?.id;
        const firstTrack = {
          id: `${reciter.id}:${surah.id}`,
          url: generateSmartAudioUrl(reciter, surah.id.toString(), rewayatId),
          title: surah.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: surah.id.toString(),
          reciterName: reciter.name,
          rewayatId,
        };

        // Add first track and play IMMEDIATELY
        const resetPromise = TrackPlayer.reset();
        currentOperationRef.current = operationId;

        await resetPromise;
        await TrackPlayer.add(firstTrack);
        await TrackPlayer.play();

        // CRITICAL: Update store IMMEDIATELY and synchronously
        if (currentOperationRef.current === operationId) {
          const store = usePlayerStore.getState();
          store.updateQueueState({
            tracks: [firstTrack],
            currentIndex: 0,
            total: 1,
            loading: false,
            endReached: false,
          });
        }

        // Get remaining items (reordered so selected is first)
        const remainingItems = [
          ...lovedData.slice(selectedIndex + 1),
          ...lovedData.slice(0, selectedIndex),
        ];

        // Create remaining tracks in parallel (background - doesn't block playback!)
        if (remainingItems.length > 0) {
          Promise.all(
            remainingItems.map(async item => {
              if (!item.reciter || !item.surah) return null;
              const itemRewayatId =
                item.track.rewayatId || item.reciter.rewayat[0]?.id;
              const url = generateSmartAudioUrl(
                item.reciter,
                item.surah.id.toString(),
                itemRewayatId,
              );
              return {
                id: `${item.reciter.id}:${item.surah.id}`,
                url,
                title: item.surah.name,
                artist: item.reciter.name,
                reciterId: item.reciter.id,
                artwork: getReciterArtwork(item.reciter),
                surahId: item.surah.id.toString(),
                reciterName: item.reciter.name,
                rewayatId: itemRewayatId,
              };
            }),
          )
            .then(remainingTracks => {
              const validRemainingTracks = remainingTracks.filter(
                (t): t is NonNullable<typeof t> => t !== null,
              );

              // Check if operation is still valid
              if (currentOperationRef.current !== operationId) {
                console.log(
                  '[LovedScreen] Operation cancelled, skipping track addition',
                );
                return;
              }

              // Add remaining tracks to TrackPlayer (non-blocking)
              TrackPlayer.add(validRemainingTracks)
                .then(() => {
                  // Double-check operation is still valid before updating store
                  if (currentOperationRef.current !== operationId) {
                    console.log(
                      '[LovedScreen] Operation cancelled, skipping store update',
                    );
                    return;
                  }

                  // Update store with complete queue (non-blocking)
                  const completeQueue = [firstTrack, ...validRemainingTracks];
                  const store = usePlayerStore.getState();
                  store.updateQueueState({
                    tracks: completeQueue,
                    total: completeQueue.length,
                  });
                })
                .catch(error => {
                  console.error('Error adding tracks to TrackPlayer:', error);
                });
            })
            .catch(error => {
              console.error('Error creating remaining tracks:', error);
            });
        }

        // Add to recently played AFTER playback starts (non-blocking)
        addRecentTrack(reciter, surah, 0, 0, rewayatId);
        queueContext.setCurrentReciter(reciter);
      } catch (error) {
        console.error('Error playing track:', error);
        currentOperationRef.current = null;
      }
    },
    [lovedData, queueContext, addRecentTrack],
  );

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    if (lovedData.length === 0) return;

    try {
      // If currently playing, pause
      if (playback.state === TrackPlayerState.Playing) {
        await pause();
        return;
      }

      const firstItem = lovedData.find(item => item.reciter && item.surah);
      if (!firstItem?.reciter || !firstItem?.surah) return;

      // Generate unique operation ID
      const operationId = `${Date.now()}-${firstItem.reciter.id}-play-all`;
      currentOperationRef.current = operationId;

      // Get artwork once
      const artwork = getReciterArtwork(firstItem.reciter);

      // OPTIMIZATION: Ensure download store is "warm"
      useDownloadStore.getState();

      // Create ONLY first track (instant!)
      const rewayatId =
        firstItem.track.rewayatId || firstItem.reciter.rewayat[0]?.id;
      const firstTrack = {
        id: `${firstItem.reciter.id}:${firstItem.surah.id}`,
        url: generateSmartAudioUrl(
          firstItem.reciter,
          firstItem.surah.id.toString(),
          rewayatId,
        ),
        title: firstItem.surah.name,
        artist: firstItem.reciter.name,
        reciterId: firstItem.reciter.id,
        artwork,
        surahId: firstItem.surah.id.toString(),
        reciterName: firstItem.reciter.name,
        rewayatId,
      };

      // Add first track and play IMMEDIATELY
      try {
        await TrackPlayer.reset();
        currentOperationRef.current = operationId;
        await TrackPlayer.add(firstTrack);
        await TrackPlayer.play();

        // CRITICAL: Update store IMMEDIATELY and synchronously
        if (currentOperationRef.current === operationId) {
          const store = usePlayerStore.getState();
          store.updateQueueState({
            tracks: [firstTrack],
            currentIndex: 0,
            total: 1,
            loading: false,
            endReached: false,
          });
        }
      } catch (error) {
        console.error('Error starting playback:', error);
        currentOperationRef.current = null;
        throw error;
      }

      // Create remaining tracks in parallel (background)
      const remainingItems = lovedData.slice(1);
      if (remainingItems.length > 0) {
        Promise.all(
          remainingItems.map(async item => {
            if (!item.reciter || !item.surah) return null;
            const itemRewayatId =
              item.track.rewayatId || item.reciter.rewayat[0]?.id;
            const url = generateSmartAudioUrl(
              item.reciter,
              item.surah.id.toString(),
              itemRewayatId,
            );
            return {
              id: `${item.reciter.id}:${item.surah.id}`,
              url,
              title: item.surah.name,
              artist: item.reciter.name,
              reciterId: item.reciter.id,
              artwork: getReciterArtwork(item.reciter),
              surahId: item.surah.id.toString(),
              reciterName: item.reciter.name,
              rewayatId: itemRewayatId,
            };
          }),
        )
          .then(remainingTracks => {
            const validRemainingTracks = remainingTracks.filter(
              (t): t is NonNullable<typeof t> => t !== null,
            );

            if (currentOperationRef.current !== operationId) {
              console.log(
                '[LovedScreen] Operation cancelled, skipping track addition',
              );
              return;
            }

            TrackPlayer.add(validRemainingTracks)
              .then(() => {
                if (currentOperationRef.current !== operationId) {
                  console.log(
                    '[LovedScreen] Operation cancelled, skipping store update',
                  );
                  return;
                }

                const completeQueue = [firstTrack, ...validRemainingTracks];
                const store = usePlayerStore.getState();
                store.updateQueueState({
                  tracks: completeQueue,
                  total: completeQueue.length,
                });
              })
              .catch(error => {
                console.error('Error adding tracks to TrackPlayer:', error);
              });
          })
          .catch(error => {
            console.error('Error creating remaining tracks:', error);
          });
      }

      // Add to recently played AFTER playback starts (non-blocking)
      addRecentTrack(firstItem.reciter, firstItem.surah, 0, 0, rewayatId);
      queueContext.setCurrentReciter(firstItem.reciter);
    } catch (error) {
      console.error('Error playing all tracks:', error);
      currentOperationRef.current = null;
    }
  }, [lovedData, pause, playback.state, queueContext, addRecentTrack]);

  // Shuffle all tracks
  const handleShuffle = useCallback(async () => {
    if (lovedData.length === 0) return;

    try {
      // Shuffle items first
      const shuffledItems = shuffleArray([...lovedData]).filter(
        item => item.reciter && item.surah,
      );

      if (shuffledItems.length === 0) return;

      const firstItem = shuffledItems[0];
      if (!firstItem.reciter || !firstItem.surah) return;

      // Generate unique operation ID
      const operationId = `${Date.now()}-${firstItem.reciter.id}-shuffle-all`;
      currentOperationRef.current = operationId;

      // Get artwork once
      const artwork = getReciterArtwork(firstItem.reciter);

      // OPTIMIZATION: Ensure download store is "warm"
      useDownloadStore.getState();

      // Create ONLY first track (instant!)
      const rewayatId =
        firstItem.track.rewayatId || firstItem.reciter.rewayat[0]?.id;
      const firstTrack = {
        id: `${firstItem.reciter.id}:${firstItem.surah.id}`,
        url: generateSmartAudioUrl(
          firstItem.reciter,
          firstItem.surah.id.toString(),
          rewayatId,
        ),
        title: firstItem.surah.name,
        artist: firstItem.reciter.name,
        reciterId: firstItem.reciter.id,
        artwork,
        surahId: firstItem.surah.id.toString(),
        reciterName: firstItem.reciter.name,
        rewayatId,
      };

      // Enable shuffle mode in player settings
      if (!playerStore.settings.shuffle) {
        playerStore.toggleShuffle();
      }

      // Add first track and play IMMEDIATELY
      try {
        await TrackPlayer.reset();
        currentOperationRef.current = operationId;
        await TrackPlayer.add(firstTrack);
        await TrackPlayer.play();

        // CRITICAL: Update store IMMEDIATELY and synchronously
        if (currentOperationRef.current === operationId) {
          const store = usePlayerStore.getState();
          store.updateQueueState({
            tracks: [firstTrack],
            currentIndex: 0,
            total: 1,
            loading: false,
            endReached: false,
          });
        }
      } catch (error) {
        console.error('Error starting playback:', error);
        currentOperationRef.current = null;
        throw error;
      }

      // Create remaining tracks in parallel (background)
      const remainingItems = shuffledItems.slice(1);
      if (remainingItems.length > 0) {
        Promise.all(
          remainingItems.map(async item => {
            if (!item.reciter || !item.surah) return null;
            const itemRewayatId =
              item.track.rewayatId || item.reciter.rewayat[0]?.id;
            const url = generateSmartAudioUrl(
              item.reciter,
              item.surah.id.toString(),
              itemRewayatId,
            );
            return {
              id: `${item.reciter.id}:${item.surah.id}`,
              url,
              title: item.surah.name,
              artist: item.reciter.name,
              reciterId: item.reciter.id,
              artwork: getReciterArtwork(item.reciter),
              surahId: item.surah.id.toString(),
              reciterName: item.reciter.name,
              rewayatId: itemRewayatId,
            };
          }),
        )
          .then(remainingTracks => {
            const validRemainingTracks = remainingTracks.filter(
              (t): t is NonNullable<typeof t> => t !== null,
            );

            if (currentOperationRef.current !== operationId) {
              console.log(
                '[LovedScreen] Operation cancelled, skipping track addition',
              );
              return;
            }

            TrackPlayer.add(validRemainingTracks)
              .then(() => {
                if (currentOperationRef.current !== operationId) {
                  console.log(
                    '[LovedScreen] Operation cancelled, skipping store update',
                  );
                  return;
                }

                const completeQueue = [firstTrack, ...validRemainingTracks];
                const store = usePlayerStore.getState();
                store.updateQueueState({
                  tracks: completeQueue,
                  total: completeQueue.length,
                });
              })
              .catch(error => {
                console.error('Error adding tracks to TrackPlayer:', error);
              });
          })
          .catch(error => {
            console.error('Error creating remaining tracks:', error);
          });
      }

      // Add to recently played AFTER playback starts (non-blocking)
      addRecentTrack(firstItem.reciter, firstItem.surah, 0, 0, rewayatId);
      queueContext.setCurrentReciter(firstItem.reciter);
    } catch (error) {
      console.error('Error shuffling tracks:', error);
      currentOperationRef.current = null;
    }
  }, [lovedData, queueContext, addRecentTrack, playerStore]);

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

  // Handle remove from loved
  const handleRemoveFromLoved = useCallback(
    (track: LovedTrack) => {
      toggleLoved(track.reciterId, track.surahId, track.rewayatId || '');
    },
    [toggleLoved],
  );

  // Calculate download state for all loved tracks using custom hook
  const downloadState = useCollectionDownloadState(lovedData);

  const ListHeaderComponent = useCallback(() => {
    return (
      <LovedHeader
        title="Loved Surahs"
        subtitle={`${lovedData.length} ${lovedData.length === 1 ? 'surah' : 'surahs'}`}
        backgroundColor="#FF6B6B"
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

    const renderRightActions = () => (
      <View style={styles.rightAction}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleRemoveFromLoved(track)}>
          <Icon
            name="trash-2"
            type="feather"
            size={moderateScale(20)}
            color="white"
          />
          <Text style={styles.deleteText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <View style={styles.listItem}>
          <TrackItem
            reciterId={track.reciterId}
            surahId={track.surahId}
            rewayatId={track.rewayatId}
            onPress={() => handleSurahPress(track, reciter, surah)}
            onPlayPress={() => handleSurahPress(track, reciter, surah)}
          />
        </View>
      </Swipeable>
    );
  };

  const getItemKey = (item: LovedTrackData) =>
    `${item.track.reciterId}:${item.track.surahId}:${item.track.rewayatId || ''}`;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={lovedData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No loved surahs yet</Text>
        }
        bounces={false}
      />
    </View>
  );
};

export default LovedScreen;
