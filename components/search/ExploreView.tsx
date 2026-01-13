import React, {useMemo, useCallback} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import {useRouter} from 'expo-router';
import {moderateScale, scale} from 'react-native-size-matters';
import {SearchInput} from '@/components/SearchInput';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {noop} from 'lodash';
import {useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {getAllSystemPlaylists, SystemPlaylist} from '@/data/systemPlaylists';

// CONFIGURABLE ROW HEIGHT MULTIPLIER - This is the 'x' variable you can adjust
const ROW_HEIGHT_UNIT = 80; // Base unit 'x' in points - adjust this value to change all card heights proportionally

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

interface ExploreViewProps {
  onSearchPress: () => void;
}

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

// BentoTile component
const BentoTileComponent = React.memo(
  ({
    tile,
    dimensions,
    onPress,
  }: {
    tile: BentoTile;
    dimensions: {width: number; height: number};
    onPress: () => void;
  }) => {
    const {theme} = useTheme();

    // Subtle gradient incorporating the tile's unique color - more apparent
    const baseColor = Color(tile.backgroundColor);
    const gradientColors = [
      baseColor.alpha(0.15).toString(), // Tile color at higher opacity
      // Color(theme.colors.background).alpha(0.05).toString(), // Theme background
      baseColor.alpha(0.25).toString(), // Tile color at much higher opacity
    ] as const;

    const titleSize =
      tile.heightMultiplier >= 2 ? moderateScale(16) : moderateScale(14);
    const subtitleSize = moderateScale(12);

    const tileStyles = createStyles(theme);

    return (
      <View
        style={[
          tileStyles.bentoTile,
          {
            width: dimensions.width,
            height: dimensions.height,
            marginBottom: moderateScale(8),
            // Border architecture from RecentReciterCard
            borderWidth: 0.5,
            borderColor: Color(theme.colors.border).alpha(0.15).toString(),
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPress}
          style={tileStyles.tileButton}>
          <LinearGradient
            colors={gradientColors}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={tileStyles.tileGradient}>
            <View style={tileStyles.tileContent}>
              <View
                style={[
                  tileStyles.tileTextContainer,
                  tile.heightMultiplier === 1
                    ? tileStyles.centerLeftContainer
                    : tileStyles.topLeftContainer,
                ]}>
                <Text
                  style={[tileStyles.tileTitle, {fontSize: titleSize}]}
                  numberOfLines={tile.heightMultiplier >= 2 ? 2 : 2}>
                  {tile.title}
                </Text>
                {tile.subtitle && (
                  <Text
                    style={[tileStyles.tileSubtitle, {fontSize: subtitleSize}]}
                    numberOfLines={1}>
                    {tile.subtitle}
                  </Text>
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  },
);

BentoTileComponent.displayName = 'BentoTileComponent';

export const ExploreView = React.memo(function ExploreView({
  onSearchPress,
}: ExploreViewProps) {
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();

  const handleCategoryPress = useCallback(
    (route: string) => {
      router.push(route);
    },
    [router],
  );

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
          {tiles.map(tile => (
            <BentoTileComponent
              key={tile.id}
              tile={tile}
              dimensions={{
                width: tileDimensions.columnWidth,
                height: tileDimensions.baseHeight * tile.heightMultiplier,
              }}
              onPress={() => handleCategoryPress(tile.route)}
            />
          ))}
        </View>
      );
    },
    [
      styles.column,
      tileDimensions.columnWidth,
      tileDimensions.baseHeight,
      handleCategoryPress,
    ],
  );

  return (
    <View style={styles.content}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + moderateScale(48),
            paddingHorizontal: horizontalPadding,
            paddingBottom: moderateScale(35),
          },
        ]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onSearchPress}
          style={styles.searchButton}>
          <SearchInput
            placeholder="Search surahs, reciters, or keywords"
            value=""
            onChangeText={noop}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.background)
              .alpha(0.5)
              .toString()}
            borderColor={Color(theme.colors.border).alpha(0.2).toString()}
            pointerEvents="none"
            containerStyle={styles.searchInputContainer}
            style={styles.searchInput}
            editable={false}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + moderateScale(20),
            paddingTop: moderateScale(8),
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
});

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    content: {
      flex: 1,
      width: '100%',
    },
    header: {
      paddingBottom: moderateScale(8),
      width: '100%',
    },
    searchButton: {
      flex: 1,
    },
    searchInputContainer: {
      paddingHorizontal: 0,
    },
    searchInput: {
      height: moderateScale(50),
      fontSize: moderateScale(16),
    },
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
    bentoTile: {
      borderRadius: moderateScale(10),
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    tileButton: {
      flex: 1,
    },
    tileGradient: {
      flex: 1,
      padding: moderateScale(16),
    },
    tileContent: {
      flex: 1,
      justifyContent: 'center',
    },
    tileTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    tileTitle: {
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
      lineHeight: moderateScale(22),
      textAlign: 'left',
    },
    tileSubtitle: {
      color: theme.colors.textSecondary,
      fontFamily: 'Manrope-Medium',
      marginTop: moderateScale(2),
      lineHeight: moderateScale(16),
      textAlign: 'left',
    },
    centerLeftContainer: {
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    topLeftContainer: {
      justifyContent: 'flex-start',
    },
  });
