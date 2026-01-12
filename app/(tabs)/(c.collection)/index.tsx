import React, {useState, useRef, useMemo, useCallback} from 'react';
import {View, ScrollView, Platform, Text} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {useSettings} from '@/hooks/useSettings';
import {Theme} from '@/utils/themeUtils';
import {BlurView} from '@react-native-community/blur';
import * as Haptics from 'expo-haptics';

// Components
import {CollectionHeader} from '@/components/collection/CollectionHeader';
import {FilterBar} from '@/components/collection/FilterBar';
import {SectionHeader} from '@/components/collection/SectionHeader';
import {CreatePlaylistModal} from '@/components/collection/CreatePlaylistModal';
import {CollectionSearchModal} from '@/components/collection/CollectionSearchModal';
import {
  CollectionGrid,
  CollectionItem as CollectionItemType,
  PlaylistItemData,
  LovedItemData,
  ReciterItemData,
  DownloadItemData,
  TrackItemData,
  ReciterDownloadsItemData,
} from '@/components/collection/CollectionGrid';
import {PlaylistItem} from '@/components/PlaylistItem';
import {ReciterItem} from '@/components/ReciterItem';
import {TrackItem} from '@/components/TrackItem';
import {ReciterDownloadsListItem} from '@/components/ReciterDownloadsListItem';
import {useDownloads} from '@/services/player/store/downloadSelectors';
import {usePlaylists} from '@/hooks/usePlaylists';
import {useModal} from '@/components/providers/ModalProvider';
import {HeartIcon, DownloadIcon} from '@/components/Icons';
import Color from 'color';
import {TouchableOpacity} from 'react-native';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {getReciterById, getSurahById} from '@/services/dataService';
import {createDownloadedTrack} from '@/utils/track';

// Filter options
const FILTERS = [
  {id: 'playlists', label: 'Playlists'},
  {id: 'reciters', label: 'Reciters'},
  {id: 'downloads', label: 'Downloads'},
  {id: 'loved', label: 'Loved'},
];

