import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
} from 'react';
import {SurahOptionsScope} from '@/components/sheets/options/surahOptions'; // @ai
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated as RNAnimated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  PixelRatio, // @ai
  type LayoutChangeEvent, // @ai
  Platform,
  StyleSheet,
  Alert,
  type ScrollViewInstance,
} from 'react-native';
import {runAfterInteractions} from '@/utils/afterInteractions';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Surah, SURAHS} from '@/data/surahData';
import {Reciter, Rewayat} from '@/data/reciterData';
import {getReciterByIdSync} from '@/services/dataService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {
  useDownloadQueries,
  useDownloadActions,
  useAreAllSurahsDownloaded,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {bulkDownloadSurahs} from '@/services/player/bulkDownloadSurahs';
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
import {ReciterViewMenu} from './components/ReciterViewMenu'; // @ai
import {nativeMenusAvailable} from '@/components/native/nativeMenus'; // @ai
import {SurahList, SurahListTableHeader} from './components/SurahList'; // @ai
import {SearchView} from './components/SearchView';
import {RewayatTabBar} from './components/RewayatTabBar';
import {UploadsTabContent} from './components/UploadsTabContent';
import {useUploadsStore} from '@/store/uploadsStore';
import {moderateScale} from '@/utils/scale';
import {useBottomInset} from '@/hooks/useBottomInset';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';
import {pickRewayatId} from '@/utils/rewayatPreference'; // @ai
import {useNavigation} from 'expo-router';
import {useGlassHeaderHeight} from '@/hooks/useGlassHeaderHeight'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps';
import {reciterShareUrl, shareUrl} from '@/utils/shareUtils';
import branding from '@/config/branding';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
// @ai-start
import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {showToast} from '@/utils/toastUtils';
import {getReciterDisplayName, getSurahDisplayName} from '@/i18n/format';
import {currentLanguage} from '@/i18n/language';
import {SOURCE_LANGUAGE} from '@/i18n/languages';
import {forceLTR, isRTL} from '@/utils/rtl';
import {getRecitationStyleLabel} from '@/components/player/v2/recitationStyle';
import {rankSurahs} from '@/utils/search/catalog'; // @ai
// @ai-end
import {hasPagerReachedInitialPage} from './utils/pagerLayout'; // @ai
// @ai-start
import {
  HERO_COLUMN_WIDTH,
  heroColumnTop,
  usesHeroColumn,
} from './utils/heroColumn';
import {TABLE_MIN_WIDTH} from './utils/surahTable';
// @ai-end
import {TabletReciterHero} from './components/TabletReciterHero'; // @ai
import {useResponsive} from '@/hooks/useResponsive'; // @ai

interface ReciterProfileProps {
  id: string;
  showLoved?: boolean;
  initialRewayatId?: string;
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

// @ai-start
const notFoundStyles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(32),
    gap: moderateScale(8),
  },
  title: {
    fontSize: moderateScale(17),
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'center',
  },
  hint: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
  button: {
    marginTop: moderateScale(12),
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(12),
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
  },
});
// @ai-end

