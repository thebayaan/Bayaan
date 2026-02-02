import React from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useDuas} from '@/hooks/useDuas';
import {CategoryCard} from '@/components/duas/CategoryCard';
import {DuaCategory, DuaBroadTag} from '@/types/dua';
import {getTagColor, DUA_TAG_NAMES, DUA_TAG_ORDER} from '@/constants/duaColors';
import {Theme} from '@/utils/themeUtils';

interface DuasViewProps {
  onCategoryPress: (category: DuaCategory) => void;
}

// Card dimensions for getItemLayout optimization
const CARD_WIDTH = moderateScale(160);
const CARD_GAP = moderateScale(12);

// Memoized FlatList component for horizontal category lists
const MemoizedCategoryFlatList = React.memo(
  ({
    categories,
    tagColor,
    onCategoryPress,
  }: {
    categories: DuaCategory[];
    tagColor: string;
    onCategoryPress: (category: DuaCategory) => void;
    theme: Theme;
  }) => (
    <FlatList
      data={categories}
      keyExtractor={item => item.id}
      renderItem={({item}) => (
        <CategoryCard
          category={item}
          tagColor={tagColor}
          onPress={() => onCategoryPress(item)}
        />
      )}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={3}
      initialNumToRender={5}
      getItemLayout={(_, index) => ({
        length: CARD_WIDTH + CARD_GAP,
        offset: (CARD_WIDTH + CARD_GAP) * index,
        index,
      })}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.categories === nextProps.categories &&
    prevProps.tagColor === nextProps.tagColor &&
    prevProps.onCategoryPress === nextProps.onCategoryPress &&
    prevProps.theme === nextProps.theme,
);

MemoizedCategoryFlatList.displayName = 'MemoizedCategoryFlatList';

// Memoized section component
interface SectionProps {
  title: string;
  categories: DuaCategory[];
  tagColor: string;
  onCategoryPress: (category: DuaCategory) => void;
  theme: Theme;
}

const Section = React.memo(
  ({title, categories, tagColor, onCategoryPress, theme}: SectionProps) => {
    if (!categories || categories.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
          {title}
        </Text>
        <MemoizedCategoryFlatList
          categories={categories}
          tagColor={tagColor}
          onCategoryPress={onCategoryPress}
          theme={theme}
        />
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.categories === nextProps.categories &&
    prevProps.tagColor === nextProps.tagColor &&
    prevProps.onCategoryPress === nextProps.onCategoryPress &&
    prevProps.theme === nextProps.theme,
);

Section.displayName = 'Section';

export const DuasView: React.FC<DuasViewProps> = ({onCategoryPress}) => {
  const {theme} = useTheme();
  const {groupedCategories, loading, error} = useDuas();

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}>
      {DUA_TAG_ORDER.map(tag => {
        const categories = groupedCategories[tag as DuaBroadTag];
        if (!categories || categories.length === 0) return null;

        return (
          <Section
            key={tag}
            title={DUA_TAG_NAMES[tag as DuaBroadTag]}
            categories={categories}
            tagColor={getTagColor(tag)}
            onCategoryPress={onCategoryPress}
            theme={theme}
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(32),
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: moderateScale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-SemiBold',
    marginBottom: moderateScale(16),
    paddingHorizontal: moderateScale(16),
  },
  listContent: {
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(12),
  },
  errorText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
    paddingHorizontal: moderateScale(24),
  },
});

export default React.memo(DuasView, (prevProps, nextProps) => {
  return prevProps.onCategoryPress === nextProps.onCategoryPress;
});
