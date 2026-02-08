import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ListRenderItem,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Pressable} from 'react-native';
import {TrackItem} from '@/components/TrackItem';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {
  useDownloadActions,
  useDownloads,
} from '@/services/player/store/downloadSelectors';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {createDownloadedTrack} from '@/utils/track';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import {DownloadCollectionActionButtons} from '@/components/DownloadCollectionActionButtons';
import {CollectionCard} from '@/components/CollectionCard';
import {DownloadIcon} from '@/components/Icons';
import {SheetManager} from 'react-native-actions-sheet';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';

interface DownloadDataItem {
  download: DownloadedSurah;
  reciter: Reciter | null;
  surah: Surah | null;
}

export default function DownloadsScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      width: '100%',
      overflow: 'hidden',
    },
    contentArea: {
      width: '100%',
      alignItems: 'center',
      paddingTop: insets.top + moderateScale(40),
      paddingBottom: moderateScale(20),
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    backButton: {
      position: 'absolute',
      top: insets.top + moderateScale(10),
      left: moderateScale(15),
      zIndex: 10,
      padding: moderateScale(8),
    },
    contentContainer: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(10),
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
  });

  const router = useRouter();
  const downloads = useDownloads();
  const {removeDownload} = useDownloadActions();
  const {updateQueue, addToQueue, play, pause} = usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);

  // Scroll tracking for sticky header
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // State to store reciter and surah data for each download
  const [downloadData, setDownloadData] = useState<DownloadDataItem[]>([]);

  // Load reciter and surah data for all downloads
  useEffect(() => {
    const loadDownloadData = async () => {
      const data = await Promise.all(
        downloads.map(async download => {
          const [reciter, surah] = await Promise.all([
            getReciterById(download.reciterId),
            getSurahById(parseInt(download.surahId, 10)),
          ]);
          return {
            download,
            reciter: reciter || null,
            surah: surah || null,
          };
        }),
      );
      setDownloadData(data);
    };

    if (downloads.length > 0) {
      loadDownloadData();
    } else {
      setDownloadData([]);
    }
  }, [downloads]);

  // Handle surah press to play downloaded file
  const handleSurahPress = useCallback(
    async (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
      try {
        // Create track using local file path
        const track = createDownloadedTrack(
          reciter,
          surah,
          download.filePath,
          download.rewayatId,
        );

        // Update queue with the downloaded track and start playing
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

  const handleShowOptions = useCallback(
    (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
      const track = createDownloadedTrack(
        reciter,
        surah,
        download.filePath,
        download.rewayatId,
      );

      SheetManager.show('download-options', {
        payload: {
          download,
          surah,
          reciterId: download.reciterId,
          rewayatId: download.rewayatId,
          onPlay: () => handleSurahPress(download, reciter, surah),
          onAddToQueue: () => {
            addToQueue([track]);
          },
          onRemoveDownload: () => handleRemoveDownload(download),
        },
      });
    },
    [handleSurahPress, addToQueue, handleRemoveDownload],
  );

  // play all downloads
  const handlePlayAll = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      // If currently playing, pause
      if (playbackState === 'playing') {
        await pause();
        return;
      }

      // If paused or stopped, play all downloads
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
  }, [downloadData, updateQueue, play, pause, playbackState]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.contentArea}>
          {/* Back Button */}
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Pressable>
          <CollectionCard
            icon={
              <DownloadIcon
                color={theme.colors.text}
                size={moderateScale(80)}
                filled={true}
              />
            }
            title="Downloads"
            subtitle={`${downloadData.length} surahs downloaded`}
          />
        </View>
        <View style={styles.contentContainer}>
          <DownloadCollectionActionButtons
            onPlayPress={handlePlayAll}
            disabled={downloadData.length === 0}
          />
        </View>
      </View>
    );
  }, [styles, theme.colors.text, router, downloadData.length, handlePlayAll]);

  const renderItem: ListRenderItem<DownloadDataItem> = ({item}) => {
    const {download, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    return (
      <TrackItem
        reciterId={download.reciterId}
        surahId={download.surahId}
        rewayatId={download.rewayatId}
        onPress={() => handleSurahPress(download, reciter, surah)}
        onPlayPress={() => handleSurahPress(download, reciter, surah)}
        onOptionsPress={() => handleShowOptions(download, reciter, surah)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <RNAnimated.FlatList
        data={downloadData}
        renderItem={renderItem}
        keyExtractor={item =>
          `${item.download.reciterId}-${item.download.surahId}`
        }
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No downloads yet</Text>
        }
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <CollectionStickyHeader title="Downloads" scrollY={scrollY} />
    </View>
  );
}