export default function CollectionScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {lovedTracks} = useLoved();
  const {favoriteReciters} = useFavoriteReciters();

  const [activeFilter, setActiveFilter] = useState('');
  const collectionViewMode = useSettings(state => state.collectionViewMode);
  const setCollectionViewMode = useSettings(
    state => state.setCollectionViewMode,
  );
  const isGridView = collectionViewMode === 'grid';
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [, setSelectedPlaylist] = useState<{
    id: string;
    name: string;
    color?: string;
  } | null>(null);
  const shouldClearPlaylistRef = useRef(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPlaylistData, setEditPlaylistData] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const downloads = useDownloads();
  const {playlists, createPlaylist, deletePlaylist, updatePlaylist} =
    usePlaylists();
  const {showPlaylistContextMenu} = useModal();
  const {updateQueue, play} = useUnifiedPlayer();

  // Handle navigation to existing screens
  const handleNewPlaylist = () => {
    setIsEditMode(false);
    setEditPlaylistData(null);
    setShowCreatePlaylist(true);
  };

  const handleSavePlaylist = async (name: string, color: string) => {
    try {
      if (isEditMode && editPlaylistData) {
        // Edit existing playlist
        await updatePlaylist(editPlaylistData.id, {name, color});
        setEditPlaylistData(null);
        setIsEditMode(false);
      } else {
        // Create new playlist
        await createPlaylist(name, color);
      }
      // Modal will close automatically
    } catch (error: unknown) {
      console.error('Failed to save playlist:', error);
    }
  };

  const handleClosePlaylistModal = () => {
    setShowCreatePlaylist(false);
    setIsEditMode(false);
    setEditPlaylistData(null);
  };

  const handlePlaylistLongPress = useCallback(
    (playlistId: string, playlistName: string, color?: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedPlaylist({id: playlistId, name: playlistName, color});
      shouldClearPlaylistRef.current = true; // Reset flag when opening context menu

      // Create a closure that captures the playlist data for editing
      const handleEditForThisPlaylist = () => {
        // Prevent clearing selectedPlaylist BEFORE closing context menu
        shouldClearPlaylistRef.current = false;

        // Set edit mode data and open the modal
        setIsEditMode(true);
        setEditPlaylistData({
          id: playlistId,
          name: playlistName,
          color: color || '#6366F1',
        });
        setShowCreatePlaylist(true);

        // Clear the flag after modal is fully opened
        setTimeout(() => {
          shouldClearPlaylistRef.current = true;
        }, 600);
      };

      // Create a closure that captures the playlist ID for deletion
      const handleDeleteForThisPlaylist = async () => {
        try {
          await deletePlaylist(playlistId);
          setSelectedPlaylist(null);
        } catch (error: unknown) {
          console.error('Failed to delete playlist:', error);
          // Error handling is done in the confirmation dialog
        }
      };

      showPlaylistContextMenu(
        playlistId,
        playlistName,
        handleDeleteForThisPlaylist,
        handleEditForThisPlaylist,
        color,
      );
    },
    [deletePlaylist, showPlaylistContextMenu],
  );

  const handleSearch = () => {
    // Open the search modal
    setShowSearchModal(true);
  };

  const handleViewToggle = () => {
    const newMode = isGridView ? 'list' : 'grid';
    setCollectionViewMode(newMode);
  };

  // Memoize collection items to ensure re-render when dependencies change
  const collectionItems = useMemo(() => {
    const items: Array<CollectionItemType & {timestamp: number}> = [];

    // Add User Playlists
    if (activeFilter === '' || activeFilter === 'playlists') {
      if (playlists && Array.isArray(playlists)) {
        playlists.forEach(playlist => {
          items.push({
            id: playlist.id,
            type: 'playlist',
            timestamp: playlist.updatedAt || playlist.createdAt || 0,
            data: {
              name: playlist.name,
              itemCount: playlist.itemCount,
              color: playlist.color,
              onPress: () => router.push(`/playlist/${playlist.id}`),
              onLongPress: () =>
                handlePlaylistLongPress(
                  playlist.id,
                  playlist.name,
                  playlist.color,
                ),
            },
          });
        });
      }
    }

    // Add Loved Surahs Collection Card
    if (activeFilter === '' || activeFilter === 'loved') {
      // Get the most recent loved track timestamp
      const mostRecentLovedTimestamp =
        lovedTracks.length > 0
          ? Math.max(...lovedTracks.map(t => t.timestamp || 0))
          : 0;

      items.push({
        id: 'loved-collection',
        type: 'loved',
        timestamp: mostRecentLovedTimestamp,
        data: {
          name: 'Loved Surahs',
          itemCount: lovedTracks.length,
          onPress: () => router.push('/collection/loved'),
        },
      });
    }

    // Add Individual Favorite Reciters
    if (activeFilter === '' || activeFilter === 'reciters') {
      favoriteReciters.forEach(reciter => {
        items.push({
          id: `reciter-${reciter.id}`,
          type: 'reciter',
          timestamp: reciter.favoritedAt || 0,
          data: {
            name: reciter.name,
            image_url: reciter.image_url,
            onPress: () => router.push(`/reciter/${reciter.id}`),
          },
        });
      });
    }

    // Add Downloads - grouped by reciter
    if (activeFilter === '' || activeFilter === 'downloads') {
      // Group downloads by reciterId
      const downloadsByReciter = downloads.reduce(
        (acc, download) => {
          if (!acc[download.reciterId]) {
            acc[download.reciterId] = [];
          }
          acc[download.reciterId].push(download);
          return acc;
        },
        {} as Record<string, typeof downloads>,
      );

      Object.entries(downloadsByReciter).forEach(
        ([reciterId, reciterDownloads]) => {
          const mostRecentTimestamp = Math.max(
            ...reciterDownloads.map(d => d.downloadDate || 0),
          );

          if (reciterDownloads.length === 1) {
            // Single download - show as individual track
            const download = reciterDownloads[0];
            items.push({
              id: `download-${download.reciterId}-${download.surahId}-${download.rewayatId || 'default'}`,
              type: 'track',
              timestamp: download.downloadDate || 0,
              data: {
                reciterId: download.reciterId,
                surahId: download.surahId,
                rewayatId: download.rewayatId,
                onPress: async () => {
                  try {
                    const [reciter, surah] = await Promise.all([
                      getReciterById(download.reciterId),
                      getSurahById(parseInt(download.surahId, 10)),
                    ]);

                    if (reciter && surah) {
                      const track = createDownloadedTrack(
                        reciter,
                        surah,
                        download.filePath,
                        download.rewayatId,
                      );
                      await updateQueue([track], 0);
                      await play();
                    }
                  } catch (error) {
                    console.error('Error playing downloaded track:', error);
                  }
                },
              },
            });
          } else {
            // Multiple downloads from same reciter - show as stacked card
            items.push({
              id: `reciter-downloads-${reciterId}`,
              type: 'reciter-downloads',
              timestamp: mostRecentTimestamp,
              data: {
                reciterId,
                downloadCount: reciterDownloads.length,
                onPress: () =>
                  router.push(`/collection/reciter-downloads/${reciterId}`),
              },
            });
          }
        },
      );
    }

    // Sort by most recent first (descending order: highest timestamp at top)
    // b.timestamp - a.timestamp means newer items (higher timestamp) come first
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [
    playlists,
    lovedTracks,
    favoriteReciters,
    downloads,
    activeFilter,
    router,
    handlePlaylistLongPress,
    updateQueue,
    play,
  ]);

  // Get existing playlist colors to avoid duplicates
  const existingPlaylistColors = useMemo(
    () => playlists.map(p => p.color).filter(Boolean) as string[],
    [playlists],
  );

  // Render function for list items
  const renderListItem = (item: CollectionItemType) => {
    switch (item.type) {
      case 'playlist': {
        const playlistData = item.data as PlaylistItemData;
        return (
          <PlaylistItem
            key={item.id}
            id={item.id}
            name={playlistData.name}
            itemCount={playlistData.itemCount}
            color={playlistData.color}
            onPress={playlistData.onPress}
            onLongPress={playlistData.onLongPress}
          />
        );
      }
      case 'loved': {
        const lovedData = item.data as LovedItemData;
        const lovedColor = '#FF6B6B';
        return (
          <View key={item.id} style={styles.listItemWrapper}>
            <TouchableOpacity
              activeOpacity={0.99}
              onPress={lovedData.onPress}
              style={styles.listItem}>
              <View
                style={[
                  styles.listItemIcon,
                  {
                    backgroundColor: Color(lovedColor).alpha(0.15).toString(),
                    borderColor: Color(lovedColor).alpha(0.3).toString(),
                  },
                ]}>
                <HeartIcon
                  color={lovedColor}
                  size={moderateScale(24)}
                  filled={true}
                />
              </View>
              <View style={styles.listItemInfo}>
                <Text style={[styles.listItemName, {color: theme.colors.text}]}>
                  Loved Surahs
                </Text>
                <Text
                  style={[
                    styles.listItemSubtitle,
                    {color: theme.colors.textSecondary},
                  ]}
                  numberOfLines={1}>
                  Loved • {lovedData.itemCount}{' '}
                  {lovedData.itemCount === 1 ? 'surah' : 'surahs'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        );
      }
      case 'reciter': {
        const reciterData = item.data as ReciterItemData;
        return (
          <ReciterItem
            key={item.id}
            item={{
              id: item.id.replace('reciter-', ''),
              name: reciterData.name,
              rewayat: [],
              image_url: reciterData.image_url,
              date: '',
            }}
            onPress={() => reciterData.onPress()}
            secondaryText="Favorite"
          />
        );
      }
      case 'download': {
        const downloadData = item.data as DownloadItemData;
        const downloadColor = '#10AC84';
        return (
          <View key={item.id} style={styles.listItemWrapper}>
            <TouchableOpacity
              activeOpacity={0.99}
              onPress={downloadData.onPress}
              style={styles.listItem}>
              <View
                style={[
                  styles.listItemIcon,
                  {
                    backgroundColor: Color(downloadColor)
                      .alpha(0.15)
                      .toString(),
                    borderColor: Color(downloadColor).alpha(0.3).toString(),
                  },
                ]}>
                <DownloadIcon color={downloadColor} size={moderateScale(24)} />
              </View>
              <View style={styles.listItemInfo}>
                <Text style={[styles.listItemName, {color: theme.colors.text}]}>
                  Downloads
                </Text>
                <Text
                  style={[
                    styles.listItemSubtitle,
                    {color: theme.colors.textSecondary},
                  ]}
                  numberOfLines={1}>
                  Downloaded • {downloadData.itemCount}{' '}
                  {downloadData.itemCount === 1 ? 'surah' : 'surahs'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        );
      }
      case 'track': {
        const trackData = item.data as TrackItemData;
        return (
          <TrackItem
            key={item.id}
            reciterId={trackData.reciterId}
            surahId={trackData.surahId}
            rewayatId={trackData.rewayatId}
            onPress={trackData.onPress}
            onPlayPress={trackData.onPress}
          />
        );
      }
      case 'reciter-downloads': {
        const reciterDownloadsData = item.data as ReciterDownloadsItemData;
        return (
          <ReciterDownloadsListItem
            key={item.id}
            reciterId={reciterDownloadsData.reciterId}
            downloadCount={reciterDownloadsData.downloadCount}
            onPress={reciterDownloadsData.onPress}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: 0}]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            blurAmount={10}
            blurType={theme.isDarkMode ? 'dark' : 'light'}
            style={[styles.blurContainer]}>
            <View
              style={[
                styles.overlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              styles.blurContainer,
              {
                backgroundColor: theme.colors.background,
                opacity: 0.95,
              },
            ]}>
            <View
              style={[
                styles.overlay,
                {
                  backgroundColor: theme.colors.background,
                },
              ]}
            />
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={{paddingTop: insets.top}} />

        {/* Header */}
        <CollectionHeader
          title="Your Collection"
          onNewPlaylistPress={handleNewPlaylist}
          onSearchPress={handleSearch}
          theme={theme}
        />

        {/* Filter Bar */}
        <FilterBar
          filters={FILTERS}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          theme={theme}
        />

        {/* Section Header */}
        <SectionHeader
          title="Your Library"
          onViewToggle={handleViewToggle}
          isGridView={isGridView}
          theme={theme}
        />

        {/* Collection Items */}
        {isGridView ? (
          <CollectionGrid items={collectionItems} theme={theme} />
        ) : (
          <View style={styles.listContainer}>
            {collectionItems.map(item => renderListItem(item))}
          </View>
        )}

        <View style={{height: moderateScale(100)}} />
      </ScrollView>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        visible={showCreatePlaylist}
        onClose={handleClosePlaylistModal}
        onCreatePlaylist={handleSavePlaylist}
        theme={theme}
        existingColors={existingPlaylistColors}
        isEditMode={isEditMode}
        initialName={editPlaylistData?.name}
        initialColor={editPlaylistData?.color}
      />

      {/* Collection Search Modal - DEEP SEARCH */}
      <CollectionSearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        theme={theme}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: moderateScale(56),
      zIndex: 100,
    },
    blurContainer: {
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.85,
    },
    content: {
      flex: 1,
    },
    listContainer: {
      paddingVertical: moderateScale(8),
    },
    listItemWrapper: {
      paddingHorizontal: moderateScale(18),
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
    },
    listItemIcon: {
      width: moderateScale(50),
      height: moderateScale(50),
      marginRight: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: moderateScale(10),
      borderWidth: moderateScale(1),
    },
    listItemInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    listItemName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      marginBottom: moderateScale(1),
    },
    listItemSubtitle: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
    },
  });
