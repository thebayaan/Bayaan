import React, {useMemo, useCallback, useEffect, useState} from 'react';
import {View, FlatList, Text} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {CategorySectionHeader} from '@/components/adhkar/CategorySectionHeader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import Header from '@/components/Header';
import {Dhikr, SuperCategory} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';

// List item types for the combined list
type ListItem =
  | {type: 'header'; categoryId: string; title: string; shortTitle: string}
  | {
      type: 'dhikr';
      dhikr: Dhikr;
      categoryId: string;
      categoryShortTitle: string;
      index: number;
      globalIndex: number;
    };

interface CategoryGroup {
  categoryId: string;
  categoryTitle: string;
  adhkar: Dhikr[];
}

const SuperCategoryScreen: React.FC = () => {
  const {superId} = useLocalSearchParams<{superId: string}>();
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const {getSuperCategoryById, setCurrentDhikr} = useAdhkar();

  // Local state for the combined list data
  const [superCategory, setSuperCategory] = useState<SuperCategory | null>(
    null,
  );
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [allAdhkar, setAllAdhkar] = useState<Dhikr[]>([]);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      if (!superId) return;

      setLoading(true);
      try {
        const data = await adhkarService.getAdhkarForSuperCategory(superId);
        if (data) {
          setSuperCategory(data.superCategory);
          setCategoryGroups(data.categoryGroups);

          // Flatten all adhkar for navigation
          const flatAdhkar = data.categoryGroups.flatMap(g => g.adhkar);
          setAllAdhkar(flatAdhkar);
        }
      } catch (error) {
        console.error('Failed to load super category data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [superId]);

  // Get super category from store as fallback for title
  const storedSuperCategory = useMemo(() => {
    if (!superId) return undefined;
    return getSuperCategoryById(superId);
  }, [superId, getSuperCategoryById]);

  // Build the combined list data
  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    let globalIndex = 0;

    for (const group of categoryGroups) {
      const shortTitle = shortenCategoryTitle(group.categoryTitle);

      // Add header
      items.push({
        type: 'header',
        categoryId: group.categoryId,
        title: group.categoryTitle,
        shortTitle,
      });

      // Add adhkar
      for (let i = 0; i < group.adhkar.length; i++) {
        items.push({
          type: 'dhikr',
          dhikr: group.adhkar[i],
          categoryId: group.categoryId,
          categoryShortTitle: shortTitle,
          index: i,
          globalIndex,
        });
        globalIndex++;
      }
    }

    return items;
  }, [categoryGroups]);

  // Count total adhkar
  const totalAdhkar = useMemo(() => {
    return categoryGroups.reduce((sum, g) => sum + g.adhkar.length, 0);
  }, [categoryGroups]);

  const handleDhikrPress = useCallback(
    (item: Extract<ListItem, {type: 'dhikr'}>) => {
      // Set the current dhikr in the store with global index for swipe navigation
      setCurrentDhikr(item.dhikr, item.globalIndex);

      router.push({
        pathname: '/(tabs)/(a.home)/adhkar/dhikr/[dhikrId]',
        params: {
          dhikrId: item.dhikr.id,
          categoryId: item.categoryId,
          categoryShortTitle: item.categoryShortTitle,
          superCategoryTitle: superCategory?.title,
        },
      });
    },
    [router, setCurrentDhikr, superCategory?.title],
  );

  const renderItem = useCallback(
    ({item, index}: {item: ListItem; index: number}) => {
      if (item.type === 'header') {
        return (
          <CategorySectionHeader
            title={item.shortTitle}
            isFirst={index === 0}
          />
        );
      }

      return (
        <DhikrListItem
          dhikr={item.dhikr}
          index={item.index}
          onPress={() => handleDhikrPress(item)}
        />
      );
    },
    [handleDhikrPress],
  );

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.type === 'header') {
      return `header-${item.categoryId}`;
    }
    return `dhikr-${item.dhikr.id}-${index}`;
  }, []);

  const getItemType = useCallback((item: ListItem) => item.type, []);

  // Handle early return states
  if (!superId) {
    return null;
  }

  const displayTitle =
    superCategory?.title || storedSuperCategory?.title || 'Loading...';

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={displayTitle} onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={displayTitle} onBack={() => router.back()} />

      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={undefined}
        contentContainerStyle={[
          styles.listContent,
          {paddingTop: insets.top + moderateScale(56)},
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No adhkar found</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerInfo}>
            <Text style={styles.headerText}>
              {totalAdhkar} {totalAdhkar === 1 ? 'dhikr' : 'adhkar'}
              {categoryGroups.length > 1 &&
                ` in ${categoryGroups.length} categories`}
            </Text>
          </View>
        }
      />
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
    headerInfo: {
      paddingHorizontal: moderateScale(16),
      marginBottom: moderateScale(8),
    },
    headerText: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
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

export default SuperCategoryScreen;
