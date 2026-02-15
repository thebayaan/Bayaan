import React from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {SURAHS} from '@/data/surahData';
import {getJuzForPage} from './constants';

interface ContinueReadingCardProps {
  onPress: (page: number) => void;
  pageToSurah: Record<number, number>;
}

export const ContinueReadingCard: React.FC<ContinueReadingCardProps> =
  React.memo(({onPress, pageToSurah}) => {
    const {theme, isDarkMode} = useTheme();
    const lastReadPage = useMushafSettingsStore(s => s.lastReadPage);

    if (!lastReadPage) return null;

    const surahId = pageToSurah[lastReadPage];
    const surahName =
      surahId >= 1 && surahId <= 114 ? SURAHS[surahId - 1].name : '';
    const juz = getJuzForPage(lastReadPage);

    return (
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: isDarkMode
              ? Color(theme.colors.border).darken(0.3).toString()
              : Color(theme.colors.border).lighten(0.3).toString(),
          },
        ]}
        onPress={() => onPress(lastReadPage)}>
        <View style={styles.iconContainer}>
          <Feather
            name="book-open"
            size={moderateScale(18)}
            color={theme.colors.text}
          />
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[styles.label, {color: theme.colors.textSecondary}]}
            numberOfLines={1}>
            Continue Reading
          </Text>
          <Text
            style={[styles.surahName, {color: theme.colors.text}]}
            numberOfLines={1}>
            {surahName}
          </Text>
          <Text
            style={[styles.meta, {color: theme.colors.textSecondary}]}
            numberOfLines={1}>
            Page {lastReadPage} · Juz {juz}
          </Text>
        </View>
        <Feather
          name="chevron-right"
          size={moderateScale(18)}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    );
  });

ContinueReadingCard.displayName = 'ContinueReadingCard';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: moderateScale(16),
    marginBottom: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: moderateScale(12),
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: moderateScale(2),
  },
  surahName: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-Bold',
  },
  meta: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Regular',
    marginTop: moderateScale(1),
  },
});
