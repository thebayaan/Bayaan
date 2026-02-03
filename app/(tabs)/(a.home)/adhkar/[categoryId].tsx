import React, {useEffect, useCallback, useMemo} from 'react';
import {View, FlatList, Text} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import Header from '@/components/Header';
import {Dhikr} from '@/types/adhkar';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';

const CategoryDetailScreen: React.FC = () => {
  const {categoryId, title} = useLocalSearchParams<{
    categoryId: string;
    title?: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const {
    selectedCategory,
    adhkarInCategory,
    selectCategory,
    setCurrentDhikr,
    loading,
  } = useAdhkar();

  // Load category data when categoryId changes
  useEffect(() => {
    if (categoryId) {
      selectCategory(categoryId);
    }
  }, [categoryId, selectCategory]);

  // Compute the short title for display and navigation
  const shortTitle = useMemo(() => {
    if (title) return title;
    if (selectedCategory) return shortenCategoryTitle(selectedCategory.title);
    return 'Dhikr';
  }, [title, selectedCategory]);

  const handleDhikrPress = useCallback(
    (dhikr: Dhikr, index: number) => {
      // Set current dhikr in store before navigating
      setCurrentDhikr(dhikr, index);
      router.push({
        pathname: '/adhkar/dhikr/[dhikrId]',
        params: {
          dhikrId: dhikr.id,
          categoryId: categoryId,
          categoryShortTitle: shortTitle,
        },
      });
    },
    [router, categoryId, setCurrentDhikr, shortTitle],
  );

  const renderDhikrItem = useCallback(
    ({item, index}: {item: Dhikr; index: number}) => (
      <DhikrListItem
        dhikr={item}
        index={index}
        onPress={() => handleDhikrPress(item, index)}
      />
    ),
    [handleDhikrPress],
  );

  const keyExtractor = useCallback((item: Dhikr) => item.id, []);

  // Handle early return states
  if (!categoryId) {
    return null;
  }

  if (loading || !selectedCategory) {
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
      <Header title={shortTitle} onBack={() => router.back()} />

      <FlatList
        data={adhkarInCategory}
        renderItem={renderDhikrItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          {paddingTop: insets.top + moderateScale(56)},
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No adhkar found in this category
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

export default CategoryDetailScreen;
