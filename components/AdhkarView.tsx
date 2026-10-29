import React, {useCallback, useMemo, useState} from 'react'; // @ai
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent, // @ai
} from 'react-native';
import {moderateScale, scale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkar} from '@/hooks/useAdhkar';
import {
  AdhkarBentoCard,
  TABLET_LABEL_OVERHEAD,
} from '@/components/adhkar/AdhkarBentoCard';
import {SuperCategory} from '@/types/adhkar';
import {useBottomInset} from '@/hooks/useBottomInset';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {
  AdhkarNowPlayingCard,
  useHasAdhkarSession,
} from '@/components/adhkar/AdhkarNowPlayingCard';
import {SavedAdhkarHero} from '@/components/hero/SavedAdhkarHero';
// @ai-start
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {computeGridLayout, pageSpacing} from '@/utils/gridLayout';
// @ai-end

// Gap between cards
const CARD_GAP = moderateScale(8);

interface AdhkarViewProps {
  onCategoryPress: (superCategory: SuperCategory) => void;
  onSavedPress: () => void;
  headerHeight: number;
}

// Memoized section header
const SectionHeader = React.memo(function SectionHeader({
  title,
  theme,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
      {title}
    </Text>
  );
});

// Interleave categories from left/right columns into row-major order
// so the visual order is: row1-left, row1-right, row2-left, row2-right, ...
function interleaveCategories(categories: SuperCategory[]): SuperCategory[] {
  const left = categories
    .filter(c => c.column === 'left')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const right = categories
    .filter(c => c.column === 'right')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const result: SuperCategory[] = [];
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < left.length) result.push(left[i]);
    if (i < right.length) result.push(right[i]);
  }
  return result;
}

// Memoized grid of uniform cards
const CategoryGrid = React.memo(function CategoryGrid({
  categories,
  columnWidth,
  cardHeight,
  onPress,
  gap, // @ai
  tablet = false, // @ai
}: {
  categories: SuperCategory[];
  columnWidth: number;
  cardHeight: number;
  onPress: (category: SuperCategory) => void;
  /** iPad: the gutter between cards and between rows. @ai */
  gap?: number;
  tablet?: boolean; // @ai
}) {
  return (
    <View style={[styles.grid, gap !== undefined && {gap}]}>
      {categories.map(category => (
        <AdhkarBentoCard
          key={category.id}
          category={category}
          onPress={() => onPress(category)}
          width={columnWidth}
          height={cardHeight}
          tablet={tablet} // @ai
        />
      ))}
    </View>
  );
});

// @ai-start
// @ai-start
/**
 * Two-column tile size for a grid `width` wide (the measured container).
 * Cards are 3:2, wider than tall.
 */
export function adhkarTileDimensions(width: number, gap: number) {
  const horizontalPadding = scale(width < 375 ? 12 : 16);
  const availableWidth = Math.max(0, width - horizontalPadding * 2);
  const columnWidth = Math.max(0, (availableWidth - gap) / 2);
  return {
    columnWidth,
    cardHeight: columnWidth * (2 / 3),
    horizontalPadding,
  };
}

/** Smallest card on the iPad grid (listening/04, Adhkar home). */
const TABLET_MIN_CARD_WIDTH = 160;

/**
 * The iPad grid for a pane `paneWidth` wide in a window `windowWidth` wide:
 * the window's page margin and gutter, columns from the pane, 3:2 images
 * with two label lines under them, and the hero cards span the grid.
 */
export function adhkarTabletLayout(paneWidth: number, windowWidth: number) {
  const {margin, gap} = pageSpacing(windowWidth);
  const {numColumns, itemWidth} = computeGridLayout(paneWidth, {
    minCardWidth: TABLET_MIN_CARD_WIDTH,
    horizontalPadding: margin,
    gap,
    minColumns: 2,
  });
  return {
    margin,
    gap,
    numColumns,
    columnWidth: itemWidth,
    cardHeight: itemWidth * (2 / 3) + TABLET_LABEL_OVERHEAD,
    heroWidth: paneWidth - margin * 2,
  };
}
// @ai-end

