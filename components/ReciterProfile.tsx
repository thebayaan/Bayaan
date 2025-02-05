// app/components/ReciterProfile.tsx
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {LinearGradient} from 'expo-linear-gradient';
import SearchBar from '@/components/SearchBar';
import {SurahItem} from '@/components/SurahItem';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {usePlayerStore} from '@/store/playerStore';
import {ReciterImage} from '@/components/ReciterImage';
import {usePlayback} from '@/hooks/usePlayback';
import {Theme} from '@/utils/themeUtils';
import {ScaledSheet} from 'react-native-size-matters';
import {Dimensions} from 'react-native';
import {ReciterProfileActionButtons} from '@/components/ReciterProfileActionButtons';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {StatusBar} from 'expo-status-bar';
import {useTrackPlayerFavorite} from '@/hooks/usePlayerFavorite';
import {useQueueManagement} from '@/hooks/useQueueManagement';
import {SurahActionsBottomSheet} from '@/components/modals/SurahActionsBottomSheet';
import BottomSheet from '@gorhom/bottom-sheet';
import {reciterImages} from '@/utils/reciterImages';
import {Asset} from 'expo-asset';
import {useImageColors} from '@/hooks/useImageColors';

Dimensions.get('window');

interface ReciterProfileProps {
  id: string;
  showFavorites?: boolean;
}

