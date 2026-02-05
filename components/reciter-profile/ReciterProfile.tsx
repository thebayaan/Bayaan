import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Pressable,
  Animated as RNAnimated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Surah} from '@/data/surahData';
import {Reciter, Rewayat} from '@/data/reciterData';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {StatusBar} from 'expo-status-bar';
import {reciterImages} from '@/utils/reciterImages';
import {Asset} from 'expo-asset';
import {useImageColors} from '@/hooks/useImageColors';
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
import {StickyHeader} from './components/StickyHeader';
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
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewayatId, setSelectedRewayatId] = useState<
    string | undefined
  >(undefined);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const iconsOpacity = useRef(new RNAnimated.Value(1)).current;
  const iconsZIndex = useRef(new RNAnimated.Value(1)).current;
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [isStatusBarDark, setIsStatusBarDark] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<ReciterProfileViewMode>(
    useSettings(state => state.reciterProfileViewMode),
  );
  const [showLovedOnly, setShowLovedOnly] = useState(showLoved);
  const [activeTab, setActiveTab] = useState<string>('');
  const flatListRef = useRef<RNAnimated.FlatList>(null);
  const {isLovedWithRewayat} = useLoved();
  const {isDownloaded} = useDownloadQueries();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const {reciterPreferences, setReciterPreference} = useSettings();

  // Retrieve persisted reciter profile settings
  const setReciterViewModeSetting = useSettings(
    state => state.setReciterProfileViewMode,
  );

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
    // Start with available surahs for the selected rewayat
    let surahsToProcess = availableSurahs;

    // Filter by loved status if toggled and a rewayat is selected
    if (showLovedOnly && selectedRewayat?.id) {
      surahsToProcess = surahsToProcess.filter(surah =>
        isLovedWithRewayat(
          currentReciterId,
          surah.id.toString(),
          selectedRewayat.id,
        ),
      );
    }

    // Filter by search query if present
    const filtered = searchQuery
      ? surahsToProcess.filter(
          surah =>
            surah.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            surah.translated_name_english
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        )
      : surahsToProcess;

    // Sort ascending by default
    return [...filtered].sort((a, b) => a.id - b.id);
  }, [
    availableSurahs,
    showLovedOnly,
    isLovedWithRewayat,
    currentReciterId,
    selectedRewayat,
    searchQuery,
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reciterData = await getReciterById(currentReciterId);
        if (reciterData) {
          // Sort rewayat to prioritize Murattal Hafs A'n Assem
          reciterData.rewayat = sortRewayat(reciterData.rewayat);
          setReciter(reciterData);

          // Use saved preference or default to first rewayat
          const savedRewayatId = reciterPreferences[currentReciterId];
          const validRewayat =
            savedRewayatId &&
            reciterData.rewayat.find(r => r.id === savedRewayatId);

          if (validRewayat) {
            setSelectedRewayatId(validRewayat.id);
          } else if (reciterData.rewayat.length > 0) {
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
  }, [currentReciterId, reciterPreferences]);

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

  // Maintain scroll position reference outside of react state
  const scrollPosition = useRef(0);

  // Create a scroll event listener for status bar updates
  const handleStatusBarUpdate = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (!theme.isDarkMode) {
        setIsStatusBarDark(offsetY > 100);
      }
    },
    [theme.isDarkMode],
  );

  // Save scroll position separately
  const handleSaveScrollPosition = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Create a proper animated scroll event
  const handleScroll = RNAnimated.event(
    [{nativeEvent: {contentOffset: {y: scrollY}}}],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        handleStatusBarUpdate(event);
        handleSaveScrollPosition(event);
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

  // Create a custom isLoved function that checks for the specific rewayatId
  const isLovedWithCurrentRewayat = useCallback(
    (id: string, surahId: string | number) => {
      if (!selectedRewayat) return false;
      return isLovedWithRewayat(id, surahId, selectedRewayat.id);
    },
    [isLovedWithRewayat, selectedRewayat],
  );

  // Function to sort rewayat, prioritizing Murattal Hafs A'n Assem
  const sortRewayat = (rewayat: Rewayat[]): Rewayat[] => {
    return [...rewayat].sort((a, b) => {
      // First priority: Hafs A'n Assem with murattal style
      const aIsHafsMurattal =
        a.name === "Hafs A'n Assem" && a.style === 'murattal';
      const bIsHafsMurattal =
        b.name === "Hafs A'n Assem" && b.style === 'murattal';

      if (aIsHafsMurattal && !bIsHafsMurattal) return -1;
      if (!aIsHafsMurattal && bIsHafsMurattal) return 1;

      // Second priority: Any Hafs A'n Assem
      const aIsHafs = a.name === "Hafs A'n Assem";
      const bIsHafs = b.name === "Hafs A'n Assem";

      if (aIsHafs && !bIsHafs) return -1;
      if (!aIsHafs && bIsHafs) return 1;

      // Third priority: Any murattal style
      const aIsMurattal = a.style === 'murattal';
      const bIsMurattal = b.style === 'murattal';

      if (aIsMurattal && !bIsMurattal) return -1;
      if (!aIsMurattal && bIsMurattal) return 1;

      return 0;
    });
  };

  // Callback to toggle view mode with optimized performance
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'card' ? 'list' : 'card';
    // First update settings store to avoid state sync issues
    setReciterViewModeSetting(newMode);
    // Then update local state
    setViewMode(newMode);

    // Schedule scroll restoration after view mode change is applied
    requestAnimationFrame(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: scrollPosition.current,
          animated: false,
        });
      }
    });
  }, [viewMode, setReciterViewModeSetting, scrollPosition]);

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

  // Build tabs array: "My Uploads" (if uploads exist) + one tab per rewayat
  const tabs = useMemo(() => {
    const result: Array<{id: string; label: string}> = [];
    if (hasUploads) {
      result.push({id: 'uploads', label: 'My Uploads'});
    }
    if (reciter?.rewayat) {
      reciter.rewayat.forEach(r => {
        const style =
          r.style.charAt(0).toUpperCase() + r.style.slice(1).toLowerCase();
        result.push({id: r.id, label: `${r.name} · ${style}`});
      });
    }
    return result;
  }, [hasUploads, reciter?.rewayat]);

  // Initialize activeTab when reciter loads or uploads change
  useEffect(() => {
    if (tabs.length === 0) return;

    if (activeTab === '') {
      // First load: default to uploads tab if has uploads, else first rewayat
      const defaultTab = hasUploads
        ? 'uploads'
        : selectedRewayatId || tabs[0].id;
      setActiveTab(defaultTab);
    } else if (!tabs.some(t => t.id === activeTab)) {
      // Active tab no longer exists (e.g. all uploads deleted) — fall back
      setActiveTab(tabs[0].id);
      if (tabs[0].id !== 'uploads') {
        handleRewayatChange(tabs[0].id);
      }
    }
  }, [tabs, activeTab, hasUploads, selectedRewayatId, handleRewayatChange]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      if (tabId !== 'uploads') {
        handleRewayatChange(tabId);
      }
    },
    [handleRewayatChange],
  );

  // Create a stable reference to data and callbacks used by SurahList to prevent re-renders
  const surahListProps = useMemo(
    () => ({
      surahs: filteredSurahs,
      onSurahPress: handleSurahPress,
      reciterId: currentReciterId,
      isLoved: isLovedWithCurrentRewayat,
      isDownloaded: isDownloaded,
      onOptionsPress: (surah: Surah) =>
        SheetManager.show('surah-options', {
          payload: {
            surah,
            reciterId: currentReciterId,
            rewayatId: selectedRewayat?.id,
            onAddToQueue: handleAddToQueue,
          },
        }),
      onScroll: handleScroll,
      viewMode,
      sortOption: 'asc' as const,
      getColorForSurah,
      rewayatId: selectedRewayat?.id,
      maintainVisibleContentPosition: {
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10,
      },
    }),
    [
      filteredSurahs,
      handleSurahPress,
      currentReciterId,
      isLovedWithCurrentRewayat,
      isDownloaded,
      handleAddToQueue,
      selectedRewayat?.id,
      handleScroll,
      viewMode,
      getColorForSurah,
    ],
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
          dominantColors={dominantColors}
          isDarkMode={theme.isDarkMode}
          reciterName={reciter.name}
          viewMode={viewMode}
          getColorForSurah={getColorForSurah}
        />
      ) : (
        <>
          {(() => {
            const listHeader = (
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
                  />
                </View>
                {tabs.length > 0 && (
                  <RewayatTabBar
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabChange={handleTabChange}
                    theme={theme}
                  />
                )}
                <View style={styles.controlsRow}>
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
              </>
            );

            if (activeTab === 'uploads') {
              return (
                <UploadsTabContent
                  reciterId={currentReciterId}
                  reciterName={reciter.name}
                  viewMode={viewMode}
                  showLovedOnly={showLovedOnly}
                  onScroll={handleScroll}
                  ListHeaderComponent={listHeader}
                  getColorForSurah={getColorForSurah}
                />
              );
            }

            return (
              <MemoizedSurahList
                ref={flatListRef}
                {...surahListProps}
                ListHeaderComponent={listHeader}
              />
            );
          })()}
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
