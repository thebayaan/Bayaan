import React, {useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PlaylistItem} from '@/components/PlaylistItem';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {usePlaylists} from '@/hooks/usePlaylists';
import {PlaylistIcon} from '@/components/Icons';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {SheetManager} from 'react-native-actions-sheet';
import Color from 'color';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';

export default function PlaylistsScreen() {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {playlists, createPlaylist, deletePlaylist, updatePlaylist} =
    usePlaylists();

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  useCollectionNativeHeader({
    title: 'Playlists',
    scrollY,
    hasContent: playlists.length > 0,
  });

  const existingColors = useMemo(
    () => playlists.map(p => p.color),
    [playlists],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        headerContainer: {
          width: '100%',
          overflow: 'hidden',
        },
        contentArea: {
          width: '100%',
          alignItems: 'center',
          paddingTop: USE_GLASS
            ? moderateScale(16)
            : insets.top + moderateScale(40),
          paddingBottom: moderateScale(30),
          overflow: 'hidden',
          backgroundColor: theme.colors.background,
        },
        contentCenter: {
          alignItems: 'center',
          paddingHorizontal: moderateScale(20),
        },
        heroIconContainer: {
          width: moderateScale(64),
          height: moderateScale(64),
          borderRadius: moderateScale(32),
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.1)
            .toString(),
        },
        heroIconInner: {
          width: moderateScale(56),
          height: moderateScale(56),
          borderRadius: moderateScale(28),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
        },
        title: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
          letterSpacing: -0.3,
        },
        subtitle: {
          fontSize: moderateScale(12),
          color: theme.colors.text,
          fontFamily: theme.fonts.regular,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        createBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: moderateScale(12),
          marginHorizontal: moderateScale(16),
          marginTop: moderateScale(8),
          marginBottom: moderateScale(8),
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          gap: moderateScale(8),
        },
        createBarText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
        listContentContainer: {
          flexGrow: 1,
          paddingBottom: moderateScale(65),
        },
        fixedBackButton: {
          position: 'absolute',
          top: insets.top + moderateScale(10),
          left: moderateScale(15),
          zIndex: 5,
          padding: moderateScale(8),
        },
        emptyHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: moderateScale(12),
          paddingHorizontal: moderateScale(16),
        },
        emptyHeaderBack: {
          width: moderateScale(36),
          height: moderateScale(36),
          justifyContent: 'center',
          alignItems: 'center',
        },
        emptyHeaderTitle: {
          flex: 1,
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
        },
        emptyContent: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: moderateScale(32),
          paddingBottom: moderateScale(60),
        },
        emptyIcon: {
          marginBottom: moderateScale(16),
        },
        emptyTitle: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        emptySubtitle: {
          fontSize: moderateScale(13),
          fontFamily: theme.fonts.regular,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginBottom: moderateScale(20),
        },
        emptyActionBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: moderateScale(12),
          paddingHorizontal: moderateScale(32),
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          gap: moderateScale(8),
        },
        emptyActionText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
      }),
    [theme, insets.top],
  );

  const handlePlaylistPress = useCallback(
    (playlistId: string) => {
      router.push(`/playlist/${playlistId}`);
    },
    [router],
  );

  const handlePlaylistOptions = useCallback(
    (item: (typeof playlists)[0]) => {
      const handleEdit = async () => {
        const result = await SheetManager.show('create-playlist', {
          payload: {
            existingColors,
            isEditMode: true,
            initialName: item.name,
            initialColor: item.color || '#6366F1',
          },
        });
        if (result?.name && result?.color) {
          await updatePlaylist(item.id, {
            name: result.name,
            color: result.color,
          });
        }
      };
      const handleDelete = async () => {
        await deletePlaylist(item.id);
      };
      SheetManager.show('playlist-context', {
        payload: {
          playlistId: item.id,
          playlistName: item.name,
          playlistColor: item.color,
          onDelete: handleDelete,
          onEdit: handleEdit,
        },
      });
    },
    [existingColors, updatePlaylist, deletePlaylist],
  );

  const handleCreatePlaylist = useCallback(async () => {
    const result = await SheetManager.show('create-playlist', {
      payload: {existingColors},
    });
    if (result?.name && result?.color) {
      await createPlaylist(result.name, result.color);
    }
  }, [existingColors, createPlaylist]);

  const renderItem = useCallback(
    ({item}: {item: (typeof playlists)[0]}) => (
      <PlaylistItem
        id={item.id}
        name={item.name}
        itemCount={item.itemCount}
        color={item.color}
        onPress={() => handlePlaylistPress(item.id)}
        onLongPress={() => handlePlaylistOptions(item)}
        onOptionsPress={() => handlePlaylistOptions(item)}
      />
    ),
    [handlePlaylistPress, handlePlaylistOptions],
  );

  if (playlists.length === 0) {
    return (
      <View style={styles.container}>
        {!USE_GLASS && (
          <View style={[styles.emptyHeader, {paddingTop: insets.top}]}>
            <Pressable
              style={styles.emptyHeaderBack}
              onPress={() => router.back()}
              hitSlop={8}>
              <Feather
                name="arrow-left"
                size={moderateScale(22)}
                color={theme.colors.text}
              />
            </Pressable>
            <Text style={styles.emptyHeaderTitle}>Playlists</Text>
            <View style={styles.emptyHeaderBack} />
          </View>
        )}
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <PlaylistIcon
              color={theme.colors.textSecondary}
              size={moderateScale(48)}
            />
          </View>
          <Text style={styles.emptyTitle}>No playlists yet</Text>
          <Text style={styles.emptySubtitle}>
            Create playlists to see them here
          </Text>
          <Pressable
            style={styles.emptyActionBar}
            onPress={handleCreatePlaylist}>
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyActionText}>Create New Playlist</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ListHeaderComponent = () => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.contentArea}>
          <View style={styles.contentCenter}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconInner}>
                <PlaylistIcon
                  color={theme.colors.text}
                  size={moderateScale(30)}
                />
              </View>
            </View>
            <Text style={styles.title}>Playlists</Text>
            <Text style={styles.subtitle}>
              {playlists.length}{' '}
              {playlists.length === 1 ? 'playlist' : 'playlists'}
            </Text>
          </View>
        </View>

        <Pressable style={styles.createBar} onPress={handleCreatePlaylist}>
          <Feather
            name="plus"
            size={moderateScale(16)}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.createBarText}>Create New Playlist</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!USE_GLASS && (
        <RNAnimated.View
          style={[
            styles.fixedBackButton,
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={playlists}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.listContentContainer}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader title="Playlists" scrollY={scrollY} />
      )}
    </View>
  );
}
