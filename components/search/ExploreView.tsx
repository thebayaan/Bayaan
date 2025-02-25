import React from 'react';
import {View, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {
  CategoryCard,
  CategoryCardProps,
} from '@/components/browse/CategoryCard';
import {moderateScale, scale} from 'react-native-size-matters';
import {SearchInput} from '@/components/SearchInput';
import {useTheme} from '@/hooks/useTheme';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInUp,
  Layout,
} from 'react-native-reanimated';
import {noop} from 'lodash';
import {useWindowDimensions} from 'react-native';

interface BrowseCategory extends Omit<CategoryCardProps, 'onPress'> {
  route: string;
}

const RECITER_CATEGORIES: BrowseCategory[] = [
  {
    id: 'all-reciters',
    title: 'Browse All Reciters',
    backgroundColor: '#1E40AF',
    icon: {name: 'users', type: 'feather'},
    route: '/reciters',
  },
  {
    id: 'favorite-reciters',
    title: 'Favorite Reciters',
    backgroundColor: '#059669',
    icon: {name: 'heart', type: 'feather'},
    route: '/favorite-reciters',
  },
  {
    id: 'daily-wird',
    title: 'Daily Wird',
    backgroundColor: '#059669',
    icon: {name: 'sun', type: 'feather'},
    route: '/daily-wird',
  },
  {
    id: 'most-recited',
    title: 'Most Recited',
    backgroundColor: '#2563EB',
    icon: {name: 'trending-up', type: 'feather'},
    route: '/most-recited',
  },
];

const SURAH_CATEGORIES: BrowseCategory[] = [
  {
    id: 'all-surahs',
    title: 'Browse All Surahs',
    backgroundColor: '#7C3AED',
    icon: {name: 'book', type: 'feather'},
    route: '/surahs',
  },
  {
    id: 'favorite-surahs',
    title: 'Favorite Surahs',
    backgroundColor: '#DC2626',
    icon: {name: 'heart', type: 'feather'},
    route: '/favorite-surahs',
  },
  {
    id: 'juz-amma',
    title: 'Juz Amma',
    backgroundColor: '#1E40AF',
    icon: {name: 'book-open', type: 'feather'},
    route: '/juz-amma',
  },
  {
    id: 'heart-of-quran',
    title: 'Heart of Quran',
    backgroundColor: '#DC2626',
    icon: {name: 'heart', type: 'feather'},
    route: '/heart',
  },
  {
    id: 'short-surahs',
    title: 'Short Surahs',
    backgroundColor: '#EA580C',
    icon: {name: 'clock', type: 'feather'},
    route: '/short-surahs',
  },
  {
    id: 'meccan',
    title: 'Meccan Surahs',
    backgroundColor: '#0D9488',
    icon: {name: 'map', type: 'feather'},
    route: '/meccan',
  },
  {
    id: 'medinan',
    title: 'Medinan Surahs',
    backgroundColor: '#7C3AED',
    icon: {name: 'home', type: 'feather'},
    route: '/medinan',
  },
];

interface ExploreViewProps {
  onSearchPress: () => void;
}

// Add this before the ExploreView component
const Separator = () => <View style={styles.separator} />;

export function ExploreView({onSearchPress}: ExploreViewProps) {
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();

  const handleCategoryPress = (route: string) => {
    router.push(route);
  };

  const renderRow = ({index}: {index: number}) => {
    const reciterItem = RECITER_CATEGORIES[index];
    const surahItem = SURAH_CATEGORIES[index];

    return (
      <View style={styles.row}>
        {reciterItem && (
          <Animated.View
            entering={FadeInDown.delay(index * 100)}
            style={styles.column}>
            <CategoryCard
              {...reciterItem}
              onPress={() => handleCategoryPress(reciterItem.route)}
            />
          </Animated.View>
        )}
        {surahItem && (
          <Animated.View
            entering={FadeInDown.delay(index * 100)}
            style={styles.column}>
            <CategoryCard
              {...surahItem}
              onPress={() => handleCategoryPress(surahItem.route)}
            />
          </Animated.View>
        )}
      </View>
    );
  };

  // Calculate responsive horizontal padding based on screen width
  const horizontalPadding = scale(width < 375 ? 12 : 16);

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      layout={Layout.duration(300)}
      style={[styles.content]}>
      <Animated.View
        entering={FadeIn}
        style={[
          styles.header,
          {
            paddingTop: insets.top + moderateScale(48),
            paddingHorizontal: horizontalPadding,
            paddingBottom: moderateScale(24),
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSearchPress}
          style={styles.searchButton}>
          <SearchInput
            placeholder="Search surahs, reciters, or keywords"
            value=""
            onChangeText={noop}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.card).alpha(0.5).toString()}
            borderColor={Color(theme.colors.border).alpha(0.2).toString()}
            pointerEvents="none"
            containerStyle={styles.searchInputContainer}
            style={styles.searchInput}
            editable={false}
          />
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        data={[
          ...Array(
            Math.max(RECITER_CATEGORIES.length, SURAH_CATEGORIES.length),
          ),
        ]}
        renderItem={renderRow}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={[
          styles.gridContainer,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + moderateScale(20),
            paddingTop: moderateScale(16),
          },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
  },
  header: {
    paddingBottom: moderateScale(8),
    width: '100%',
  },
  searchButton: {
    flex: 1,
  },
  searchInputContainer: {
    paddingHorizontal: 0,
  },
  searchInput: {
    height: moderateScale(50),
    fontSize: moderateScale(16),
  },
  gridContainer: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: scale(16),
  },
  column: {
    flex: 1,
  },
  separator: {
    height: moderateScale(8),
  },
});
