// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useHover} from '@/hooks/useHover';
import {useTheme} from '@/hooks/useTheme';
import {localizeDigits} from '@/i18n/format';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {useQuranVerseLabel} from './quranVerseLabel';

export interface RecentVerseRowProps {
  /** Hafs verse key, 'S:A'. */
  verseKey: string;
  onPress: () => void;
}

/**
 * An ayah opened from the Quran search, in the Search tab's recent searches:
 * a book icon and "Al-Baqarah 2:255", laid out like the surah rows beside it.
 */
export const RecentVerseRow: React.FC<RecentVerseRowProps> = ({
  verseKey,
  onPress,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  const {hovered, hoverProps} = useHover();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const label = localizeDigits(useQuranVerseLabel()(verseKey));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('quranSearch.hitHint')}
      {...hoverProps}
      style={({pressed}) => [
        styles.row,
        (pressed || hovered) && styles.pressed,
      ]}>
      <View style={styles.icon}>
        <Feather
          name="book-open"
          size={moderateScale(20)}
          color={theme.colors.text}
        />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingStart: moderateScale(12),
      paddingEnd: moderateScale(16),
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    // The surah rows' glyph box, so the labels line up.
    icon: {
      width: moderateScale(60),
      height: moderateScale(45),
      alignItems: 'center',
      justifyContent: 'center',
      marginEnd: moderateScale(8),
    },
    label: {
      flex: 1,
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
  });
