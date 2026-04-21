import React, {useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  InteractionManager,
} from 'react-native';
import {Link} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import {SESSION_SEED, pickHeroTheme} from '@/components/hero/heroThemes';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

const TILE_COLORS = [
  '#fbbf24',
  '#ef4444',
  '#8b5cf6',
  '#34d399',
  '#38bdf8',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#a78bfa',
  '#fb923c',
  '#4ade80',
  '#f472b6',
];

const TITLE_VARIANTS = [
  'Browse the Full Collection',
  'Explore Every Reciter',
  'Every Voice, One Place',
  'A World of Recitations',
  'All Reciters Await',
  'Every Reciter, One Tap',
];

const LABEL_VARIANTS = [
  'All Reciters',
  'Browse Voices',
  'Discover',
  'Full Library',
  'Explore',
  'Browse',
];

// Match SurahsHero height
const CARD_HEIGHT = moderateScale(150);
const TILE_SIZE = moderateScale(16);
const TILE_RADIUS = moderateScale(3);
const TILE_GAP = moderateScale(3);
const TILE_STEP = TILE_SIZE + TILE_GAP;

// Column configs — different speeds and start offsets for staggered drift
const COLUMN_CONFIGS = [
  {speed: 180000, startOffset: 0},
  {speed: 200000, startOffset: 30},
  {speed: 160000, startOffset: 60},
  {speed: 210000, startOffset: 15},
  {speed: 190000, startOffset: 45},
  {speed: 170000, startOffset: 70},
  {speed: 220000, startOffset: 25},
  {speed: 185000, startOffset: 55},
  {speed: 195000, startOffset: 10},
  {speed: 175000, startOffset: 40},
  {speed: 205000, startOffset: 65},
  {speed: 165000, startOffset: 20},
  {speed: 215000, startOffset: 50},
  {speed: 180000, startOffset: 35},
  {speed: 200000, startOffset: 5},
  {speed: 190000, startOffset: 60},
  {speed: 170000, startOffset: 22},
  {speed: 210000, startOffset: 48},
  {speed: 185000, startOffset: 12},
  {speed: 195000, startOffset: 58},
];

interface TileData {
  fill: string;
  opacity: number;
}

// Generate tile colors/opacities for a single column
function generateColumnTiles(
  seed: number,
  colIndex: number,
  count: number,
): TileData[] {
  let s = seed + colIndex * 7919; // different seed per column
  function nextRand() {
    s = (s * 16807 + 11) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  }
  const tiles: TileData[] = [];
  for (let i = 0; i < count; i++) {
    tiles.push({
      fill: TILE_COLORS[Math.floor(nextRand() * TILE_COLORS.length)],
      opacity: 0.15 + nextRand() * 0.25,
    });
  }
  return tiles;
}

// Animated column of tiles
const TileColumn = React.memo(
  ({
    colIndex,
    tileOpacity,
    tilesPerColumn,
    speed,
    startOffset,
  }: {
    colIndex: number;
    tileOpacity: number;
    tilesPerColumn: number;
    speed: number;
    startOffset: number;
  }) => {
    const scrollY = useSharedValue(startOffset);
    const mountedRef = useRef(true);

    // Generate tiles for this column (doubled for seamless loop)
    const tiles = useMemo(
      () => generateColumnTiles(SESSION_SEED, colIndex, tilesPerColumn),
      [colIndex, tilesPerColumn],
    );

    const singleSetHeight = tilesPerColumn * TILE_STEP;

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{translateY: -(scrollY.value % singleSetHeight)}],
    }));

    useEffect(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        if (!mountedRef.current) return;
        scrollY.value = startOffset;
        scrollY.value = withRepeat(
          withTiming(singleSetHeight + startOffset, {
            duration: speed,
            easing: Easing.linear,
          }),
          -1,
          false,
        );
      });

      return () => {
        mountedRef.current = false;
        cancelAnimation(scrollY);
        task.cancel();
      };
    }, [singleSetHeight, speed, startOffset, scrollY]);

    // Render doubled tiles for seamless wrap
    const allTiles = useMemo(() => [...tiles, ...tiles], [tiles]);

    return (
      <View style={columnStyles.wrapper}>
        <Animated.View style={animatedStyle}>
          {allTiles.map((tile, i) => (
            <View
              key={i}
              style={[
                columnStyles.tile,
                {
                  backgroundColor: Color(tile.fill)
                    .alpha(tile.opacity * tileOpacity)
                    .toString(),
                },
              ]}
            />
          ))}
        </Animated.View>
      </View>
    );
  },
);

