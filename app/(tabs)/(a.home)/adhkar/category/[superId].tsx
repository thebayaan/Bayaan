import React, {useMemo, useCallback} from 'react';
import {View, FlatList, Text} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {CategoryCard} from '@/components/adhkar/CategoryCard';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import Header from '@/components/Header';
import {AdhkarCategory} from '@/types/adhkar';

const SubcategoryScreen: React.FC = () => {
  const {superId} = useLocalSearchParams<{superId: string}>();
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const {categories, loading, getSuperCategoryById} = useAdhkar();

  // Get the super category from the store (database)
  const superCategory = useMemo(() => {
    if (!superId) return undefined;
    return getSuperCategoryById(superId);
  }, [superId, getSuperCategoryById]);

  // Filter categories to only show subcategories of this super category
  const subcategories = useMemo(() => {
    if (!superCategory || !categories.length) return [];

    return categories.filter(cat => superCategory.categoryIds.includes(cat.id));
  }, [superCategory, categories]);

  const handleSubcategoryPress = useCallback(
    (category: AdhkarCategory) => {
      router.push({
        pathname: '/(tabs)/(a.home)/adhkar/[categoryId]',
        params: {categoryId: category.id},
      });
    },
    [router],
  );

  const renderSubcategory = useCallback(
    ({item}: {item: AdhkarCategory}) => (
      <View style={styles.cardWrapper}>
        <CategoryCard
          category={item}
          tagColor={superCategory?.color || '#6366F1'}
          onPress={() => handleSubcategoryPress(item)}
          width={undefined} // Full width
          height={moderateScale(100)}
        />
      </View>
    ),
    [superCategory, handleSubcategoryPress, styles.cardWrapper],
  );

  const keyExtractor = useCallback((item: AdhkarCategory) => item.id, []);

  // Handle early return states
  if (!superId || !superCategory) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Loading..." onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={superCategory.title} onBack={() => router.back()} />

      <FlatList
        data={subcategories}
        renderItem={renderSubcategory}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          {paddingTop: insets.top + moderateScale(56)},
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No subcategories found</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerInfo}>
            <Text style={styles.headerText}>
              {subcategories.length}{' '}
              {subcategories.length === 1 ? 'category' : 'categories'}
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
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(100),
    },
    cardWrapper: {
      marginBottom: moderateScale(12),
    },
    headerInfo: {
      marginBottom: moderateScale(16),
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

export default SubcategoryScreen;