export const ReciterProfile: React.FC<ReciterProfileProps> = ({
  id,
  showFavorites = false,
}) => {
  const router = useRouter();
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const {favoriteTrackIds, isLoading} = usePlayerStore(state => ({
    favoriteTrackIds: state.favoriteTrackIds,
    isLoading: state.isLoading,
  }));
  const scrollY = useRef(new Animated.Value(0)).current as Animated.Value;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(showFavorites);
  const scrollViewRef = useRef<ScrollView>(null);
  const {addToQueue} = usePlayback();
  const {toggleFavorite} = useTrackPlayerFavorite();

  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 300],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const filteredSurahsMemo = useMemo(() => {
    if (!surahs.length) return [];

    if (!searchQuery && !showFavoritesOnly) {
      return surahs;
    }

    // Convert favoriteTrackIds to Set for O(1) lookup
    const favoriteSet = new Set(favoriteTrackIds);

    return surahs.filter(surah => {
      // First check favorites if needed
      if (showFavoritesOnly && !favoriteSet.has(`${id}:${surah.id}`)) {
        return false;
      }

      // Then check search query if needed
      if (searchQuery) {
        const lowercaseQuery = searchQuery.toLowerCase().trim();
        return (
          surah.name.toLowerCase().includes(lowercaseQuery) ||
          surah.name_arabic.includes(searchQuery) ||
          surah.translated_name_english
            .toLowerCase()
            .includes(lowercaseQuery) ||
          surah.id.toString().includes(lowercaseQuery)
        );
      }

      return true;
    });
  }, [surahs, searchQuery, showFavoritesOnly, favoriteTrackIds, id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch reciter and surahs in parallel
        const [fetchedReciter, allSurahs] = await Promise.all([
          getReciterById(id),
          getAllSurahs(),
        ]);

        if (fetchedReciter) {
          setReciter(fetchedReciter);

          // Filter surahs efficiently using Set
          const surahSet = new Set(fetchedReciter.surah_list);
          const surahsMatchingReciter =
            fetchedReciter.surah_total === 114
              ? allSurahs
              : allSurahs.filter(surah => surahSet.has(surah.id));

          setSurahs(surahsMatchingReciter);
        }
      } catch (error) {
        console.error('Error fetching reciter data:', error);
      }
    };
    fetchData();
  }, [id]);

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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const {playAll, playFromSurah} = usePlayback();

  useTrackPlayerFavorite();
  useQueueManagement();

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (reciter) {
        // Remove navigation, just play the track
        await playFromSurah(reciter, surah, surahs);
      }
    },
    [reciter, playFromSurah, surahs],
  );

  const handlePlayAll = useCallback(() => {
    if (reciter) {
      // Remove navigation, just play all
      playAll(reciter, filteredSurahs);
    }
  }, [reciter, filteredSurahs, playAll]);

  const handleShuffleAll = useCallback(() => {
    if (reciter) {
      // Remove navigation, just shuffle and play
      playAll(reciter, filteredSurahs, true);
    }
  }, [reciter, filteredSurahs, playAll]);

  const {toggleFavoriteReciter, isFavoriteReciter} = useFavoriteReciters();

  const handleToggleFavoriteReciter = useCallback(() => {
    if (reciter) {
      toggleFavoriteReciter(reciter.id);
    }
  }, [reciter, toggleFavoriteReciter]);

  const handlePlaySurahPress = useCallback(
    async (surah: Surah) => {
      if (reciter) {
        await playFromSurah(reciter, surah, surahs);
      }
    },
    [reciter, playFromSurah, surahs],
  );

  useEffect(() => {
    setFilteredSurahs(filteredSurahsMemo);
  }, [filteredSurahsMemo]);

  const handleAddToQueue = useCallback(
    async (surah: Surah) => {
      if (reciter) {
        await addToQueue(reciter, surah);
      }
    },
    [reciter, addToQueue],
  );

  const handleToggleLove = useCallback(
    (surah: Surah) => {
      if (reciter) {
        toggleFavorite(reciter.id, surah.id.toString());
      }
    },
    [reciter, toggleFavorite],
  );

  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  const handleCloseBottomSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    setSelectedSurah(null);
  }, []);

  const renderItem = useCallback(
    ({item}: {item: Surah}) => (
      <SurahItem
        item={item}
        onPress={handleSurahPress}
        showPlayButton
        onPlayPress={handlePlaySurahPress}
      />
    ),
    [handleSurahPress, handlePlaySurahPress],
  );

  const dominantColors = useImageColors(reciter?.name);
  const isLoadingColors =
    !dominantColors.primary || dominantColors.primary === theme.colors.primary;
  const [isImagePreloaded, setIsImagePreloaded] = useState(false);

  // Add preloading effect
  useEffect(() => {
    if (reciter?.name) {
      // Preload the image and extract colors
      const formattedName = reciter.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      const localImageSource = reciterImages[formattedName];
      if (localImageSource) {
        Asset.fromModule(localImageSource as number)
          .downloadAsync()
          .then(() => setIsImagePreloaded(true))
          .catch(error => {
            console.error('Error preloading image:', error);
            setIsImagePreloaded(true); // Set to true even on error to not block UI
          });
      } else {
        setIsImagePreloaded(true); // No image to preload
      }
    }
  }, [reciter?.name]);

  if (!reciter || isLoadingColors || !isImagePreloaded) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[
          dominantColors.primary,
          dominantColors.secondary,
          theme.colors.background,
        ]}
        style={styles.absoluteGradient}
        locations={[0, 0.6, 1]}
      />
      <Animated.FlatList
        bounces={false}
        data={filteredSurahs}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={[
                dominantColors.primary,
                dominantColors.secondary,
                theme.colors.background,
              ]}
              style={styles.gradientContainer}
              locations={[0, 0.6, 1]}>
              <View
                style={[
                  styles.headerContainer,
                  {paddingTop: insets.top + moderateScale(50)},
                ]}>
                <ReciterImage
                  imageUrl={reciter?.image_url}
                  reciterName={reciter?.name}
                  style={styles.reciterImage}
                />
                <View style={styles.reciterInfo}>
                  <Text style={styles.reciterName}>{reciter?.name}</Text>
                  <Text style={styles.reciterMoshafName}>
                    {reciter?.moshaf_name}
                  </Text>
                </View>
              </View>
            </LinearGradient>
            <View style={styles.contentContainer}>
              <ReciterProfileActionButtons
                onFavoritePress={handleToggleFavoriteReciter}
                onShufflePress={handleShuffleAll}
                onPlayPress={handlePlayAll}
                isFavoriteReciter={
                  reciter ? isFavoriteReciter(reciter.id) : false
                }
              />
              {showSearch && (
                <View style={styles.searchBarContainer}>
                  <SearchBar
                    placeholder="Search Surahs"
                    onChangeText={handleSearch}
                    value={searchQuery}
                  />
                </View>
              )}
              <View style={styles.toggleContainer}>
                <Text style={styles.toggleLabel}>Show Loved Only</Text>
                <Switch
                  value={showFavoritesOnly}
                  onValueChange={setShowFavoritesOnly}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primary,
                  }}
                  thumbColor={
                    showFavoritesOnly
                      ? theme.colors.background
                      : theme.colors.text
                  }
                />
              </View>
            </View>
          </>
        }
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {
            useNativeDriver: true,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const offsetY = event.nativeEvent.contentOffset.y;
              setIsStatusBarDark(offsetY > 100);
            },
          },
        )}
        scrollEventThrottle={1}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No surahs available</Text>
        }
      />
      <SurahActionsBottomSheet
        ref={bottomSheetRef}
        surah={selectedSurah}
        isLoved={
          selectedSurah
            ? favoriteTrackIds.includes(`${reciter.id}:${selectedSurah.id}`)
            : false
        }
        onAddToQueue={handleAddToQueue}
        onToggleLove={handleToggleLove}
        onClose={handleCloseBottomSheet}
      />
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerOpacity,
            paddingTop: insets.top,
          },
        ]}>
        <LinearGradient
          colors={[dominantColors.primary, dominantColors.secondary]}
          style={StyleSheet.absoluteFill}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
        />
        <Text style={[styles.stickyHeaderTitle, {color: 'white'}]}>
          {reciter?.name}
        </Text>
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
          <Icon
            name="arrow-left"
            type="feather"
            size={moderateScale(24)}
            color="white"
          />
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
          <Icon
            name="search"
            type="feather"
            size={moderateScale(20)}
            color="white"
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default ReciterProfile;

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    absoluteGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '40%',
    },
    gradientContainer: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(10),
      alignItems: 'center',
    },
    headerContainer: {},
    reciterImage: {
      width: moderateScale(200),
      height: moderateScale(200),
      borderRadius: moderateScale(20),
      marginBottom: moderateScale(10), // Add margin below the image
      alignSelf: 'center',
    },
    contentContainer: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: moderateScale(15),
    },
    searchBarContainer: {
      backgroundColor: theme.colors.background,
      paddingBottom: moderateScale(10),
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(5),
      backgroundColor: theme.colors.background,
    },
    toggleLabel: {
      fontSize: moderateScale(14),
      color: theme.colors.text,
      fontWeight: 'bold',
      marginRight: moderateScale(10),
    },
    listContentContainer: {
      paddingTop: moderateScale(10),
    },
    emptyText: {
      fontSize: moderateScale(16),
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: moderateScale(20),
    },
    stickyHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      paddingBottom: moderateScale(15),
      paddingHorizontal: moderateScale(20),
    },
    stickyHeaderTitle: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    backButton: {
      position: 'absolute',
      left: moderateScale(15),
      zIndex: 10,
    },
    searchButton: {
      position: 'absolute',
      zIndex: 10,
    },
    reciterInfo: {
      alignItems: 'center', // Center text horizontally
    },
    reciterName: {
      fontSize: moderateScale(20),
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    reciterMoshafName: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      marginTop: moderateScale(5),
      textAlign: 'center',
    },
  });
