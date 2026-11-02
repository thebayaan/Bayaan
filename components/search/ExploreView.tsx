import React, {useMemo, useCallback, useState} from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import {Link} from 'expo-router';
import {moderateScale, scale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useWindowDimensions} from 'react-native';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {getAllSystemPlaylists, SystemPlaylist} from '@/data/systemPlaylists';
import {useBottomInset} from '@/hooks/useBottomInset';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {useResponsive} from '@/hooks/useResponsive';
import {GlassView} from 'expo-glass-effect';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
import i18n from '@/i18n';
import {computeGridLayout} from '@/utils/gridLayout';
// @ai-end

// CONFIGURABLE ROW HEIGHT MULTIPLIER - This is the 'x' variable you can adjust
const ROW_HEIGHT_UNIT = 80; // Base unit 'x' in points - adjust this value to change all card heights proportionally

// Gap between cards (must match marginBottom on tiles)
const CARD_GAP = moderateScale(8);

// @ai-start
// iPad grid (mockup L6).
const TABLET_GAP = moderateScale(12);
const TABLET_MIN_TILE_WIDTH = moderateScale(180);
const TABLET_TILE_ASPECT = 1.6;
const TABLET_FEATURE_HEIGHT = moderateScale(96);
// @ai-end

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
// @ai-start
const BROWSE_TILES: BentoTile[] = [
  {
    id: 'all-reciters',
    get title() {
      return i18n.t('home:browse.browseAll');
    },
    get subtitle() {
      return i18n.t('common:terms.reciters');
    },
    backgroundColor: '#1E40AF',
    route: '/(tabs)/(b.search)/browse-all',
    heightMultiplier: 1,
    column: 'left',
    order: 1,
    type: 'browse',
  },
  {
    id: 'all-surahs',
    get title() {
      return i18n.t('home:browse.browseAll');
    },
    get subtitle() {
      return i18n.t('common:terms.surahs');
    },
    backgroundColor: '#7C3AED',
    route: '/(tabs)/(b.search)/browse-all-surahs',
    heightMultiplier: 1,
    column: 'right',
    order: 1,
    type: 'browse',
  },
];
// @ai-end

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

// @ai-start
/**
 * System playlists in reading order for the iPad grid: the phone's two
 * columns interleaved row by row, so Morning Reflections and Evening
 * Serenity still open the list side by side.
 */
export function interleaveColumns<
  T extends Pick<BentoTile, 'column' | 'order'>,
>(tiles: readonly T[]): T[] {
  return [...tiles].sort(
    (a, b) =>
      a.order - b.order ||
      (a.column === b.column ? 0 : a.column === 'left' ? -1 : 1),
  );
}
// @ai-end

// Tile presentation:
//   - iOS 26 (USE_GLASS): Liquid Glass; GlassView with the "regular"
//     effect. No colored chrome; the material itself carries the card.
//   - Everywhere else: thin tinted hollow border fallback (no Liquid Glass
//     on Android or pre-iOS-26, so we keep the colored outline we had).
//   - The iPad grid adds a light tint of the tile's color to either. @ai
const BORDER_WIDTH = 1.5;
const OUTER_RADIUS = moderateScale(20);

const BentoTileComponent = React.memo(
  ({
    tile,
    dimensions,
    grid = false, // @ai
  }: {
    tile: BentoTile;
    dimensions: {width: number; height: number};
    /** iPad grid tile: tinted with its color, title at the top. @ai */
    grid?: boolean;
  }) => {
    const {theme} = useTheme();
    const glassColorScheme = useGlassColorScheme();

    const borderColor = useMemo(
      () => Color(tile.backgroundColor).alpha(0.55).toString(),
      [tile.backgroundColor],
    );
    // @ai-start
    // Grid tiles are all one size, so color (not height) tells them apart.
    const tint = useMemo(
      () =>
        grid
          ? Color(tile.backgroundColor)
              .alpha(USE_GLASS ? 0.32 : 0.14)
              .toString()
          : undefined,
      [grid, tile.backgroundColor],
    );
    // @ai-end

    const isLargeCard = grid || tile.heightMultiplier >= 2; // @ai
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
        marginBottom: grid ? 0 : moderateScale(8), // @ai
      }),
      [dimensions.width, dimensions.height, grid],
    );

    // Non-glass fallback: keep the thin tinted hollow border so Android /
    // pre-iOS-26 still get a recognizable card shape.
    // @ai-start
    // Computed before the glass branch returns so the hook order never
    // changes.
    // @ai-end
    const fallbackStyle = useMemo(
      () => ({
        ...outerStyle,
        borderRadius: OUTER_RADIUS,
        borderWidth: BORDER_WIDTH,
        borderColor,
        backgroundColor: tint ?? ('transparent' as const), // @ai
      }),
      [outerStyle, borderColor, tint],
    );

    if (USE_GLASS) {
      return (
        <Link href={tile.route as any} asChild>
          <Pressable style={outerStyle}>
            <Link.AppleZoom>
              <GlassView
                style={tileInnerStyles.glassInner}
                glassEffectStyle="regular"
                tintColor={tint} // @ai
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
// @ai-start
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
    letterSpacing: latinLetterSpacing(0.2),
  },
  subtitle: {
    fontFamily: 'Manrope-Medium',
    marginTop: moderateScale(2),
    lineHeight: moderateScale(16),
    textAlign: 'left',
    opacity: 0.9,
    letterSpacing: latinLetterSpacing(0.1),
  },
});
// @ai-end

