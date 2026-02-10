import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {View, Text, StyleSheet, Animated as RNAnimated} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {SurahItem} from '@/components/SurahItem';
import {getReciterById, getSurahById} from '@/services/dataService';
import {moderateScale} from 'react-native-size-matters';
import {ListRenderItem} from 'react-native';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {
  useDownloadActions,
  useDownloads,
} from '@/services/player/store/downloadSelectors';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {shuffleArray} from '@/utils/arrayUtils';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {ReciterDownloadsHeader} from '@/components/playlist-detail/ReciterDownloadsHeader';
import {createDownloadedTrack} from '@/utils/track';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SheetManager} from 'react-native-actions-sheet';
import {usePlayerActions} from '@/hooks/usePlayerActions';

interface DownloadTrackData {
  download: DownloadedSurah;
  reciter: Reciter | null;
  surah: Surah | null;
  rewayatName?: string;
}

interface ReciterDownloadsListProps {
  reciterId: string;
}

export const ReciterDownloadsList: React.FC<ReciterDownloadsListProps> = ({
  reciterId,
}) => {
  const {theme} = useTheme();
  const downloads = useDownloads();
  const {removeDownload} = useDownloadActions();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const {addToQueue, updateQueue, toggleShuffle} = usePlayerActions();
  const shuffleEnabled = usePlayerStore(state => state.settings.shuffle);

  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [downloadData, setDownloadData] = useState<DownloadTrackData[]>([]);
  const [loading, setLoading] = useState(true);

  // Scroll tracking for sticky header
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // Filter downloads for this reciter
  const reciterDownloads = useMemo(() => {
    return downloads.filter(d => d.reciterId === reciterId);
  }, [downloads, reciterId]);

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

  // Load reciter data
  useEffect(() => {
    if (!reciterId) return;

    let mounted = true;
    const loadReciter = async () => {
      try {
        const data = await getReciterById(reciterId);
        if (mounted && data) {
          setReciter(data);
        }
      } catch (error) {
        console.error('Error loading reciter:', error);
      }
    };
    loadReciter();
    return () => {
      mounted = false;
    };
  }, [reciterId]);

  // Load download data
  const loadDownloadData = useCallback(async () => {
    if (!reciterId) return;

    try {
      setLoading(true);

      // Enrich with surah data and rewayat name
      const enrichedData = await Promise.all(
        reciterDownloads.map(async download => {
          const [loadedReciter, surah] = await Promise.all([
            getReciterById(download.reciterId),
            Promise.resolve(getSurahById(parseInt(download.surahId, 10))),
          ]);

          // Get rewayat name and style if rewayatId is available
          let rewayatName: string | undefined;
          if (loadedReciter && download.rewayatId) {
            const rewayat = loadedReciter.rewayat.find(
              r => r.id === download.rewayatId,
            );
            if (rewayat) {
              // Capitalize style
              const capitalizedStyle =
                rewayat.style.charAt(0).toUpperCase() + rewayat.style.slice(1);
              rewayatName = `${rewayat.name} \u2022 ${capitalizedStyle}`;
            }
          }

          return {
            download,
            reciter: loadedReciter || null,
            surah: surah || null,
            rewayatName,
          };
        }),
      );

      // Sort by surah number
      enrichedData.sort((a, b) => {
        if (!a.surah || !b.surah) return 0;
        return a.surah.id - b.surah.id;
      });

      setDownloadData(enrichedData);
    } catch (error) {
      console.error('Failed to load download data:', error);
    } finally {
      setLoading(false);
    }
  }, [reciterId, reciterDownloads]);

  useEffect(() => {
    loadDownloadData();
  }, [loadDownloadData]);

  // Handle track press to play
  const handleTrackPress = useCallback(
    async (download: DownloadedSurah, loadedReciter: Reciter, surah: Surah) => {
      try {
        if (downloadData.length === 0) {
          console.warn('No download data loaded yet');
          return;
        }

        const selectedIndex = downloadData.findIndex(
          item =>
            item.download.reciterId === download.reciterId &&
            item.download.surahId === download.surahId &&
            (item.download.rewayatId || '') === (download.rewayatId || ''),
        );

        if (selectedIndex === -1) {
          console.warn('Selected track not found');
          return;
        }

        // Build all tracks with selected first
        const reorderedItems = [
          downloadData[selectedIndex],
          ...downloadData.slice(selectedIndex + 1),
          ...downloadData.slice(0, selectedIndex),
        ];

        const allTracks = reorderedItems
          .filter(
            (
              item,
            ): item is DownloadTrackData & {reciter: Reciter; surah: Surah} =>
              item.reciter !== null && item.surah !== null,
          )
          .map(item =>
            createDownloadedTrack(
              item.reciter,
              item.surah,
              item.download.filePath,
              item.download.rewayatId,
            ),
          );

        if (allTracks.length === 0) return;

        await updateQueue(allTracks, 0);
        addRecentTrack(loadedReciter, surah, 0, 0, download.rewayatId);
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [downloadData, addRecentTrack, updateQueue],
  );

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      const allTracks = downloadData
        .filter(
          (
            item,
          ): item is DownloadTrackData & {reciter: Reciter; surah: Surah} =>
            item.reciter !== null && item.surah !== null,
        )
        .map(item =>
          createDownloadedTrack(
            item.reciter,
            item.surah,
            item.download.filePath,
            item.download.rewayatId,
          ),
        );

      if (allTracks.length === 0) return;

      await updateQueue(allTracks, 0);

      const firstItem = downloadData.find(item => item.reciter && item.surah);
      if (firstItem?.reciter && firstItem?.surah) {
        addRecentTrack(
          firstItem.reciter,
          firstItem.surah,
          0,
          0,
          firstItem.download.rewayatId,
        );
      }
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  }, [downloadData, addRecentTrack, updateQueue]);

  // Shuffle all tracks
  const handleShuffle = useCallback(async () => {
    if (downloadData.length === 0) return;

    try {
      const shuffledItems = shuffleArray([...downloadData]).filter(
        (item): item is DownloadTrackData & {reciter: Reciter; surah: Surah} =>
          item.reciter !== null && item.surah !== null,
      );

      if (shuffledItems.length === 0) return;

      // Enable shuffle mode
      if (!shuffleEnabled) {
        toggleShuffle();
      }

      const allTracks = shuffledItems.map(item =>
        createDownloadedTrack(
          item.reciter,
          item.surah,
          item.download.filePath,
          item.download.rewayatId,
        ),
      );

      await updateQueue(allTracks, 0);

      const firstItem = shuffledItems[0];
      addRecentTrack(
        firstItem.reciter,
        firstItem.surah,
        0,
        0,
        firstItem.download.rewayatId,
      );
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [
    downloadData,
    addRecentTrack,
    updateQueue,
    shuffleEnabled,
    toggleShuffle,
  ]);

  // Handle remove download
  const handleRemoveDownload = useCallback(
    async (download: DownloadedSurah) => {
      try {
        await removeDownload(
          download.reciterId,
          download.surahId,
          download.rewayatId || undefined,
        );
      } catch (error) {
        console.error('Error removing download:', error);
      }
    },
    [removeDownload],
  );

  // Handle show options for a download
  const handleShowOptions = useCallback(
    (download: DownloadedSurah, itemReciter: Reciter, surah: Surah) => {
      const track = createDownloadedTrack(
        itemReciter,
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
          onPlay: () => handleTrackPress(download, itemReciter, surah),
          onAddToQueue: () => {
            addToQueue([track]);
          },
          onRemoveDownload: () => handleRemoveDownload(download),
        },
      });
    },
    [handleTrackPress, addToQueue, handleRemoveDownload],
  );

  const handleRemoveAllDownloads = useCallback(() => {
    SheetManager.show('collection-options', {
      payload: {
        title: reciter?.name || 'Downloads',
        subtitle: `${reciterDownloads.length} ${
          reciterDownloads.length === 1 ? 'surah' : 'surahs'
        } downloaded`,
        options: [
          {
            label: 'Remove All Downloads',
            icon: 'trash-2',
            destructive: true,
            onPress: async () => {
              for (const d of reciterDownloads) {
                await removeDownload(
                  d.reciterId,
                  d.surahId,
                  d.rewayatId || undefined,
                );
              }
            },
          },
        ],
      },
    });
  }, [reciterDownloads, reciter?.name, removeDownload]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <ReciterDownloadsHeader
        reciterId={reciterId}
        reciterName={reciter?.name || 'Reciter'}
        reciterImageUrl={reciter?.image_url || undefined}
        subtitle={`${downloadData.length} ${
          downloadData.length === 1 ? 'surah' : 'surahs'
        } downloaded`}
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        onOptionsPress={handleRemoveAllDownloads}
        theme={theme}
      />
    );
  }, [
    reciterId,
    reciter,
    downloadData.length,
    handlePlayAll,
    handleShuffle,
    handleRemoveAllDownloads,
    theme,
  ]);

  const renderItem: ListRenderItem<DownloadTrackData> = ({item}) => {
    const {download, reciter: itemReciter, surah, rewayatName} = item;

    if (!itemReciter || !surah) {
      return null;
    }

    return (
      <View style={styles.listItem}>
        <SurahItem
          item={surah}
          onPress={() => handleTrackPress(download, itemReciter, surah)}
          reciterId={download.reciterId}
          rewayatId={download.rewayatId}
          rewayatName={rewayatName}
          onOptionsPress={() => handleShowOptions(download, itemReciter, surah)}
        />
      </View>
    );
  };

  const getItemKey = (item: DownloadTrackData) =>
    `${item.download.reciterId}:${item.download.surahId}:${
      item.download.rewayatId || ''
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
      <RNAnimated.FlatList
        data={downloadData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No downloads for this reciter</Text>
        }
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <CollectionStickyHeader
        title={reciter?.name || 'Downloads'}
        scrollY={scrollY}
      />
    </View>
  );
};