TileColumn.displayName = 'TileColumn';

const columnStyles = StyleSheet.create({
  wrapper: {
    width: TILE_SIZE,
    overflow: 'hidden',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_RADIUS,
    marginBottom: TILE_GAP,
  },
});

interface BrowseAllHeroProps {
  style?: object;
}

export function BrowseAllHero({style}: BrowseAllHeroProps) {
  const {theme} = useTheme();
  const heroTheme = useMemo(() => pickHeroTheme(), []);
  const copyIndex = useMemo(
    () => Math.abs(SESSION_SEED) % TITLE_VARIANTS.length,
    [],
  );
  const title = TITLE_VARIANTS[copyIndex];
  const label = LABEL_VARIANTS[copyIndex];
  const isDark = theme.isDarkMode;

  const bg = isDark ? heroTheme.bg : heroTheme.bgLight;
  const labelColor = isDark ? heroTheme.accentDim : heroTheme.accentDark;
  const titleColor = isDark ? heroTheme.accentLight : heroTheme.accentDark;
  const chevronColor = isDark ? heroTheme.accent : heroTheme.accentDark;
  const tileOpacity = isDark ? 0.12 : 0.18;

  // How many tile rows fit in the card + extra for scroll buffer
  const tilesPerColumn = useMemo(
    () => Math.ceil(CARD_HEIGHT / TILE_STEP) + 4,
    [],
  );

  // How many columns fit in the card width — we'll use a generous count
  // and let flexbox + overflow handle the rest
  const columnCount = COLUMN_CONFIGS.length;

  const scale = useSharedValue(1);
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));
  const handlePressIn = () => {
    scale.value = withSpring(0.98, {damping: 20, stiffness: 400, mass: 0.5});
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, {damping: 20, stiffness: 400, mass: 0.5});
  };

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View style={[styles.container, pressAnimStyle, style]}>
      <Link href="/(tabs)/(a.home)/browse-all" asChild>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{flex: 1}}>
          {/* Solid background */}
          <View style={[StyleSheet.absoluteFill, {backgroundColor: bg[0]}]} />

          {/* Scrolling mosaic columns */}
          <View style={styles.tilesContainer}>
            {COLUMN_CONFIGS.slice(0, columnCount).map((config, i) => (
              <TileColumn
                key={i}
                colIndex={i}
                tileOpacity={tileOpacity}
                tilesPerColumn={tilesPerColumn}
                speed={config.speed}
                startOffset={config.startOffset}
              />
            ))}
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.textContainer}>
              <Text style={[styles.label, {color: labelColor}]}>
                {label.toUpperCase()}
              </Text>
              <Text style={[styles.title, {color: titleColor}]}>{title}</Text>
            </View>
            <View style={styles.chevron}>
              <Svg
                width={moderateScale(16)}
                height={moderateScale(16)}
                viewBox="0 0 24 24">
                <Path
                  d="M9 6l6 6-6 6"
                  stroke={chevronColor}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
          </View>
        </Pressable>
      </Link>
    </Animated.View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      height: CARD_HEIGHT,
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    tilesContainer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      gap: TILE_GAP,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(14),
    },
    textContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    label: {
      fontFamily: 'Manrope-Bold',
      fontSize: moderateScale(9),
      letterSpacing: 1.2,
      marginBottom: moderateScale(2),
    },
    title: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(14),
    },
    chevron: {
      marginLeft: moderateScale(8),
      marginBottom: moderateScale(2),
    },
  });
