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
import {ReciterImage} from '@/components/ReciterImage';
import {Theme} from '@/utils/themeUtils';
import {ScaledSheet} from 'react-native-size-matters';
import {Dimensions} from 'react-native';
import {ReciterProfileActionButtons} from '@/components/ReciterProfileActionButtons';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {StatusBar} from 'expo-status-bar';
import {reciterImages} from '@/utils/reciterImages';
import {Asset} from 'expo-asset';
import {useImageColors} from '@/hooks/useImageColors';
import {useLoved} from '@/hooks/useLoved';
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {shuffleArray} from '@/utils/arrayUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useModal} from '@/components/providers/ModalProvider';

Dimensions.get('window');

interface ReciterProfileProps {
  id: string;
  showFavorites?: boolean;
}

export const ReciterProfile: React.FC<ReciterProfileProps> = ({
  id: reciterId, // Rename to avoid shadowing
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
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(undefined);

  const scrollY = useRef(new Animated.Value(0)).current as Animated.Value;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showLovedOnly, setShowLovedOnly] = useState(showFavorites);
  const scrollViewRef = useRef<ScrollView>(null);
  const {isLoved} = useLoved();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const {showSurahOptions, showRewayatInfo} = useModal();

  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 300],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const selectedRewayat = useMemo(() => {
    if (!reciter) return undefined;
    if (!selectedRewayatId) return reciter.rewayat[0];
    return (
      reciter.rewayat.find(r => r.id === selectedRewayatId) ||
      reciter.rewayat[0]
    );
  }, [reciter, selectedRewayatId]);

  const availableSurahs = useMemo(() => {
    if (!selectedRewayat?.surah_list) return surahs;
    const validSurahs = selectedRewayat.surah_list.filter(
      (id): id is number => id !== null,
    );
    return surahs.filter(surah => validSurahs.includes(surah.id));
  }, [surahs, selectedRewayat]);

  const filteredSurahsMemo = useMemo(() => {
    if (!availableSurahs.length) return [];

    if (!searchQuery && !showLovedOnly) {
      return availableSurahs;
    }

    return availableSurahs.filter(surah => {
      // First check loved status if needed
      if (showLovedOnly && !isLoved(reciterId, surah.id.toString())) {
        return false;
      }

      // Then check search query if needed
      if (searchQuery) {
        const lowercaseQuery = searchQuery.toLowerCase().trim();
        return (
          surah.name.toLowerCase().includes(lowercaseQuery) ||
          surah.translated_name_english
            .toLowerCase()
            .includes(lowercaseQuery) ||
          surah.id.toString() === lowercaseQuery
        );
      }

      return true;
    });
  }, [availableSurahs, searchQuery, showLovedOnly, isLoved, reciterId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reciterData = await getReciterById(reciterId);
        if (reciterData) {
          setReciter(reciterData);
          // Set initial rewayat ID to the first one
          if (reciterData.rewayat.length > 0) {
            setSelectedRewayatId(reciterData.rewayat[0].id);
          }
        }
        const surahsData = await getAllSurahs();
        setSurahs(surahsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [reciterId]);

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

  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {toggleFavorite, isFavoriteReciter} = useFavoriteReciters();

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        // Get the index of the tapped surah in the filtered list
        const startIndex = filteredSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        // Create tracks for all filtered surahs
        const tracks = await createTracksForReciter(
          reciter,
          filteredSurahs,
          selectedRewayat.id,
        );

        // Reorder tracks to start from the tapped surah
        const reorderedTracks = [
          ...tracks.slice(startIndex), // Tracks from tapped surah to end
          ...tracks.slice(0, startIndex), // Tracks from beginning to tapped surah
        ];

        await updateQueue(reorderedTracks, 0);
        await play();

        // Add to recently played list
        await addRecentTrack(reciter, surah, 0, 0);

        queueContext.setCurrentReciter(reciter);
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    },
    [
      reciter,
      filteredSurahs,
      selectedRewayat,
      updateQueue,
      play,
      queueContext,
      addRecentTrack,
    ],
  );

  const handlePlayAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    try {
      const tracks = await createTracksForReciter(
        reciter,
        filteredSurahs,
        selectedRewayat.id,
      );
      await updateQueue(tracks, 0);
      await play();

      // Add first surah to recently played list
      if (filteredSurahs.length > 0) {
        await addRecentTrack(reciter, filteredSurahs[0], 0, 0);
      }

      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error playing all surahs:', error);
    }
  }, [
    reciter,
    filteredSurahs,
    selectedRewayat,
    updateQueue,
    play,
    queueContext,
    addRecentTrack,
  ]);

  const handleShuffleAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    try {
      const tracks = await createTracksForReciter(
        reciter,
        filteredSurahs,
        selectedRewayat.id,
      );
      const shuffledTracks = shuffleArray([...tracks]);
      await updateQueue(shuffledTracks, 0);
      await play();

      // Add first shuffled track's surah to recently played list
      if (filteredSurahs.length > 0) {
        const firstTrackSurahId = shuffledTracks[0].surahId;
        if (firstTrackSurahId) {
          const firstSurah = filteredSurahs.find(
            s => s.id === parseInt(firstTrackSurahId, 10),
          );
          if (firstSurah) {
            await addRecentTrack(reciter, firstSurah, 0, 0);
          }
        }
      }

      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error shuffling surahs:', error);
    }
  }, [
    reciter,
    filteredSurahs,
    selectedRewayat,
    updateQueue,
    play,
    queueContext,
    addRecentTrack,
  ]);

  const handleToggleFavorite = useCallback(() => {
    if (reciter) {
      toggleFavorite(reciter);
    }
  }, [reciter, toggleFavorite]);

  const handleRewayatSelect = useCallback((rewayatId: string) => {
    setSelectedRewayatId(rewayatId);
  }, []);

  const handleRewayatInfoPress = useCallback(() => {
    if (!reciter) return;
    showRewayatInfo(reciter.rewayat, selectedRewayatId, handleRewayatSelect);
  }, [reciter, selectedRewayatId, handleRewayatSelect, showRewayatInfo]);

  const handleStyleChange = useCallback(() => {
    if (!reciter) return;

    // Find current style index
    const currentIndex = reciter.rewayat.findIndex(
      r => r.id === selectedRewayat?.id,
    );
    // Get next rewayat, or wrap around to first
    const nextIndex = (currentIndex + 1) % reciter.rewayat.length;
    setSelectedRewayatId(reciter.rewayat[nextIndex].id);
  }, [reciter, selectedRewayat]);

  const renderStyleIndicator = () => {
    if (!reciter || !selectedRewayat) return null;

    return (
      <View style={styles.styleContainer}>
        <TouchableOpacity
          style={styles.styleButton}
          onPress={handleStyleChange}
          activeOpacity={0.7}>
          <View style={styles.styleTextContainer}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: moderateScale(4),
              }}>
              <Text style={styles.styleText} numberOfLines={1}>
                {selectedRewayat.name}
              </Text>
              <TouchableOpacity
                onPress={handleRewayatInfoPress}
                activeOpacity={0.7}>
                <Icon
                  name="info"
                  type="feather"
                  size={moderateScale(14)}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.styleSubText} numberOfLines={1}>
              {selectedRewayat.style}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = useCallback(
    ({item}: {item: Surah}) => (
      <SurahItem
        item={item}
        onPress={handleSurahPress}
        reciterId={reciterId}
        isLoved={isLoved(reciterId, item.id.toString())}
        onOptionsPress={surah => showSurahOptions(surah, reciterId)}
      />
    ),
    [handleSurahPress, reciterId, isLoved, showSurahOptions],
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

  useEffect(() => {
    setFilteredSurahs(filteredSurahsMemo);
  }, [filteredSurahsMemo]);

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
        showsVerticalScrollIndicator={false}
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
                  reciterName={reciter.name}
                  imageUrl={reciter.image_url || undefined}
                  style={styles.reciterImage}
                />
                <View style={styles.reciterInfo}>
                  <Text style={styles.reciterName}>{reciter.name}</Text>
                  {renderStyleIndicator()}
                </View>
              </View>
            </LinearGradient>
            <View style={styles.contentContainer}>
              <ReciterProfileActionButtons
                onFavoritePress={handleToggleFavorite}
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
                  value={showLovedOnly}
                  onValueChange={setShowLovedOnly}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primary,
                  }}
                  thumbColor={
                    showLovedOnly ? theme.colors.background : theme.colors.text
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
          {reciter.name}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.backButton,
          {
            top: insets.top,
            left: moderateScale(15),
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
      paddingHorizontal: moderateScale(5),
      paddingBottom: moderateScale(10),
    },
    contentContainer: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: moderateScale(20),
      paddingTop: moderateScale(10),
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(15),
      gap: moderateScale(15),
    },
    reciterImage: {
      width: moderateScale(100),
      height: moderateScale(100),
      borderRadius: moderateScale(12),
      alignSelf: 'flex-start',
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    reciterName: {
      fontSize: moderateScale(22),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    styleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
      marginTop: moderateScale(4),
    },
    styleButton: {
      flex: 1,
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(0),
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    styleTextContainer: {
      flex: 1,
    },
    styleText: {
      color: theme.colors.text,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      lineHeight: moderateScale(20),
      flexDirection: 'row',
      alignItems: 'center',
    },
    styleSubText: {
      color: theme.colors.textSecondary,
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      marginTop: moderateScale(2),
      textTransform: 'capitalize',
      opacity: 0.8,
    },
    infoButton: {
      padding: moderateScale(4),
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
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginRight: moderateScale(10),
    },
    listContentContainer: {
      paddingBottom: moderateScale(80),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
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
      fontFamily: 'Manrope-Bold',
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
  });
