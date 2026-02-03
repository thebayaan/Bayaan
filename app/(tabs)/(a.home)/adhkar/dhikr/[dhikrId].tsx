import React, {useEffect, useCallback, useRef, useState, useMemo} from 'react';
import {View, Text, TouchableOpacity, InteractionManager} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import PagerView from 'react-native-pager-view';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrReader} from '@/components/adhkar/DhikrReader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr} from '@/types/adhkar';

// Memoized page component to prevent unnecessary re-renders
const DhikrPage = React.memo(function DhikrPage({
  dhikr,
  isFavorite,
  onFavoriteToggle,
  style,
}: {
  dhikr: Dhikr;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  style: object;
}) {
  return (
    <View style={style}>
      <DhikrReader
        dhikr={dhikr}
        isFavorite={isFavorite}
        onFavoriteToggle={onFavoriteToggle}
      />
    </View>
  );
});

const DhikrDetailScreen: React.FC = () => {
  const {dhikrId, categoryId, categoryShortTitle, superCategoryTitle} =
    useLocalSearchParams<{
      dhikrId: string;
      categoryId?: string;
      categoryShortTitle?: string;
      superCategoryTitle?: string;
    }>();
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pagerRef = useRef<PagerView>(null);

  // Track if the pager is ready (for loading other pages after initial render)
  const [pagerReady, setPagerReady] = useState(false);

  const {
    currentDhikr,
    currentDhikrIndex,
    adhkarInCategory,
    selectedCategory,
    selectCategory,
    setCurrentDhikr,
    isFavorite,
    toggleFavorite,
    getCategoryTitle,
    loading,
  } = useAdhkar();

  // Load category if we have categoryId but no selected category
  useEffect(() => {
    if (categoryId && !selectedCategory) {
      selectCategory(categoryId);
    }
  }, [categoryId, selectedCategory, selectCategory]);

  // Set current dhikr if we navigated directly with dhikrId
  useEffect(() => {
    if (dhikrId && adhkarInCategory.length > 0 && !currentDhikr) {
      const index = adhkarInCategory.findIndex(d => d.id === dhikrId);
      if (index !== -1) {
        setCurrentDhikr(adhkarInCategory[index], index);
      }
    }
  }, [dhikrId, adhkarInCategory, currentDhikr, setCurrentDhikr]);

  // After initial render and interactions complete, enable the full pager
  useEffect(() => {
    if (currentDhikr && adhkarInCategory.length > 1) {
      const task = InteractionManager.runAfterInteractions(() => {
        setPagerReady(true);
      });
      return () => task.cancel();
    }
  }, [currentDhikr, adhkarInCategory.length]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleFavoriteToggle = useCallback(
    (dhikr: Dhikr) => {
      toggleFavorite(dhikr.id);
    },
    [toggleFavorite],
  );

  // Handle page change
  const handlePageSelected = useCallback(
    (e: {nativeEvent: {position: number}}) => {
      const index = e.nativeEvent.position;
      if (adhkarInCategory[index]) {
        setCurrentDhikr(adhkarInCategory[index], index);
      }
    },
    [adhkarInCategory, setCurrentDhikr],
  );

  // Navigation info
  const totalAdhkar = adhkarInCategory.length;
  const isDataReady = !loading && currentDhikr && adhkarInCategory.length > 0;

  // Dynamic title: look up category title based on current dhikr
  // This updates when swiping to a dhikr from a different category
  const displayTitle = useMemo(() => {
    if (currentDhikr) {
      // First try to get title from the store's category titles map
      const dynamicTitle = getCategoryTitle(currentDhikr.categoryId);
      if (dynamicTitle) {
        return dynamicTitle;
      }
    }
    // Fall back to route params
    return (
      categoryShortTitle ||
      superCategoryTitle ||
      selectedCategory?.title ||
      'Dhikr'
    );
  }, [
    currentDhikr,
    getCategoryTitle,
    categoryShortTitle,
    superCategoryTitle,
    selectedCategory?.title,
  ]);

  // Memoize the pages to prevent recreation on every render
  const pages = useMemo(() => {
    if (!isDataReady || !pagerReady) return null;
    return adhkarInCategory.map(dhikr => (
      <DhikrPage
        key={dhikr.id}
        dhikr={dhikr}
        isFavorite={isFavorite(dhikr.id)}
        onFavoriteToggle={() => handleFavoriteToggle(dhikr)}
        style={styles.page}
      />
    ));
  }, [
    adhkarInCategory,
    isFavorite,
    handleFavoriteToggle,
    styles.page,
    isDataReady,
    pagerReady,
  ]);

  // Handle missing dhikrId
  if (!dhikrId) {
    return null;
  }

  // Still loading data
  if (loading || !currentDhikr) {
    return (
      <View style={styles.container}>
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
            </View>
            <View style={styles.headerPlaceholder} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  // Render header and content
  return (
    <View style={styles.container}>
      {/* Custom Header - always visible */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          {/* Back Button */}
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

          {/* Title with position */}
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayTitle}
            </Text>
            {totalAdhkar > 1 ? (
              <Text style={styles.positionText}>
                {currentDhikrIndex + 1} of {totalAdhkar}
              </Text>
            ) : null}
          </View>

          {/* Placeholder for symmetry */}
          <View style={styles.headerPlaceholder} />
        </View>
      </SafeAreaView>

      {/* Content area */}
      <View style={[styles.pagerContainer, {paddingBottom: insets.bottom}]}>
        {pagerReady && totalAdhkar > 1 ? (
          // Full pager with all pages (after interactions complete)
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={currentDhikrIndex}
            onPageSelected={handlePageSelected}
            overdrag={true}
            offscreenPageLimit={2}>
            {pages}
          </PagerView>
        ) : (
          // Show just the current dhikr immediately (no pager overhead)
          <View style={styles.page}>
            <DhikrReader
              dhikr={currentDhikr}
              isFavorite={isFavorite(currentDhikr.id)}
              onFavoriteToggle={() => handleFavoriteToggle(currentDhikr)}
            />
          </View>
        )}
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
    pagerContainer: {
      flex: 1,
    },
    pager: {
      flex: 1,
    },
    page: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });

export default DhikrDetailScreen;
