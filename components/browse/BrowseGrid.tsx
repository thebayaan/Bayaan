import React, {useMemo, useState, useCallback, useEffect} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import {BrowseReciterCard} from './BrowseReciterCard';
import {getFeaturedReciters} from '@/data/featuredReciters';
import {reciterImages} from '@/utils/reciterImages';

interface BrowseGridProps {
  reciters: Reciter[];
  onReciterPress: (reciter: Reciter) => void;
  theme: Theme;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
}

function createStyles(_theme: Theme) {
  const columnGap = moderateScale(10);
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    gridContainer: {
      paddingHorizontal: moderateScale(4),
      paddingBottom: moderateScale(80), // Add extra padding at the bottom
    },
    columnWrapper: {
      gap: columnGap,
      paddingHorizontal: moderateScale(4),
      paddingBottom: columnGap,
    },
    loadingContainer: {
      padding: moderateScale(20),
      alignItems: 'center',
    },
  });
}

// Helper function to check if a reciter has an image
function hasImage(reciter: Reciter): boolean {
  if (reciter.image_url) return true;

  const formattedName = reciter.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return !!reciterImages[formattedName];
}

// Sort reciters by priority: featured first, then those with images
function sortReciters(reciters: Reciter[]): Reciter[] {
  const featuredReciters = getFeaturedReciters(20);
  const featuredIds = new Set(featuredReciters.map(r => r.id));

  return [...reciters].sort((a, b) => {
    // Featured reciters come first
    if (featuredIds.has(a.id) && !featuredIds.has(b.id)) return -1;
    if (!featuredIds.has(a.id) && featuredIds.has(b.id)) return 1;

    // Then reciters with images
    const aHasImage = hasImage(a);
    const bHasImage = hasImage(b);
    if (aHasImage && !bHasImage) return -1;
    if (!aHasImage && bHasImage) return 1;

    // Alphabetical order as fallback
    return a.name.localeCompare(b.name);
  });
}

const ITEMS_PER_PAGE = 24;

const BrowseGrid = React.memo(
  ({reciters, onReciterPress, theme}: BrowseGridProps) => {
    const {width: windowWidth} = useWindowDimensions();
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [displayedReciters, setDisplayedReciters] = useState<Reciter[]>([]);

    // Sort reciters by priority
    const sortedReciters = useMemo(() => sortReciters(reciters), [reciters]);

    // Update displayed reciters when the source changes
    useEffect(() => {
      // Reset pagination when reciters change
      setPage(1);
      setDisplayedReciters(sortedReciters.slice(0, ITEMS_PER_PAGE));
    }, [sortedReciters]);

    // Calculate number of columns based on screen width
    const numColumns = useMemo(() => {
      const minCardWidth = moderateScale(120);
      return Math.max(3, Math.floor(windowWidth / minCardWidth));
    }, [windowWidth]);

    const styles = useMemo(() => createStyles(theme), [theme]);

    // Calculate item dimensions
    const itemDimensions = useMemo(() => {
      const padding = moderateScale(8) * 2; // Total horizontal padding
      const gap = moderateScale(10) * (numColumns - 1); // Total gap between items
      const availableWidth = windowWidth - padding - gap;
      const itemWidth = availableWidth / numColumns;
      const itemHeight = itemWidth * 1.2; // Reduced aspect ratio from 1.3 to 1.2

      return {
        width: itemWidth,
        height: itemHeight,
      };
    }, [windowWidth, numColumns]);

    const renderItem = useCallback(
      ({item}: {item: Reciter}) => (
        <BrowseReciterCard
          reciter={item}
          onPress={() => onReciterPress(item)}
          width={itemDimensions.width}
          height={itemDimensions.height}
          theme={theme}
        />
      ),
      [itemDimensions, onReciterPress, theme],
    );

    const keyExtractor = useCallback((item: Reciter) => item.id, []);

    const getItemLayout = useCallback(
      (_: ArrayLike<Reciter> | null | undefined, index: number) => ({
        length: itemDimensions.height,
        offset: itemDimensions.height * Math.floor(index / numColumns),
        index,
      }),
      [itemDimensions.height, numColumns],
    );

    const handleLoadMore = useCallback(() => {
      if (displayedReciters.length < sortedReciters.length && !isLoading) {
        setIsLoading(true);

        // Use setTimeout to prevent UI blocking
        setTimeout(() => {
          const nextPage = page + 1;
          const newItems = sortedReciters.slice(0, nextPage * ITEMS_PER_PAGE);

          setPage(nextPage);
          setDisplayedReciters(newItems);
          setIsLoading(false);
        }, 300);
      }
    }, [displayedReciters.length, sortedReciters, isLoading, page]);

    const renderFooter = useCallback(() => {
      if (!isLoading) return null;

      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text} />
        </View>
      );
    }, [isLoading, styles.loadingContainer, theme.colors.text]);

    return (
      <View style={styles.container}>
        <FlatList
          data={displayedReciters}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={numColumns * 2}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.theme === nextProps.theme &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.reciters.length === nextProps.reciters.length,
);

BrowseGrid.displayName = 'BrowseGrid';

export default BrowseGrid;