export const AdhkarView: React.FC<AdhkarViewProps> = ({
  onCategoryPress,
  onSavedPress,
  headerHeight,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('player');
  const bottomInset = useBottomInset();
  const {
    error,
    mainSuperCategories,
    otherSuperCategories,
    superCategoriesLoaded,
    savedIds,
  } = useAdhkar();
  const {width: windowWidth} = useWindowDimensions();
  const {isTablet} = useResponsive(); // @ai
  const hasAdhkarSession = useHasAdhkarSession();
  // @ai-start
  // Size the grid from the scroll view's own width, not the window: on iPad
  // it sits in a capped column beside the sidebar, where window-sized cards
  // no longer fit two per row. The window is only a first guess.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setContainerWidth(prev => (prev === next ? prev : next));
  }, []);
  const width = containerWidth ?? windowWidth;

  const tileDimensions = useMemo(
    () => adhkarTileDimensions(width, CARD_GAP),
    [width],
  );
  const tablet = useMemo(
    () => (isTablet ? adhkarTabletLayout(width, windowWidth) : null),
    [isTablet, width, windowWidth],
  );
  // @ai-end

  // Interleave categories for row-major grid order
  const mainCategories = useMemo(
    () => interleaveCategories(mainSuperCategories),
    [mainSuperCategories],
  );
  const otherCategories = useMemo(
    () => interleaveCategories(otherSuperCategories),
    [otherSuperCategories],
  );

  // Loading state - only show if data hasn't been preloaded by AppInitializer
  if (!superCategoriesLoaded) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, {color: theme.colors.error}]}>
          {error}
        </Text>
      </View>
    );
  }

  // @ai-start
  if (tablet) {
    const hasHero = hasAdhkarSession || savedIds.size > 0;
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingBottom: bottomInset + 24,
          paddingHorizontal: tablet.margin,
        }}
        contentInsetAdjustmentBehavior="never"
        onLayout={handleLayout}
        showsVerticalScrollIndicator={false}>
        {hasHero ? (
          <View style={[styles.tabletHero, {width: tablet.heroWidth}]}>
            {hasAdhkarSession && <AdhkarNowPlayingCard variant="row" />}
            <SavedAdhkarHero
              savedCount={savedIds.size}
              width={tablet.heroWidth}
            />
          </View>
        ) : null}
        <CategoryGrid
          categories={mainCategories}
          columnWidth={tablet.columnWidth}
          cardHeight={tablet.cardHeight}
          onPress={onCategoryPress}
          gap={tablet.gap}
          tablet
        />
        <Text
          style={[styles.tabletSectionTitle, {color: theme.colors.text}]}
          accessibilityRole="header">
          {t('adhkar.otherSection')}
        </Text>
        <CategoryGrid
          categories={otherCategories}
          columnWidth={tablet.columnWidth}
          cardHeight={tablet.cardHeight}
          onPress={onCategoryPress}
          gap={tablet.gap}
          tablet
        />
      </ScrollView>
    );
  }
  // @ai-end

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: headerHeight,
          paddingBottom: bottomInset,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      onLayout={handleLayout} // @ai
      showsVerticalScrollIndicator={false}>
      {/* Saved Hero Section - only shows when there are saved adhkar */}
      {hasAdhkarSession && (
        <View
          style={{
            paddingHorizontal: tileDimensions.horizontalPadding,
            marginBottom: moderateScale(8),
          }}>
          <AdhkarNowPlayingCard variant="row" />
        </View>
      )}
      <SavedAdhkarHero savedCount={savedIds.size} />

      {/* Main Section */}
      <View
        style={{
          paddingHorizontal: tileDimensions.horizontalPadding,
          marginTop: savedIds.size > 0 ? moderateScale(8) : 0,
        }}>
        <CategoryGrid
          categories={mainCategories}
          columnWidth={tileDimensions.columnWidth}
          cardHeight={tileDimensions.cardHeight}
          onPress={onCategoryPress}
        />
      </View>

      {/* Other Section */}
      <View style={{paddingHorizontal: tileDimensions.horizontalPadding}}>
        <SectionHeader title={t('adhkar.otherSection')} theme={theme} />
        <CategoryGrid
          categories={otherCategories}
          columnWidth={tileDimensions.columnWidth}
          cardHeight={tileDimensions.cardHeight}
          onPress={onCategoryPress}
        />
      </View>
    </ScrollView>
  );
};
// @ai-end

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(16),
    marginTop: moderateScale(16),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  // @ai-start
  tabletHero: {
    gap: 12,
    marginBottom: 24,
  },
  tabletSectionTitle: {
    fontSize: 22,
    fontFamily: 'Manrope-Bold',
    textAlign: 'left',
    marginTop: 32,
    marginBottom: 12,
  },
  // @ai-end
  errorText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    paddingHorizontal: moderateScale(24),
  },
});

export default React.memo(AdhkarView);