// @ai-start
const ReciterProfileContent: React.FC<ReciterProfileProps> = ({
  id: currentReciterId,
  showLoved = false,
  initialRewayatId: initialRewayatIdProp,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation(['player', 'common']);
  const styles = createSharedStyles(theme);
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const {height: screenHeight, width: windowWidth} = useWindowDimensions();
  // iPad (mockup L9): a photo hero and a surah table across the pane, with
  // the page margin for the window's width class (ipad-standards §5.2).
  const {isTablet} = useResponsive();
  const pageMargin = windowWidth >= 900 ? 32 : 24;
  // @ai-start
  // When the profile is wide enough for the hero column and the table
  // beside it, the hero is a fixed leading column and only the tab bar and
  // the surahs scroll (ipad-standards §10.2). The profile's own width
  // decides, not the window: the sidebar and the capped Collection column
  // take part of the window.
  const [profileWidth, setProfileWidth] = useState<number | null>(null);
  const handleProfileLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setProfileWidth(prev => (prev === next ? prev : next));
  }, []);
  const heroColumn =
    profileWidth !== null && usesHeroColumn(isTablet, profileWidth);
  // The pager pages must match the pager's own width, not the window: on
  // iPad the profile sits beside the sidebar inside a capped column, so
  // window-wide pages were clipped and swipes landed mid-page. Pages render
  // once the pager has been measured (it is hidden until then anyway); the
  // window width is only a first guess for the math before that.
  const [measuredPagerWidth, setMeasuredPagerWidth] = useState<number | null>(
    null,
  );
  const pageWidth = measuredPagerWidth ?? windowWidth;
  const handlePagerLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setMeasuredPagerWidth(prev => (prev === next ? prev : next));
  }, []);
  // @ai-end
  const navigation = useNavigation();
  const headerHeight = useGlassHeaderHeight(isGlass); // @ai

  // Synchronous reciter init — data available on first render, no deferred loading delay
  const initialReciter = useMemo(
    () => initReciter(currentReciterId),
    [currentReciterId],
  );
  // @ai-start
  // Prefer the rewayat passed via navigation, then the one the user last
  // picked for this reciter, then the first one. The saved pick is read once
  // so saving a new pick does not move the open profile.
  const initialRewayatId = useMemo(() => {
    if (!initialReciter) return undefined;
    const savedRewayatId =
      useSettings.getState().reciterPreferences[initialReciter.id];
    return pickRewayatId(initialReciter.rewayat, [
      initialRewayatIdProp,
      savedRewayatId,
    ]);
  }, [initialRewayatIdProp, initialReciter]);
  // @ai-end

  const [reciter, setReciter] = useState<Reciter | null>(initialReciter);
  const surahs = SURAHS;

  // Track reciter selected on mount
  useEffect(() => {
    if (initialReciter) {
      analyticsService.trackReciterSelected({
        reciter_id: initialReciter.id,
        reciter_name: initialReciter.name,
      });
    }
  }, [initialReciter]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(initialRewayatId);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const scrollX = useRef(
    new RNAnimated.Value(
      initialReciter
        ? (() => {
            // "My Uploads" is at index 0; rewayat start at index 1.
            // Find the index of the initial rewayat to set the correct scroll position.
            if (!initialRewayatId) return pageWidth;
            const rewayatIndex = initialReciter.rewayat.findIndex(
              r => r.id === initialRewayatId,
            );
            // +1 because "My Uploads" occupies index 0
            return rewayatIndex >= 0
              ? (rewayatIndex + 1) * pageWidth
              : pageWidth;
          })()
        : 0,
    ),
  ).current;
  const iconsOpacity = useRef(new RNAnimated.Value(1)).current;
  const iconsZIndex = useRef(new RNAnimated.Value(20)).current;
  const pagerOpacity = useRef(
    new RNAnimated.Value(
      initialReciter && initialReciter.rewayat.length === 0 ? 1 : 0,
    ),
  ).current;
  const [showSearch, setShowSearch] = useState(false);

  const [viewMode, setViewMode] = useState<ReciterProfileViewMode>(
    useSettings(state => state.reciterProfileViewMode),
  );
  const [sortOption, setSortOption] = useState<ReciterProfileSortOption>(
    useSettings(state => state.reciterProfileSortOption),
  );
  const [showLovedOnly, setShowLovedOnly] = useState(showLoved);
  const [activeTab, setActiveTab] = useState<string>(initialRewayatId ?? '');
  // iPad list tables pin their column header in the sticky section, so it
  // must use the same width test as SurahList (the page is the list). @ai
  const showPinnedTableHeader =
    isTablet &&
    viewMode === 'list' &&
    activeTab !== 'uploads' &&
    pageWidth >= TABLE_MIN_WIDTH;
  const [neighborsReady, setNeighborsReady] = useState(false);
  const outerScrollRef = useRef<ScrollViewInstance>(null);
  const horizontalRef = useRef<ScrollViewInstance>(null);
  const currentScrollYRef = useRef(0);
  const renderedTabsRef = useRef(new Set<string>());
  const pagerScrolledRef = useRef(
    initialReciter != null && initialReciter.rewayat.length === 0,
  );
  const scrollTargetRef = useRef<string | null>(null);
  const activeTabRef = useRef(initialRewayatId ?? '');
  const pagerContentWidthRef = useRef(0); // @ai: last width after the reveal

  const [collapsibleHeight, setCollapsibleHeight] = useState(0);
  const [stickyHeight, setStickyHeight] = useState(0);
  const [stickyTitleHeight, setStickyTitleHeight] = useState(0);

  // iOS: offset below transparent native header; Android: below custom sticky title
  const stickyPinOffset = isGlass ? headerHeight : stickyTitleHeight;
  // @ai-start
  const heroColumnTopInset = heroColumnTop({
    isGlass,
    headerHeight,
    safeAreaTop: insets.top,
    stickyPinOffset,
  });
  // @ai-end
  const {isLovedWithRewayat, lovedTracks} = useLoved();
  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
  } = useDownloadQueries();
  // @ai-start
  const {setDownloading, clearDownloading, addDownload, setDownloadProgress} =
    useDownloadActions();
  // "Download all" batches in flight, by rewayah, with how far each has got
  // (0–1). One flag for the whole screen made another rewayah's button show
  // this batch's progress, and a tap there cancelled it instead of starting
  // that rewayah's own.
  const [downloadAllProgressById, setDownloadAllProgressById] = useState<
    Record<string, number>
  >({});
  // Tracks mount state so a long batch's deferred setState/Alert never fire
  // after the screen is gone; the batches ref also closes the same-frame
  // double-tap window that React state alone leaves open.
  const isMountedRef = useRef(true);
  const downloadAllBatchesRef = useRef(new Map<string, {cancelled: boolean}>());

  useEffect(() => {
    isMountedRef.current = true;
    const batches = downloadAllBatchesRef.current;
    return () => {
      isMountedRef.current = false;
      if (batches.size === 0) return;
      // Signal any in-flight batch to stop when the user leaves the screen,
      // and say so: it used to stop after the current surah without a word.
      batches.forEach(batch => {
        batch.cancelled = true;
      });
      showToast(
        i18n.t('player:reciterProfile.downloadAll.stoppedOnLeave'),
        i18n.t('player:reciterProfile.downloadAll.stoppedOnLeaveHint'),
        'none',
      );
    };
  }, []);
  // @ai-end
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain); // @ai
  const {setReciterPreference} = useSettings(); // @ai

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

      // 3. A query ranks by relevance; sorting only applies without one
      // @ai-start
      if (searchQuery.trim()) return [...rankSurahs(searchQuery, available)];
      // @ai-end

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
  // @ai-start
  // With the heart filter on, the lists are made of what is loved, so they
  // have to be rebuilt when that changes. `isLovedWithRewayat` keeps its
  // identity, so a surah un-loved from its options stayed in the list,
  // without its heart, until the filter or the sort was toggled.
  const lovedKey = showLovedOnly
    ? lovedTracks
        .filter(track => track.reciterId === currentReciterId)
        .map(track => `${track.surahId}:${track.rewayatId}`)
        .join(',')
    : '';
  const cacheKey = `${showLovedOnly}|${searchQuery}|${sortOption}|${lovedKey}`;
  // @ai-end
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
    // `cacheKey`: once the cache is reset, `filteredSurahs` below has to
    // read it again. @ai
    [reciter, getFilteredSurahsForRewayat, cacheKey], // @ai
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

  // @ai-start
  // `tabId` is the rewayah tab whose list the row was tapped in. Every tab's
  // list used to share one handler that played the selected rewayah, so a tap
  // in the Hafs list played Warsh whenever the two had drifted apart (or did
  // nothing if Warsh lacked the surah). The search overlay has a single list
  // for the selected rewayah and passes no tab.
  const handleSurahPress = useCallback(
    async (surah: Surah, tabId?: string) => {
      if (!reciter) return;
      const rewayat = tabId
        ? reciter.rewayat.find(r => r.id === tabId)
        : selectedRewayat;
      if (!rewayat) return;
      try {
        const tabSurahs = getSurahsForTab(rewayat.id);
        const startIndex = tabSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        const artwork = getReciterArtwork(reciter);

        // Build all tracks with selected surah first
        const reorderedSurahs = [
          tabSurahs[startIndex],
          ...tabSurahs.slice(startIndex + 1),
          ...tabSurahs.slice(0, startIndex),
        ];

        const allTracks = reorderedSurahs.map(s => ({
          id: `${reciter.id}:${s.id}`,
          url: generateSmartAudioUrl(reciter, s.id.toString(), rewayat.id),
          title: getSurahDisplayName(s),
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: s.id.toString(),
          reciterName: reciter.name,
          rewayatId: rewayat.id,
        }));

        await updateQueue(allTracks, 0);
        startNewChain(reciter, surah, 0, 0, rewayat.id);
      } catch (error) {
        console.error('Error playing surah:', error);
      }
    },
    [reciter, getSurahsForTab, selectedRewayat, startNewChain, updateQueue],
  );
  // @ai-end

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
        title: getSurahDisplayName(s),
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
        title: getSurahDisplayName(s),
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

  // @ai-start
  // Subscribe through a primitive-returning store selector so this (heavy)
  // screen only re-renders when the boolean flips — not on every mutation of
  // the downloads array (single-surah downloads, removals, each batch item).
  const surahIdsForRewayat = useMemo(
    () => filteredSurahs.map(s => s.id.toString()),
    [filteredSurahs],
  );
  const allDownloaded = useAreAllSurahsDownloaded(
    currentReciterId,
    surahIdsForRewayat,
    selectedRewayat?.id,
  );

  // The selected rewayah's own batch, if it has one running.
  const selectedBatchProgress = selectedRewayat
    ? downloadAllProgressById[selectedRewayat.id]
    : undefined;
  const isDownloadingAll = selectedBatchProgress !== undefined;
  const downloadAllProgress = selectedBatchProgress ?? 0;

  const handleDownloadAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    const rewayatId = selectedRewayat.id;

    // A tap while this rewayah's batch is in flight requests cancellation.
    // Read the ref (not state) so a rapid second tap in the same frame is
    // caught before the re-render lands, which otherwise lets two batches
    // for the same rewayah start.
    const running = downloadAllBatchesRef.current.get(rewayatId);
    if (running) {
      running.cancelled = true;
      return;
    }

    if (filteredSurahs.length === 0) return;

    if (allDownloaded) {
      Alert.alert(
        t('reciterProfile.downloadAll.alreadyTitle'),
        t('reciterProfile.downloadAll.alreadyMessage'),
      );
      return;
    }

    const batch = {cancelled: false};
    downloadAllBatchesRef.current.set(rewayatId, batch);
    setDownloadAllProgressById(prev => ({...prev, [rewayatId]: 0}));

    try {
      const items = filteredSurahs.map(s => ({
        surahId: s.id,
        reciterId: reciter.id,
        rewayatId,
      }));

      const summary = await bulkDownloadSurahs(
        items,
        {
          downloadSurah,
          isDownloaded,
          isDownloadedWithRewayat,
          isDownloading,
          isDownloadingWithRewayat,
          setDownloading,
          clearDownloading,
          addDownload,
          setDownloadProgress,
        },
        {
          onProgress: (completed, total) => {
            // Skip progress writes once the screen is gone.
            if (!isMountedRef.current) return;
            setDownloadAllProgressById(prev => ({
              ...prev,
              [rewayatId]: total > 0 ? completed / total : 1,
            }));
          },
          isCancelled: () => batch.cancelled || !isMountedRef.current,
        },
      );

      // Don't surface result alerts on an unrelated screen if the user
      // navigated away from the reciter profile mid-batch (the unmount
      // effect has told them it stopped).
      if (!isMountedRef.current) return;

      if (summary.cancelled) {
        Alert.alert(
          t('reciterProfile.downloadAll.stoppedTitle'),
          t('reciterProfile.downloadAll.stoppedMessage', {
            count: summary.downloaded,
          }),
        );
      } else if (summary.failed > 0) {
        Alert.alert(
          t('reciterProfile.downloadAll.finishedTitle'),
          t('reciterProfile.downloadAll.finishedMessage', {
            downloaded: summary.downloaded,
            failed: summary.failed,
          }),
        );
      } else if (summary.downloaded > 0) {
        Alert.alert(
          t('reciterProfile.downloadAll.completeTitle'),
          t('reciterProfile.downloadAll.completeMessage', {
            reciter: getReciterDisplayName(reciter),
          }),
        );
      }
    } catch (error) {
      console.error('Error downloading all surahs:', error);
      if (isMountedRef.current) {
        Alert.alert(
          t('reciterProfile.downloadAll.errorTitle'),
          t('reciterProfile.downloadAll.errorMessage'),
        );
      }
    } finally {
      downloadAllBatchesRef.current.delete(rewayatId);
      if (isMountedRef.current) {
        setDownloadAllProgressById(prev => {
          const next = {...prev};
          delete next[rewayatId];
          return next;
        });
      }
    }
  }, [
    reciter,
    selectedRewayat,
    filteredSurahs,
    allDownloaded,
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
    setDownloading,
    clearDownloading,
    addDownload,
    setDownloadProgress,
    t,
  ]);
  // @ai-end

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

  // @ai-start View and sort sit in the header beside search, as on the
  // Collection screens; the old row of sort pills stays only where there
  // are no native menus (web). Hidden on My Uploads, which has no surahs.
  const setViewModeTo = useCallback(
    (mode: ReciterProfileViewMode) => {
      setReciterViewModeSetting(mode);
      setViewMode(mode);
    },
    [setReciterViewModeSetting],
  );
  const viewMenu =
    nativeMenusAvailable && activeTab !== 'uploads' ? (
      <ReciterViewMenu
        viewMode={viewMode}
        sortOption={sortOption}
        lovedOnly={showLovedOnly}
        onViewModeChange={setViewModeTo}
        onSortChange={changeSortOption}
        onToggleLovedOnly={toggleShowLovedOnly}
      />
    ) : null;
  // @ai-end

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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: moderateScale(20),
                paddingHorizontal: moderateScale(6),
              }}>
              <Pressable
                onPress={() => {
                  const slug = reciter?.slug ?? currentReciterId;
                  shareUrl(
                    reciterShareUrl(slug),
                    t('reciterProfile.shareMessage', {
                      name: reciter
                        ? getReciterDisplayName(reciter)
                        : t('reciterProfile.thisReciter'),
                      appName: branding.appName,
                    }),
                  );
                }}
                hitSlop={8}>
                <Feather
                  name="share"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
              </Pressable>
              <Pressable onPress={() => setShowSearch(true)} hitSlop={8}>
                <Feather
                  name="search"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
              </Pressable>
              {viewMenu}
            </View>
          ),
    });
  }, [navigation, theme, showSearch, t, viewMenu]);

  // Uploads for this reciter
  const reciterUploads = useUploadsStore(state =>
    state.recitations.filter(r => r.reciterId === currentReciterId),
  );
  const hasUploads = reciterUploads.length > 0;

  // Build tabs array: "My Uploads" first (leftmost), then rewayat tabs.
  // The pager uses opacity-gated reveal to scroll to index 1 before showing.
  const tabs = useMemo(() => {
    const result: Array<{id: string; label: string}> = [];
    result.push({id: 'uploads', label: t('reciterProfile.myUploads')});
    if (reciter?.rewayat) {
      reciter.rewayat.forEach(r => {
        const style =
          currentLanguage === SOURCE_LANGUAGE
            ? r.style.charAt(0).toUpperCase() + r.style.slice(1).toLowerCase()
            : getRecitationStyleLabel(r.style);
        result.push({
          id: r.id,
          label: `${getDisplayLabelFromName(r.name)} · ${style}`,
        });
      });
    }
    return result;
  }, [reciter?.rewayat, t]);

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
          x: tabIndex * pageWidth,
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
    [collapsibleHeight, stickyPinOffset, handleRewayatChange, tabs, pageWidth],
  );

  // Scroll listener — only clears programmatic scroll gate; no side effects during swipe.
  const handleHorizontalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollTargetRef.current !== null) {
        const offsetX = e.nativeEvent.contentOffset.x;
        const pageIndex = Math.round(offsetX / pageWidth);
        const tab = tabs[pageIndex];
        if (tab && tab.id === scrollTargetRef.current) {
          scrollTargetRef.current = null;
        }
      }
    },
    [tabs, pageWidth],
  );

  // Fires after paging snap completes — updates tab state without interrupting gesture.
  const handleHorizontalMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / pageWidth);
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
    [tabs, pageWidth, handleRewayatChange, collapsibleHeight, stickyPinOffset],
  );

  // Opacity-gated reveal: scroll pager to initial rewayat tab before showing.
  // Defaults to index 1 (first rewayat, skipping "My Uploads" at index 0),
  // but honours initialRewayatId when navigating from a rewayah-specific context.
  const initialTabIndex = useMemo(() => {
    if (!initialRewayatId) return 1;
    const idx = tabs.findIndex(t => t.id === initialRewayatId);
    return idx >= 0 ? idx : 1;
  }, [initialRewayatId, tabs]);

  const handlePagerContentSizeChange = useCallback(
    (contentWidth: number) => {
      // @ai-start
      // After the reveal, go back to the active page each time the pages get
      // a new width (rotation, Split View, the sidebar, the hero column).
      // Only now do the pages have that width: a scroll before it is clamped
      // to the old content on Android, and leaves the pager between pages.
      if (pagerScrolledRef.current) {
        if (contentWidth === pagerContentWidthRef.current) return;
        pagerContentWidthRef.current = contentWidth;
        const index = tabs.findIndex(tab => tab.id === activeTabRef.current);
        if (index < 0) return;
        const x = index * pageWidth;
        // The tab bar indicator follows scrollX.
        scrollX.setValue(x);
        // A scroll in this frame can still reach the view before its new
        // layout, so wait one frame.
        requestAnimationFrame(() =>
          horizontalRef.current?.scrollTo({x, y: 0, animated: false}),
        );
        return;
      }
      // @ai-end
      const targetX = initialTabIndex * pageWidth;
      // @ai-start
      const initialPageReady = hasPagerReachedInitialPage(
        contentWidth,
        pageWidth,
        initialTabIndex,
        PixelRatio.get(),
      );
      if (initialPageReady) {
        pagerScrolledRef.current = true;
        pagerContentWidthRef.current = contentWidth; // @ai
        // Set scrollX so the tab bar indicator lands on the correct tab immediately
        scrollX.setValue(targetX);
        horizontalRef.current?.scrollTo({
          x: targetX,
          y: 0,
          animated: false,
        });
        requestAnimationFrame(() => {
          pagerOpacity.setValue(1);
          setNeighborsReady(true);
        });
      }
      // @ai-end
    },
    [pageWidth, pagerOpacity, initialTabIndex, scrollX, tabs],
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

  // @ai-start
  // The reciter is looked up once, from the catalogue already in memory, so
  // a missing one never arrives: a card or favourite whose reciter left the
  // catalogue, a mistyped link, "Go to reciter" on an untagged upload. This
  // used to show a spinner forever, with no way back on screens without the
  // native header.
  if (!reciter) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={theme.isDarkMode ? 'light' : 'dark'} />
        <View style={notFoundStyles.body}>
          <Text style={[notFoundStyles.title, {color: theme.colors.text}]}>
            {t('reciterProfile.notFound')}
          </Text>
          <Text
            style={[notFoundStyles.hint, {color: theme.colors.textSecondary}]}>
            {t('reciterProfile.notFoundHint')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({pressed}) => [
              notFoundStyles.button,
              {borderColor: theme.colors.border},
              pressed && notFoundStyles.buttonPressed,
            ]}>
            <Text
              style={[notFoundStyles.buttonText, {color: theme.colors.text}]}>
              {t('common:actions.back')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  // @ai-end

  // @ai-start
  // On a tablet the hero's place depends on the profile's width, so the
  // page lays out once that is measured, as the pager pages do. This keeps
  // the hero from jumping from a row to the column on the first frame.
  if (isTablet && profileWidth === null) {
    return <View onLayout={handleProfileLayout} style={styles.container} />;
  }

  // The tablet hero, built once: a row above the list, or the pinned column
  // beside it.
  const rowHeroTop = showSearch ? 16 : isGlass ? 8 : insets.top + 56;
  const tabletHero = isTablet ? (
    <TabletReciterHero
      reciter={reciter}
      layout={heroColumn ? 'column' : 'row'}
      paddingTop={heroColumn ? heroColumnTopInset : rowHeroTop}
      margin={pageMargin}
      onFavoritePress={handleToggleFavorite}
      onShufflePress={handleShuffleAll}
      onPlayPress={handlePlayAll}
      isFavoriteReciter={isFavoriteReciter(reciter.id)}
      onDownloadAllPress={handleDownloadAll}
      isDownloadingAll={isDownloadingAll}
      downloadAllProgress={downloadAllProgress}
      allDownloaded={allDownloaded}
    />
  ) : null;
  // @ai-end

  return (
    <View
      onLayout={handleProfileLayout} // @ai
      style={styles.container}>
      <StatusBar style={theme.isDarkMode ? 'light' : 'dark'} />
      {/* Main content — always mounted to preserve pager scroll position */}
      <View
        style={[{flex: 1}, heroColumn && {flexDirection: 'row'}]} // @ai
        pointerEvents={showSearch ? 'none' : 'auto'}>
        <>
          {/* @ai-start */}
          {/* Large windows: the hero is a leading column outside the scroll
           * view. It scrolls on its own only when it is taller than the
           * window (a short window or a large text size). */}
          {heroColumn && (
            <ScrollView
              style={{width: HERO_COLUMN_WIDTH, flexGrow: 0, flexShrink: 0}}
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical={false}>
              {tabletHero}
            </ScrollView>
          )}
          {/* @ai-end */}
          {/* Single outer scroll: header collapses, tab bar sticks, content scrolls */}
          <RNAnimated.ScrollView
            ref={outerScrollRef}
            style={heroColumn ? {flex: 1} : undefined} // @ai
            stickyHeaderIndices={[1]}
            // @ai: the column layout pads for the native header itself
            contentInsetAdjustmentBehavior={
              isGlass && !heroColumn ? 'automatic' : 'never'
            }
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
                        headerTitle: shouldShow
                          ? getReciterDisplayName(reciter)
                          : '',
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
              {/* @ai: with the hero in its column, only its top inset stays
               * here, so the tab bar starts level with the photo. */}
              {heroColumn ? (
                <View style={{height: heroColumnTopInset}} />
              ) : isTablet ? (
                tabletHero
              ) : (
                <>
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
                      onDownloadAllPress={handleDownloadAll}
                      isDownloadingAll={isDownloadingAll}
                      downloadAllProgress={downloadAllProgress}
                      allDownloaded={allDownloaded}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Child 1: Sticky section — sticks at top when header collapses */}
            {/* paddingTop offsets below native header (iOS) or sticky title (Android) */}
            <View
              onLayout={e => setStickyHeight(e.nativeEvent.layout.height)}
              // @ai: the offset above the tabs is painted too, so rows
              // scrolling up don't show between the top bar and the tabs.
              // Before the header collapses, the header sits over it.
              style={{
                paddingTop: stickyPinOffset,
                backgroundColor: theme.colors.background,
              }}
              pointerEvents="box-none">
              <View style={{backgroundColor: theme.colors.background}}>
                {tabs.length > 0 && (
                  <RewayatTabBar
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabChange={handleTabChange}
                    theme={theme}
                    scrollX={scrollX}
                    screenWidth={pageWidth}
                  />
                )}
                {!nativeMenusAvailable && (
                  <View
                    style={[
                      styles.controlsRow,
                      isTablet && {marginHorizontal: pageMargin},
                    ]}>
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
                            {t('reciterProfile.sort.asc')}
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
                            {t('reciterProfile.sort.desc')}
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
                            {t('reciterProfile.sort.revelation')}
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
                )}
                {/* @ai: the table's column labels stay on screen while the
                    surahs scroll under them. */}
                {showPinnedTableHeader && (
                  <SurahListTableHeader margin={pageMargin} />
                )}
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
                style={[{opacity: pagerOpacity}, forceLTR]}
                onLayout={handlePagerLayout} // @ai
                onContentSizeChange={handlePagerContentSizeChange}
                onScrollBeginDrag={() => {
                  scrollTargetRef.current = null;
                }}
                onMomentumScrollEnd={handleHorizontalMomentumEnd}
                onScroll={RNAnimated.event(
                  [{nativeEvent: {contentOffset: {x: scrollX}}}],
                  {useNativeDriver: true, listener: handleHorizontalScroll},
                )}>
                {/* @ai: pages wait for the measured pager width */}
                {measuredPagerWidth !== null &&
                  tabs.map(tab => (
                    <View
                      key={tab.id}
                      style={{
                        width: pageWidth,
                        minHeight: contentMinHeight,
                        paddingBottom: bottomInset,
                        direction: isRTL ? 'rtl' : 'ltr',
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
                          // @ai-start
                          <SurahOptionsScope
                            reciterId={currentReciterId}
                            rewayatId={tab.id}
                            onAddToQueue={handleAddToQueue}
                            hideGoToReciter>
                            <MemoizedSurahList
                              inline
                              surahs={getSurahsForTab(tab.id)}
                              onSurahPress={(surah: Surah) =>
                                handleSurahPress(surah, tab.id)
                              }
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
                              tabletMargin={isTablet ? pageMargin : undefined}
                              hideTableHeader={isTablet} // @ai
                            />
                          </SurahOptionsScope>
                          // @ai-end
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
                {getReciterDisplayName(reciter)}
              </Text>
            </RNAnimated.View>
          )}
          {!isGlass && (
            <NavigationButtons
              insets={insets}
              iconsOpacity={iconsOpacity}
              iconsZIndex={iconsZIndex}
              onSearchPress={() => setShowSearch(true)}
              extra={viewMenu}
              onSharePress={() => {
                const slug = reciter?.slug ?? currentReciterId;
                shareUrl(
                  reciterShareUrl(slug),
                  t('reciterProfile.shareMessage', {
                    name: reciter
                      ? getReciterDisplayName(reciter)
                      : t('reciterProfile.thisReciter'),
                    appName: branding.appName,
                  }),
                );
              }}
            />
          )}
        </>
      </View>
      {/* Search overlay — mounted on top, preserves main content underneath */}
      {showSearch && (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          {/* @ai-start */}
          <SurahOptionsScope
            reciterId={currentReciterId}
            rewayatId={selectedRewayat?.id}
            onAddToQueue={handleAddToQueue}
            hideGoToReciter>
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
              // Through the tab handler, so the tab bar and pager under this
              // overlay move with the chip. Setting only the rewayah left
              // the old tab's list showing after Cancel while taps, Play,
              // Shuffle and Download all acted on the chip's rewayah.
              onRewayatSelect={handleTabChange}
              isDarkMode={theme.isDarkMode}
              reciterName={getReciterDisplayName(reciter)}
              viewMode={viewMode}
              getColorForSurah={getColorForSurah}
            />
          </SurahOptionsScope>
          {/* @ai-end */}
        </View>
      )}
    </View>
  );
};
// @ai-end

// Lightweight wrapper — defers mounting the heavy content until the navigation
// transition finishes so the screen push feels instant.
// The idle callback can be late while the JS thread stays busy, so we race it
// against a short timeout.
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

    const handle = runAfterInteractions(markReady);
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
