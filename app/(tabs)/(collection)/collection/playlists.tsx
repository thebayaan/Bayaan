import React from 'react';
import {View, Text, FlatList, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ReciterCard} from '@/components/cards/ReciterCard';
import {useRouter} from 'expo-router';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';

interface Playlist {
  id: string;
  name: string;
  imageUrl: string;
}

// Mock data for playlists (replace with actual data source later)
const mockPlaylists: Playlist[] = [
  {
    id: '1',
    name: 'My Favorite Surahs',
    imageUrl: 'https://example.com/image1.jpg',
  },
  {
    id: '2',
    name: 'Ramadan Collection',
    imageUrl: 'https://example.com/image2.jpg',
  },
  // Add more mock playlists as needed
];

export default function PlaylistsScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handlePlaylistPress = (playlistId: string) => {
    // Navigate to playlist details screen (to be implemented)
    router.push(`/playlist/${playlistId}`);
  };

  const renderItem = ({item}: {item: Playlist}) => (
    <ReciterCard
      imageUrl={item.imageUrl}
      name={item.name}
      onPress={() => handlePlaylistPress(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Playlists</Text>
        </View>
      </View>
      <FlatList
        data={mockPlaylists}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No playlists yet</Text>
        }
        ListHeaderComponent={
          <TouchableOpacity
            activeOpacity={0.99}
            style={styles.createPlaylistButton}
            onPress={() => {
              /* Handle create playlist */
            }}>
            <Icon
              name="add"
              type="ionicon"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
            <Text style={styles.createPlaylistText}>Create New Playlist</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}
