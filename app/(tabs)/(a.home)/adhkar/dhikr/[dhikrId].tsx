import React, {useEffect, useCallback, useRef, useState, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
// PagerView kept for potential revert
// import PagerView from 'react-native-pager-view';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// Memoized page component to prevent unnecessary re-renders
const DhikrPage = React.memo(function DhikrPage({
  dhikr,
  isFavorite,
  onFavoriteToggle,
}: {
  dhikr: Dhikr;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
}) {
  return (
    <View style={{width: SCREEN_WIDTH, flex: 1}}>
      <DhikrReader
        dhikr={dhikr}
        isFavorite={isFavorite}
        onFavoriteToggle={onFavoriteToggle}
      />
    </View>
  );
});

interface CategoryTitleMap {
  [categoryId: string]: string;
}

const DhikrDetailScreen: React.FC = () => {
  const {
    dhikrId,
    superId,
    globalIndex: globalIndexParam,
    categoryShortTitle: initialCategoryTitle,
    superCategoryTitle,
  } = useLocalSearchParams<{
    dhikrId: string;
    superId?: string;
    globalIndex?: string;
    categoryShortTitle?: string;
    superCategoryTitle?: string;
  }>();

  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const flatListRef = useRef<FlatList<Dhikr>>(null);

  // Parse initial index from params
  const initialIndex = globalIndexParam ? parseInt(globalIndexParam, 10) : 0;

  // Local state - load data in this screen for faster navigation
  const [adhkarList, setAdhkarList] = useState<Dhikr[]>([]);
  const [categoryTitles, setCategoryTitles] = useState<CategoryTitleMap>({});
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Get favorite functions from hook
  const {isFavorite, toggleFavorite} = useAdhkar();

  // Load data on mount - this runs after navigation completes
  useEffect(() => {
    async function loadData() {
      if (!superId) {
        // If no superId, we can't load the list
        // This might happen for direct navigation - handle gracefully
        setIsDataLoaded(true);
        return;
      }

      try {
        const data = await adhkarService.getAdhkarForSuperCategory(superId);
        if (data) {
          // Flatten all adhkar
          const flatAdhkar = data.categoryGroups.flatMap(g => g.adhkar);
          setAdhkarList(flatAdhkar);

          // Build category titles map
          const titlesMap: CategoryTitleMap = {};
          data.categoryGroups.forEach(group => {
            titlesMap[group.categoryId] = shortenCategoryTitle(
              group.categoryTitle,
            );
          });
          setCategoryTitles(titlesMap);
        }
      } catch (error) {
        console.error('Failed to load adhkar data:', error);
      } finally {
        setIsDataLoaded(true);
      }
    }

    loadData();
  }, [superId]);

  // Current dhikr based on index
  const currentDhikr = useMemo(() => {
    return adhkarList[currentIndex] || null;
  }, [adhkarList, currentIndex]);

  // Dynamic title based on current dhikr's category
  const displayTitle = useMemo(() => {
    if (currentDhikr && categoryTitles[currentDhikr.categoryId]) {
      return categoryTitles[currentDhikr.categoryId];
    }
    return initialCategoryTitle || superCategoryTitle || 'Dhikr';
  }, [currentDhikr, categoryTitles, initialCategoryTitle, superCategoryTitle]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleFavoriteToggle = useCallback(
    (dhikr: Dhikr) => {
      toggleFavorite(dhikr.id);
    },
    [toggleFavorite],
  );

  // Handle viewable items change for FlatList
  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // getItemLayout for instant scroll positioning (no measurement needed)
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  // Render item for FlatList
  const renderItem = useCallback(
    ({item}: {item: Dhikr}) => {
      return (
        <DhikrPage
          dhikr={item}
          isFavorite={isFavorite(item.id)}
          onFavoriteToggle={() => handleFavoriteToggle(item)}
        />
      );
    },
    [isFavorite, handleFavoriteToggle],
  );

  const keyExtractor = useCallback((item: Dhikr) => item.id, []);

  // Handle missing dhikrId
  if (!dhikrId) {
    return null;
  }

  const totalAdhkar = adhkarList.length;

  // Header component (used in both loading and loaded states)
  const Header = (
    <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={1}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
          {totalAdhkar > 1 && (
            <Text style={styles.positionText}>
              {currentIndex + 1} of {totalAdhkar}
            </Text>
          )}
        </View>
        <View style={styles.headerPlaceholder} />
      </View>
    </SafeAreaView>
  );

  // Still loading data
  if (!isDataLoaded) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  // No data available
  if (adhkarList.length === 0) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>No adhkar found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Header}

      {/* Horizontal FlatList with paging - much better virtualization than PagerView */}
      <View style={[styles.listContainer, {paddingBottom: insets.bottom}]}>
        <FlatList
          ref={flatListRef}
          data={adhkarList}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Performance optimizations
          windowSize={3}
          maxToRenderPerBatch={2}
          removeClippedSubviews={true}
          initialNumToRender={1}
          // Smooth scrolling
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="start"
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerSafeArea: {
      backgroundColor: theme.colors.background,
    },
    header: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      padding: moderateScale(8),
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    positionText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    headerPlaceholder: {
      width: moderateScale(40),
    },
    listContainer: {
      flex: 1,
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

export default DhikrDetailScreen;
