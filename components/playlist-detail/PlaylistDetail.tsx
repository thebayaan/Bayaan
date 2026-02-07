import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ListRenderItem,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {TrackItem} from '@/components/TrackItem';
import {usePlaylists} from '@/hooks/usePlaylists';
import {getReciterById, getSurahById} from '@/services/dataService';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTrack} from '@/utils/track';
import {moderateScale} from 'react-native-size-matters';
import {PlaylistHeader} from './PlaylistHeader';
import {SheetManager} from 'react-native-actions-sheet';
import {useRouter} from 'expo-router';
import * as Haptics from 'expo-haptics';
import {UserPlaylist} from '@/services/database/DatabaseService';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';

interface PlaylistTrack {
  id: string;
  surahId: string;
  reciterId: string;
  rewayatId?: string;
  surah?: Surah;
  reciter?: Reciter;
}

interface PlaylistDataItem {
  track: PlaylistTrack;
  reciter: Reciter | null;
  surah: Surah | null;
}

interface PlaylistDetailProps {
  id: string;
}

const PlaylistDetail: React.FC<PlaylistDetailProps> = ({id}) => {
  const {theme} = useTheme();
  const router = useRouter();
  const {
    getPlaylist,
    getPlaylistItems,
    removeFromPlaylist,
    updatePlaylist,
    deletePlaylist,
    playlists,
  } = usePlaylists();
  const {updateQueue, addToQueue, play} = useUnifiedPlayer();

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const [playlistData, setPlaylistData] = useState<PlaylistDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldClearPlaylistRef = useRef(true);

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
  });

  useEffect(() => {
    loadPlaylistData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPlaylistData = useCallback(async () => {
    try {
      setLoading(true);

      const playlistInfo = await getPlaylist(id);
      setPlaylist(playlistInfo);

      const playlistItems = await getPlaylistItems(id);

      const enrichedData = await Promise.all(
        playlistItems.map(async item => {
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
        }),
      );

      setPlaylistData(enrichedData);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    } finally {
      setLoading(false);
    }
  }, [id, getPlaylist, getPlaylistItems]);

  const handleSurahPress = useCallback(
    async (track: PlaylistTrack, reciter: Reciter, surah: Surah) => {
      try {
        const trackPromises = playlistData.map(async item => {
          if (!item.reciter || !item.surah) return null;
          return await createTrack(
            item.reciter,
            item.surah,
            item.track.rewayatId,
          );
        });

        const validTracks = (await Promise.all(trackPromises)).filter(
          (t): t is NonNullable<typeof t> => t !== null,
        );

        if (validTracks.length === 0) return;

        const selectedIndex = validTracks.findIndex(
          t =>
            t.reciterId === reciter.id &&
            t.surahId === surah.id.toString() &&
            (track.rewayatId ? t.rewayatId === track.rewayatId : true),
        );

        if (selectedIndex === -1) return;

        const reorderedTracks = [
          ...validTracks.slice(selectedIndex),
          ...validTracks.slice(0, selectedIndex),
        ];

        await updateQueue(reorderedTracks, 0);
        await play();
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [updateQueue, play, playlistData],
  );

  const handleRemoveFromPlaylist = useCallback(
    async (track: PlaylistTrack) => {
      try {
        await removeFromPlaylist(track.id);
        await loadPlaylistData();
      } catch (error) {
        console.error('Failed to remove item from playlist:', error);
      }
    },
    [removeFromPlaylist, loadPlaylistData],
  );

  const handlePlayAll = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      const trackPromises = playlistData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        return await createTrack(
          item.reciter,
          item.surah,
          item.track.rewayatId,
        );
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
  }, [playlistData, updateQueue, play]);

  const handleShuffle = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      const trackPromises = playlistData.map(async item => {
        if (!item.reciter || !item.surah) return null;
        return await createTrack(
          item.reciter,
          item.surah,
          item.track.rewayatId,
        );
      });

      const validTracks = (await Promise.all(trackPromises)).filter(
        (track): track is NonNullable<typeof track> => track !== null,
      );

      if (validTracks.length > 0) {
        const shuffledTracks = [...validTracks].sort(() => Math.random() - 0.5);
        await updateQueue(shuffledTracks, 0);
        await play();
      }
    } catch (error) {
      console.error('Error shuffling tracks:', error);
    }
  }, [playlistData, updateQueue, play]);

  const existingPlaylistColors = React.useMemo(
    () => playlists.map(p => p.color).filter(Boolean) as string[],
    [playlists],
  );

  const handleOptionsPress = useCallback(() => {
    if (!playlist) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    shouldClearPlaylistRef.current = true;

    const handleEditForThisPlaylist = async () => {
      shouldClearPlaylistRef.current = false;

      const result = await SheetManager.show('create-playlist', {
        payload: {
          existingColors: existingPlaylistColors,
          isEditMode: true,
          initialName: playlist.name,
          initialColor: playlist.color || '#6366F1',
        },
      });

      if (result?.name && result?.color) {
        try {
          await updatePlaylist(playlist.id, {
            name: result.name,
            color: result.color,
          });
          await loadPlaylistData();
        } catch (error: unknown) {
          console.error('Failed to update playlist:', error);
        }
      }

      setTimeout(() => {
        shouldClearPlaylistRef.current = true;
      }, 600);
    };

    const handleDeleteForThisPlaylist = async () => {
      try {
        await deletePlaylist(playlist.id);
        router.back();
      } catch (error: unknown) {
        console.error('Failed to delete playlist:', error);
      }
    };

    SheetManager.show('playlist-context', {
      payload: {
        playlistId: playlist.id,
        playlistName: playlist.name,
        playlistColor: playlist.color,
        onDelete: handleDeleteForThisPlaylist,
        onEdit: handleEditForThisPlaylist,
      },
    });
  }, [
    playlist,
    deletePlaylist,
    router,
    existingPlaylistColors,
    updatePlaylist,
    loadPlaylistData,
  ]);

  const handleShowTrackOptions = useCallback(
    async (track: PlaylistTrack, reciter: Reciter, surah: Surah) => {
      const audioTrack = await createTrack(reciter, surah, track.rewayatId);

      SheetManager.show('surah-options', {
        payload: {
          surah,
          reciterId: track.reciterId,
          rewayatId: track.rewayatId,
          onAddToQueue: async (s: Surah) => {
            if (audioTrack) {
              await addToQueue([audioTrack]);
            }
          },
        },
      });
    },
    [addToQueue],
  );

  const ListHeaderComponent = useCallback(() => {
    if (!playlist) return null;

    return (
      <PlaylistHeader
        title={playlist.name}
        subtitle={`${playlistData.length} ${
          playlistData.length === 1 ? 'surah' : 'surahs'
        }`}
        onPlayPress={handlePlayAll}
        onShufflePress={handleShuffle}
        onOptionsPress={handleOptionsPress}
        theme={theme}
      />
    );
  }, [
    playlist,
    playlistData.length,
    handlePlayAll,
    handleShuffle,
    handleOptionsPress,
    theme,
  ]);

  const renderItem: ListRenderItem<PlaylistDataItem> = ({item}) => {
    const {track, reciter, surah} = item;

    if (!reciter || !surah) {
      return null;
    }

    return (
      <TrackItem
        reciterId={track.reciterId}
        surahId={track.surahId}
        rewayatId={track.rewayatId}
        onPress={() => handleSurahPress(track, reciter, surah)}
        onPlayPress={() => handleSurahPress(track, reciter, surah)}
        onOptionsPress={() => handleShowTrackOptions(track, reciter, surah)}
      />
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
      <RNAnimated.FlatList
        data={playlistData}
        renderItem={renderItem}
        keyExtractor={item => item.track.id}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No surahs in this playlist</Text>
        }
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <CollectionStickyHeader title={playlist.name} scrollY={scrollY} />
    </View>
  );
};

export default PlaylistDetail;
