import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Dhikr} from '@/types/adhkar';
import Color from 'color';
import {Icon} from '@rneui/themed';

interface DhikrListItemProps {
  dhikr: Dhikr;
  index: number;
  onPress: () => void;
}

export const DhikrListItem: React.FC<DhikrListItemProps> = React.memo(
  ({dhikr, index, onPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const displayNumber = index + 1;

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.container}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Dhikr ${displayNumber}, ${dhikr.translation || dhikr.arabic}`}
        accessibilityHint="Tap to view dhikr details">
        {/* Left side - Index number */}
        <View style={styles.indexContainer}>
          <Text style={styles.indexText}>{displayNumber}</Text>
        </View>

        {/* Middle content */}
        <View style={styles.contentContainer}>
          {/* Arabic text */}
          {dhikr.arabic ? (
            <Text
              style={styles.arabicText}
              numberOfLines={1}
              ellipsizeMode="tail">
              {dhikr.arabic}
            </Text>
          ) : null}

          {/* Translation */}
          {dhikr.translation ? (
            <Text
              style={styles.translationText}
              numberOfLines={2}
              ellipsizeMode="tail">
              {dhikr.translation}
            </Text>
          ) : null}

          {/* Repeat indicator */}
          {dhikr.repeatCount > 1 ? (
            <View style={styles.repeatContainer}>
              <Text style={styles.repeatText}>{dhikr.repeatCount}x</Text>
            </View>
          ) : null}
        </View>

        {/* Right side - Chevron */}
        <View style={styles.chevronContainer}>
          <Icon
            name="chevron-right"
            type="feather"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  },
);

DhikrListItem.displayName = 'DhikrListItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: moderateScale(12),
      padding: moderateScale(14),
      marginHorizontal: moderateScale(16),
      marginVertical: moderateScale(5),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    indexContainer: {
      width: moderateScale(28),
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    indexText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    contentContainer: {
      flex: 1,
      marginRight: moderateScale(8),
    },
    arabicText: {
      fontSize: moderateScale(17),
      fontFamily: 'QPC',
      color: theme.colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginBottom: moderateScale(6),
      lineHeight: moderateScale(38),
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
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.1).toString(),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(3),
      borderRadius: moderateScale(4),
    },
    repeatText: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    chevronContainer: {
      opacity: 0.5,
    },
  });
