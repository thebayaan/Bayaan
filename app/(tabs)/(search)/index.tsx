import React, {useState} from 'react';
import {View, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';
import {SearchView} from '@/components/search/SearchView';
import {
  CategoryCard,
  CategoryCardProps,
} from '@/components/browse/CategoryCard';
import {moderateScale} from 'react-native-size-matters';
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

interface BrowseCategory extends Omit<CategoryCardProps, 'onPress'> {
  route: string;
}

const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: 'juz-amma',
    title: 'Juz Amma',
    backgroundColor: '#1E40AF',
    icon: {name: 'book-open', type: 'feather'},
    route: '/juz-amma',
  },
  {
    id: 'daily-wird',
    title: 'Daily Wird',
    backgroundColor: '#059669',
    icon: {name: 'sun', type: 'feather'},
    route: '/daily-wird',
  },
  {
    id: 'stories',
    title: 'Stories of Prophets',
    backgroundColor: '#7C3AED',
    icon: {name: 'book', type: 'feather'},
    route: '/stories',
  },
  {
    id: 'heart',
    title: 'Heart of Quran',
    backgroundColor: '#DC2626',
    icon: {name: 'heart', type: 'feather'},
    route: '/heart',
  },
  {
    id: 'most-recited',
    title: 'Most Recited',
    backgroundColor: '#2563EB',
    icon: {name: 'trending-up', type: 'feather'},
    route: '/most-recited',
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

export default function BrowseScreen() {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  const handleCategoryPress = (route: string) => {
    router.push(route);
  };

  const renderItem = ({item, index}: {item: BrowseCategory; index: number}) => (
    <Animated.View entering={FadeInDown.delay(index * 100)}>
      <CategoryCard {...item} onPress={() => handleCategoryPress(item.route)} />
    </Animated.View>
  );

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <SearchView
        visible={isSearchActive}
        onClose={() => setIsSearchActive(false)}
      />

      <Animated.View
        entering={!isSearchActive ? SlideInUp.duration(300) : undefined}
        layout={Layout.duration(300)}
        style={[styles.content]}>
        <Animated.View
          entering={FadeIn}
          style={[styles.header, {paddingTop: insets.top + moderateScale(20)}]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsSearchActive(true)}
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
          data={BROWSE_CATEGORIES}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={[
            styles.gridContainer,
            {paddingBottom: insets.bottom + moderateScale(20)},
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<View style={styles.gridHeader} />}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(8),
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
  gridHeader: {
    height: moderateScale(20),
  },
  gridContainer: {
    padding: moderateScale(8),
  },
});
