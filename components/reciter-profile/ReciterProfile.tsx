import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Switch,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
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
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {createSharedStyles} from './styles';

// Import components directly
import {ActionButtons} from './components/ActionButtons';
import {ReciterHeader} from './components/ReciterHeader';
import {StickyHeader} from './components/StickyHeader';
import {NavigationButtons} from './components/NavigationButtons';
import {SurahList} from './components/SurahList';
import {SearchView} from './components/SearchView';

interface ReciterProfileProps {
  id: string;
  showFavorites?: boolean;
}

const ReciterProfile: React.FC<ReciterProfileProps> = ({
  id: reciterId,
  showFavorites = false,
}) => {
  const {theme} = useTheme();
  const styles = createSharedStyles(theme);
  const insets = useSafeAreaInsets();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(undefined);

  const scrollY = useRef(new Animated.Value(0)).current;
  const iconsOpacity = useRef(new Animated.Value(1)).current;
  const iconsZIndex = useRef(new Animated.Value(10)).current;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStatusBarDark, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showLovedOnly, setShowLovedOnly] = useState(showFavorites);
  const flatListRef = useRef<Animated.FlatList>(null);
  const {isLoved} = useLoved();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const {showSurahOptions, showRewayatInfo} = useModal();

  const headerOpacity = scrollY.interpolate({
    inputRange: [100, 200],
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
      if (showLovedOnly && !isLoved(reciterId, surah.id.toString())) {
        return false;
      }

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

  const {updateQueue, play, addToQueue} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {toggleFavorite, isFavoriteReciter} = useFavoriteReciters();

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        const startIndex = filteredSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        const tracks = await createTracksForReciter(
          reciter,
          filteredSurahs,
          selectedRewayat.id,
        );
        const reorderedTracks = [
          ...tracks.slice(startIndex),
          ...tracks.slice(0, startIndex),
        ];

        await updateQueue(reorderedTracks, 0);
        await play();
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

  // Memoize the rewayat list to prevent unnecessary re-renders
  const rewayatList = useMemo(() => {
    if (!reciter?.rewayat) return [];
    return reciter.rewayat.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style,
      surah_list: r.surah_list,
    }));
  }, [reciter?.rewayat]);

  const handleRewayatInfoPress = useCallback(() => {
    if (!rewayatList.length) return;
    // Use requestAnimationFrame to ensure UI is ready
    requestAnimationFrame(() => {
      showRewayatInfo(rewayatList, selectedRewayatId, handleRewayatSelect);
    });
  }, [rewayatList, selectedRewayatId, handleRewayatSelect, showRewayatInfo]);

  const dominantColors = useImageColors(reciter?.name);
  const isLoadingColors =
    !dominantColors.primary || dominantColors.primary === theme.colors.primary;
  const [isImagePreloaded, setIsImagePreloaded] = useState(false);

  useEffect(() => {
    if (reciter?.name) {
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
            setIsImagePreloaded(true);
          });
      } else {
        setIsImagePreloaded(true);
      }
    }
  }, [reciter?.name]);

  useEffect(() => {
    setFilteredSurahs(filteredSurahsMemo);
  }, [filteredSurahsMemo]);

  const handleScroll = Animated.event(
    [{nativeEvent: {contentOffset: {y: scrollY}}}],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (!theme.isDarkMode) {
          setIsStatusBarDark(offsetY > 100);
        }
      },
    },
  );

  const handleAddToQueue = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        // Create track for just this surah
        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          selectedRewayat.id,
        );

        // Add to queue
        await addToQueue(tracks);
      } catch (error) {
        console.error('Error adding surah to queue:', error);
      }
    },
    [reciter, selectedRewayat, addToQueue],
  );

  if (!reciter || isLoadingColors || !isImagePreloaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          style={theme.isDarkMode ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.isDarkMode ? 'light' : isStatusBarDark ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      {showSearch ? (
        <SearchView
          surahs={filteredSurahs}
          onSurahPress={handleSurahPress}
          reciterId={reciterId}
          isLoved={isLoved}
          onOptionsPress={(surah: Surah) =>
            showSurahOptions(surah, reciterId, handleAddToQueue)
          }
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onCloseSearch={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
          availableRewayat={rewayatList}
          selectedRewayatId={selectedRewayatId}
          onRewayatSelect={handleRewayatSelect}
          dominantColors={dominantColors}
          isDarkMode={theme.isDarkMode}
          reciterName={reciter.name}
        />
      ) : (
        <>
          <SurahList
            ref={flatListRef}
            surahs={filteredSurahs}
            onSurahPress={handleSurahPress}
            reciterId={reciterId}
            isLoved={isLoved}
            onOptionsPress={(surah: Surah) =>
              showSurahOptions(surah, reciterId, handleAddToQueue)
            }
            onScroll={handleScroll}
            ListHeaderComponent={
              <>
                <ReciterHeader
                  reciter={reciter}
                  selectedRewayatId={selectedRewayatId}
                  onRewayatInfoPress={handleRewayatInfoPress}
                  showSearch={showSearch}
                  insets={insets}
                />
                <View style={styles.contentContainer}>
                  <ActionButtons
                    onFavoritePress={handleToggleFavorite}
                    onShufflePress={handleShuffleAll}
                    onPlayPress={handlePlayAll}
                    isFavoriteReciter={isFavoriteReciter(reciter.id)}
                  />
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
                        showLovedOnly
                          ? theme.colors.background
                          : theme.colors.text
                      }
                    />
                  </View>
                </View>
              </>
            }
          />
          <StickyHeader
            reciterName={reciter.name}
            headerOpacity={headerOpacity}
            insets={insets}
            dominantColors={dominantColors}
            isDarkMode={theme.isDarkMode}
          />
          <NavigationButtons
            insets={insets}
            iconsOpacity={iconsOpacity}
            iconsZIndex={iconsZIndex}
            scrollY={scrollY}
            onSearchPress={() => {
              setShowSearch(true);
            }}
          />
        </>
      )}
    </View>
  );
};

export default ReciterProfile;
