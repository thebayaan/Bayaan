import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrackItem} from '@/components/TrackItem';
import {usePlaylists} from '@/hooks/usePlaylists';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTrack} from '@/utils/track';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import {Swipeable} from 'react-native-gesture-handler';
import {Icon} from '@rneui/themed';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {State as TrackPlayerState} from 'react-native-track-player';
import {PlaylistHeader} from '@/components/collection/PlaylistHeader';

interface PlaylistTrack {
  id: string;
  surahId: string;
  reciterId: string;
  rewayatId?: string;
  surah?: Surah;
  reciter?: Reciter;
}

const PlaylistDetailScreen = () => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {id} = useLocalSearchParams<{id: string}>();
  const router = useRouter();
  const {getPlaylist, getPlaylistItems, removeFromPlaylist, reorderPlaylistItems} = usePlaylists();
  const {updateQueue, play, pause, playback} = useUnifiedPlayer();
  
  const [playlist, setPlaylist] = useState<any>(null);
  const [playlistData, setPlaylistData] = useState<
    Array<{
      track: PlaylistTrack;
      reciter: Reciter | null;
      surah: Surah | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

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
  });

  useEffect(() => {
    loadPlaylistData();
  }, [id]);

  const loadPlaylistData = async () => {
    try {
      setLoading(true);
      
      // Get playlist info
      const playlistData = await getPlaylist(id!);
      setPlaylist(playlistData);

      // Get playlist items
      const playlistItems = await getPlaylistItems(id!);
      
      // Enrich with surah and reciter data
      const enrichedData = await Promise.all(
        playlistItems.map(async (item) => {
          const [reciter, surah] = await Promise.all([
            getReciterById(item.reciterId),
            getSurahById(parseInt(item.surahId, 10)),
          ]);
          
          return {
            track: {
              id: item.id,
              surahId: item.surahId,
              reciterId: item.reciterId,
              rewayatId: item.rewayatId,
              surah,
              reciter,
            },
            reciter: reciter || null,
            surah: surah || null,
          };
        })
      );
      
      setPlaylistData(enrichedData);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle surah press to play track
  const handleSurahPress = useCallback(
    async (track: PlaylistTrack, reciter: Reciter, surah: Surah) => {
      try {
        // Create track using the smart audio URL system
        const playerTrack = await createTrack(reciter, surah, track.rewayatId);
        
        // Update queue with the track and start playing
        await updateQueue([playerTrack], 0);
        await play();
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [updateQueue, play],
  );

  const handleReorder = useCallback(
    (
      data: Array<{
        track: PlaylistTrack;
        reciter: Reciter | null;
        surah: Surah | null;
      }>,
    ) => {
      // Update local state
      setPlaylistData(data);

      // Update store with new order
      const newOrder = data.map(item => item.track.id);
      reorderPlaylistItems(id!, newOrder);
    },
    [reorderPlaylistItems, id],
  );

  const handleRemoveFromPlaylist = useCallback(
    async (track: PlaylistTrack) => {
      try {
        await removeFromPlaylist(track.id);
        // Reload playlist data to reflect changes
        await loadPlaylistData();
      } catch (error) {
        console.error('Failed to remove item from playlist:', error);
      }
    },
    [removeFromPlaylist],
  );

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    if (playlistData.length === 0) return;
    
    try {
      // If currently playing, pause
      if (playback.state === TrackPlayerState.Playing) {
        await pause();
        return;
      }

      // If paused or stopped, play all tracks
      const trackPromises = playlistData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        return await createTrack(item.reciter, item.surah, item.track.rewayatId);
      });
      
      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );
      
      if (validTracks.length === 0) return;

      await updateQueue(validTracks, 0);
      await play();
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  }, [playlistData, updateQueue, play, pause, playback.state]);

  const handleShuffle = useCallback(async () => {
    if (playlistData.length === 0) return;
    
    try {
      // Create tracks for all items in the playlist
      const trackPromises = playlistData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        return await createTrack(item.reciter, item.surah, item.track.rewayatId);
      });
      
      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );
      
      if (validTracks.length > 0) {
        // Shuffle the tracks array
        const shuffledTracks = [...validTracks].sort(() => Math.random() - 0.5);
        
        // Update queue with shuffled tracks and start playing from the first one
        await updateQueue(shuffledTracks, 0);
        await play();
      }
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [playlistData, updateQueue, play]);

  const ListHeaderComponent = useCallback(() => {
    if (!playlist) return null;
    
    return (
      <PlaylistHeader
        title={playlist.name}
        subtitle={`Playlist • ${playlistData.length} surahs`}
        backgroundColor={playlist.color}
        iconName="book-open"
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        showDownloadIcon={false}
        theme={theme}
      />
    );
  }, [
    playlist,
    playlistData.length,
    handlePlayAll,
    handleShuffle,
    theme,
  ]);

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<{
    track: PlaylistTrack;
    reciter: Reciter | null;
    surah: Surah | null;
  }>) => {
    const {track, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    const renderRightActions = () => (
      <View style={styles.rightAction}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleRemoveFromPlaylist(track)}>
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
            reciterId={track.reciterId}
            surahId={track.surahId}
            rewayatId={track.rewayatId}
            onPress={() => handleSurahPress(track, reciter, surah)}
            onPlayPress={() => handleSurahPress(track, reciter, surah)}
          />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading || !playlist) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={playlistData}
        renderItem={renderItem}
        keyExtractor={item => item.track.id}
        onDragEnd={({data}) => handleReorder(data)}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No surahs in this playlist</Text>
        }
        bounces={false}
      />
    </View>
  );
};

export default PlaylistDetailScreen;