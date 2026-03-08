import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {HeroSection} from './HeroSection';
import {Link} from 'expo-router';
import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import Svg, {Circle, Path, Defs, RadialGradient, Stop} from 'react-native-svg';
import {pickHeroTheme, HeroColorTheme} from '@/components/hero/heroThemes';

const USE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

// Match SurahsHero height
const SECTION_HEIGHT = moderateScale(150);

interface TasbihBeadsSvgProps {
  theme: HeroColorTheme;
  isDarkMode: boolean;
}

/** SVG tasbih bead pattern rendered as card background decoration */
const TasbihBeadsSvg = ({theme, isDarkMode}: TasbihBeadsSvgProps) => {
  const beadOpacity = isDarkMode ? 0.25 : 0.3;

  // Left side bead positions (bottom to top arc)
  const leftBeads = [
    {cx: 85, cy: 115},
    {cx: 68, cy: 95},
    {cx: 58, cy: 72},
    {cx: 57, cy: 48},
    {cx: 65, cy: 27},
    {cx: 82, cy: 12},
  ];

  // Right side bead positions (mirror of left)
  const rightBeads = [
    {cx: 315, cy: 115},
    {cx: 332, cy: 95},
    {cx: 342, cy: 72},
    {cx: 343, cy: 48},
    {cx: 335, cy: 27},
    {cx: 318, cy: 12},
  ];

  // Bead sizes (bottom to top, slightly smaller going up)
  const beadSizes = [5, 5.5, 5.5, 5, 4.5, 4];

  // Bead colors (bottom = accentLight, middle = accent, top = accentDim)
  const beadColors = [
    theme.accentLight,
    theme.accentLight,
    theme.accent,
    theme.accent,
    theme.accentDim,
    theme.accentDim,
  ];

  // Thread path connecting beads on left side
  const leftThread = `M ${leftBeads[0].cx},${leftBeads[0].cy} ${leftBeads.map(b => `L ${b.cx},${b.cy}`).join(' ')}`;
  // Thread path connecting beads on right side
  const rightThread = `M ${rightBeads[0].cx},${rightBeads[0].cy} ${rightBeads.map(b => `L ${b.cx},${b.cy}`).join(' ')}`;

  return (
    <Svg
      viewBox="0 0 400 150"
      style={StyleSheet.absoluteFill}
      preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="centerGlow" cx="50%" cy="50%" r="40%">
          <Stop offset="0%" stopColor={theme.accent} stopOpacity={0.08} />
          <Stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Center radial glow */}
      <Circle cx={200} cy={75} r={120} fill="url(#centerGlow)" />

      {/* Left thread */}
      <Path
        d={leftThread}
        stroke={theme.accent}
        strokeWidth={0.5}
        fill="none"
        opacity={0.08}
      />

      {/* Right thread */}
      <Path
        d={rightThread}
        stroke={theme.accent}
        strokeWidth={0.5}
        fill="none"
        opacity={0.08}
      />

      {/* Left beads */}
      {leftBeads.map((bead, i) => (
        <Circle
          key={`left-${i}`}
          cx={bead.cx}
          cy={bead.cy}
          r={beadSizes[i]}
          fill={beadColors[i]}
          opacity={beadOpacity}
        />
      ))}

      {/* Right beads */}
      {rightBeads.map((bead, i) => (
        <Circle
          key={`right-${i}`}
          cx={bead.cx}
          cy={bead.cy}
          r={beadSizes[i]}
          fill={beadColors[i]}
          opacity={beadOpacity}
        />
      ))}
    </Svg>
  );
};

