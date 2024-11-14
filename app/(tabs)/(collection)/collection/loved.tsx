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
import {TrackItem} from '@/components/TrackItem';
import {usePlayerStore} from '@/store/playerStore';
import {usePlayback} from '@/hooks/usePlayback';
import {usePlayerNavigation} from '@/hooks/usePlayerNavigation';
import {getReciterById, getSurahById} from '@/services/dataService';
import {useRouter} from 'expo-router';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/themed';
import {LinearGradient} from 'expo-linear-gradient';
import {HeartIcon} from '@/components/Icons';
import {StatusBar} from 'expo-status-bar';
import {CollectionCard} from '@/components/CollectionCard';
import SearchBar from '@/components/SearchBar';
import {shuffleArray} from '@/utils/arrayUtils';
import {CollectionActionButtons} from '@/components/CollectionActionButtons';

interface FavoriteTrack {
  reciterId: string;
  surahId: string;
}

export default function LovedScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const {favoriteTrackIds} = usePlayerStore();
  const {playLovedTrack} = usePlayback();
  const {navigateToPlayer} = usePlayerNavigation();
  const router = useRouter();
  const gradientColors = ['purple', theme.colors.background];

  const scrollY = useRef(new Animated.Value(0)).current as Animated.Value;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStatusBarDark, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

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

  const handleTrackPress = async (trackId: string) => {
    try {
      const [reciterId] = trackId.split(':');
      const reciter = getReciterById(reciterId);
      navigateToPlayer(reciter?.image_url);
      playLovedTrack(trackId, favoriteTrackIds);
    } catch (error) {
      console.error('Error playing loved track:', error);
    }
  };

  const renderItem = ({item}: {item: FavoriteTrack}) => (
    <TrackItem
      reciterId={item.reciterId}
      surahId={item.surahId}
      onPress={() => handleTrackPress(`${item.reciterId}:${item.surahId}`)}
    />
  );

  // Prepare data for FlatList
  const data = favoriteTrackIds.map(id => {
    const [reciterId, surahId] = id.split(':');
    const reciter = getReciterById(reciterId);
    const surah = getSurahById(parseInt(surahId, 10));
    return {
      reciterId,
      surahId,
      reciterName: reciter?.name,
      surahName: surah?.name,
    };
  });

  const filteredData = data.filter(
    item =>
      item.reciterId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.surahId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reciterName &&
        item.reciterName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.surahName &&
        item.surahName.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handlePlayAll = useCallback(() => {
    if (filteredData.length > 0) {
      playLovedTrack(
        filteredData[0].reciterId + ':' + filteredData[0].surahId,
        filteredData.map(item => item.reciterId + ':' + item.surahId),
      );
      const firstTrack = filteredData[0];
      const reciter = getReciterById(firstTrack.reciterId);
      if (reciter) {
        navigateToPlayer(reciter.image_url);
      }
    }
  }, [filteredData, playLovedTrack, navigateToPlayer]);

  const handleShuffleAll = useCallback(() => {
    if (filteredData.length > 0) {
      const shuffledData = shuffleArray([...filteredData]);
      playLovedTrack(
        shuffledData[0].reciterId + ':' + shuffledData[0].surahId,
        shuffledData.map(item => item.reciterId + ':' + item.surahId),
      );
      const firstTrack = shuffledData[0];
      const reciter = getReciterById(firstTrack.reciterId);
      if (reciter) {
        navigateToPlayer(reciter.image_url);
      }
    }
  }, [filteredData, playLovedTrack, navigateToPlayer]);

  return (
    <View style={styles.container}>
      <StatusBar style={isStatusBarDark ? 'dark' : 'light'} />
      <ScrollView
        ref={scrollViewRef}
        bounces={false}
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
          colors={gradientColors}
          style={[
            styles.gradientContainer,
            {paddingTop: insets.top + moderateScale(20)},
          ]}>
          <CollectionCard
            icon={
              <HeartIcon color={theme.colors.text} size={moderateScale(80)} />
            }
            title="Loved Surahs"
            subtitle={`${favoriteTrackIds.length} surahs`}
          />
        </LinearGradient>
        <View style={styles.contentContainer}>
          <CollectionActionButtons
            onShufflePress={handleShuffleAll}
            onPlayPress={handlePlayAll}
          />
          {showSearch && (
            <View style={styles.searchBarContainer}>
              <SearchBar
                placeholder="Search loved surahs"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}
          <Animated.FlatList
            data={filteredData}
            renderItem={renderItem}
            keyExtractor={item => `${item.reciterId}:${item.surahId}`}
            contentContainerStyle={[
              styles.listContentContainer,
              {paddingBottom: 65},
            ]}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No loved surahs yet</Text>
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
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.stickyHeaderTitle}>Loved Surahs</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.backButton,
          {
            top: insets.top,
            left: moderateScale(20),
          },
        ]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Animated.View
            style={{
              opacity: headerOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}>
            <Icon
              name="chevron-thin-left"
              type="entypo"
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
              name="chevron-thin-left"
              type="entypo"
              size={moderateScale(20)}
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
