import React, {useEffect, useCallback} from 'react';
import {View, FlatList, Text} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useDuas} from '@/hooks/useDuas';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DuaListItem} from '@/components/duas/DuaListItem';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import Header from '@/components/Header';
import {Dua} from '@/types/dua';

const CategoryDetailScreen: React.FC = () => {
  const {categoryId} = useLocalSearchParams<{categoryId: string}>();
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const {
    selectedCategory,
    duasInCategory,
    selectCategory,
    isFavorite,
    toggleFavorite,
    setCurrentDua,
    loading,
  } = useDuas();

  // Load category data when categoryId changes
  useEffect(() => {
    if (categoryId) {
      selectCategory(categoryId);
    }
  }, [categoryId, selectCategory]);

  const handleDuaPress = useCallback(
    (dua: Dua, index: number) => {
      // Set current dua in store before navigating
      setCurrentDua(dua, index);
      router.push({
        pathname: '/duas/dua/[duaId]',
        params: {duaId: dua.id, categoryId: categoryId},
      });
    },
    [router, categoryId, setCurrentDua],
  );

  const handleFavoritePress = useCallback(
    (duaId: string) => {
      toggleFavorite(duaId);
    },
    [toggleFavorite],
  );

  const renderDuaItem = useCallback(
    ({item, index}: {item: Dua; index: number}) => (
      <DuaListItem
        dua={item}
        index={index}
        isFavorite={isFavorite(item.id)}
        onPress={() => handleDuaPress(item, index)}
        onFavoritePress={() => handleFavoritePress(item.id)}
      />
    ),
    [isFavorite, handleDuaPress, handleFavoritePress],
  );

  const keyExtractor = useCallback((item: Dua) => item.id, []);

  // Handle early return states
  if (!categoryId) {
    return null;
  }

  if (loading || !selectedCategory) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Loading..." onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={selectedCategory.title} onBack={() => router.back()} />

      <FlatList
        data={duasInCategory}
        renderItem={renderDuaItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No duas found in this category</Text>
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
      paddingTop: moderateScale(70),
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
