import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
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
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import {Swipeable} from 'react-native-gesture-handler';
import {Icon} from '@rneui/themed';
import {PlaylistHeader} from './PlaylistHeader';
import {useModal} from '@/components/providers/ModalProvider';
import {useRouter} from 'expo-router';
import {CreatePlaylistModal} from '@/components/collection/CreatePlaylistModal';
import * as Haptics from 'expo-haptics';
import {UserPlaylist} from '@/services/database/DatabaseService';

interface PlaylistTrack {
  id: string;
  surahId: string;
  reciterId: string;
  rewayatId?: string;
  surah?: Surah;
  reciter?: Reciter;
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
    reorderPlaylistItems,
    updatePlaylist,
    deletePlaylist,
    playlists,
  } = usePlaylists();
  const {updateQueue, play} = useUnifiedPlayer();
  const {showPlaylistContextMenu} = useModal();

  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const [playlistData, setPlaylistData] = useState<
    Array<{
      track: PlaylistTrack;
      reciter: Reciter | null;
      surah: Surah | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPlaylistData = useCallback(async () => {
    try {
      setLoading(true);

      // Get playlist info
      const playlistInfo = await getPlaylist(id);
      setPlaylist(playlistInfo);

      // Get playlist items
      const playlistItems = await getPlaylistItems(id);

      // Enrich with surah and reciter data
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

  // Handle surah press to play track
  const handleSurahPress = useCallback(
    async (track: PlaylistTrack, reciter: Reciter, surah: Surah) => {
      try {
        // Create tracks for all items in the playlist
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

        // Find the index of the selected track
        const selectedIndex = validTracks.findIndex(
          t =>
            t.reciterId === reciter.id &&
            t.surahId === surah.id.toString() &&
            (track.rewayatId ? t.rewayatId === track.rewayatId : true),
        );

        if (selectedIndex === -1) return;

        // Reorder tracks to start from the selected track
        const reorderedTracks = [
          ...validTracks.slice(selectedIndex),
          ...validTracks.slice(0, selectedIndex),
        ];

        // Update queue with all tracks starting from the selected one
        await updateQueue(reorderedTracks, 0);
        await play();
      } catch (error) {
        console.error('Error playing track:', error);
      }
    },
    [updateQueue, play, playlistData],
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
      reorderPlaylistItems(id, newOrder);
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
    [removeFromPlaylist, loadPlaylistData],
  );

  // Play all tracks
  const handlePlayAll = useCallback(async () => {
    if (playlistData.length === 0) return;

    try {
      // Create tracks for all items in the playlist
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
      // Create tracks for all items in the playlist
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

  // Handle options button press
  const handleOptionsPress = useCallback(() => {
    if (!playlist) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    shouldClearPlaylistRef.current = true;

    // Create a closure that captures the playlist data for editing
    const handleEditForThisPlaylist = () => {
      // Prevent clearing playlist data BEFORE closing context menu
      shouldClearPlaylistRef.current = false;

      // Set edit mode data and open the modal
      setIsEditMode(true);
      setShowEditModal(true);

      // Clear the flag after modal is fully opened
      setTimeout(() => {
        shouldClearPlaylistRef.current = true;
      }, 600);
    };

    // Create a closure that captures the playlist ID for deletion
    const handleDeleteForThisPlaylist = async () => {
      try {
        await deletePlaylist(playlist.id);
        // Navigate back after successful deletion
        router.back();
      } catch (error: unknown) {
        console.error('Failed to delete playlist:', error);
      }
    };

    showPlaylistContextMenu(
      playlist.id,
      playlist.name,
      handleDeleteForThisPlaylist,
      handleEditForThisPlaylist,
      playlist.color,
    );
  }, [playlist, deletePlaylist, router, showPlaylistContextMenu]);

  // Handle save playlist (for edit mode)
  const handleSavePlaylist = useCallback(
    async (name: string, color: string) => {
      if (!playlist) return;

      try {
        await updatePlaylist(playlist.id, {name, color});
        setShowEditModal(false);
        setIsEditMode(false);
        // Reload playlist data to reflect changes
        await loadPlaylistData();
      } catch (error: unknown) {
        console.error('Failed to save playlist:', error);
      }
    },
    [playlist, updatePlaylist, loadPlaylistData],
  );

  // Handle close edit modal
  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setIsEditMode(false);
  }, []);

  // Get existing playlist colors to avoid duplicates
  const existingPlaylistColors = React.useMemo(
    () => playlists.map(p => p.color).filter(Boolean) as string[],
    [playlists],
  );

  const ListHeaderComponent = useCallback(() => {
    if (!playlist) return null;

    return (
      <PlaylistHeader
        title={playlist.name}
        subtitle={`${playlistData.length} ${playlistData.length === 1 ? 'surah' : 'surahs'}`}
        backgroundColor={playlist.color}
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
      <StatusBar barStyle="light-content" />
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

      {/* Edit Playlist Modal */}
      <CreatePlaylistModal
        visible={showEditModal}
        onClose={handleCloseEditModal}
        onCreatePlaylist={handleSavePlaylist}
        theme={theme}
        existingColors={existingPlaylistColors}
        isEditMode={isEditMode}
        initialName={playlist?.name}
        initialColor={playlist?.color}
      />
    </View>
  );
};

export default PlaylistDetail;