// @ai-start
export const ExploreView = React.memo(
  function ExploreView({}: ExploreViewProps) {
    const {theme} = useTheme();
    const {width: windowWidth} = useWindowDimensions();
    const bottomInset = useBottomInset();
    const {isTablet} = useResponsive();

    // Tablet-only guard: on iPad the window width is not the same as the
    // available content width (the sidebar steals space). Measure the real
    // content width via onLayout so the two-column grid fits inside the
    // visible area and tiles don't overlap. On phones we keep the original
    // `useWindowDimensions` behavior untouched.
    const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
    const onContentLayout = useCallback(
      (e: LayoutChangeEvent) => {
        if (!isTablet) return;
        const w = e.nativeEvent.layout.width;
        if (w > 0) {
          setMeasuredWidth(prev => (prev === w ? prev : w));
        }
      },
      [isTablet],
    );

    const width =
      isTablet && measuredWidth != null ? measuredWidth : windowWidth;

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

    // On tablet, wait for the first onLayout measurement before rendering the
    // tiles so we never flash the wrong (windowWidth-based) sizes. The View
    // wrapper itself always renders so onLayout can fire.
    const tilesReady = !isTablet || measuredWidth != null;

    // iPad (mockup L6): the two Browse All tiles side by side, then the
    // system playlists as a grid of 1.6:1 tiles that gains columns with the
    // pane (3 on the mini, 4 on the 13"). The phone bento stays as it is.
    const tabletGrid = useMemo(() => {
      if (!isTablet) return null;
      const {itemWidth} = computeGridLayout(width, {
        minCardWidth: TABLET_MIN_TILE_WIDTH,
        horizontalPadding,
        gap: TABLET_GAP,
        minColumns: 3,
      });
      return {
        // Floored so rounding never wraps the last tile of a row.
        tile: {
          width: Math.floor(itemWidth),
          height: Math.floor(itemWidth / TABLET_TILE_ASPECT),
        },
        feature: {
          width: Math.floor((width - horizontalPadding * 2 - TABLET_GAP) / 2),
          height: TABLET_FEATURE_HEIGHT,
        },
        playlists: interleaveColumns(
          getAllSystemPlaylists().map(systemPlaylistToTile),
        ),
      };
    }, [isTablet, width, horizontalPadding]);

    return (
      <View style={styles.content} onLayout={onContentLayout}>
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
          {tilesReady && tabletGrid ? (
            <View style={styles.tabletGrid}>
              {BROWSE_TILES.map(tile => (
                <BentoTileComponent
                  key={tile.id}
                  tile={tile}
                  dimensions={tabletGrid.feature}
                  grid
                />
              ))}
              {tabletGrid.playlists.map(tile => (
                <BentoTileComponent
                  key={tile.id}
                  tile={tile}
                  dimensions={tabletGrid.tile}
                  grid
                />
              ))}
            </View>
          ) : (
            tilesReady && (
              <View style={styles.masonryContainer}>
                {renderColumn(layout.leftColumn, 'left')}
                {renderColumn(layout.rightColumn, 'right')}
              </View>
            )
          )}
        </ScrollView>
      </View>
    );
  },
);
// @ai-end

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
    // @ai-start
    tabletGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: TABLET_GAP,
    },
    // @ai-end
  });
