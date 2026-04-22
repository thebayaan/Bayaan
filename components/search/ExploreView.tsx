import React, {useMemo, useCallback} from 'react';
import {View, StyleSheet, Pressable, Text, ScrollView} from 'react-native';
import {Link} from 'expo-router';
import {moderateScale, scale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useWindowDimensions} from 'react-native';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {getAllSystemPlaylists, SystemPlaylist} from '@/data/systemPlaylists';
import {useBottomInset} from '@/hooks/useBottomInset';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {GlassView} from 'expo-glass-effect';

// CONFIGURABLE ROW HEIGHT MULTIPLIER - This is the 'x' variable you can adjust
const ROW_HEIGHT_UNIT = 80; // Base unit 'x' in points - adjust this value to change all card heights proportionally

// Gap between cards (must match marginBottom on tiles)
const CARD_GAP = moderateScale(8);

interface BentoTile {
  id: string;
  title: string;
  subtitle?: string;
  backgroundColor: string;
  route: string;
  heightMultiplier: number; // Whole multiples of x only
  column: 'left' | 'right'; // Explicit column assignment
  order: number; // Order within the column (1 = top, 2 = second, etc.)
  type: 'browse' | 'system-playlist'; // Distinguish between browse tiles and system playlists
}

// Browse tiles - always show these
const BROWSE_TILES: BentoTile[] = [
  {
    id: 'all-reciters',
    title: 'Browse All',
    subtitle: 'Reciters',
    backgroundColor: '#1E40AF',
    route: '/(tabs)/(b.search)/browse-all',
    heightMultiplier: 1,
    column: 'left',
    order: 1,
    type: 'browse',
  },
  {
    id: 'all-surahs',
    title: 'Browse All',
    subtitle: 'Surahs',
    backgroundColor: '#7C3AED',
    route: '/(tabs)/(b.search)/browse-all-surahs',
    heightMultiplier: 1,
    column: 'right',
    order: 1,
    type: 'browse',
  },
];

// Convert system playlists to BentoTiles
function systemPlaylistToTile(playlist: SystemPlaylist): BentoTile {
  return {
    id: playlist.id,
    title: playlist.title,
    subtitle: playlist.subtitle,
    backgroundColor: playlist.backgroundColor,
    route: `/(tabs)/(b.search)/system-playlist/${playlist.id}`,
    heightMultiplier: playlist.heightMultiplier,
    column: playlist.column,
    order: playlist.order + 1, // Offset by 1 to account for Browse All tiles
    type: 'system-playlist',
  };
}

