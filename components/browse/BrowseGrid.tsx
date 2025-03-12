import React, {useMemo, useState, useCallback} from 'react';
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

interface BrowseGridProps {
  reciters: Reciter[];
  onReciterPress: (reciter: Reciter) => void;
  theme: Theme;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
}

function createStyles(theme: Theme) {
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
    seeMoreButton: {
      backgroundColor: theme.colors.card,
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(20),
      borderRadius: moderateScale(8),
      alignItems: 'center',
      marginVertical: moderateScale(20),
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    seeMoreText: {
      color: theme.colors.text,
      fontFamily: theme.fonts.medium,
      fontSize: moderateScale(14),
    },
  });
}

// Helper function to check if a reciter has an image

const ITEMS_PER_PAGE = 36; // Increased from 24 to show more items initially

const BrowseGrid = React.memo(
  ({reciters, onReciterPress, theme}: BrowseGridProps) => {
    const {width: windowWidth} = useWindowDimensions();
    const [isLoading, setIsLoading] = useState(false);
    const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);

    // Use the reciters as they are, without re-sorting
    // This respects the sorting already applied in BrowseReciters
    const sortedReciters = useMemo(() => reciters, [reciters]);

    // The currently visible subset of reciters
    const displayedReciters = useMemo(() => {
      return sortedReciters.slice(0, visibleItems);
    }, [sortedReciters, visibleItems]);

    // Whether there are more items to show
    const hasMoreItems = useMemo(() => {
      return visibleItems < sortedReciters.length;
    }, [visibleItems, sortedReciters.length]);

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
      if (isLoading || !hasMoreItems) return;
      setIsLoading(true);
      // Use requestAnimationFrame instead of setTimeout for smoother performance
      requestAnimationFrame(() => {
        setVisibleItems(prev =>
          Math.min(prev + ITEMS_PER_PAGE, sortedReciters.length),
        );
        setIsLoading(false);
      });
    }, [isLoading, hasMoreItems, sortedReciters.length]);

    const renderFooter = useCallback(() => {
      if (!hasMoreItems && !isLoading) return null;

      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text} />
        </View>
      );
    }, [isLoading, hasMoreItems, styles.loadingContainer, theme.colors.text]);

    return (
      <View style={styles.container}>
        <FlatList
          data={displayedReciters}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          removeClippedSubviews={false}
          maxToRenderPerBatch={12}
          windowSize={7}
          initialNumToRender={numColumns * 3}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={handleLoadMore}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
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
