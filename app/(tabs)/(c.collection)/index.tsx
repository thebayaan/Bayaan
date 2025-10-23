import React, {useState} from 'react';
import {
  View,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {moderateScale, ScaledSheet} from 'react-native-size-matters';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {Theme} from '@/utils/themeUtils';
import {BlurView} from '@react-native-community/blur';

// Components
import {CollectionHeader} from '@/components/collection/CollectionHeader';
import {FilterBar} from '@/components/collection/FilterBar';
import {SectionHeader} from '@/components/collection/SectionHeader';
import {CollectionItem} from '@/components/collection/CollectionItem';
import {GridItem} from '@/components/collection/GridItem';
import {CreatePlaylistModal} from '@/components/collection/CreatePlaylistModal';
import {useDownload} from '@/services/player/store/downloadStore';
import {usePlaylists} from '@/hooks/usePlaylists';


// Filter options
const FILTERS = [
  {id: 'all', label: 'All'},
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
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [isGridView, setIsGridView] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const {downloads} = useDownload();
  const {playlists, createPlaylist, loading: playlistsLoading} = usePlaylists();

  // Handle navigation to existing screens
  const handleNewPlaylist = () => {
    setShowCreatePlaylist(true);
  };

  const handleCreatePlaylist = async (name: string, color: string) => {
    try {
      await createPlaylist(name, color);
      // Modal will close automatically
    } catch (error) {
      console.error('Failed to create playlist:', error);
      // TODO: Show error message to user
    }
  };

  const handleSearch = () => {
    // TODO: Implement search
    console.log('Search pressed');
  };

  const handleViewToggle = () => {
    setIsGridView(!isGridView);
  };

  // Get collection items based on filter
  const getCollectionItems = () => {
    const items = [];

    // Add User Playlists
    if (activeFilter === 'all' || activeFilter === 'playlists') {
      if (playlists && Array.isArray(playlists)) {
        playlists.forEach(playlist => {
          items.push({
            id: playlist.id,
            title: playlist.name,
            subtitle: `Playlist • ${playlist.itemCount} surahs`,
          iconName: 'book-open',
          iconType: 'feather',
            color: playlist.color,
            onPress: () => router.push(`/playlist/${playlist.id}`),
          });
        });
      }
    }

    // Add Loved Surahs
    if (activeFilter === 'all' || activeFilter === 'loved') {
      items.push({
        id: 'loved',
        title: 'Loved Surahs',
        subtitle: `Loved • ${lovedTracks.length} surahs`,
        iconName: 'heart',
        iconType: 'feather',
        color: undefined,
        onPress: () => router.push('/collection/loved'),
      });
    }

    // Add Favorite Reciters
    if (activeFilter === 'all' || activeFilter === 'reciters') {
      items.push({
        id: 'favorite-reciters',
        title: 'Favorite Reciters',
        subtitle: `Favorite • ${favoriteReciters.length} reciters`,
        iconName: 'user',
        iconType: 'feather',
        color: undefined,
        onPress: () => router.push('/collection/favorite-reciters'),
      });
    }

    // Add Downloads
    if (activeFilter === 'all' || activeFilter === 'downloads') {
      items.push({
        id: 'downloads',
        title: 'Downloads',
        subtitle: `Downloaded • ${downloads.length} surahs`,
        iconName: 'download',
        iconType: 'feather',
        color: undefined,
        onPress: () => router.push('/collection/downloads'),
      });
    }

    return items;
  };

  const collectionItems = getCollectionItems();

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
      
      <ScrollView style={styles.content}>
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
          <View style={styles.gridContainer}>
            {collectionItems.map((item, index) => (
              <GridItem
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                iconName={item.iconName}
                iconType={item.iconType}
                onPress={item.onPress}
                theme={theme}
                isLarge={index === 0 && item.id === 'loved'} // Make "Loved Surahs" large like Spotify
              />
            ))}
          </View>
        ) : (
          collectionItems.map(item => (
            <CollectionItem
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              iconName={item.iconName}
              iconType={item.iconType}
              color={item.color}
              onPress={item.onPress}
              theme={theme}
            />
          ))
        )}
        
        <View style={{height: moderateScale(100)}} />
      </ScrollView>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        visible={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onCreatePlaylist={handleCreatePlaylist}
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
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
    },
  });
