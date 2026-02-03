import React, {useMemo, useCallback, useEffect, useState} from 'react';
import {
  View,
  SectionList,
  FlatList,
  Text,
  TouchableOpacity,
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Icon} from '@rneui/themed';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {CategorySectionHeader} from '@/components/adhkar/CategorySectionHeader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {Dhikr, SuperCategory} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {shortenCategoryTitle} from '@/utils/adhkarUtils';

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
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {getSuperCategoryById} = useAdhkar();

  const [superCategory, setSuperCategory] = useState<SuperCategory | null>(
    null,
  );
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleDhikrPress = useCallback(
    (item: DhikrItem) => {
      router.push({
        pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
        params: {
          superId: superId,
          dhikrId: item.dhikr.id,
          globalIndex: item.globalIndex.toString(),
          categoryShortTitle: item.categoryShortTitle,
          superCategoryTitle: superCategory?.title,
        },
      });
    },
    [router, superId, superCategory?.title],
  );

  const renderItem = useCallback(
    ({item}: {item: DhikrItem}) => (
      <DhikrListItem
        dhikr={item.dhikr}
        index={item.index}
        onPress={() => handleDhikrPress(item)}
      />
    ),
    [handleDhikrPress],
  );

  const renderSectionHeader = useCallback(({section}: {section: Section}) => {
    return <CategorySectionHeader title={section.shortTitle} />;
  }, []);

  const keyExtractor = useCallback(
    (item: DhikrItem) => `dhikr-${item.dhikr.id}`,
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

  const InlineHeader = (
    <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>
    </SafeAreaView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {InlineHeader}
        <View style={styles.loadingContainer}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {InlineHeader}

      {isSingleCategory ? (
        <FlatList
          data={flatAdhkarList}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
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
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={7}
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
    headerSafeArea: {
      backgroundColor: theme.colors.background,
    },
    header: {
      height: moderateScale(56),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      padding: moderateScale(8),
    },
    headerTitle: {
      flex: 1,
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    headerPlaceholder: {
      width: moderateScale(40),
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
