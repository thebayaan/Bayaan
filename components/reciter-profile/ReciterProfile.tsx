import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated as RNAnimated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  InteractionManager,
  Platform,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Surah, SURAHS} from '@/data/surahData';
import {Reciter, Rewayat} from '@/data/reciterData';
import {getReciterByIdSync} from '@/services/dataService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {StatusBar} from 'expo-status-bar';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTracksForReciter} from '@/utils/track';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {shuffleArray} from '@/utils/arrayUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {SheetManager} from 'react-native-actions-sheet';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useDownloadQueries} from '@/services/player/store/downloadSelectors';
import {createSharedStyles} from './styles';
import {useSettings} from '@/hooks/useSettings';
import {Feather} from '@expo/vector-icons';
import {HeartIcon} from '@/components/Icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// Import components directly
import {ActionButtons} from './components/ActionButtons';
import {ReciterHeader} from './components/ReciterHeader';
import {NavigationButtons} from './components/NavigationButtons';
import {SurahList} from './components/SurahList';
import {SearchView} from './components/SearchView';
import {RewayatTabBar} from './components/RewayatTabBar';
import {UploadsTabContent} from './components/UploadsTabContent';
import {useUploadsStore} from '@/store/uploadsStore';
import {moderateScale} from 'react-native-size-matters';
import {useBottomInset} from '@/hooks/useBottomInset';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';
import {useNavigation} from 'expo-router';
import {useHeaderHeight} from '@react-navigation/elements';
import {USE_GLASS} from '@/hooks/useGlassProps';

interface ReciterProfileProps {
  id: string;
  showLoved?: boolean;
}

// Define types matching useSettings
type ReciterProfileViewMode = 'card' | 'list';
type ReciterProfileSortOption = 'asc' | 'desc' | 'revelation';

// Sort rewayat, prioritizing Murattal Hafs A'n Assem
function sortRewayat(rewayat: Rewayat[]): Rewayat[] {
  return [...rewayat].sort((a, b) => {
    const aIsHafsMurattal =
      a.name === HAFS_REWAYAT_NAME && a.style === 'murattal';
    const bIsHafsMurattal =
      b.name === HAFS_REWAYAT_NAME && b.style === 'murattal';
    if (aIsHafsMurattal && !bIsHafsMurattal) return -1;
    if (!aIsHafsMurattal && bIsHafsMurattal) return 1;

    const aIsHafs = a.name === HAFS_REWAYAT_NAME;
    const bIsHafs = b.name === HAFS_REWAYAT_NAME;
    if (aIsHafs && !bIsHafs) return -1;
    if (!aIsHafs && bIsHafs) return 1;

    const aIsMurattal = a.style === 'murattal';
    const bIsMurattal = b.style === 'murattal';
    if (aIsMurattal && !bIsMurattal) return -1;
    if (!aIsMurattal && bIsMurattal) return 1;

    return 0;
  });
}

// Synchronous reciter init — avoids async loading phase
function initReciter(id: string): Reciter | null {
  const r = getReciterByIdSync(id);
  if (!r) return null;
  return {...r, rewayat: sortRewayat(r.rewayat)};
}

// Create a proper memoized wrapper for SurahList
const MemoizedSurahList = React.memo(SurahList);

// Skeleton placeholder for surah list — shows pulsing rows while content loads
const SurahListSkeleton: React.FC<{theme: any}> = React.memo(({theme}) => {
  const pulseAnim = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const barColor = theme.isDarkMode
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.06)';

  return (
    <RNAnimated.View style={{opacity: pulseAnim, paddingTop: moderateScale(4)}}>
      {Array.from({length: 8}, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: moderateScale(16),
            paddingVertical: moderateScale(12),
          }}>
          <View
            style={{
              width: moderateScale(40),
              height: moderateScale(40),
              borderRadius: moderateScale(8),
              backgroundColor: barColor,
            }}
          />
          <View style={{marginLeft: moderateScale(12), flex: 1}}>
            <View
              style={{
                width: '55%',
                height: moderateScale(14),
                borderRadius: moderateScale(4),
                backgroundColor: barColor,
              }}
            />
            <View
              style={{
                width: '35%',
                height: moderateScale(10),
                borderRadius: moderateScale(4),
                backgroundColor: barColor,
                marginTop: moderateScale(6),
              }}
            />
          </View>
        </View>
      ))}
    </RNAnimated.View>
  );
});

