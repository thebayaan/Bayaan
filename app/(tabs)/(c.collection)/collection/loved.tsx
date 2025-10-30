import React, {useRef, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  FlatList,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrackItem} from '@/components/TrackItem';
import {getReciterById, getSurahById} from '@/services/dataService';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {LinearGradient} from 'expo-linear-gradient';
import {HeartIcon} from '@/components/Icons';
import {StatusBar} from 'expo-status-bar';
import {CollectionCard} from '@/components/CollectionCard';
import SearchBar from '@/components/SearchBar';
import {shuffleArray} from '@/utils/arrayUtils';
import {CollectionActionButtons} from '@/components/CollectionActionButtons';
import {Reciter} from '@/data/reciterData';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {useLoved} from '@/hooks/useLoved';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useDownload} from '@/services/player/store/downloadStore';
import {downloadSurah} from '@/services/downloadService';
import {showToast} from '@/utils/toastUtils';

interface LovedTrack {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
}

const LovedScreen = () => {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      width: '100%',
      overflow: 'hidden',
    },
    gradientContainer: {
      width: '100%',
      alignItems: 'center',
      paddingBottom: moderateScale(20),
      overflow: 'hidden',
      backgroundColor: 'purple',
    },
    contentContainer: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(10),
    },
    listContentContainer: {
      flexGrow: 1,
      paddingBottom: moderateScale(65),
    },
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: moderateScale(100),
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    stickyHeaderTitle: {
      fontSize: moderateScale(24),
      fontWeight: 'bold',
      color: 'white',
    },
    backButton: {
      position: 'absolute',
      zIndex: 10,
    },
    searchButton: {
      position: 'absolute',
      zIndex: 10,
    },
    searchBarContainer: {
      marginTop: moderateScale(16),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: moderateScale(32),
    },
  });
  const insets = useSafeAreaInsets();
  const {lovedTracks} = useLoved();
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
  } = useDownload();

  const scrollY = useRef(new Animated.Value(0)).current;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStatusBarDark, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reciters, setReciters] = useState<Record<string, Reciter>>({});
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const headerOpacity = scrollY.interpolate({
    inputRange: [150, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const listener = headerOpacity.addListener(({value}) => {
      if (value === 1 && !isHeaderVisible) {
        setIsHeaderVisible(true);
      } else if (value < 1 && isHeaderVisible) {
        setIsHeaderVisible(false);
      }
    });

    return () => headerOpacity.removeListener(listener);
  }, [headerOpacity, isHeaderVisible]);

  const handleTrackPress = useCallback(
    async (trackId: string) => {
      try {
        const [reciterId, surahId, rewayatId] = trackId.split(':');
        const reciter = await getReciterById(reciterId);
        const surah = await getSurahById(parseInt(surahId, 10));

        if (!reciter || !surah) return;

        // Get all loved tracks for the queue
        const trackPromises = lovedTracks.map(async item => {
          const itemReciter = await getReciterById(item.reciterId);
          const itemSurah = await getSurahById(parseInt(item.surahId, 10));
          if (!itemReciter || !itemSurah) return null;

          // Use the stored rewayatId if available, otherwise fallback to the first rewayat
          const itemRewayatId = item.rewayatId || itemReciter.rewayat[0]?.id;

          const tracks = await createTracksForReciter(
            itemReciter,
            [itemSurah],
            itemRewayatId,
          );
          return tracks[0] || null;
        });

        // Filter out any null tracks
        const validTracks = (await Promise.all(trackPromises)).filter(
          (track): track is NonNullable<typeof track> => track !== null,
        );

        if (validTracks.length === 0) return;

        // Find the index of the selected track
        const selectedIndex = validTracks.findIndex(
          track =>
            track.reciterId === reciterId &&
            track.surahId === surahId.toString() &&
            (rewayatId ? track.rewayatId === rewayatId : true),
        );

        if (selectedIndex === -1) return;

        // Reorder tracks to start from the selected track
        const reorderedTracks = [
          ...validTracks.slice(selectedIndex),
          ...validTracks.slice(0, selectedIndex),
        ];

        // Update queue and start playing
        await updateQueue(reorderedTracks, 0);
        await play();

        // Add to recently played list with the correct rewayatId
        await addRecentTrack(
          reciter,
          surah,
          0,
          0,
          rewayatId || reciter.rewayat[0]?.id,
        );

        // Set current reciter for batch loading
        queueContext.setCurrentReciter(reciter);
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [lovedTracks, updateQueue, play, queueContext, addRecentTrack],
  );

  const ReciterTrackItem = useCallback(
    ({item}: {item: LovedTrack}) => {
      const reciter = reciters[item.reciterId];

      if (!reciter) {
        return <LoadingIndicator />;
      }

      const handlePress = () => {
        const trackId = `${item.reciterId}:${item.surahId}:${item.rewayatId || ''}`;
        handleTrackPress(trackId);
      };

      return (
        <TrackItem
          reciterId={item.reciterId}
          surahId={item.surahId}
          rewayatId={item.rewayatId}
          onPress={handlePress}
        />
      );
    },
    [reciters, handleTrackPress],
  );

  useEffect(() => {
    const loadReciters = async () => {
      const reciterMap: Record<string, Reciter> = {};
      for (const track of lovedTracks) {
        if (!reciterMap[track.reciterId]) {
          const reciter = await getReciterById(track.reciterId);
          if (reciter) {
            reciterMap[track.reciterId] = reciter;
          }
        }
      }
      setReciters(reciterMap);
    };
    loadReciters();
  }, [lovedTracks]);

  const data = lovedTracks.map(track => {
    const reciter = reciters[track.reciterId];
    const surah = getSurahById(parseInt(track.surahId, 10));
    return {
      reciterId: track.reciterId,
      surahId: track.surahId,
      rewayatId: track.rewayatId,
      reciterName: reciter?.name,
      surahName: surah?.name,
    };
  });

  const filteredData = data.filter(
    item =>
      item.reciterId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.surahId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reciterName &&
        item.reciterName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.surahName &&
        item.surahName.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const getItemKey = (item: {
    reciterId: string;
    surahId: string;
    rewayatId?: string;
  }) => `${item.reciterId}:${item.surahId}:${item.rewayatId || ''}`;

  const handlePlayAll = useCallback(async () => {
    if (filteredData.length === 0) return;

    try {
      // Create tracks for all loved tracks
      const trackPromises = filteredData.map(async item => {
        const reciter = await getReciterById(item.reciterId);
        const surah = await getSurahById(parseInt(item.surahId, 10));
        if (!reciter || !surah) return null;

        // Find the loved track to get its rewayatId
        const lovedTrack = lovedTracks.find(
          track =>
            track.reciterId === item.reciterId &&
            track.surahId === item.surahId,
        );
        const rewayatId = lovedTrack?.rewayatId || reciter.rewayat[0]?.id;

        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          rewayatId,
        );
        return tracks[0] || null;
      });

      // Filter out any null tracks
      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length === 0) return;

      // Update queue and start playing
      await updateQueue(validTracks, 0);
      await play();

      // Add first track to recently played
      const firstTrack = validTracks[0];
      if (!firstTrack?.reciterId || !firstTrack?.surahId) return;

      const firstReciter = await getReciterById(firstTrack.reciterId);
      const firstSurah = await getSurahById(parseInt(firstTrack.surahId, 10));

      if (firstReciter && firstSurah) {
        // Use the rewayatId from the track
        await addRecentTrack(
          firstReciter,
          firstSurah,
          0,
          0,
          firstTrack.rewayatId || firstReciter.rewayat[0]?.id,
        );
        queueContext.setCurrentReciter(firstReciter);
      }
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  }, [
    filteredData,
    lovedTracks,
    updateQueue,
    play,
    queueContext,
    addRecentTrack,
  ]);

  const handleShuffleAll = useCallback(async () => {
    if (filteredData.length === 0) return;

    try {
      // Create tracks for all loved tracks
      const trackPromises = filteredData.map(async item => {
        const reciter = await getReciterById(item.reciterId);
        const surah = await getSurahById(parseInt(item.surahId, 10));
        if (!reciter || !surah) return null;

        // Find the loved track to get its rewayatId
        const lovedTrack = lovedTracks.find(
          track =>
            track.reciterId === item.reciterId &&
            track.surahId === item.surahId,
        );
        const rewayatId = lovedTrack?.rewayatId || reciter.rewayat[0]?.id;

        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          rewayatId,
        );
        return tracks[0] || null;
      });

      // Filter out any null tracks
      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length === 0) return;

      // Shuffle the tracks
      const shuffledTracks = shuffleArray([...validTracks]);

      // Update queue and start playing
      await updateQueue(shuffledTracks, 0);
      await play();

      // Add first track to recently played
      const firstTrack = shuffledTracks[0];
      if (!firstTrack?.reciterId || !firstTrack?.surahId) return;

      const firstReciter = await getReciterById(firstTrack.reciterId);
      const firstSurah = await getSurahById(parseInt(firstTrack.surahId, 10));

      if (firstReciter && firstSurah) {
        // Use the rewayatId from the track
        await addRecentTrack(
          firstReciter,
          firstSurah,
          0,
          0,
          firstTrack.rewayatId || firstReciter.rewayat[0]?.id,
        );
        queueContext.setCurrentReciter(firstReciter);
      }
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [
    filteredData,
    lovedTracks,
    updateQueue,
    play,
    queueContext,
    addRecentTrack,
  ]);

  const handleBulkDownload = useCallback(async () => {
    if (filteredData.length === 0 || isBulkDownloading) return;
    
    setIsBulkDownloading(true);
    
    try {
      // Get all loved tracks and filter out already downloaded ones
      const surahsToDownload = filteredData.filter(item => {
        // Find the loved track to get its rewayatId
        const lovedTrack = lovedTracks.find(
          track =>
            track.reciterId === item.reciterId &&
            track.surahId === item.surahId,
        );
        const rewayatId = lovedTrack?.rewayatId;
        
        // Check if already downloaded
        if (rewayatId) {
          return !isDownloadedWithRewayat(
            item.reciterId,
            item.surahId,
            rewayatId,
          );
        } else {
          return !isDownloaded(item.reciterId, item.surahId);
        }
      });

      const alreadyDownloaded = filteredData.length - surahsToDownload.length;

      if (surahsToDownload.length === 0) {
        showToast(
          alreadyDownloaded > 0
            ? 'All loved surahs are already downloaded'
            : 'No surahs to download',
        );
        setIsBulkDownloading(false);
        return;
      }

      showToast(`Starting download of ${surahsToDownload.length} loved surah${surahsToDownload.length > 1 ? 's' : ''}...`);

      let successCount = 0;
      let failCount = 0;

      // Download each surah
      for (let i = 0; i < surahsToDownload.length; i++) {
        const item = surahsToDownload[i];
        // Find the loved track to get its rewayatId
        const lovedTrack = lovedTracks.find(
          track =>
            track.reciterId === item.reciterId &&
            track.surahId === item.surahId,
        );
        const rewayatId = lovedTrack?.rewayatId;

        const downloadId = `${item.reciterId}-${item.surahId}`;
        
        // Skip if already downloading
        if (isDownloading(item.reciterId, item.surahId)) {
          continue;
        }

        try {
          setDownloading(downloadId);
          
          // Show progress for downloads > 3
          if (surahsToDownload.length > 3) {
            showToast(`Downloading ${i + 1}/${surahsToDownload.length}: ${item.surahName || item.surahId}`);
          }
          
          const downloadResult = await downloadSurah(
            parseInt(item.surahId, 10),
            item.reciterId,
            rewayatId,
          );

          addDownload({
            reciterId: item.reciterId,
            surahId: item.surahId,
            rewayatId: rewayatId || '',
            filePath: downloadResult.filePath,
            fileSize: downloadResult.fileSize,
            downloadDate: Date.now(),
            status: 'completed',
          });

          clearDownloading(downloadId);
          successCount++;
        } catch (error) {
          console.error(`Failed to download surah ${item.surahId}:`, error);
          clearDownloading(downloadId);
          failCount++;
        }
      }

      // Show completion message
      if (failCount === 0) {
        showToast(
          `Successfully downloaded ${successCount} loved surah${successCount > 1 ? 's' : ''}!`,
        );
      } else {
        showToast(
          `Downloaded ${successCount} surah${successCount > 1 ? 's' : ''}, ${failCount} failed`,
        );
      }
    } catch (error) {
      console.error('Error in bulk download:', error);
      showToast('An error occurred during bulk download');
    } finally {
      setIsBulkDownloading(false);
    }
  }, [
    filteredData,
    lovedTracks,
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    isBulkDownloading,
  ]);

  const handleScroll = Animated.event(
    [{nativeEvent: {contentOffset: {y: scrollY}}}],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setIsStatusBarDark(offsetY > 100);
      },
    },
  );

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['purple', theme.colors.background] as [string, string]}
          style={[
            styles.gradientContainer,
            {paddingTop: insets.top + moderateScale(20)},
          ]}>
          <CollectionCard
            icon={
              <HeartIcon
                color={theme.colors.text}
                size={moderateScale(80)}
                filled={true}
              />
            }
            title="Loved Surahs"
            subtitle={`${lovedTracks.length} surahs`}
          />
        </LinearGradient>
        <View style={styles.contentContainer}>
          <CollectionActionButtons
            onShufflePress={handleShuffleAll}
            onPlayPress={handlePlayAll}
            onDownloadPress={handleBulkDownload}
            showDownloadIcon={true}
            disabled={isBulkDownloading}
          />
          {showSearch && (
            <View style={styles.searchBarContainer}>
              <SearchBar
                placeholder="Search loved surahs"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}
        </View>
      </View>
    );
  }, [
    styles.headerContainer,
    styles.gradientContainer,
    styles.contentContainer,
    styles.searchBarContainer,
    theme.colors.background,
    theme.colors.text,
    insets.top,
    lovedTracks.length,
    handleShuffleAll,
    handlePlayAll,
    handleBulkDownload,
    isBulkDownloading,
    showSearch,
    searchQuery,
  ]);

  return (
    <View style={styles.container}>
      <StatusBar style={isStatusBarDark ? 'dark' : 'light'} />
      <FlatList
        data={filteredData}
        bounces={false}
        showsVerticalScrollIndicator={false}
        renderItem={ReciterTrackItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No loved surahs yet</Text>
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerOpacity,
            paddingTop: insets.top,
          },
        ]}>
        <LinearGradient
          colors={['purple', theme.colors.background] as [string, string]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.stickyHeaderTitle}>Loved Surahs</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.backButton,
          {
            top: insets.top + moderateScale(10),
            left: moderateScale(15),
          },
        ]}>
        <TouchableOpacity activeOpacity={0.99} onPress={() => router.back()}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color="white"
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: headerOpacity,
            }}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View
        style={[
          styles.searchButton,
          {
            top: insets.top + moderateScale(10),
            right: moderateScale(15),
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={() => setShowSearch(!showSearch)}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="search"
              type="feather"
              size={moderateScale(20)}
              color="white"
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: headerOpacity,
            }}>
            <Icon
              name="search"
              type="feather"
              size={moderateScale(25)}
              color={theme.colors.text}
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default LovedScreen;
