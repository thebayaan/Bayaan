import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, FlatList, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrackItem} from '@/components/TrackItem';
import {useDownload, DownloadedSurah} from '@/services/player/store/downloadStore';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createDownloadedTrack} from '@/utils/track';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {useRouter} from 'expo-router';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';






// Mock data for downloads (replace with actual data source later)


export default function DownloadsScreen() {

  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const {downloads, clearAllDownloads, reorderDownloads, setDownloads, removeDownload} = useDownload();
  const {updateQueue, play} = useUnifiedPlayer();
  const router = useRouter();
  // State to store reciter and surah data for each download
  const [downloadData, setDownloadData] = useState<Array<{
    download: DownloadedSurah;
    reciter: Reciter | null;
    surah: Surah | null;
  }>>([]);

  // Load reciter and surah data for all downloads
  useEffect(() => {
    const loadDownloadData = async () => {
      const data = await Promise.all(
        downloads.map(async (download) => {
          const [reciter, surah] = await Promise.all([
            getReciterById(download.reciterId),
            getSurahById(parseInt(download.surahId, 10))
          ]);
          return {
            download,
            reciter: reciter || null,
            surah: surah || null
          };
        })
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
  const handleSurahPress = useCallback(async (download: DownloadedSurah, reciter: Reciter, surah: Surah) => {
    try {
      // Create track using local file path
      const track = createDownloadedTrack(reciter, surah, download.filePath, download.rewayatId);
      
      // Update queue with the downloaded track and start playing
      await updateQueue([track], 0);
      await play();
    } catch (error) {
      console.error('Error playing downloaded surah', error);
    }
  }, [updateQueue, play]);

  const handleClearAll = useCallback(async () => {
    await clearAllDownloads();
  }, [clearAllDownloads]);
  const handleReorder = useCallback((data: Array<{download: DownloadedSurah, reciter: Reciter | null, surah: Surah | null}>) => {
    // Update local state
    setDownloadData(data);
    
    // Update store with new order
    const newOrder = data.map(item => item.download);
    setDownloads(newOrder);
  }, [setDownloads]);

const handlePlayAll = useCallback(async () => {
  if (downloadData.length === 0) return;

  try {
    const trackPromises = downloadData.map(async item => {
      if (!item.reciter || !item.surah) return null;
      return createDownloadedTrack(
        item.reciter, 
        item.surah, 
        item.download.filePath, 
        item.download.rewayatId
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
const handleRemoveDownload = useCallback((download: DownloadedSurah) => {
  removeDownload(download.reciterId, download.surahId);
}, [removeDownload]);
//render item for draggable flat list
const renderItem = ({item, drag, isActive}: RenderItemParams<{download: DownloadedSurah, reciter: Reciter | null, surah: Surah | null}>) => {
  const {download, reciter, surah} = item;
  
  if (!reciter || !surah) {
    return null;
  }

  const renderRightActions = () => (
    <View style={styles.rightAction}>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleRemoveDownload(download)}>
        <Icon name="trash-2" type="feather" size={moderateScale(20)} color="white" />
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
        <Icon name="menu" type="feather" size={moderateScale(20)} color={theme.colors.textSecondary} />
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
    {/* Header with gradient background */}
    <View style={styles.headerContainer2}>
      <LinearGradient
        colors={['#8B5CF6', '#A855F7', '#C084FC']}
        style={styles.gradientContainer2}>
        
        {/* Back button */}
        <TouchableOpacity 
          style={styles.backButton2}
          onPress={() => router.back()}>
          <Icon name="arrow-left" type="feather" size={moderateScale(24)} color="white" />
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Downloads</Text>
          <Text style={styles.subtitle}>{downloadData.length} surahs downloaded</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons2}>
          <TouchableOpacity 
            style={[styles.playAllButton, downloadData.length === 0 && styles.buttonDisabled]}
            onPress={handlePlayAll}
            disabled={downloadData.length === 0}>
            <Icon name="play" type="feather" size={moderateScale(20)} color="white" />
            <Text style={styles.playAllText}>Play All</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.clearButton2, downloadData.length === 0 && styles.buttonDisabled]}
            onPress={handleClearAll}
            disabled={downloadData.length === 0}>
            <Icon name="trash-2" type="feather" size={moderateScale(20)} color="white" />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>

    {/* Content */}
    <DraggableFlatList
  data={downloadData}
  renderItem={renderItem}
  keyExtractor={item => `${item.download.reciterId}-${item.download.surahId}`}
  onDragEnd={({data}) => handleReorder(data)}
  contentContainerStyle={styles.listContainer}
  ListEmptyComponent={
    <Text style={styles.emptyText}>No downloads yet</Text>
  }
/>
  </View>
);
}