// Get all tiles (browse + system playlists)
function getAllTiles(): BentoTile[] {
  const systemPlaylists = getAllSystemPlaylists();
  const systemPlaylistTiles = systemPlaylists.map(systemPlaylistToTile);
  return [...BROWSE_TILES, ...systemPlaylistTiles];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExploreViewProps {}

interface ColumnLayout {
  leftColumn: BentoTile[];
  rightColumn: BentoTile[];
}

// Simple function to organize tiles by their assigned columns and order
function createExplicitLayout(): ColumnLayout {
  const allTiles = getAllTiles();
  const leftColumn = allTiles
    .filter(tile => tile.column === 'left')
    .sort((a, b) => a.order - b.order);
  const rightColumn = allTiles
    .filter(tile => tile.column === 'right')
    .sort((a, b) => a.order - b.order);

  return {leftColumn, rightColumn};
}

// Tile presentation:
//   - iOS 26 (USE_GLASS): Liquid Glass; GlassView with the "regular"
//     effect. No colored chrome; the material itself carries the card.
//   - Everywhere else: thin tinted hollow border fallback (no Liquid Glass
//     on Android or pre-iOS-26, so we keep the colored outline we had).
const BORDER_WIDTH = 1.5;
const OUTER_RADIUS = moderateScale(20);

const BentoTileComponent = React.memo(
  ({
    tile,
    dimensions,
  }: {
    tile: BentoTile;
    dimensions: {width: number; height: number};
  }) => {
    const {theme} = useTheme();
    const glassColorScheme = useGlassColorScheme();

    const borderColor = useMemo(
      () => Color(tile.backgroundColor).alpha(0.55).toString(),
      [tile.backgroundColor],
    );

    const isLargeCard = tile.heightMultiplier >= 2;
    const titleSize = isLargeCard ? moderateScale(16) : moderateScale(14);
    const subtitleSize = moderateScale(12);

    const contentBlock = (
      <View
        style={[
          tileInnerStyles.textContainer,
          isLargeCard
            ? tileInnerStyles.topLeftContainer
            : tileInnerStyles.centerLeftContainer,
        ]}>
        <Text
          style={[
            tileInnerStyles.title,
            {fontSize: titleSize, color: theme.colors.text},
          ]}
          numberOfLines={2}>
          {tile.title}
        </Text>
        {tile.subtitle && (
          <Text
            style={[
              tileInnerStyles.subtitle,
              {fontSize: subtitleSize, color: theme.colors.textSecondary},
            ]}
            numberOfLines={1}>
            {tile.subtitle}
          </Text>
        )}
      </View>
    );

    const outerStyle = useMemo(
      () => ({
        width: dimensions.width,
        height: dimensions.height,
        marginBottom: moderateScale(8),
      }),
      [dimensions.width, dimensions.height],
    );

    if (USE_GLASS) {
      return (
        <Link href={tile.route as any} asChild>
          <Pressable style={outerStyle}>
            <Link.AppleZoom>
              <GlassView
                style={tileInnerStyles.glassInner}
                glassEffectStyle="regular"
                colorScheme={glassColorScheme}>
                <View style={tileInnerStyles.contentWrapper}>
                  {contentBlock}
                </View>
              </GlassView>
            </Link.AppleZoom>
          </Pressable>
        </Link>
      );
    }

    // Non-glass fallback: keep the thin tinted hollow border so Android /
    // pre-iOS-26 still get a recognizable card shape.
    const fallbackStyle = useMemo(
      () => ({
        ...outerStyle,
        borderRadius: OUTER_RADIUS,
        borderWidth: BORDER_WIDTH,
        borderColor,
        backgroundColor: 'transparent' as const,
      }),
      [outerStyle, borderColor],
    );

    return (
      <Link href={tile.route as any} asChild>
        <Pressable style={fallbackStyle}>
          <View style={tileInnerStyles.contentWrapper}>{contentBlock}</View>
        </Pressable>
      </Link>
    );
  },
);

BentoTileComponent.displayName = 'BentoTileComponent';

// Static inner styles for BentoTileComponent (no theme dependency).
// Per-tile tinted-border style is built inline (needs dynamic borderColor);
// everything theme-independent lives here.
const tileInnerStyles = StyleSheet.create({
  glassInner: {
    flex: 1,
    borderRadius: OUTER_RADIUS,
    overflow: 'hidden',
  },
  contentWrapper: {
    flex: 1,
    padding: moderateScale(16),
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  centerLeftContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topLeftContainer: {
    justifyContent: 'flex-start',
  },
  title: {
    fontFamily: 'Manrope-Bold',
    lineHeight: moderateScale(22),
    textAlign: 'left',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: 'Manrope-Medium',
    marginTop: moderateScale(2),
    lineHeight: moderateScale(16),
    textAlign: 'left',
    opacity: 0.9,
    letterSpacing: 0.1,
  },
});

export const ExploreView = React.memo(
  function ExploreView({}: ExploreViewProps) {
    const {theme} = useTheme();
    const {width} = useWindowDimensions();
    const bottomInset = useBottomInset();

    // Calculate tile dimensions based on screen width - strict two-column grid
    const tileDimensions = useMemo(() => {
      const horizontalPadding = scale(width < 375 ? 12 : 16);
      const gap = moderateScale(8);
      const availableWidth = width - horizontalPadding * 2;

      // Column width - exactly half the available width minus half the gap
      const columnWidth = (availableWidth - gap) / 2;

      return {
        columnWidth,
        baseHeight: moderateScale(ROW_HEIGHT_UNIT),
      };
    }, [width]);

    // Calculate responsive horizontal padding
    const horizontalPadding = scale(width < 375 ? 12 : 16);

    // Create balanced layout
    const layout = useMemo(() => createExplicitLayout(), []);

    // Memoize theme-dependent styles
    const styles = useMemo(() => createStyles(theme), [theme]);

    // Render a column of tiles - memoized with useCallback
    const renderColumn = useCallback(
      (tiles: BentoTile[], columnKey: string) => {
        return (
          <View key={columnKey} style={styles.column}>
            {tiles.map(tile => {
              // Account for the gap between stacked 1x cards
              // A 2x card = two 1x cards + the gap between them
              const gapAdjustment = CARD_GAP * (tile.heightMultiplier - 1);
              const cardHeight =
                tileDimensions.baseHeight * tile.heightMultiplier +
                gapAdjustment;

              return (
                <BentoTileComponent
                  key={tile.id}
                  tile={tile}
                  dimensions={{
                    width: tileDimensions.columnWidth,
                    height: cardHeight,
                  }}
                />
              );
            })}
          </View>
        );
      },
      [styles.column, tileDimensions.columnWidth, tileDimensions.baseHeight],
    );

    return (
      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingHorizontal: horizontalPadding},
            // Glass: the system already pads for the search bar + tab bar
            // via automatic insets; any manual top/bottom would double-pad.
            // Non-glass: parent container handles top inset for the search
            // row; we need to clear the floating tab bar + mini player at
            // the bottom manually.
            USE_GLASS
              ? undefined
              : {
                  paddingTop: moderateScale(16),
                  paddingBottom: bottomInset,
                },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.masonryContainer}>
            {renderColumn(layout.leftColumn, 'left')}
            {renderColumn(layout.rightColumn, 'right')}
          </View>
        </ScrollView>
      </View>
    );
  },
);

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    content: {
      flex: 1,
      width: '100%',
    },
    // flex: 1 on the ScrollView itself lets iOS 26's NativeTabs
    // BottomAccessory (mini player) auto-collapse on scroll; the tab bar
    // tracks the screen's primary scroll view by its frame, and a
    // ScrollView sized to content doesn't register as primary.
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    masonryContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: moderateScale(8),
    },
    column: {
      flex: 1,
    },
  });
