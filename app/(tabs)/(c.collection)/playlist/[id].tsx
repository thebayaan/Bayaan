import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useLocalSearchParams} from 'expo-router';
import {PlaylistHeader} from '@/components/collection/PlaylistHeader';
import {usePlaylists} from '@/hooks/usePlaylists';
import {TrackItem} from '@/components/TrackItem';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTrack} from '@/utils/track';

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
  const {getPlaylist, getPlaylistItems} = usePlaylists();
  const {updateQueue, play} = useUnifiedPlayer();
  
  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const styles = createStyles(theme, insets);

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
      const enrichedTracks = await Promise.all(
        playlistItems.map(async (item) => {
          const [reciter, surah] = await Promise.all([
            getReciterById(item.reciterId),
            getSurahById(parseInt(item.surahId, 10)),
          ]);
          
          return {
            id: item.id,
            surahId: item.surahId,
            reciterId: item.reciterId,
            rewayatId: item.rewayatId,
            surah,
            reciter,
          };
        })
      );
      
      setTracks(enrichedTracks);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    
    try {
      // Create tracks for all items in the playlist
      const playerTracks = await Promise.all(
        tracks.map(async (track) => {
          if (!track.surah || !track.reciter) return null;
          return await createTrack(track.reciter, track.surah, track.rewayatId);
        })
      );
      
      // Filter out null tracks
      const validTracks = playerTracks.filter(track => track !== null);
      
      if (validTracks.length > 0) {
        // Update queue with all tracks and start playing from the first one
        await updateQueue(validTracks, 0);
        await play();
      }
    } catch (error) {
      console.error('Error playing all tracks:', error);
    }
  };

  const handleShuffle = async () => {
    if (tracks.length === 0) return;
    
    try {
      // Create tracks for all items in the playlist
      const playerTracks = await Promise.all(
        tracks.map(async (track) => {
          if (!track.surah || !track.reciter) return null;
          return await createTrack(track.reciter, track.surah, track.rewayatId);
        })
      );
      
      // Filter out null tracks
      const validTracks = playerTracks.filter(track => track !== null);
      
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
  };

  const handleTrackPress = async (track: PlaylistTrack) => {
    if (!track.surah || !track.reciter) return;
    
    try {
      // Create track using the smart audio URL system
      const playerTrack = await createTrack(track.reciter, track.surah, track.rewayatId);
      
      // Update queue with the track and start playing
      await updateQueue([playerTrack], 0);
      await play();
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const renderTrack = ({item}: {item: PlaylistTrack}) => {
    if (!item.surah || !item.reciter) return null;

    return (
      <TrackItem
        reciterId={item.reciterId}
        surahId={item.surahId}
        rewayatId={item.rewayatId}
        onPress={() => handleTrackPress(item)}
        onPlayPress={() => handleTrackPress(item)}
      />
    );
  };

  if (loading || !playlist) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PlaylistHeader
        title={playlist.name}
        subtitle={`Playlist • ${playlist.itemCount} surahs`}
        backgroundColor={playlist.color}
        iconName="book-open"
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        showDownloadIcon={false}
        theme={theme}
      />

      <FlatList
        data={tracks}
        renderItem={renderTrack}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No surahs in this playlist</Text>
            {/* <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>Add Surahs</Text>
            </TouchableOpacity> */}
          </View>
        }
      />
    </View>
  );
};

const createStyles = (theme: any, insets: any) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      fontSize: moderateScale(16),
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: moderateScale(50),
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: moderateScale(100),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: moderateScale(20),
      marginTop: moderateScale(50),
    },
    emptyText: {
      fontSize: moderateScale(18),
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: moderateScale(20),
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(8),
    },
    addButtonText: {
      color: 'white',
      fontSize: moderateScale(16),
      fontWeight: '600',
    },
  });

export default PlaylistDetailScreen;
