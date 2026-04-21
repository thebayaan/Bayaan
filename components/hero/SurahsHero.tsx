import React, {useCallback, useMemo} from 'react';
import {StyleSheet, Text, View, Pressable, ViewStyle} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Surah} from '@/data/surahData';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
import {HeroSection} from './HeroSection';
import {SurahOfTheDay} from './SurahOfTheDay';
import {Link} from 'expo-router';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {SESSION_SEED, pickHeroTheme} from '@/components/hero/heroThemes';
import {
  MESH_PALETTES,
  SurahGradientMesh,
} from '@/components/hero/SurahGradientMesh';

// Same SECTION_HEIGHT as ScrollingHero for consistency
const SECTION_HEIGHT = moderateScale(150);

interface SurahHeroSectionProps {
  surah: Surah;
  onLongPress?: (surah: Surah) => void;
  title?: string;
  isCompact?: boolean;
  style?: ViewStyle | ViewStyle[];
  // When provided, tapping the hero opens the mushaf at this exact
  // page (e.g. where the user last stopped). Without it the link
  // falls back to the surah's first page.
  resumePage?: number;
}

/**
 * Individual Surah hero section component that displays surah information
 * with zoom transition to mushaf.
 */
export const SurahHeroSection = ({
  surah,
  onLongPress,
  title = 'SURAH OF THE DAY',
  style,
  resumePage,
}: SurahHeroSectionProps) => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const heroTheme = useMemo(() => pickHeroTheme(), []);
  const handleLongPress = useCallback(() => {
    onLongPress?.(surah);
  }, [surah, onLongPress]);

  // Pick a mesh palette that cycles per session
  const palette = useMemo(() => {
    const index = Math.abs(SESSION_SEED + 2) % MESH_PALETTES.length;
    return MESH_PALETTES[index];
  }, []);

  const isDark = theme.isDarkMode;
  const baseBg = isDark ? heroTheme.bg[0] : heroTheme.bgLight[0];
  const mainOpacity = isDark ? 0.12 : 0.15;

  const iconColor = isDark ? heroTheme.accentLight : heroTheme.accentDark;

  // Use the styles
  const styles = useMemo(
    () => createStyles(theme, heroTheme, isDark),
    [theme, heroTheme, isDark],
  );

  const revelationPlace = surah.revelation_place.toLowerCase();

  const cardContent = (
    <>
      {/* Solid background behind mesh */}
      <View style={[StyleSheet.absoluteFill, {backgroundColor: baseBg}]} />
      <SurahGradientMesh palette={palette} isDark={isDark} />

      <View style={styles.content}>
        <View style={styles.topSection}>
          <View style={styles.topRow}>
            <Text style={styles.heroTitle}>{title}</Text>
            <View style={styles.revelationPlace}>
              {revelationPlace === 'makkah' ? (
                <MakkahIcon
                  size={moderateScale(20)}
                  color={iconColor}
                  secondaryColor={baseBg}
                />
              ) : (
                <MadinahIcon size={moderateScale(12)} color={iconColor} />
              )}
            </View>
          </View>
          <Text style={styles.heroGlyph}>{surahGlyphMap[surah.id]}</Text>
        </View>
        <View style={styles.bottomSection}>
          <Text style={styles.heroSurahName}>{surah.name}</Text>
          <Text style={styles.translatedName}>
            {surah.translated_name_english}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{surah.verses_count}</Text>
              <Text style={styles.statLabel}>Verses</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{surah.id}</Text>
              <Text style={styles.statLabel}>Number</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  const linkProps = {
    href: {
      pathname: '/mushaf' as const,
      // Prefer the resume page when we have one — that's what makes
      // the hero a true "Continue reading" shortcut instead of just
      // "open this surah at page 1".
      params: resumePage
        ? {page: resumePage.toString()}
        : {surah: surah.id.toString()},
    },
    asChild: true as const,
  };

  const pressableProps = {
    onLongPress: onLongPress ? handleLongPress : undefined,
    delayLongPress: 500,
  };

  if (USE_GLASS) {
    return (
      <Link {...linkProps}>
        <Pressable
          {...pressableProps}
          style={StyleSheet.flatten([styles.glassWrapper, style])}>
          <Link.AppleZoom>
            <GlassView
              style={styles.glassInner}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}>
              {cardContent}
            </GlassView>
          </Link.AppleZoom>
        </Pressable>
      </Link>
    );
  }

  return (
    <Link {...linkProps}>
      <Pressable
        {...pressableProps}
        style={StyleSheet.flatten([styles.hero, style])}>
        {cardContent}
      </Pressable>
    </Link>
  );
};

// Styles for the SurahHeroSection component
const createStyles = (
  theme: Theme,
  heroTheme: import('@/components/hero/heroThemes').HeroColorTheme,
  isDark: boolean,
) =>
  StyleSheet.create({
    hero: {
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      flex: 1,
    },
    glassWrapper: {
      height: moderateScale(150),
      width: '100%' as const,
    },
    glassInner: {
      flex: 1,
      borderRadius: moderateScale(20),
      overflow: 'hidden' as const,
    },
    content: {
      padding: moderateScale(10),
      flexDirection: 'column',
      flex: 1,
    },
    topSection: {
      marginBottom: moderateScale(3),
      alignItems: 'center',
    },
    bottomSection: {
      alignItems: 'center',
    },
    heroGlyph: {
      fontSize: moderateScale(30),
      fontFamily: 'SurahNames',
      color: isDark ? heroTheme.accentLight : heroTheme.accentDark,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 4,
      textAlign: 'center',
      marginTop: 0,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: moderateScale(2),
    },
    heroTitle: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      letterSpacing: moderateScale(0.8),
      color: isDark ? heroTheme.accentDim : heroTheme.accentDark,
    },
    revelationPlace: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroSurahName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: isDark ? heroTheme.accentLight : heroTheme.accentDark,
      marginBottom: moderateScale(1),
      textAlign: 'center',
    },
    translatedName: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: isDark ? heroTheme.accent : heroTheme.accentDark,
      marginBottom: moderateScale(3),
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: moderateScale(16),
      justifyContent: 'center',
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statValue: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      color: isDark ? heroTheme.accentLight : heroTheme.accentDark,
      marginRight: moderateScale(4),
    },
    statLabel: {
      fontSize: moderateScale(8),
      fontFamily: 'Manrope-Medium',
      color: isDark ? heroTheme.accentDim : heroTheme.accentDark,
      textTransform: 'uppercase',
    },
  });

interface SurahsHeroProps {
  surahOfTheDay: Surah;
  onSurahLongPress?: (surah: Surah) => void;
}

/**
 * The main hero component for the SurahsView.
 * Displays the Surah of the Day in full width.
 */
export function SurahsHero({surahOfTheDay, onSurahLongPress}: SurahsHeroProps) {
  // Create card style for full-width display
  const cardStyle: ViewStyle = useMemo(() => {
    return {
      width: '100%' as const,
      height: SECTION_HEIGHT,
    };
  }, []);

  return (
    <HeroSection
      mainHero={
        <View
          style={{
            paddingHorizontal: moderateScale(16),
          }}>
          <SurahOfTheDay
            surah={surahOfTheDay}
            onLongPress={onSurahLongPress}
            style={cardStyle}
          />
        </View>
      }
      randomHero={false}
    />
  );
}
