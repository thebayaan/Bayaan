import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {PlaylistIcon, HeartIcon} from '@/components/Icons';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {usePlaylists} from '@/hooks/usePlaylists';
import {useLoved} from '@/hooks/useLoved';
import {PlaylistItem} from '@/components/PlaylistItem';
import {Icon} from '@rneui/themed';
import Color from 'color';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const SelectPlaylistSheet = (props: SheetProps<'select-playlist'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {playlists, createPlaylist, addToPlaylist} = usePlaylists();
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const [isCreating, setIsCreating] = useState(false);

  const payload = props.payload;
  const surah = payload?.surah;
  const reciterId = payload?.reciterId ?? '';
  const rewayatId = payload?.rewayatId;

  // Calculate loved state
  const isLovedState = reciterId
    ? rewayatId
      ? isLovedWithRewayat(reciterId, surah?.id?.toString() ?? '', rewayatId)
      : isLoved(reciterId, surah?.id?.toString() ?? '')
    : false;

  const handleClose = useCallback(() => {
    SheetManager.hide('select-playlist');
  }, []);

  // Handle playlist selection
  const handlePlaylistSelect = useCallback(
    async (playlistId: string) => {
      if (!surah) return;
      try {
        await addToPlaylist(
          playlistId,
          surah.id.toString(),
          reciterId,
          rewayatId,
        );

        console.log(`Added ${surah.name} to playlist`);
        handleClose();
      } catch (error) {
        console.error('Failed to add to playlist:', error);
        Alert.alert('Error', 'Failed to add surah to playlist');
      }
    },
    [surah, reciterId, rewayatId, addToPlaylist, handleClose],
  );

  // Get existing playlist colors for unique color selection
  const existingColors = playlists.map(p => p.color);

  // Handle showing create playlist sheet
  const handleShowCreatePlaylist = useCallback(async () => {
    if (!surah) return;

    const result = await SheetManager.show('create-playlist', {
      payload: {
        existingColors,
      },
    });

    if (result?.name && result?.color) {
      try {
        setIsCreating(true);
        const newPlaylist = await createPlaylist(result.name, result.color);

        // Small delay to ensure previous transaction is committed
        await new Promise(resolve => setTimeout(resolve, 50));

        // Add the surah to the new playlist
        await addToPlaylist(
          newPlaylist.id,
          surah.id.toString(),
          reciterId,
          rewayatId,
        );

        console.log(
          `Created playlist "${result.name}" and added ${surah.name}`,
        );
        handleClose();
      } catch (error) {
        console.error('Failed to create playlist:', error);
        Alert.alert('Error', 'Failed to create playlist');
      } finally {
        setIsCreating(false);
      }
    }
  }, [
    surah,
    reciterId,
    rewayatId,
    existingColors,
    createPlaylist,
    addToPlaylist,
    handleClose,
  ]);

  const handleToggleLoved = useCallback(() => {
    if (!reciterId || !surah) return;
    toggleLoved(reciterId, surah.id.toString(), rewayatId || '');
  }, [reciterId, surah, rewayatId, toggleLoved]);

  if (!surah) {
    return null;
  }

  return (
    <>
      <ActionSheet
        id={props.sheetId}
        containerStyle={styles.sheetContainer}
        indicatorStyle={styles.indicator}
        gestureEnabled={true}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Add to Collection</Text>
        </View>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.surahName}>{surah.name}</Text>
            <Text style={styles.surahTranslation}>
              {surah.translated_name_english}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}>
            {/* Add to Loved Option */}
            {reciterId && (
              <TouchableOpacity
                style={[
                  styles.lovedOption,
                  isLovedState && styles.lovedOptionActive,
                ]}
                onPress={handleToggleLoved}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.lovedIconContainer,
                    isLovedState && styles.lovedIconContainerActive,
                  ]}>
                  <HeartIcon
                    color={isLovedState ? '#FF6B6B' : theme.colors.text}
                    size={moderateScale(24)}
                    filled={isLovedState}
                  />
                </View>
                <Text
                  style={[
                    styles.lovedText,
                    isLovedState && styles.lovedTextActive,
                  ]}>
                  Loved
                </Text>
              </TouchableOpacity>
            )}

            {/* Create New Playlist Button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleShowCreatePlaylist}
              activeOpacity={0.7}
              disabled={isCreating}>
              <View style={styles.createButtonContent}>
                <Icon
                  name="plus"
                  type="feather"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create New Playlist'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Existing Playlists */}
            {playlists.length > 0 && (
              <View style={styles.playlistsContainer}>
                <Text style={styles.sectionTitle}>Your Playlists</Text>
                {playlists.map(playlist => (
                  <PlaylistItem
                    key={playlist.id}
                    id={playlist.id}
                    name={playlist.name}
                    itemCount={playlist.itemCount}
                    color={playlist.color}
                    onPress={() => handlePlaylistSelect(playlist.id)}
                  />
                ))}
              </View>
            )}

            {playlists.length === 0 && (
              <View style={styles.emptyState}>
                <PlaylistIcon
                  color={theme.colors.textSecondary}
                  size={moderateScale(40)}
                  filled={false}
                />
                <Text style={styles.emptyStateText}>
                  No playlists yet. Create your first playlist above!
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ActionSheet>
    </>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      height: SCREEN_HEIGHT * 0.75,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    container: {
      flex: 1,
      paddingHorizontal: moderateScale(16),
    },
    header: {
      alignItems: 'center',
      marginVertical: moderateScale(16),
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    surahTranslation: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    lovedOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      marginBottom: moderateScale(16),
      borderWidth: 1,
      borderColor: 'transparent',
    },
    lovedOptionActive: {
      backgroundColor: Color('#FF6B6B').alpha(0.08).toString(),
      borderColor: Color('#FF6B6B').alpha(0.2).toString(),
    },
    lovedIconContainer: {
      width: moderateScale(50),
      height: moderateScale(50),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    lovedIconContainerActive: {
      backgroundColor: Color('#FF6B6B').alpha(0.15).toString(),
    },
    lovedText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    lovedTextActive: {
      color: '#FF6B6B',
    },
    createButton: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      marginBottom: moderateScale(20),
    },
    createButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    createButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    playlistsContainer: {
      marginBottom: moderateScale(20),
      marginHorizontal: moderateScale(-15),
    },
    sectionTitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      marginHorizontal: moderateScale(15),
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(8),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: moderateScale(40),
      gap: moderateScale(12),
    },
    emptyStateText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
