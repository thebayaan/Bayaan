import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {PlaylistIcon} from '@/components/Icons';
import Color from 'color';

interface PlaylistItemProps {
  id: string;
  name: string;
  itemCount: number;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = React.memo(
  ({name, itemCount, color, onPress, onLongPress, isSelected}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const handlePress = React.useCallback(() => onPress(), [onPress]);
    const handleLongPress = React.useCallback(
      () => onLongPress?.(),
      [onLongPress],
    );

    const playlistColor = color || theme.colors.primary;
    const backgroundColor = Color(playlistColor).alpha(0.15).toString();
    const borderColor = Color(playlistColor).alpha(0.3).toString();

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={[styles.playlistItem, isSelected && styles.selectedPlaylistItem]}
        onPress={handlePress}
        onLongPress={handleLongPress}>
        <View
          style={[
            styles.iconContainer,
            {backgroundColor, borderColor},
            isSelected && styles.selectedIconContainer,
          ]}>
          <PlaylistIcon color={playlistColor} size={moderateScale(24)} />
        </View>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName}>{name}</Text>
          <Text style={styles.playlistSubtitle} numberOfLines={1}>
            Playlist • {itemCount} {itemCount === 1 ? 'surah' : 'surahs'}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Icon
              name="check"
              type="material"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

PlaylistItem.displayName = 'PlaylistItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    playlistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(18),
    },
    iconContainer: {
      width: moderateScale(50),
      height: moderateScale(50),
      marginRight: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: moderateScale(10),
      borderWidth: moderateScale(1),
    },
    playlistInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    playlistName: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      marginBottom: moderateScale(1),
    },
    playlistSubtitle: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    selectedPlaylistItem: {
      borderRadius: moderateScale(10),
    },
    selectedIconContainer: {
      borderWidth: moderateScale(2),
    },
    checkmarkContainer: {
      marginLeft: moderateScale(8),
    },
  });
