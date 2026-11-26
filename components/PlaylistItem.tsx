import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {MaterialIcons, Feather} from '@expo/vector-icons';
import {PlaylistIcon} from '@/components/Icons';
import Color from 'color';
import {
  PANEL_ART_GAP,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
} from '@/components/collection/CollectionPanel'; // @ai
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface PlaylistItemProps {
  id: string;
  name: string;
  itemCount: number;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onOptionsPress?: () => void;
  /** A native menu laid over the ••• button on tablets. @ai */
  optionsMenu?: React.ReactNode;
  isSelected?: boolean;
  /** Drawn in place of the tinted icon, e.g. the playlist's mosaic. @ai */
  art?: React.ReactNode;
  /** Just the surah count, on screens that only list playlists. @ai */
  countOnly?: boolean;
}

// @ai-start
export const PlaylistItem: React.FC<PlaylistItemProps> = React.memo(
  ({
    name,
    itemCount,
    color,
    onPress,
    onLongPress,
    onOptionsPress,
    optionsMenu,
    isSelected,
    art,
    countOnly,
  }) => {
    const {theme} = useTheme();
    const {t} = useTranslation(['collection', 'common']);
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
      <Pressable
        style={[
          styles.playlistItem,
          art ? styles.panelItem : null, // @ai
          isSelected && styles.selectedPlaylistItem,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}>
        {art ? (
          <View style={styles.artContainer}>{art}</View>
        ) : (
          <View
            style={[
              styles.iconContainer,
              {backgroundColor, borderColor},
              isSelected && styles.selectedIconContainer,
            ]}>
            <PlaylistIcon color={playlistColor} size={moderateScale(24)} />
          </View>
        )}
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName}>{name}</Text>
          <Text style={styles.playlistSubtitle} numberOfLines={1}>
            {countOnly
              ? t('common:counts.surahs', {count: itemCount})
              : t('playlistItem.subtitle', {
                  surahs: t('common:counts.surahs', {count: itemCount}),
                })}
          </Text>
        </View>
        {onOptionsPress && !isSelected && (
          <Pressable
            style={styles.optionsButton}
            onPress={onOptionsPress}
            hitSlop={8}>
            <Feather
              name="more-horizontal"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
            {optionsMenu}
          </Pressable>
        )}
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <MaterialIcons
              name="check"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
          </View>
        )}
      </Pressable>
    );
  },
);
// @ai-end

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
    artContainer: {
      width: PANEL_ART_SIZE,
      height: PANEL_ART_SIZE,
      marginEnd: PANEL_ART_GAP,
    },
    panelItem: {
      paddingVertical: PANEL_ROW_VERTICAL,
      paddingStart: PANEL_ROW_PADDING,
      paddingEnd: moderateScale(4),
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
    optionsButton: {
      padding: moderateScale(8),
    },
    checkmarkContainer: {
      marginLeft: moderateScale(8),
    },
  });
