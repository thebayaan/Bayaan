import React, {useCallback, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import {PlaylistIcon} from '@/components/Icons';
import Color from 'color';
import {useUploadsStore} from '@/store/uploadsStore';
import {usePlaylists} from '@/hooks/usePlaylists';
import {pickAndImportAudioFiles} from '@/utils/importAudio';

export const AddToCollectionSheet = (
  props: SheetProps<'add-to-collection'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {importFile, importFiles} = useUploadsStore();
  const {playlists, createPlaylist} = usePlaylists();

  const existingPlaylistColors = useMemo(
    () => playlists.map(p => p.color).filter(Boolean) as string[],
    [playlists],
  );

  const handleClose = useCallback(() => {
    SheetManager.hide('add-to-collection');
  }, []);

  const handleAddFavoriteReciter = useCallback(() => {
    handleClose();
    setTimeout(() => {
      SheetManager.show('favorite-reciters');
    }, 300);
  }, [handleClose]);

  const handleNewPlaylist = useCallback(async () => {
    handleClose();
    setTimeout(async () => {
      const result = await SheetManager.show('create-playlist', {
        payload: {
          existingColors: existingPlaylistColors,
        },
      });

      if (result?.name && result?.color) {
        try {
          await createPlaylist(result.name, result.color);
        } catch (error) {
          console.error('Failed to create playlist:', error);
        }
      }
    }, 300);
  }, [handleClose, existingPlaylistColors, createPlaylist]);

  const handleNewUpload = useCallback(async () => {
    handleClose();
    setTimeout(async () => {
      try {
        await pickAndImportAudioFiles({
          importFile,
          importFiles,
        });
      } catch (error) {
        console.error('Error importing files:', error);
      }
    }, 300);
  }, [handleClose, importFile, importFiles]);

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add to Collection</Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleNewUpload}>
            <Feather
              name="mic"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Upload Recitation</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleNewPlaylist}>
            <PlaylistIcon color={theme.colors.text} size={moderateScale(18)} />
            <Text style={styles.optionText}>Create New Playlist</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleAddFavoriteReciter}>
            <Feather
              name="star"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
            <Text style={styles.optionText}>Add Favorite Reciter</Text>
          </Pressable>
        </View>
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(4),
      marginBottom: moderateScale(14),
    },
    title: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(10),
    },
  });