interface SavedAdhkarCardProps {
  savedCount: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Card component for saved adhkar hero section
 * Matches the SurahHeroSection design pattern exactly
 */
const SavedAdhkarCard = ({savedCount, style}: SavedAdhkarCardProps) => {
  const {theme} = useTheme();
  const heroTheme = useMemo(() => pickHeroTheme(), []);
  const styles = useMemo(
    () => createStyles(theme, heroTheme),
    [theme, heroTheme],
  );

  const isDark = theme.isDarkMode;
  const bgColors = isDark ? heroTheme.bg : heroTheme.bgLight;

  const cardContent = (
    <>
      <LinearGradient
        colors={bgColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <TasbihBeadsSvg theme={heroTheme} isDarkMode={theme.isDarkMode} />
      <View style={styles.content}>
        {/* Top section - matching SurahHeroSection layout exactly */}
        <View style={styles.topSection}>
          <View style={styles.topRow}>
            <Text style={styles.heroTitle}>
              {' '}
              {savedCount === 1 ? 'SAVED DHIKR' : 'SAVED ADHKAR'}
            </Text>
            <View style={styles.iconContainer}>
              <Ionicons
                name="bookmark"
                size={moderateScale(20)}
                color={isDark ? heroTheme.accentLight : heroTheme.accentDark}
              />
            </View>
          </View>
          {/* Count number - positioned exactly where heroGlyph is */}
          <Text style={styles.heroGlyph}>{savedCount}</Text>
        </View>

        {/* Bottom section - matching SurahHeroSection layout exactly */}
        <View style={styles.bottomSection}>
          <Text style={styles.heroSurahName}> Saved </Text>
          <Text style={styles.translatedName}>Your collection</Text>
        </View>
      </View>
    </>
  );

  if (USE_GLASS) {
    return (
      <Link href="/(tabs)/(a.home)/adhkar/saved" asChild>
        <Pressable style={StyleSheet.flatten([styles.glassWrapper, style])}>
          <Link.AppleZoom>
            <GlassView style={styles.glassInner} glassEffectStyle="regular">
              {cardContent}
            </GlassView>
          </Link.AppleZoom>
        </Pressable>
      </Link>
    );
  }

  return (
    <Link href="/(tabs)/(a.home)/adhkar/saved" asChild>
      <Pressable style={StyleSheet.flatten([styles.hero, style])}>
        {cardContent}
      </Pressable>
    </Link>
  );
};

// Styles matching SurahHeroSection exactly
const createStyles = (theme: Theme, heroTheme: HeroColorTheme) =>
  StyleSheet.create({
    hero: {
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      flex: 1,
    },
    glassWrapper: {
      height: SECTION_HEIGHT,
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
      marginBottom: moderateScale(6),
      alignItems: 'center',
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
      color: theme.isDarkMode ? heroTheme.accentDim : heroTheme.accentDark,
    },
    iconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroGlyph: {
      fontSize: moderateScale(30),
      fontFamily: 'Manrope-Bold',
      color: theme.isDarkMode ? heroTheme.accentLight : heroTheme.accentDark,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 4,
      textAlign: 'center',
      marginTop: moderateScale(2),
    },
    bottomSection: {
      alignItems: 'center',
    },
    heroSurahName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.isDarkMode ? heroTheme.accentLight : heroTheme.accentDark,
      marginBottom: moderateScale(1),
      textAlign: 'center',
    },
    translatedName: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.isDarkMode ? heroTheme.accentDim : heroTheme.accentDark,
      marginBottom: moderateScale(6),
      textAlign: 'center',
    },
  });

interface SavedAdhkarHeroProps {
  savedCount: number;
}

/**
 * Hero section for saved adhkar in AdhkarView
 * Only renders when there are saved adhkar
 */
export function SavedAdhkarHero({savedCount}: SavedAdhkarHeroProps) {
  const cardStyle: ViewStyle = useMemo(() => {
    return {
      width: '100%' as const,
      height: SECTION_HEIGHT,
    };
  }, []);

  // Don't render if no saved adhkar
  if (savedCount === 0) {
    return null;
  }

  return (
    <HeroSection
      mainHero={
        <View style={{paddingHorizontal: moderateScale(16)}}>
          <SavedAdhkarCard savedCount={savedCount} style={cardStyle} />
        </View>
      }
      randomHero={false}
    />
  );
}
