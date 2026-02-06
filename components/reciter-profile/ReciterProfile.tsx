import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
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
import {useUnifiedPlayer} from '@/services/player/store/playerStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {createTracksForReciter} from '@/utils/track';
import TrackPlayer from 'react-native-track-player';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {QueueContext} from '@/services/queue/QueueContext';
import {shuffleArray} from '@/utils/arrayUtils';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {SheetManager} from 'react-native-actions-sheet';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useDownloadQueries} from '@/services/player/store/downloadSelectors';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {createSharedStyles} from './styles';
import {useSettings} from '@/hooks/useSettings';
import {Icon} from '@rneui/themed';
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
      a.name === "Hafs A'n Assem" && a.style === 'murattal';
    const bIsHafsMurattal =
      b.name === "Hafs A'n Assem" && b.style === 'murattal';
    if (aIsHafsMurattal && !bIsHafsMurattal) return -1;
    if (!aIsHafsMurattal && bIsHafsMurattal) return 1;

    const aIsHafs = a.name === "Hafs A'n Assem";
    const bIsHafs = b.name === "Hafs A'n Assem";
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

const ReciterProfile: React.FC<ReciterProfileProps> = ({
  id: currentReciterId,
  showLoved = false,
}) => {
  const {theme} = useTheme();
  const styles = createSharedStyles(theme);
  const insets = useSafeAreaInsets();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const surahs = SURAHS;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(undefined);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const iconsOpacity = useRef(new RNAnimated.Value(1)).current;
  const iconsZIndex = useRef(new RNAnimated.Value(20)).current;
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<ReciterProfileViewMode>(
    useSettings(state => state.reciterProfileViewMode),
  );
  const [sortOption, setSortOption] = useState<ReciterProfileSortOption>(
    useSettings(state => state.reciterProfileSortOption),
  );
  const [showLovedOnly, setShowLovedOnly] = useState(showLoved);
  const [activeTab, setActiveTab] = useState<string>('');
  const outerScrollRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<ScrollView>(null);
  const currentScrollYRef = useRef(0);
  const initialScrollDone = useRef(false);
  const renderedTabsRef = useRef(new Set<string>());
  const activeTabRef = useRef('');
  const {height: screenHeight, width: screenWidth} = useWindowDimensions();

  // Deferred loading — run after navigation animation completes
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      const r = initReciter(currentReciterId);
      if (r) {
        const firstRewayatId = r.rewayat[0]?.id;
        // Set scrollX BEFORE triggering re-render so the tab bar
        // interpolations start at the correct position.
        // Uploads is index 0, first rewayat is index 1.
        scrollX.setValue(1 * screenWidth);
        setReciter(r);
        setSelectedRewayatId(firstRewayatId);
        setActiveTab(firstRewayatId ?? '');
        activeTabRef.current = firstRewayatId ?? '';
      } else {
        setReciter(null);
      }
    });
    return () => handle.cancel();
  }, [currentReciterId, scrollX, screenWidth]);
  const [collapsibleHeight, setCollapsibleHeight] = useState(0);
  const [stickyHeight, setStickyHeight] = useState(0);
  const [stickyTitleHeight, setStickyTitleHeight] = useState(0);
  const {isLovedWithRewayat} = useLoved();
  const {isDownloaded} = useDownloadQueries();
  const {addRecentTrack} = useRecentlyPlayedStore();
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

  const {addToQueue} = useUnifiedPlayer();
  const playerStore = usePlayerStore();
  const queueContext = QueueContext.getInstance();
  const {toggleFavorite, isFavoriteReciter} = useFavoriteReciters();

  // Track current operation to prevent race conditions
  const currentOperationRef = useRef<string | null>(null);

  const handleSurahPress = useCallback(
    async (surah: Surah) => {
      if (!reciter || !selectedRewayat) return;
      try {
        const startIndex = filteredSurahs.findIndex(s => s.id === surah.id);
        if (startIndex === -1) return;

        // OPTIMIZED: Use hybrid approach - create first track, play immediately
        // Then create remaining tracks in background (like playFromSurah does)

        // Generate unique operation ID to prevent race conditions
        const operationId = `${Date.now()}-${reciter.id}-${surah.id}`;
        currentOperationRef.current = operationId;

        // Get artwork once (same for all tracks)
        const artwork = getReciterArtwork(reciter);

        // OPTIMIZATION: Ensure download store is "warm" (hydrated) before checking
        // This makes generateSmartAudioUrl fast - the check itself is just a .some() on an array
        // Store is pre-warmed in _layout.tsx, but we ensure it's ready here
        useDownloadStore.getState(); // Trigger hydration if not already done

        // Create ONLY first track (instant!)
        // Use generateSmartAudioUrl - store is now warm, so check is fast (<1ms)
        const firstTrack = {
          id: `${reciter.id}:${surah.id}`,
          url: generateSmartAudioUrl(
            reciter,
            surah.id.toString(),
            selectedRewayat.id,
          ), // Fast now - store is warm
          title: surah.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: surah.id.toString(),
          reciterName: reciter.name,
          rewayatId: selectedRewayat.id,
        };

        // Add first track and play IMMEDIATELY (fast path - no blocking!)
        // OPTIMIZATION: Don't await reset - start it but don't wait for it to complete
        // This makes switching surahs blazing fast!
        const resetPromise = TrackPlayer.reset();
        currentOperationRef.current = operationId;

        // Wait for reset to complete, but track creation and URL generation happens in parallel
        await resetPromise;

        await TrackPlayer.add(firstTrack);
        await TrackPlayer.play();

        // CRITICAL: Update store IMMEDIATELY and synchronously to prevent race conditions
        // Check if operation is still valid (user might have switched during reset/add)
        if (currentOperationRef.current === operationId) {
          const store = usePlayerStore.getState();
          store.updateQueueState({
            tracks: [firstTrack],
            currentIndex: 0,
            total: 1,
            loading: false,
            endReached: false,
          });
        }

        // Get remaining surahs (reordered so selected is first)
        const remainingSurahs = [
          ...filteredSurahs.slice(startIndex + 1),
          ...filteredSurahs.slice(0, startIndex),
        ];

        // Create remaining tracks in parallel (background - doesn't block playback!)
        if (remainingSurahs.length > 0) {
          Promise.all(
            remainingSurahs.map(async s => {
              const url = generateSmartAudioUrl(
                reciter,
                s.id.toString(),
                selectedRewayat.id,
              );
              return {
                id: `${reciter.id}:${s.id}`,
                url,
                title: s.name,
                artist: reciter.name,
                reciterId: reciter.id,
                artwork, // Reuse pre-computed artwork
                surahId: s.id.toString(),
                reciterName: reciter.name,
                rewayatId: selectedRewayat.id,
              };
            }),
          )
            .then(remainingTracks => {
              // FIX: Check if operation is still valid (prevents race conditions)
              if (currentOperationRef.current !== operationId) {
                console.log(
                  '[ReciterProfile] Operation cancelled, skipping track addition',
                );
                return; // Operation was cancelled (user switched tracks)
              }

              // Add remaining tracks to TrackPlayer (non-blocking)
              TrackPlayer.add(remainingTracks)
                .then(() => {
                  // FIX: Double-check operation is still valid before updating store
                  if (currentOperationRef.current !== operationId) {
                    console.log(
                      '[ReciterProfile] Operation cancelled, skipping store update',
                    );
                    return;
                  }

                  // Update store with complete queue (non-blocking)
                  const completeQueue = [firstTrack, ...remainingTracks];
                  const store = usePlayerStore.getState();
                  store.updateQueueState({
                    tracks: completeQueue,
                    total: completeQueue.length, // FIX: Update total to match actual tracks
                  });
                })
                .catch(error => {
                  console.error('Error adding tracks to TrackPlayer:', error);
                });
            })
            .catch(error => {
              console.error('Error creating remaining tracks:', error);
            });
        }

        // Add to recently played AFTER playback starts (non-blocking)
        addRecentTrack(reciter, surah, 0, 0, selectedRewayat.id);
        queueContext.setCurrentReciter(reciter);
      } catch (error) {
        console.error('Error playing surah:', error);
        currentOperationRef.current = null; // Clear on error
      }
    },
    [reciter, filteredSurahs, selectedRewayat, queueContext, addRecentTrack],
  );

  const handlePlayAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    try {
      // OPTIMIZED: Use hybrid approach - create first track, play immediately
      // Then create remaining tracks in background

      if (filteredSurahs.length === 0) return;

      // Generate unique operation ID
      const operationId = `${Date.now()}-${reciter.id}-play-all`;
      currentOperationRef.current = operationId;

      // Get artwork once
      const artwork = getReciterArtwork(reciter);

      // OPTIMIZATION: Ensure download store is "warm" (hydrated) before checking
      useDownloadStore.getState(); // Trigger hydration if not already done

      // Create ONLY first track (instant!)
      // Use generateSmartAudioUrl - store is now warm, so check is fast (<1ms)
      const firstSurah = filteredSurahs[0];
      const firstTrack = {
        id: `${reciter.id}:${firstSurah.id}`,
        url: generateSmartAudioUrl(
          reciter,
          firstSurah.id.toString(),
          selectedRewayat.id,
        ), // Fast now - store is warm
        title: firstSurah.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: firstSurah.id.toString(),
        reciterName: reciter.name,
        rewayatId: selectedRewayat.id,
      };

      // Add first track and play IMMEDIATELY
      try {
        await TrackPlayer.reset();
        currentOperationRef.current = operationId;
        await TrackPlayer.add(firstTrack);
        await TrackPlayer.play();

        // CRITICAL: Update store IMMEDIATELY and synchronously to prevent race conditions
        if (currentOperationRef.current === operationId) {
          const store = usePlayerStore.getState();
          store.updateQueueState({
            tracks: [firstTrack],
            currentIndex: 0,
            total: 1,
            loading: false,
            endReached: false,
          });
        }
      } catch (error) {
        console.error('Error starting playback:', error);
        currentOperationRef.current = null;
        throw error;
      }

      // Create remaining tracks in parallel (background)
      const remainingSurahs = filteredSurahs.slice(1);
      if (remainingSurahs.length > 0) {
        Promise.all(
          remainingSurahs.map(async s => {
            const url = generateSmartAudioUrl(
              reciter,
              s.id.toString(),
              selectedRewayat.id,
            );
            return {
              id: `${reciter.id}:${s.id}`,
              url,
              title: s.name,
              artist: reciter.name,
              reciterId: reciter.id,
              artwork,
              surahId: s.id.toString(),
              reciterName: reciter.name,
              rewayatId: selectedRewayat.id,
            };
          }),
        )
          .then(remainingTracks => {
            if (currentOperationRef.current !== operationId) {
              console.log(
                '[ReciterProfile] Operation cancelled, skipping track addition',
              );
              return;
            }

            TrackPlayer.add(remainingTracks)
              .then(() => {
                if (currentOperationRef.current !== operationId) {
                  console.log(
                    '[ReciterProfile] Operation cancelled, skipping store update',
                  );
                  return;
                }

                const completeQueue = [firstTrack, ...remainingTracks];
                const store = usePlayerStore.getState();
                store.updateQueueState({
                  tracks: completeQueue,
                  total: completeQueue.length,
                });
              })
              .catch(error => {
                console.error('Error adding tracks to TrackPlayer:', error);
              });
          })
          .catch(error => {
            console.error('Error creating remaining tracks:', error);
          });
      }

      // Add to recently played AFTER playback starts (non-blocking)
      addRecentTrack(reciter, firstSurah, 0, 0, selectedRewayat.id);
      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error playing all surahs:', error);
      currentOperationRef.current = null;
    }
  }, [reciter, filteredSurahs, selectedRewayat, queueContext, addRecentTrack]);

  const handleShuffleAll = useCallback(async () => {
    if (!reciter || !selectedRewayat) return;
    try {
      // OPTIMIZED: Use hybrid approach - create first track, play immediately
      // Then create remaining tracks in background

      if (filteredSurahs.length === 0) return;

      // Shuffle surahs first
      const shuffledSurahs = shuffleArray([...filteredSurahs]);

      // Generate unique operation ID
      const operationId = `${Date.now()}-${reciter.id}-shuffle-all`;
      currentOperationRef.current = operationId;

      // Get artwork once
      const artwork = getReciterArtwork(reciter);

      // OPTIMIZATION: Ensure download store is "warm" (hydrated) before checking
      useDownloadStore.getState(); // Trigger hydration if not already done

      // Create ONLY first track (instant!)
      // Use generateSmartAudioUrl - store is now warm, so check is fast (<1ms)
      const firstSurah = shuffledSurahs[0];
      const firstTrack = {
        id: `${reciter.id}:${firstSurah.id}`,
        url: generateSmartAudioUrl(
          reciter,
          firstSurah.id.toString(),
          selectedRewayat.id,
        ), // Fast now - store is warm
        title: firstSurah.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork,
        surahId: firstSurah.id.toString(),
        reciterName: reciter.name,
        rewayatId: selectedRewayat.id,
      };

      // Enable shuffle mode in player settings
      if (!playerStore.settings.shuffle) {
        playerStore.toggleShuffle();
      }

      // Add first track and play IMMEDIATELY
      try {
        await TrackPlayer.reset();
        currentOperationRef.current = operationId;
        await TrackPlayer.add(firstTrack);
        await TrackPlayer.play();

        // CRITICAL: Update store IMMEDIATELY and synchronously to prevent race conditions
        if (currentOperationRef.current === operationId) {
          const store = usePlayerStore.getState();
          store.updateQueueState({
            tracks: [firstTrack],
            currentIndex: 0,
            total: 1,
            loading: false,
            endReached: false,
          });
        }
      } catch (error) {
        console.error('Error starting playback:', error);
        currentOperationRef.current = null;
        throw error;
      }

      // Create remaining tracks in parallel (background)
      const remainingSurahs = shuffledSurahs.slice(1);
      if (remainingSurahs.length > 0) {
        Promise.all(
          remainingSurahs.map(async s => {
            const url = generateSmartAudioUrl(
              reciter,
              s.id.toString(),
              selectedRewayat.id,
            );
            return {
              id: `${reciter.id}:${s.id}`,
              url,
              title: s.name,
              artist: reciter.name,
              reciterId: reciter.id,
              artwork,
              surahId: s.id.toString(),
              reciterName: reciter.name,
              rewayatId: selectedRewayat.id,
            };
          }),
        )
          .then(remainingTracks => {
            if (currentOperationRef.current !== operationId) {
              console.log(
                '[ReciterProfile] Operation cancelled, skipping track addition',
              );
              return;
            }

            TrackPlayer.add(remainingTracks)
              .then(() => {
                if (currentOperationRef.current !== operationId) {
                  console.log(
                    '[ReciterProfile] Operation cancelled, skipping store update',
                  );
                  return;
                }

                const completeQueue = [firstTrack, ...remainingTracks];
                const store = usePlayerStore.getState();
                store.updateQueueState({
                  tracks: completeQueue,
                  total: completeQueue.length,
                });
              })
              .catch(error => {
                console.error('Error adding tracks to TrackPlayer:', error);
              });
          })
          .catch(error => {
            console.error('Error creating remaining tracks:', error);
          });
      }

      // Add to recently played AFTER playback starts (non-blocking)
      addRecentTrack(reciter, firstSurah, 0, 0, selectedRewayat.id);
      queueContext.setCurrentReciter(reciter);
    } catch (error) {
      console.error('Error shuffling surahs:', error);
      currentOperationRef.current = null;
    }
  }, [
    reciter,
    filteredSurahs,
    selectedRewayat,
    queueContext,
    addRecentTrack,
    playerStore,
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

  // Build tabs array: "My Uploads" (always first) + one tab per rewayat
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
        horizontalRef.current.scrollTo({
          x: tabIndex * screenWidth,
          animated: true,
        });
      }
      // When changing tabs: if sticky, stay at collapse point.
      // If not sticky, scroll to top so header is visible.
      const actualCollapsePoint = collapsibleHeight - stickyTitleHeight;
      const isCollapsed = currentScrollYRef.current >= actualCollapsePoint - 1;
      outerScrollRef.current?.scrollTo({
        y: isCollapsed ? actualCollapsePoint : 0,
        animated: false,
      });
    },
    [
      collapsibleHeight,
      stickyTitleHeight,
      handleRewayatChange,
      tabs,
      screenWidth,
    ],
  );

  // Continuous scroll listener — updates activeTab at 50% swipe threshold
  const handleHorizontalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const pageIndex = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      const tab = tabs[pageIndex];
      if (tab && tab.id !== activeTabRef.current) {
        activeTabRef.current = tab.id;
        setActiveTab(tab.id);
        if (tab.id !== 'uploads') {
          handleRewayatChange(tab.id);
        }
      }
    },
    [tabs, screenWidth, handleRewayatChange],
  );

  // Sticky title bar opacity — fades in as the outer scroll collapses the header
  // With negative margin on header, the actual collapse point is reduced
  const collapsePoint = Math.max(1, collapsibleHeight - stickyTitleHeight);
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

  // Scroll horizontal pager to the initial active tab on first load
  useEffect(() => {
    if (!initialScrollDone.current && activeTab && tabs.length > 0) {
      const index = tabs.findIndex(t => t.id === activeTab);
      if (index >= 0) {
        activeTabRef.current = activeTab;
        scrollX.setValue(index * screenWidth);
        setTimeout(() => {
          horizontalRef.current?.scrollTo({
            x: index * screenWidth,
            animated: false,
          });
        }, 0);
        initialScrollDone.current = true;
      }
    }
  }, [activeTab, tabs, screenWidth, scrollX]);

  // Lazy tab rendering: mark active ±1 tabs so only nearby tabs render.
  // Once rendered, tabs stay in the Set so revisited tabs don't re-mount.
  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  for (
    let i = Math.max(0, activeIndex - 1);
    i <= Math.min(tabs.length - 1, activeIndex + 1);
    i++
  ) {
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
      {showSearch ? (
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
      ) : (
        <>
          {/* Single outer scroll: header collapses, tab bar sticks, content scrolls */}
          <RNAnimated.ScrollView
            ref={outerScrollRef}
            stickyHeaderIndices={[1]}
            onScroll={RNAnimated.event(
              [{nativeEvent: {contentOffset: {y: scrollY}}}],
              {
                useNativeDriver: true,
                listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  currentScrollYRef.current = e.nativeEvent.contentOffset.y;
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
              style={{marginBottom: -stickyTitleHeight}}>
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
            {/* Outer View has transparent paddingTop so action buttons show through the overlap */}
            {/* Inner View has opaque background for the actual tab bar + controls */}
            <View
              onLayout={e => setStickyHeight(e.nativeEvent.layout.height)}
              style={{paddingTop: stickyTitleHeight}}>
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
                      <Icon
                        name={viewMode === 'card' ? 'list' : 'grid'}
                        type="feather"
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
            <RNAnimated.ScrollView
              ref={horizontalRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              contentOffset={{x: activeIndex * screenWidth, y: 0}}
              onScroll={RNAnimated.event(
                [{nativeEvent: {contentOffset: {x: scrollX}}}],
                {useNativeDriver: true, listener: handleHorizontalScroll},
              )}>
              {tabs.map(tab => (
                <View
                  key={tab.id}
                  style={{width: screenWidth, minHeight: contentMinHeight}}>
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
                          isLovedPerTab.get(tab.id) ?? isLovedWithCurrentRewayat
                        }
                        isDownloaded={isDownloaded}
                        onOptionsPress={(surah: Surah) =>
                          SheetManager.show('surah-options', {
                            payload: {
                              surah,
                              reciterId: currentReciterId,
                              rewayatId: tab.id,
                              onAddToQueue: handleAddToQueue,
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
          </RNAnimated.ScrollView>

          {/* Sticky title bar — fades in as outer scroll collapses header */}
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
          <NavigationButtons
            insets={insets}
            iconsOpacity={iconsOpacity}
            iconsZIndex={iconsZIndex}
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
