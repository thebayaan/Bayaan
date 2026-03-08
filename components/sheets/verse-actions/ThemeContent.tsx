import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {ScrollView} from 'react-native-actions-sheet';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {themeDataService} from '@/services/mushaf/ThemeDataService';

const surahData = require('@/data/surahData.json');

// ─── Component ────────────────────────────────────────────────────────────

interface ThemeContentProps {
  surahNumber: number;
  ayahNumber: number;
  onBack: () => void;
}

export const ThemeContent: React.FC<ThemeContentProps> = ({
  surahNumber,
  ayahNumber,
  onBack,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = `${surahNumber}:${ayahNumber}`;
  const themeInfo = themeDataService.getThemeForVerse(verseKey);

  if (!themeInfo) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          bounces={true}>
          <Text style={styles.emptyText}>No thematic data for this verse.</Text>
        </ScrollView>
      </View>
    );
  }

  const surah = surahData.find(
    (s: {id: number; name: string}) => s.id === themeInfo.surah,
  );
  const surahName = surah?.name ?? `Surah ${themeInfo.surah}`;
  const passageRange = `${themeInfo.surah}:${themeInfo.ayahFrom} \u2013 ${themeInfo.surah}:${themeInfo.ayahTo}`;
  const verseCount = themeInfo.ayahTo - themeInfo.ayahFrom + 1;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        {/* Theme name */}
        <Text style={styles.themeName}>{themeInfo.theme}</Text>

        {/* Info card */}
        <View style={styles.card}>
          {/* Surah name row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Surah</Text>
            <Text style={styles.infoValue}>{surahName}</Text>
          </View>

          <View style={styles.divider} />

          {/* Passage range row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Passage</Text>
            <Text style={styles.infoValue}>{passageRange}</Text>
          </View>

          <View style={styles.divider} />

          {/* Verse count row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Verses</Text>
            <Text style={styles.infoValue}>{verseCount}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flex: 1,
    },
    scrollInner: {
      paddingTop: verticalScale(16),
      paddingBottom: verticalScale(24),
    },
    emptyText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
      paddingVertical: verticalScale(24),
    },
    themeName: {
      fontSize: moderateScale(17),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginBottom: verticalScale(16),
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(14),
    },
    infoLabel: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    infoValue: {
      fontSize: moderateScale(13.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.85).toString(),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
  });
