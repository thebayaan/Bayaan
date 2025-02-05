import React, {useRef, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {LinearGradient} from 'expo-linear-gradient';
import {StarIcon} from '@/components/Icons';
import {StatusBar} from 'expo-status-bar';
import {CollectionCard} from '@/components/CollectionCard';
import SearchBar from '@/components/SearchBar';
import {Reciter} from '@/data/reciterData';

type ReciterListItem =
  | Reciter
  | {
      id: string;
      name: string;
      type: 'add';
    };

export default function FavoriteRecitersScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const {favoriteReciters} = useFavoriteReciters();
  const router = useRouter();

  const scrollY = useRef(new Animated.Value(0)).current as Animated.Value;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStatusBarDark, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const headerOpacity = scrollY.interpolate({
    inputRange: [150, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const listener = headerOpacity.addListener(({value}) => {
      if (value === 1 && !isHeaderVisible) {
        setIsHeaderVisible(true);
      } else if (value < 1 && isHeaderVisible) {
        setIsHeaderVisible(false);
      }
    });

    return () => headerOpacity.removeListener(listener);
  }, [headerOpacity, isHeaderVisible]);

  const handleReciterPress = (reciterId: string) => {
    router.push(`/reciter/${reciterId}`);
  };

  const filteredReciters = favoriteReciters.filter(reciter =>
    reciter.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleOpenSelectReciters = useCallback(() => {
    router.push({
      pathname: '/(modals)/add-favorite-reciters',
      params: {isVisible: 'true'},
    });
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar style={isStatusBarDark ? 'dark' : 'light'} />
      <ScrollView
        ref={scrollViewRef}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {
            useNativeDriver: false,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const offsetY = event.nativeEvent.contentOffset.y;
              setIsStatusBarDark(offsetY > 100);
            },
          },
        )}
        scrollEventThrottle={16}>
        <LinearGradient
          colors={
            [theme.colors.primary, theme.colors.background] as [string, string]
          }
          style={[
            styles.gradientContainer,
            {paddingTop: insets.top + moderateScale(20)},
          ]}>
          <CollectionCard
            icon={
              <StarIcon color={theme.colors.text} size={moderateScale(80)} />
            }
            title="Favorite Reciters"
            subtitle={`${favoriteReciters.length} reciters`}
          />
        </LinearGradient>
        <View style={styles.contentContainer}>
          {showSearch && (
            <View style={styles.searchBarContainer}>
              <SearchBar
                placeholder="Search favorite reciters"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
            </View>
          )}
          <Animated.FlatList
            data={
              [
                ...(!isSearchFocused
                  ? [
                      {
                        id: 'add-button',
                        name: 'Add reciters',
                        type: 'add' as const,
                      },
                    ]
                  : []),
                ...filteredReciters,
              ] as ReciterListItem[]
            }
            renderItem={({item}: {item: ReciterListItem}) => (
              <CircularReciterCard
                imageUrl={'image_url' in item ? item.image_url : undefined}
                name={item.name}
                onPress={() =>
                  'type' in item && item.type === 'add'
                    ? handleOpenSelectReciters()
                    : handleReciterPress(item.id)
                }
                size="medium"
                variant={
                  'type' in item && item.type === 'add' ? 'add' : 'default'
                }
              />
            )}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={[styles.gridContainer, {paddingBottom: 65}]}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No favorite reciters yet</Text>
            }
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerOpacity,
            paddingTop: insets.top,
          },
        ]}>
        <LinearGradient
          colors={
            [theme.colors.primary, theme.colors.background] as [string, string]
          }
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.stickyHeaderTitle}>Favorite Reciters</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.backButton,
          {
            top: insets.top,
            left: moderateScale(20),
          },
        ]}>
        <TouchableOpacity activeOpacity={0.99} onPress={() => router.back()}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color="white"
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: headerOpacity,
            }}>
            <Icon
              name="arrow-left"
              type="feather"
              size={moderateScale(24)}
              color={theme.colors.text}
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View
        style={[
          styles.searchButton,
          {
            top: insets.top,
            right: moderateScale(20),
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={() => {
            setShowSearch(!showSearch);
            if (!showSearch) {
              scrollViewRef.current?.scrollTo({y: 0, animated: true});
            }
          }}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="search"
              type="feather"
              size={moderateScale(20)}
              color="white"
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: headerOpacity,
            }}>
            <Icon
              name="search"
              type="feather"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
