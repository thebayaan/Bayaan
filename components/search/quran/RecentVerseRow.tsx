// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {hitLabel} from '@/components/mushaf/mushafSearchVerses';
import {SURAHS} from '@/data/surahData';
import {useHover} from '@/hooks/useHover';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {useTheme} from '@/hooks/useTheme';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {firstHitSlot} from '@/utils/search/quranHitParams';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {useQuranVerseLabel} from './quranVerseLabel';

export interface RecentVerseRowProps {
  /** Hafs verse key, 'S:A'. */
  verseKey: string;
  /** Its matched Digital Khatt slots, which it opens on. */
  positions: readonly number[];
  onPress: () => void;
}

/**
 * An ayah opened from the Quran search, in the Search tab's recent searches:
 * a book icon and "Al-Baqarah 2:255", laid out like the surah rows beside it.
 *
 * With another rewayah in the mushaf, the row names the verse the reader
 * will select: the verse of that rewayah holding the first matched slot
 * ("Quraysh 106:5 · Warsh"). While that rewayah's verses load, and for the
 * unnumbered Fatiha basmala, it names the Hafs verse and says so
 * ("Quraysh 106:4 · Hafs"). The mushaf search and root search name their
 * ayahs the same way (hitLabel).
 */
export const RecentVerseRow: React.FC<RecentVerseRowProps> = ({
  verseKey,
  positions,
  onPress,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  const {hovered, hoverProps} = useHover();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hafsLabel = useQuranVerseLabel();
  const rewayah = useMushafSettingsStore(s => s.rewayah);
  const {units} = useRewayahVerseUnits(rewayah === 'hafs' ? null : rewayah);
  const surah = SURAHS[Number(verseKey.split(':')[0]) - 1];
  const label = localizeDigits(
    rewayah === 'hafs' || !surah
      ? hafsLabel(verseKey)
      : hitLabel(
          verseKey,
          firstHitSlot(positions),
          {rewayah, units},
          getSurahDisplayName(surah),
        ),
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('quranSearch.hitHint')}
      {...hoverProps}
      style={[styles.row, hovered && styles.pressed]}>
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
