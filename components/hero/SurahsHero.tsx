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
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import {SESSION_SEED, pickHeroTheme} from '@/components/hero/heroThemes';

// Same SECTION_HEIGHT as ScrollingHero for consistency
const SECTION_HEIGHT = moderateScale(150);

const MESH_PALETTES = [
  // Purple dream
  ['#e879f9', '#a78bfa', '#38bdf8', '#34d399'],
  // Ocean depths
  ['#38bdf8', '#818cf8', '#5eead4', '#a78bfa'],
  // Golden hour
  ['#fbbf24', '#fb923c', '#f87171', '#e879f9'],
  // Rose garden
  ['#f9a8d4', '#fb7185', '#a78bfa', '#38bdf8'],
  // Emerald forest
  ['#34d399', '#86efac', '#38bdf8', '#a78bfa'],
  // Twilight
  ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#5eead4'],
];

interface SurahHeroSectionProps {
  surah: Surah;
  onLongPress?: (surah: Surah) => void;
  title?: string;
  isCompact?: boolean;
  style?: ViewStyle | ViewStyle[];
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
      {/* SVG gradient mesh blobs */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 400 155"
        preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgRadialGradient id="blob1" cx="0.2" cy="0.3" r="0.35">
            <Stop offset="0" stopColor={palette[0]} stopOpacity={mainOpacity} />
            <Stop offset="1" stopColor={palette[0]} stopOpacity={0} />
          </SvgRadialGradient>
          <SvgRadialGradient id="blob2" cx="0.75" cy="0.7" r="0.3">
            <Stop offset="0" stopColor={palette[1]} stopOpacity={mainOpacity} />
            <Stop offset="1" stopColor={palette[1]} stopOpacity={0} />
          </SvgRadialGradient>
          <SvgRadialGradient id="blob3" cx="0.55" cy="0.2" r="0.25">
            <Stop
              offset="0"
              stopColor={palette[2]}
              stopOpacity={isDark ? 0.08 : 0.1}
            />
            <Stop offset="1" stopColor={palette[2]} stopOpacity={0} />
          </SvgRadialGradient>
          <SvgRadialGradient id="blob4" cx="0.35" cy="0.8" r="0.2">
            <Stop
              offset="0"
              stopColor={palette[3]}
              stopOpacity={isDark ? 0.06 : 0.08}
            />
            <Stop offset="1" stopColor={palette[3]} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="155" fill="url(#blob1)" />
        <Rect x="0" y="0" width="400" height="155" fill="url(#blob2)" />
        <Rect x="0" y="0" width="400" height="155" fill="url(#blob3)" />
        <Rect x="0" y="0" width="400" height="155" fill="url(#blob4)" />
      </Svg>
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
      params: {surah: surah.id.toString()},
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
