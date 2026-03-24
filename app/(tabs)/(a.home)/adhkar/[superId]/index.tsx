import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  View,
  SectionList,
  FlatList,
  Text,
  ViewToken,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  Link,
} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {CategorySectionHeader} from '@/components/adhkar/CategorySectionHeader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {PlayAllButton} from '@/components/adhkar/PlayAllButton';
import {Dhikr, SuperCategory} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';
import {useAdhkarPlayAllStore} from '@/store/adhkarPlayAllStore';
import {useHeaderHeight} from '@react-navigation/elements';

interface DhikrItem {
  dhikr: Dhikr;
  index: number;
  globalIndex: number;
  categoryShortTitle: string;
}

interface Section {
  title: string;
  shortTitle: string;
  categoryId: string;
  data: DhikrItem[];
}

interface CategoryGroup {
  categoryId: string;
  categoryTitle: string;
  adhkar: Dhikr[];
}

const SuperCategoryListScreen: React.FC = () => {
  const {superId} = useLocalSearchParams<{superId: string}>();
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();

  const {getSuperCategoryById} = useAdhkar();

  // Play All store
  const isPlayAllMode = useAdhkarPlayAllStore(state => state.isPlayAllMode);
  const playAllSourceId = useAdhkarPlayAllStore(state => state.sourceId);
  const startPlayAll = useAdhkarPlayAllStore(state => state.startPlayAll);
  const stopPlayAll = useAdhkarPlayAllStore(state => state.stopPlayAll);

  // Check if currently playing this category
  const isThisCategoryPlaying = isPlayAllMode && playAllSourceId === superId;

  const [superCategory, setSuperCategory] = useState<SuperCategory | null>(
    null,
  );
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function loadData() {
      if (!superId) return;

      setLoading(true);
      try {
        const data = await adhkarService.getAdhkarForSuperCategory(superId);
        if (data) {
          setSuperCategory(data.superCategory);
          setCategoryGroups(data.categoryGroups);
        }
      } catch (error) {
        console.error('Failed to load super category data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [superId]);

  const storedSuperCategory = useMemo(() => {
    if (!superId) return undefined;
    return getSuperCategoryById(superId);
  }, [superId, getSuperCategoryById]);

  const displayTitle =
    superCategory?.title || storedSuperCategory?.title || 'Loading...';

  // Determine if this is a single-category super category
  const isSingleCategory = categoryGroups.length === 1;

  // Build sections for SectionList (multi-category view)
  const sections: Section[] = useMemo(() => {
    if (isSingleCategory) return [];

    let globalIndex = 0;
    return categoryGroups.map(group => {
      const shortTitle = shortenCategoryTitle(group.categoryTitle);
      const data: DhikrItem[] = group.adhkar.map((dhikr, index) => {
        const item = {
          dhikr,
          index,
          globalIndex,
          categoryShortTitle: shortTitle,
        };
        globalIndex++;
        return item;
      });

      return {
        title: group.categoryTitle,
        shortTitle,
        categoryId: group.categoryId,
        data,
      };
    });
  }, [categoryGroups, isSingleCategory]);

  // Build flat list for single-category view
  const flatAdhkarList: DhikrItem[] = useMemo(() => {
    if (!isSingleCategory || categoryGroups.length === 0) return [];

    const group = categoryGroups[0];
    const shortTitle = shortenCategoryTitle(group.categoryTitle);
    return group.adhkar.map((dhikr, index) => ({
      dhikr,
      index,
      globalIndex: index,
      categoryShortTitle: shortTitle,
    }));
  }, [categoryGroups, isSingleCategory]);

  // Build full adhkar list for Play All (works for both single and multi-category)
  const allAdhkarForPlayAll: Dhikr[] = useMemo(() => {
    if (categoryGroups.length === 0) return [];
    return categoryGroups.flatMap(group => group.adhkar);
  }, [categoryGroups]);

  // Play All handler
  const handlePlayAll = useCallback(() => {
    if (!superId) return;

    if (isThisCategoryPlaying) {
      // Stop if already playing this category
      stopPlayAll();
      return;
    }

    if (allAdhkarForPlayAll.length === 0) return;

    // Determine source type based on superId
    let sourceType: 'morning' | 'evening' | 'saved' | 'other' = 'other';
    if (superId === 'morning-adhkar') {
      sourceType = 'morning';
    } else if (superId === 'evening-adhkar') {
      sourceType = 'evening';
    }

    startPlayAll(allAdhkarForPlayAll, 0, sourceType, superId);

    // Navigate to reader with first dhikr
    const firstDhikr = allAdhkarForPlayAll[0];
    const firstCategoryTitle =
      categoryGroups.length > 0
        ? shortenCategoryTitle(categoryGroups[0].categoryTitle)
        : '';

    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {
        superId,
        dhikrId: firstDhikr.id,
        globalIndex: '0',
        categoryShortTitle: firstCategoryTitle,
        superCategoryTitle: superCategory?.title,
        playAll: 'true',
      },
    });
  }, [
    superId,
    isThisCategoryPlaying,
    allAdhkarForPlayAll,
    categoryGroups,
    superCategory?.title,
    startPlayAll,
    stopPlayAll,
    router,
  ]);

  // Set native header options dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerStyle: {backgroundColor: 'transparent'},
      headerTintColor: theme.colors.text,
      headerShadowVisible: false,
      title: '',
      headerBackTitle: '',
      headerTitleAlign: 'center',
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{padding: moderateScale(4)}}>
          <Ionicons
            name="chevron-back"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </Pressable>
      ),
      headerTitle: () => (
        <View style={{alignItems: 'center'}}>
          <Text
            style={{
              fontSize: moderateScale(16),
              fontFamily: theme.fonts.semiBold,
              color: theme.colors.text,
            }}
            numberOfLines={1}>
            {displayTitle}
          </Text>
          {currentSectionTitle && !isSingleCategory && (
            <Text
              style={{
                fontSize: moderateScale(12),
                fontFamily: theme.fonts.regular,
                color: theme.colors.textSecondary,
                marginTop: moderateScale(2),
              }}
              numberOfLines={1}>
              {currentSectionTitle}
            </Text>
          )}
        </View>
      ),
      headerRight: () => (
        <View style={{paddingHorizontal: moderateScale(4)}}>
          <PlayAllButton
            onPress={handlePlayAll}
            isPlaying={isThisCategoryPlaying}
            disabled={loading || allAdhkarForPlayAll.length === 0}
          />
        </View>
      ),
    });
  }, [
    navigation,
    displayTitle,
    currentSectionTitle,
    isSingleCategory,
    handlePlayAll,
    isThisCategoryPlaying,
    loading,
    allAdhkarForPlayAll.length,
    theme,
  ]);

  const renderItem = useCallback(
    ({item}: {item: DhikrItem}) => (
      <Link
        href={{
          pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
          params: {
            superId: superId,
            dhikrId: item.dhikr.id,
            globalIndex: item.globalIndex.toString(),
            categoryShortTitle: item.categoryShortTitle,
            superCategoryTitle: superCategory?.title,
          },
        }}
        asChild>
        <Pressable style={StyleSheet.flatten([{flex: 1}])}>
          {USE_GLASS ? (
            <Link.AppleZoom>
              <DhikrListItem dhikr={item.dhikr} index={item.index} />
            </Link.AppleZoom>
          ) : (
            <DhikrListItem dhikr={item.dhikr} index={item.index} />
          )}
        </Pressable>
      </Link>
    ),
    [superId, superCategory?.title],
  );

  const renderSectionHeader = useCallback(({section}: {section: Section}) => {
    return <CategorySectionHeader title={section.shortTitle} />;
  }, []);

  // Track current visible section for the subtitle
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0) {
        const firstItem = viewableItems[0];
        if (firstItem.section) {
          setCurrentSectionTitle((firstItem.section as Section).shortTitle);
        }
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const keyExtractor = useCallback(
    (item: DhikrItem) => `dhikr-${item?.dhikr?.id ?? 'unknown'}`,
    [],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No adhkar found</Text>
      </View>
    ),
    [styles.emptyContainer, styles.emptyText],
  );

  if (!superId) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: headerHeight}]}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isSingleCategory ? (
        <FlatList
          data={flatAdhkarList}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          contentInset={USE_GLASS ? {top: headerHeight} : undefined}
          contentOffset={
            USE_GLASS ? {x: 0, y: -headerHeight} : undefined
          }
          scrollIndicatorInsets={
            USE_GLASS ? {top: headerHeight} : undefined
          }
          style={
            !USE_GLASS ? {marginTop: headerHeight} : undefined
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={ListEmptyComponent}
        />
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          contentInset={USE_GLASS ? {top: headerHeight} : undefined}
          contentOffset={
            USE_GLASS ? {x: 0, y: -headerHeight} : undefined
          }
          scrollIndicatorInsets={
            USE_GLASS ? {top: headerHeight} : undefined
          }
          style={
            !USE_GLASS ? {marginTop: headerHeight} : undefined
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={7}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={ListEmptyComponent}
        />
      )}
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
    listContent: {
      paddingBottom: moderateScale(100),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: moderateScale(100),
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

export default SuperCategoryListScreen;
