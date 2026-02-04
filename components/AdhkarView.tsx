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

// Base height unit for bento cards (Spotify-style proportions)
// 1x cards are short/wide, 2x cards span two 1x cards + gap
const ROW_HEIGHT_UNIT = 62;

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

// Gap between cards (must match marginBottom in AdhkarBentoCard)
const CARD_GAP = moderateScale(8);

// Memoized bento column (matches ExploreView pattern)
const BentoColumn = React.memo(function BentoColumn({
  categories,
  columnWidth,
  baseHeight,
  onPress,
}: {
  categories: SuperCategory[];
  columnWidth: number;
  baseHeight: number;
  onPress: (category: SuperCategory) => void;
}) {
  return (
    <View style={styles.column}>
      {categories.map(category => {
        // Account for the gap that would exist between stacked 1x cards
        // A 2x card should equal two 1x cards + the gap between them
        // Formula: height = baseHeight * multiplier + gap * (multiplier - 1)
        const gapAdjustment = CARD_GAP * (category.heightMultiplier - 1);
        const cardHeight =
          baseHeight * category.heightMultiplier + gapAdjustment;

        return (
          <AdhkarBentoCard
            key={category.id}
            category={category}
            onPress={() => onPress(category)}
            width={columnWidth}
            height={cardHeight}
          />
        );
      })}
    </View>
  );
});

// Helper function to organize categories by column
function organizeByColumn(categories: SuperCategory[]): {
  leftColumn: SuperCategory[];
  rightColumn: SuperCategory[];
} {
  const leftColumn = categories
    .filter(cat => cat.column === 'left')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rightColumn = categories
    .filter(cat => cat.column === 'right')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {leftColumn, rightColumn};
}

export const AdhkarView: React.FC<AdhkarViewProps> = ({onCategoryPress, onSavedPress}) => {
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
    const gap = moderateScale(8);
    const availableWidth = width - horizontalPadding * 2;
    const columnWidth = (availableWidth - gap) / 2;

    return {
      columnWidth,
      baseHeight: moderateScale(ROW_HEIGHT_UNIT),
      horizontalPadding,
    };
  }, [width]);

  // Organize categories into columns (from database)
  const mainLayout = useMemo(
    () => organizeByColumn(mainSuperCategories),
    [mainSuperCategories],
  );
  const otherLayout = useMemo(
    () => organizeByColumn(otherSuperCategories),
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
      <View style={[
        styles.bentoGrid,
        {
          paddingHorizontal: tileDimensions.horizontalPadding,
          marginTop: savedIds.size > 0 ? moderateScale(8) : 0,
        }
      ]}>
        <BentoColumn
          categories={mainLayout.leftColumn}
          columnWidth={tileDimensions.columnWidth}
          baseHeight={tileDimensions.baseHeight}
          onPress={onCategoryPress}
        />
        <BentoColumn
          categories={mainLayout.rightColumn}
          columnWidth={tileDimensions.columnWidth}
          baseHeight={tileDimensions.baseHeight}
          onPress={onCategoryPress}
        />
      </View>

      {/* Other Section */}
      <View style={{paddingHorizontal: tileDimensions.horizontalPadding}}>
        <SectionHeader title="Other" theme={theme} />
      </View>
      <View style={[styles.bentoGrid, {paddingHorizontal: tileDimensions.horizontalPadding}]}>
        <BentoColumn
          categories={otherLayout.leftColumn}
          columnWidth={tileDimensions.columnWidth}
          baseHeight={tileDimensions.baseHeight}
          onPress={onCategoryPress}
        />
        <BentoColumn
          categories={otherLayout.rightColumn}
          columnWidth={tileDimensions.columnWidth}
          baseHeight={tileDimensions.baseHeight}
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
  bentoGrid: {
    flexDirection: 'row',
    gap: moderateScale(8),
  },
  column: {
    flex: 1,
  },
  errorText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    paddingHorizontal: moderateScale(24),
  },
});

export default React.memo(AdhkarView);
