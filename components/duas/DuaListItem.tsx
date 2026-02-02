import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {HeartIcon} from '@/components/Icons';
import {Dua} from '@/types/dua';
import Color from 'color';

interface DuaListItemProps {
  dua: Dua;
  index: number;
  isFavorite: boolean;
  onPress: () => void;
  onFavoritePress: () => void;
}

export const DuaListItem: React.FC<DuaListItemProps> = React.memo(
  ({dua, index, isFavorite, onPress, onFavoritePress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const handleFavoritePress = React.useCallback(
      (e: GestureResponderEvent) => {
        e.stopPropagation();
        onFavoritePress();
      },
      [onFavoritePress],
    );

    const displayNumber = index + 1;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.container}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Dua ${displayNumber}, ${dua.translation || dua.arabic}`}
        accessibilityHint="Tap to view dua details">
        {/* Left side - Index badge */}
        <View style={styles.indexContainer}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{displayNumber}</Text>
          </View>
        </View>

        {/* Middle content */}
        <View style={styles.contentContainer}>
          {/* Arabic text */}
          {dua.arabic ? (
            <Text
              style={styles.arabicText}
              numberOfLines={1}
              ellipsizeMode="tail">
              {dua.arabic}
            </Text>
          ) : null}

          {/* Translation */}
          {dua.translation ? (
            <Text
              style={styles.translationText}
              numberOfLines={2}
              ellipsizeMode="tail">
              {dua.translation}
            </Text>
          ) : null}

          {/* Repeat indicator */}
          {dua.repeatCount > 1 ? (
            <View style={styles.repeatContainer}>
              <Text style={styles.repeatText}>Repeat {dua.repeatCount}x</Text>
            </View>
          ) : null}
        </View>

        {/* Right side - Favorite button */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          accessibilityState={{selected: isFavorite}}>
          <HeartIcon
            size={moderateScale(20)}
            color={
              isFavorite ? theme.colors.primary : theme.colors.textSecondary
            }
            filled={isFavorite}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
);

DuaListItem.displayName = 'DuaListItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      marginHorizontal: moderateScale(16),
      marginVertical: moderateScale(6),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.15).toString(),
    },
    indexContainer: {
      marginRight: moderateScale(12),
    },
    indexBadge: {
      width: moderateScale(28),
      height: moderateScale(28),
      borderRadius: moderateScale(14),
      backgroundColor: Color(theme.colors.primary).alpha(0.15).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
    indexText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.primary,
    },
    contentContainer: {
      flex: 1,
      marginRight: moderateScale(12),
    },
    arabicText: {
      fontSize: moderateScale(17),
      fontFamily: 'QPC',
      color: theme.colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginBottom: moderateScale(6),
      lineHeight: moderateScale(28),
    },
    translationText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(18),
    },
    repeatContainer: {
      marginTop: moderateScale(8),
      alignSelf: 'flex-start',
      backgroundColor: Color(theme.colors.primary).alpha(0.1).toString(),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(3),
      borderRadius: moderateScale(4),
    },
    repeatText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: theme.colors.primary,
    },
    favoriteButton: {
      padding: moderateScale(4),
    },
  });
