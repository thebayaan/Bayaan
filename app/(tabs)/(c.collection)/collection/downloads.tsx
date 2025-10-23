import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrackItem} from '@/components/TrackItem';
import {
  useDownload,
  DownloadedSurah,
} from '@/services/player/store/downloadStore';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createDownloadedTrack} from '@/utils/track';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import {Swipeable} from 'react-native-gesture-handler';
import {Icon} from '@rneui/themed';
import {useRouter} from 'expo-router';
import {State as TrackPlayerState} from 'react-native-track-player';
import {DownloadCollectionActionButtons} from '@/components/DownloadCollectionActionButtons';
import {CollectionCard} from '@/components/CollectionCard';
import {DownloadIcon} from '@/components/Icons';

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
    gradientContainer: {
      width: '100%',
      alignItems: 'center',
      paddingBottom: moderateScale(20),
      overflow: 'hidden',
      backgroundColor: '#10B981',
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
    dragHandle: {
      position: 'absolute',
      left: moderateScale(10),
      top: '50%',
      transform: [{translateY: moderateScale(-10)}],
      zIndex: 1,
    },
    draggableItem: {
      marginVertical: moderateScale(2),
    },
    draggingItem: {
      opacity: 0.8,
      transform: [{scale: 1.02}],
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
    backButton: {
      position: 'absolute',
      zIndex: 10,
    },
  });
  const {downloads, setDownloads, removeDownload} = useDownload();
  const {updateQueue, play, pause, playback} = useUnifiedPlayer();
  const router = useRouter();
  // State to store reciter and surah data for each download
  const [downloadData, setDownloadData] = useState<
    Array<{
      download: DownloadedSurah;
      reciter: Reciter | null;
      surah: Surah | null;
    }>
  >([]);

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

  const handleReorder = useCallback(
    (
      data: Array<{
        download: DownloadedSurah;
        reciter: Reciter | null;
        surah: Surah | null;
      }>,
    ) => {
      // Update local state
      setDownloadData(data);

      // Update store with new order
      const newOrder = data.map(item => item.download);
      setDownloads(newOrder);
    },
    [setDownloads],
  );

  const handleRemoveDownload = useCallback(
    (download: DownloadedSurah) => {
      removeDownload(download.reciterId, download.surahId);
    },
    [removeDownload],
  );

  // play all downloads
  const handlePlayAll = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      // If currently playing, pause
      if (playback.state === TrackPlayerState.Playing) {
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
  }, [downloadData, updateQueue, play, pause, playback.state]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#10B981', theme.colors.background] as [string, string]}
          style={[
            styles.gradientContainer,
            {paddingTop: insets.top + moderateScale(20)},
          ]}>
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
        </LinearGradient>
        <View style={styles.contentContainer}>
          <DownloadCollectionActionButtons
            onPlayPress={handlePlayAll}
            disabled={downloadData.length === 0}
          />
        </View>
      </View>
    );
  }, [
    styles.headerContainer,
    styles.gradientContainer,
    styles.contentContainer,
    theme.colors.background,
    theme.colors.text,
    insets.top,
    downloadData.length,
    handlePlayAll,
  ]);

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<{
    download: DownloadedSurah;
    reciter: Reciter | null;
    surah: Surah | null;
  }>) => {
    const {download, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    const renderRightActions = () => (
      <View style={styles.rightAction}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleRemoveDownload(download)}>
          <Icon
            name="trash-2"
            type="feather"
            size={moderateScale(20)}
            color="white"
          />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[styles.draggableItem, isActive && styles.draggingItem]}>
          <View style={styles.dragHandle}>
            <Icon
              name="menu"
              type="feather"
              size={moderateScale(20)}
              color={'transparent'}
            />
          </View>
          <TrackItem
            reciterId={download.reciterId}
            surahId={download.surahId}
            rewayatId={download.rewayatId}
            onPress={() => handleSurahPress(download, reciter, surah)}
            onPlayPress={() => handleSurahPress(download, reciter, surah)}
          />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={downloadData}
        renderItem={renderItem}
        keyExtractor={item =>
          `${item.download.reciterId}-${item.download.surahId}`
        }
        onDragEnd={({data}) => handleReorder(data)}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No downloads yet</Text>
        }
        bounces={false}
      />
      <View
        style={[
          styles.backButton,
          {
            top: insets.top + moderateScale(10),
            left: moderateScale(15),
          },
        ]}>
        <TouchableOpacity activeOpacity={0.99} onPress={() => router.back()}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color="white"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