// Use USE_GLASS (iOS 26+) instead of Platform.OS so non-glass iOS
// devices get the same custom header/nav buttons as Android.
const isGlass = USE_GLASS;

const ReciterProfileContent: React.FC<ReciterProfileProps> = ({
  id: currentReciterId,
  showLoved = false,
}) => {
  const {theme} = useTheme();
  const styles = createSharedStyles(theme);
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const {height: screenHeight, width: screenWidth} = useWindowDimensions();
  const navigation = useNavigation();
  const headerHeight = isGlass ? useHeaderHeight() : 0;

  // Synchronous reciter init — data available on first render, no deferred loading delay
  const initialReciter = useMemo(
    () => initReciter(currentReciterId),
    [currentReciterId],
  );
  const initialRewayatId = initialReciter?.rewayat[0]?.id;

  const [reciter, setReciter] = useState<Reciter | null>(initialReciter);
  const surahs = SURAHS;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(initialRewayatId);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const scrollX = useRef(
    new RNAnimated.Value(initialReciter ? screenWidth : 0),
  ).current;
  const iconsOpacity = useRef(new RNAnimated.Value(1)).current;
  const iconsZIndex = useRef(new RNAnimated.Value(20)).current;
  const pagerOpacity = useRef(
    new RNAnimated.Value(
      initialReciter && initialReciter.rewayat.length === 0 ? 1 : 0,
    ),
  ).current;
  const [showSearch, setShowSearch] = useState(false);

  // iOS native header: search icon in headerRight, hidden when search is active
  const headerTitleShownRef = useRef(false);
  useLayoutEffect(() => {
    if (!isGlass) return;
    headerTitleShownRef.current = false;
    navigation.setOptions({
      headerTitle: '',
      headerBackTitle: ' ',
      headerBackButtonDisplayMode: 'minimal',
      headerTransparent: true,
      headerStyle: {backgroundColor: 'transparent'},
      headerShadowVisible: false,
      // Hide back button and search icon when SearchView is open (it has its own cancel)
      headerBackVisible: !showSearch,
      headerRight: showSearch
        ? () => null
        : () => (
            <Pressable onPress={() => setShowSearch(true)} hitSlop={8}>
              <Feather
                name="search"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            </Pressable>
          ),
    });
  }, [navigation, theme, showSearch]);

  const [viewMode, setViewMode] = useState<ReciterProfileViewMode>(
    useSettings(state => state.reciterProfileViewMode),
  );
  const [sortOption, setSortOption] = useState<ReciterProfileSortOption>(
    useSettings(state => state.reciterProfileSortOption),
  );
  const [showLovedOnly, setShowLovedOnly] = useState(showLoved);
  const [activeTab, setActiveTab] = useState<string>(initialRewayatId ?? '');
  const [neighborsReady, setNeighborsReady] = useState(false);
  const outerScrollRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<ScrollView>(null);
  const currentScrollYRef = useRef(0);
  const renderedTabsRef = useRef(new Set<string>());
  const pagerScrolledRef = useRef(
    initialReciter != null && initialReciter.rewayat.length === 0,
  );
  const scrollTargetRef = useRef<string | null>(null);
  const activeTabRef = useRef(initialRewayatId ?? '');

  const [collapsibleHeight, setCollapsibleHeight] = useState(0);
  const [stickyHeight, setStickyHeight] = useState(0);
  const [stickyTitleHeight, setStickyTitleHeight] = useState(0);

  // iOS: offset below transparent native header; Android: below custom sticky title
  const stickyPinOffset = isGlass ? headerHeight : stickyTitleHeight;
  const {isLovedWithRewayat} = useLoved();
  const {isDownloaded} = useDownloadQueries();
  const {startNewChain} = useRecentlyPlayedStore();
  const {reciterPreferences, setReciterPreference} = useSettings();

  // Retrieve persisted reciter profile settings
  const setReciterViewModeSetting = useSettings(
    state => state.setReciterProfileViewMode,
  );
  const setReciterSortOptionSetting = useSettings(
    state => state.setReciterProfileSortOption,
  );

  const selectedRewayat = useMemo(() => {
    if (!reciter) return undefined;
    if (!selectedRewayatId) return reciter.rewayat[0];
    return (
      reciter.rewayat.find(r => r.id === selectedRewayatId) ||
      reciter.rewayat[0]
    );
  }, [reciter, selectedRewayatId]);

  const getFilteredSurahsForRewayat = useCallback(
    (rewayat: Rewayat): Surah[] => {
      // 1. Available surahs for this rewayat
      let available = surahs;
      if (rewayat.surah_list) {
        const validSurahs = rewayat.surah_list.filter(
          (id): id is number => id !== null,
        );
        available = surahs.filter(surah => validSurahs.includes(surah.id));
      }

      // 2. Filter by loved status if toggled
      if (showLovedOnly) {
        available = available.filter(surah =>
          isLovedWithRewayat(currentReciterId, surah.id.toString(), rewayat.id),
        );
      }

      // 3. Filter by search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        available = available.filter(
          surah =>
            surah.name.toLowerCase().includes(q) ||
            surah.translated_name_english.toLowerCase().includes(q),
        );
      }

      // 4. Sort
      return [...available].sort((a, b) => {
        if (sortOption === 'asc') return a.id - b.id;
        if (sortOption === 'desc') return b.id - a.id;
        if (sortOption === 'revelation')
          return a.revelation_order - b.revelation_order;
        return 0;
      });
    },
    [
      surahs,
      showLovedOnly,
      isLovedWithRewayat,
      currentReciterId,
      searchQuery,
      sortOption,
    ],
  );

  // Lazy per-tab surah cache — only computes when a tab is first accessed.
  // Deps key invalidates the whole cache when filter/sort/search changes.
  const surahCacheRef = useRef<{key: string; map: Map<string, Surah[]>}>({
    key: '',
    map: new Map(),
  });
  const cacheKey = `${showLovedOnly}|${searchQuery}|${sortOption}`;
  if (surahCacheRef.current.key !== cacheKey) {
    surahCacheRef.current = {key: cacheKey, map: new Map()};
  }

  const getSurahsForTab = useCallback(
    (tabId: string): Surah[] => {
      const cache = surahCacheRef.current.map;
      const cached = cache.get(tabId);
      if (cached) return cached;
      const rewayat = reciter?.rewayat.find(r => r.id === tabId);
      if (!rewayat) return [];
      const result = getFilteredSurahsForRewayat(rewayat);
      cache.set(tabId, result);
      return result;
    },
    [reciter, getFilteredSurahsForRewayat],
  );

  // Derived filteredSurahs for the active rewayat (used by playback handlers)
  const filteredSurahs = useMemo(
    () => getSurahsForTab(selectedRewayatId ?? ''),
    [getSurahsForTab, selectedRewayatId],
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const {
    addToQueue,
    updateQueue,
    toggleShuffle: toggleShuffleAction,
  } = usePlayerActions();
  const shuffleEnabled = usePlayerStore(state => state.settings.shuffle);
  const {toggleFavorite, isFavoriteReciter} = useFavoriteReciters();

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        const startIndex = filteredSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        const artwork = getReciterArtwork(reciter);

        // Build all tracks with selected surah first
        const reorderedSurahs = [
          filteredSurahs[startIndex],
          ...filteredSurahs.slice(startIndex + 1),
          ...filteredSurahs.slice(0, startIndex),
        ];

        const allTracks = reorderedSurahs.map(s => ({
          id: `${reciter.id}:${s.id}`,
          url: generateSmartAudioUrl(
            reciter,
            s.id.toString(),
            selectedRewayat.id,
          ),
          title: s.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: s.id.toString(),
          reciterName: reciter.name,
          rewayatId: selectedRewayat.id,
        }));

        await updateQueue(allTracks, 0);
        startNewChain(reciter, surah, 0, 0, selectedRewayat.id);
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    },
    [reciter, filteredSurahs, selectedRewayat, startNewChain, updateQueue],
  );

  const handlePlayAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    if (filteredSurahs.length === 0) return;

    try {
      const artwork = getReciterArtwork(reciter);

      const allTracks = filteredSurahs.map(s => ({
        id: `${reciter.id}:${s.id}`,
        url: generateSmartAudioUrl(
          reciter,
          s.id.toString(),
          selectedRewayat.id,
        ),
        title: s.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: s.id.toString(),
        reciterName: reciter.name,
        rewayatId: selectedRewayat.id,
      }));

      await updateQueue(allTracks, 0);
      startNewChain(reciter, filteredSurahs[0], 0, 0, selectedRewayat.id);
    } catch (error) {
      console.error('Error playing all surahs:', error);
    }
  }, [reciter, filteredSurahs, selectedRewayat, startNewChain, updateQueue]);

  const handleShuffleAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    if (filteredSurahs.length === 0) return;

    try {
      const shuffledSurahs = shuffleArray([...filteredSurahs]);
      const artwork = getReciterArtwork(reciter);

      // Enable shuffle mode
      if (!shuffleEnabled) {
        toggleShuffleAction();
      }

      const allTracks = shuffledSurahs.map(s => ({
        id: `${reciter.id}:${s.id}`,
        url: generateSmartAudioUrl(
          reciter,
          s.id.toString(),
          selectedRewayat.id,
        ),
        title: s.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: s.id.toString(),
        reciterName: reciter.name,
        rewayatId: selectedRewayat.id,
      }));

      await updateQueue(allTracks, 0);
      startNewChain(reciter, shuffledSurahs[0], 0, 0, selectedRewayat.id);
    } catch (error) {
      console.error('Error shuffling surahs:', error);
    }
  }, [
    reciter,
    filteredSurahs,
    selectedRewayat,
    startNewChain,
    updateQueue,
    shuffleEnabled,
    toggleShuffleAction,
  ]);

  const handleToggleFavorite = useCallback(() => {
    if (reciter) {
      toggleFavorite(reciter);
    }
  }, [reciter, toggleFavorite]);

  const handleRewayatChange = useCallback(
    (rewayatId: string) => {
      setSelectedRewayatId(rewayatId);
      setReciterPreference(currentReciterId, rewayatId);
    },
    [currentReciterId, setReciterPreference],
  );

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

  // Create a custom isLoved function that checks for the specific rewayatId
  const isLovedWithCurrentRewayat = useCallback(
    (id: string, surahId: string | number) => {
      if (!selectedRewayat) return false;
      return isLovedWithRewayat(id, surahId, selectedRewayat.id);
    },
    [isLovedWithRewayat, selectedRewayat],
  );

  // Per-tab isLoved functions so all pager tabs show correct loved state
  const isLovedPerTab = useMemo(() => {
    const map = new Map<
      string,
      (recId: string, surahId: string | number) => boolean
    >();
    reciter?.rewayat.forEach(r => {
      map.set(r.id, (recId: string, surahId: string | number) =>
        isLovedWithRewayat(recId, surahId, r.id),
      );
    });
    return map;
  }, [reciter?.rewayat, isLovedWithRewayat]);

  // Callback to toggle view mode with optimized performance
  const changeSortOption = useCallback(
    (option: ReciterProfileSortOption) => {
      setSortOption(option);
      setReciterSortOptionSetting(option);
    },
    [setReciterSortOptionSetting],
  );

  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'card' ? 'list' : 'card';
    setReciterViewModeSetting(newMode);
    setViewMode(newMode);
  }, [viewMode, setReciterViewModeSetting]);

  // Function to generate a consistent color for each surah (similar to browse-all)
  const getColorForSurah = useCallback((id: number): string => {
    const colors = [
      '#059669',
      '#7C3AED',
      '#1E40AF',
      '#DC2626',
      '#EA580C',
      '#0891B2',
      '#BE185D',
      '#4F46E5',
      '#B45309',
      '#047857',
    ];
    return colors[id % colors.length];
  }, []);

  // Add shared value for heart animation
  const heartScale = useSharedValue(1);

  // Create animated style for heart
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: heartScale.value}],
  }));

  // Callback to toggle loved filter with animation
  const toggleShowLovedOnly = useCallback(() => {
    setShowLovedOnly(prev => !prev);
    // Animate the heart
    heartScale.value = withSpring(1.2, {damping: 10, stiffness: 300}, () => {
      heartScale.value = withSpring(1);
    });
  }, [heartScale]);

  // Uploads for this reciter
  const reciterUploads = useUploadsStore(state =>
    state.recitations.filter(r => r.reciterId === currentReciterId),
  );
  const hasUploads = reciterUploads.length > 0;

  // Build tabs array: "My Uploads" first (leftmost), then rewayat tabs.
  // The pager uses opacity-gated reveal to scroll to index 1 before showing.
  const tabs = useMemo(() => {
    const result: Array<{id: string; label: string}> = [];
    result.push({id: 'uploads', label: 'My Uploads'});
    if (reciter?.rewayat) {
      reciter.rewayat.forEach(r => {
        const style =
          r.style.charAt(0).toUpperCase() + r.style.slice(1).toLowerCase();
        result.push({id: r.id, label: `${r.name} · ${style}`});
      });
    }
    return result;
  }, [reciter?.rewayat]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      // Sync ref BEFORE scrolling so the scroll listener won't fight us
      activeTabRef.current = tabId;
      setActiveTab(tabId);
      if (tabId !== 'uploads') {
        handleRewayatChange(tabId);
      }
      // Scroll horizontal pager to the new tab
      const tabIndex = tabs.findIndex(t => t.id === tabId);
      if (tabIndex >= 0 && horizontalRef.current) {
        scrollTargetRef.current = tabId;
        horizontalRef.current.scrollTo({
          x: tabIndex * screenWidth,
          animated: true,
        });
      }
      // If scrolled past the collapse point, snap back to it so the tab bar
      // stays pinned and content starts cleanly. Otherwise don't touch scroll
      // — let the header stay visible at its current position.
      const snapPoint = Math.max(0, collapsibleHeight - stickyPinOffset);
      if (currentScrollYRef.current > snapPoint) {
        outerScrollRef.current?.scrollTo({y: snapPoint, animated: false});
      }
    },
    [
      collapsibleHeight,
      stickyPinOffset,
      handleRewayatChange,
      tabs,
      screenWidth,
    ],
  );

  // Scroll listener — only clears programmatic scroll gate; no side effects during swipe.
  const handleHorizontalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollTargetRef.current !== null) {
        const offsetX = e.nativeEvent.contentOffset.x;
        const pageIndex = Math.round(offsetX / screenWidth);
        const tab = tabs[pageIndex];
        if (tab && tab.id === scrollTargetRef.current) {
          scrollTargetRef.current = null;
        }
      }
    },
    [tabs, screenWidth],
  );

  // Fires after paging snap completes — updates tab state without interrupting gesture.
  const handleHorizontalMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / screenWidth);
      const tab = tabs[pageIndex];

      if (scrollTargetRef.current !== null) return; // programmatic scroll handled elsewhere

      if (tab && tab.id !== activeTabRef.current) {
        activeTabRef.current = tab.id;
        setActiveTab(tab.id);
        if (tab.id !== 'uploads') {
          handleRewayatChange(tab.id);
        }
        // Only snap if scrolled past collapse point
        const snapPoint = Math.max(0, collapsibleHeight - stickyPinOffset);
        if (currentScrollYRef.current > snapPoint) {
          outerScrollRef.current?.scrollTo({y: snapPoint, animated: false});
        }
      }
    },
    [
      tabs,
      screenWidth,
      handleRewayatChange,
      collapsibleHeight,
      stickyPinOffset,
    ],
  );

  // Opacity-gated reveal: scroll pager to first rewayat (index 1) before showing
  const handlePagerContentSizeChange = useCallback(
    (contentWidth: number) => {
      if (pagerScrolledRef.current) return;
      if (contentWidth >= 2 * screenWidth) {
        pagerScrolledRef.current = true;
        horizontalRef.current?.scrollTo({
          x: screenWidth,
          y: 0,
          animated: false,
        });
        requestAnimationFrame(() => {
          pagerOpacity.setValue(1);
          setNeighborsReady(true);
        });
      }
    },
    [screenWidth, pagerOpacity],
  );

  // Sticky title bar opacity — fades in as the outer scroll collapses the header
  // With negative margin on header, the actual collapse point is reduced
  const collapsePoint = Math.max(1, collapsibleHeight - stickyPinOffset);
  const stickyTitleOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [collapsePoint * 0.6, collapsePoint],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY, collapsePoint],
  );

  // Minimum height for content area so header can always fully collapse
  const contentMinHeight = Math.max(0, screenHeight - stickyHeight);

  // Lazy tab rendering: mark active ±1 tabs so only nearby tabs render.
  // Once rendered, tabs stay in the Set so revisited tabs don't re-mount.
  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  const lazyStart = neighborsReady
    ? Math.max(0, activeIndex - 1)
    : Math.max(0, activeIndex);
  const lazyEnd = neighborsReady
    ? Math.min(tabs.length - 1, activeIndex + 1)
    : Math.min(tabs.length - 1, Math.max(0, activeIndex));
  for (let i = lazyStart; i <= lazyEnd; i++) {
    renderedTabsRef.current.add(tabs[i].id);
  }

  if (!reciter) {
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
        style={theme.isDarkMode ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      {/* Main content — always mounted to preserve pager scroll position */}
      <View style={{flex: 1}} pointerEvents={showSearch ? 'none' : 'auto'}>
        <>
          {/* Single outer scroll: header collapses, tab bar sticks, content scrolls */}
          <RNAnimated.ScrollView
            ref={outerScrollRef}
            stickyHeaderIndices={[1]}
            contentInsetAdjustmentBehavior={isGlass ? 'automatic' : 'never'}
            onScroll={RNAnimated.event(
              [{nativeEvent: {contentOffset: {y: scrollY}}}],
              {
                useNativeDriver: true,
                listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const y = e.nativeEvent.contentOffset.y;
                  currentScrollYRef.current = y;
                  // iOS: show reciter name in native header when scrolled past header
                  if (isGlass && reciter) {
                    const threshold = collapsePoint * 0.6;
                    const shouldShow = y >= threshold;
                    if (shouldShow !== headerTitleShownRef.current) {
                      headerTitleShownRef.current = shouldShow;
                      navigation.setOptions({
                        headerTitle: shouldShow ? reciter.name : '',
                        headerStyle: {
                          backgroundColor: shouldShow
                            ? theme.colors.background
                            : 'transparent',
                        },
                      });
                    }
                  }
                },
              },
            )}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            {/* Child 0: Collapsible header — scrolls away */}
            {/* Negative marginBottom pulls the sticky section up, closing the gap */}
            {/* between action buttons and tab bar when the header is not collapsed */}
            <View
              onLayout={e => setCollapsibleHeight(e.nativeEvent.layout.height)}
              style={{marginBottom: -stickyPinOffset, zIndex: 11}}
              pointerEvents="box-none">
              <ReciterHeader
                reciter={reciter}
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
              </View>
            </View>

            {/* Child 1: Sticky section — sticks at top when header collapses */}
            {/* paddingTop offsets below native header (iOS) or sticky title (Android) */}
            <View
              onLayout={e => setStickyHeight(e.nativeEvent.layout.height)}
              style={{paddingTop: stickyPinOffset}}
              pointerEvents="box-none">
              <View style={{backgroundColor: theme.colors.background}}>
                {tabs.length > 0 && (
                  <RewayatTabBar
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabChange={handleTabChange}
                    theme={theme}
                    scrollX={scrollX}
                    screenWidth={screenWidth}
                  />
                )}
                <View style={styles.controlsRow}>
                  {activeTab !== 'uploads' && (
                    <View style={styles.sortOptionsContainer}>
                      <Pressable
                        style={[
                          styles.optionButton,
                          sortOption === 'asc' && styles.activeOptionButton,
                        ]}
                        onPress={() => changeSortOption('asc')}>
                        <Text
                          style={[
                            styles.optionButtonText,
                            sortOption === 'asc' && styles.activeOptionText,
                          ]}>
                          Asc
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.optionButton,
                          sortOption === 'desc' && styles.activeOptionButton,
                        ]}
                        onPress={() => changeSortOption('desc')}>
                        <Text
                          style={[
                            styles.optionButtonText,
                            sortOption === 'desc' && styles.activeOptionText,
                          ]}>
                          Desc
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.optionButton,
                          sortOption === 'revelation' &&
                            styles.activeOptionButton,
                        ]}
                        onPress={() => changeSortOption('revelation')}>
                        <Text
                          style={[
                            styles.optionButtonText,
                            sortOption === 'revelation' &&
                              styles.activeOptionText,
                          ]}>
                          Rev
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  <View style={styles.rightControlsContainer}>
                    <Pressable
                      style={[
                        styles.optionButton,
                        {
                          marginRight: moderateScale(15),
                          marginTop: moderateScale(4),
                        },
                      ]}
                      onPress={toggleShowLovedOnly}>
                      <Animated.View style={heartAnimatedStyle}>
                        <HeartIcon
                          size={moderateScale(22)}
                          color={
                            showLovedOnly
                              ? theme.colors.error
                              : theme.colors.textSecondary
                          }
                          filled={true}
                        />
                      </Animated.View>
                    </Pressable>
                    <Pressable
                      style={styles.viewModeButton}
                      onPress={toggleViewMode}>
                      <Feather
                        name={viewMode === 'card' ? 'list' : 'grid'}
                        size={moderateScale(16)}
                        color={theme.colors.text}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {/* Child 2: Horizontal pager — lazy-rendered, swipeable */}
            {/* Only active ±1 tabs render; previously visited tabs stay mounted */}
            {/* When uploads is active, cap height to viewport so the tall rewayat pages */}
            {/* don't inflate the scrollable area with empty space */}
            <View
              style={
                activeTab === 'uploads'
                  ? {height: contentMinHeight, overflow: 'hidden'}
                  : undefined
              }>
              <RNAnimated.ScrollView
                ref={horizontalRef}
                horizontal
                pagingEnabled
                decelerationRate="fast"
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                style={{opacity: pagerOpacity}}
                onContentSizeChange={handlePagerContentSizeChange}
                onScrollBeginDrag={() => {
                  scrollTargetRef.current = null;
                }}
                onMomentumScrollEnd={handleHorizontalMomentumEnd}
                onScroll={RNAnimated.event(
                  [{nativeEvent: {contentOffset: {x: scrollX}}}],
                  {useNativeDriver: true, listener: handleHorizontalScroll},
                )}>
                {tabs.map(tab => (
                  <View
                    key={tab.id}
                    style={{
                      width: screenWidth,
                      minHeight: contentMinHeight,
                      paddingBottom: bottomInset,
                    }}>
                    {renderedTabsRef.current.has(tab.id) ? (
                      tab.id === 'uploads' ? (
                        <UploadsTabContent
                          inline
                          reciterId={currentReciterId}
                          reciterName={reciter.name}
                          viewMode={viewMode}
                          showLovedOnly={showLovedOnly}
                          getColorForSurah={getColorForSurah}
                        />
                      ) : (
                        <MemoizedSurahList
                          inline
                          surahs={getSurahsForTab(tab.id)}
                          onSurahPress={handleSurahPress}
                          reciterId={currentReciterId}
                          isLoved={
                            isLovedPerTab.get(tab.id) ??
                            isLovedWithCurrentRewayat
                          }
                          isDownloaded={isDownloaded}
                          onOptionsPress={(surah: Surah) =>
                            SheetManager.show('surah-options', {
                              payload: {
                                surah,
                                reciterId: currentReciterId,
                                rewayatId: tab.id,
                                onAddToQueue: handleAddToQueue,
                                hideGoToReciter: true,
                              },
                            })
                          }
                          viewMode={viewMode}
                          sortOption={sortOption}
                          getColorForSurah={getColorForSurah}
                          rewayatId={tab.id}
                        />
                      )
                    ) : null}
                  </View>
                ))}
              </RNAnimated.ScrollView>
              {!neighborsReady && (
                <RNAnimated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    opacity: pagerOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                  }}
                  pointerEvents="none">
                  <SurahListSkeleton theme={theme} />
                </RNAnimated.View>
              )}
            </View>
          </RNAnimated.ScrollView>

          {/* Sticky title bar — fades in as outer scroll collapses header (Android only) */}
          {!isGlass && (
            <RNAnimated.View
              pointerEvents="none"
              onLayout={e => setStickyTitleHeight(e.nativeEvent.layout.height)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 15,
                paddingTop: insets.top,
                paddingBottom: moderateScale(10),
                backgroundColor: theme.colors.background,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: stickyTitleOpacity,
              }}>
              <Text
                style={{
                  fontSize: moderateScale(16),
                  fontFamily: 'Manrope-Bold',
                  color: theme.colors.text,
                  textAlign: 'center',
                }}>
                {reciter.name}
              </Text>
            </RNAnimated.View>
          )}
          {!isGlass && (
            <NavigationButtons
              insets={insets}
              iconsOpacity={iconsOpacity}
              iconsZIndex={iconsZIndex}
              onSearchPress={() => {
                setShowSearch(true);
              }}
            />
          )}
        </>
      </View>
      {/* Search overlay — mounted on top, preserves main content underneath */}
      {showSearch && (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          <SearchView
            surahs={filteredSurahs}
            onSurahPress={handleSurahPress}
            reciterId={currentReciterId}
            isLoved={isLovedWithCurrentRewayat}
            onOptionsPress={(surah: Surah) =>
              SheetManager.show('surah-options', {
                payload: {
                  surah,
                  reciterId: currentReciterId,
                  rewayatId: selectedRewayat?.id,
                  onAddToQueue: handleAddToQueue,
                  hideGoToReciter: true,
                },
              })
            }
            searchQuery={searchQuery}
            onSearchChange={handleSearch}
            onCloseSearch={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            availableRewayat={rewayatList}
            selectedRewayatId={selectedRewayatId}
            onRewayatSelect={handleRewayatChange}
            isDarkMode={theme.isDarkMode}
            reciterName={reciter.name}
            viewMode={viewMode}
            getColorForSurah={getColorForSurah}
          />
        </View>
      )}
    </View>
  );
};

// Lightweight wrapper — defers mounting the heavy content until the navigation
// transition finishes so the screen push feels instant.
// On Android, InteractionManager can hang indefinitely if an interaction never
// completes, so we race it against a short timeout.
const ReciterProfile: React.FC<ReciterProfileProps> = props => {
  const [ready, setReady] = useState(false);
  const {theme} = useTheme();

  useEffect(() => {
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };

    const handle = InteractionManager.runAfterInteractions(markReady);
    // Fallback: if interactions don't settle within 300ms, mount anyway
    const timer = setTimeout(markReady, 300);

    return () => {
      handle.cancel();
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return <View style={{flex: 1, backgroundColor: theme.colors.background}} />;
  }

  return <ReciterProfileContent {...props} />;
};

export default ReciterProfile;
