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
  useWindowDimensions,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './_styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {LinearGradient} from 'expo-linear-gradient';
import {StatusBar} from 'expo-status-bar';
import {CollectionCard} from '@/components/CollectionCard';
import SearchBar from '@/components/SearchBar';
import {Reciter} from '@/data/reciterData';
import {SheetManager} from 'react-native-actions-sheet';
import {Ionicons} from '@expo/vector-icons';

type ReciterListItem =
  | Reciter
  | {
      id: string;
      name: string;
      type: 'add';
    };

function calculateColumns(width: number) {
  const screenMargin = moderateScale(20) * 2; // Left and right screen margins
  const itemMinWidth = moderateScale(75); // Minimum width we want for each item
  const gapWidth = moderateScale(8); // Gap between items

  const availableWidth = width - screenMargin;
  const maxColumns = Math.floor(
    (availableWidth + gapWidth) / (itemMinWidth + gapWidth),
  );

  return Math.max(3, Math.min(maxColumns, 5)); // Minimum 3, maximum 5 columns
}

function calculateItemWidth(width: number, columns: number) {
  const screenMargin = moderateScale(20) * 2; // Left and right screen margins
  const gapWidth = moderateScale(8); // Gap between items
  const totalGapWidth = gapWidth * (columns - 1);

  const availableWidth = width - screenMargin - totalGapWidth;
  return availableWidth / columns;
}

export default function FavoriteRecitersScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const {favoriteReciters} = useFavoriteReciters();
  const router = useRouter();
  const {width} = useWindowDimensions();
  const columns = calculateColumns(width);
  const itemWidth = calculateItemWidth(width, columns);
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
    SheetManager.show('favorite-reciters');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style={isStatusBarDark ? 'dark' : 'light'} />
      <ScrollView
        ref={scrollViewRef}
        bounces={false}
        showsVerticalScrollIndicator={false}
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
            {
              paddingTop: insets.top + moderateScale(20),
              backgroundColor: theme.colors.primary,
            },
          ]}>
          <CollectionCard
            icon={
              <Ionicons
                name="star"
                size={moderateScale(80)}
                color={theme.colors.text}
              />
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
            showsVerticalScrollIndicator={false}
            renderItem={({item}: {item: ReciterListItem}) => (
              <View
                style={{
                  width: itemWidth,
                  marginBottom: moderateScale(8),
                  alignItems: 'center',
                }}>
                <CircularReciterCard
                  imageUrl={
                    'image_url' in item
                      ? item.image_url || undefined
                      : undefined
                  }
                  name={item.name}
                  onPress={() =>
                    'type' in item && item.type === 'add'
                      ? handleOpenSelectReciters()
                      : handleReciterPress(item.id)
                  }
                  width={itemWidth * 0.85}
                  variant={
                    'type' in item && item.type === 'add' ? 'add' : 'default'
                  }
                />
              </View>
            )}
            keyExtractor={item => item.id}
            numColumns={columns}
            contentContainerStyle={[styles.gridContainer, {paddingBottom: 65}]}
            columnWrapperStyle={{
              gap: moderateScale(8),
              flex: 1,
              justifyContent: 'flex-start',
            }}
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
