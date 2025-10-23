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

  const handlePlayAll = () => {
    // TODO: Implement play all functionality
    console.log('Play all pressed');
  };

  const handleShuffle = () => {
    // TODO: Implement shuffle functionality
    console.log('Shuffle pressed');
  };

  const handleTrackPress = (track: PlaylistTrack) => {
    // TODO: Implement track play functionality
    console.log('Track pressed:', track);
  };

  const renderTrack = ({item}: {item: PlaylistTrack}) => {
    if (!item.surah || !item.reciter) return null;

    return (
      <TrackItem
        track={{
          id: `${item.reciterId}:${item.surahId}:${item.rewayatId || ''}`,
          title: item.surah.name,
          artist: item.reciter.name,
          artwork: '', // TODO: Add artwork if needed
        }}
        onPress={() => handleTrackPress(item)}
        theme={theme}
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
