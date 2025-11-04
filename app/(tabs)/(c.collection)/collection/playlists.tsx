import React from 'react';
import {View, Text, FlatList, TouchableOpacity} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PlaylistCard} from '@/components/cards/PlaylistCard';
import {useRouter} from 'expo-router';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import {usePlaylists} from '@/hooks/usePlaylists';

export default function PlaylistsScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {playlists} = usePlaylists();

  const handlePlaylistPress = (playlistId: string) => {
    router.push(`/playlist/${playlistId}`);
  };

  const renderItem = ({item}: {item: (typeof playlists)[0]}) => (
    <PlaylistCard
      name={item.name}
      itemCount={item.itemCount}
      color={item.color}
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
        data={playlists}
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
