import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, FlatList} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrackItem} from '@/components/TrackItem';
import {useDownload} from '@/services/player/store/downloadStore';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createDownloadedTrack} from '@/utils/track';

interface DownloadedSurah {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  filePath: string;        // Where the file is saved
  fileSize: number;       // Size in bytes
  downloadDate: number;   // When downloaded
  status: 'downloading' | 'completed' | 'error';
}

// Mock data for downloads (replace with actual data source later)


export default function DownloadsScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const {downloads} = useDownload();
  const {updateQueue, play} = useUnifiedPlayer();
  
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
      console.error('Error playing downloaded surah:', error);
    }
  }, [updateQueue, play]);

  const renderItem = ({item}: {item: {download: DownloadedSurah, reciter: Reciter | null, surah: Surah | null}}) => {
    const {download, reciter, surah} = item;
    
    // Don't render if we don't have the required data yet
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
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Downloads</Text>
        </View>
      </View>
      <FlatList
        data={downloadData}
        renderItem={renderItem}
        keyExtractor={item => `${item.download.reciterId}-${item.download.surahId}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No downloads yet</Text>
        }
      />
    </View>
  );
}
