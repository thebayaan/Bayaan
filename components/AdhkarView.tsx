import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {moderateScale, scale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useAdhkar} from '@/hooks/useAdhkar';
import {AdhkarBentoCard} from '@/components/adhkar/AdhkarBentoCard';
import {SuperCategory} from '@/types/adhkar';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {SavedAdhkarHero} from '@/components/hero/SavedAdhkarHero';

// Gap between cards
const CARD_GAP = moderateScale(8);

interface AdhkarViewProps {
  onCategoryPress: (superCategory: SuperCategory) => void;
  onSavedPress: () => void;
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
}: {
  categories: SuperCategory[];
  columnWidth: number;
  cardHeight: number;
  onPress: (category: SuperCategory) => void;
}) {
  return (
    <View style={styles.grid}>
      {categories.map(category => (
        <AdhkarBentoCard
          key={category.id}
          category={category}
          onPress={() => onPress(category)}
          width={columnWidth}
          height={cardHeight}
        />
      ))}
    </View>
  );
});

export const AdhkarView: React.FC<AdhkarViewProps> = ({
  onCategoryPress,
  onSavedPress,
}) => {
  const {theme} = useTheme();
  const {
    error,
    mainSuperCategories,
    otherSuperCategories,
    superCategoriesLoaded,
    savedIds,
  } = useAdhkar();
  const {width} = useWindowDimensions();

  // Calculate column dimensions
  const tileDimensions = useMemo(() => {
    const horizontalPadding = scale(width < 375 ? 12 : 16);
    const gap = CARD_GAP;
    const availableWidth = width - horizontalPadding * 2;
    const columnWidth = (availableWidth - gap) / 2;
    // 3:2 aspect ratio — cards are wider than tall
    const cardHeight = columnWidth * (2 / 3);

    return {
      columnWidth,
      cardHeight,
      horizontalPadding,
    };
  }, [width]);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingBottom: TOTAL_BOTTOM_PADDING,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      {/* Saved Hero Section - only shows when there are saved adhkar */}
      <SavedAdhkarHero savedCount={savedIds.size} onPress={onSavedPress} />

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
        <SectionHeader title="Other" theme={theme} />
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
  errorText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    paddingHorizontal: moderateScale(24),
  },
});

export default React.memo(AdhkarView);
