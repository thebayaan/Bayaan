import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  Keyboard,
  Animated as RNAnimated,
} from 'react-native';
import {useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAllReciters, getAllSurahs} from '@/services/dataService';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import Fuse from 'fuse.js';
import {Feather} from '@expo/vector-icons';
import {ReciterItem} from '@/components/ReciterItem';
import {SurahItem} from '@/components/SurahItem';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {SearchInput} from '@/components/SearchInput';
import {StyleSheet} from 'react-native';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SheetManager} from 'react-native-actions-sheet';
import {ExploreView} from '@/components/search/ExploreView';

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface RecentSearchItem {
  type: 'surah' | 'reciter';
  item: Surah | Reciter;
  timestamp: number;
}

interface SearchResult {
  type: 'surah' | 'reciter';
  item: Surah | Reciter;
  score: number;
}

interface SearchViewProps {
  onClose: () => void;
  visible: boolean;
}

export function SearchView({onClose, visible}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const [reciterFuse, setReciterFuse] = useState<Fuse<Reciter> | null>(null);
  const [surahFuse, setSurahFuse] = useState<Fuse<Surah> | null>(null);

  // Fade animation refs (mushaf search pattern — both views always mounted)
  const browseOpacity = useRef(new RNAnimated.Value(1)).current;
  const searchOpacity = useRef(new RNAnimated.Value(0)).current;

  const {theme} = useTheme();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const insets = useSafeAreaInsets();

  // Clear query and exit search mode when closing
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setIsSearchMode(false);
      browseOpacity.setValue(1);
      searchOpacity.setValue(0);
    }
  }, [visible, browseOpacity, searchOpacity]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [query]);

  // Mode transitions (mushaf search pattern)
  const enterSearchMode = useCallback(() => {
    setIsSearchMode(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
    RNAnimated.parallel([
      RNAnimated.timing(browseOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.timing(searchOpacity, {
        toValue: 1,
        duration: 200,
        delay: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [browseOpacity, searchOpacity]);

  const exitSearchMode = useCallback(() => {
    Keyboard.dismiss();
    setQuery('');
    setIsSearchMode(false);
    searchInputRef.current?.blur();
    RNAnimated.parallel([
      RNAnimated.timing(searchOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.timing(browseOpacity, {
        toValue: 1,
        duration: 200,
        delay: 50,
        useNativeDriver: true,
      }),
    ]).start();
    onClose();
  }, [browseOpacity, searchOpacity, onClose]);

  // Lazy-init Fuse.js — only when user activates search mode
  const fuseInitialized = useRef(false);
  useEffect(() => {
    if (!visible || !isSearchMode || fuseInitialized.current) return;
    fuseInitialized.current = true;

    const fetchData = async () => {
      try {
        const [reciterData, surahData] = await Promise.all([
          getAllReciters(),
          getAllSurahs(),
        ]);

        setReciterFuse(
          new Fuse(reciterData, {
            keys: [
              {name: 'name', weight: 2},
              {name: 'translated_name', weight: 1.5},
              {name: 'arabic_name', weight: 2},
              {name: 'description', weight: 0.7},
              {name: 'style', weight: 0.5},
            ],
            threshold: 0.4,
            distance: 200,
            minMatchCharLength: 2,
            useExtendedSearch: true,
            ignoreLocation: true,
            findAllMatches: true,
            includeScore: true,
          }),
        );

        setSurahFuse(
          new Fuse(surahData, {
            keys: [
              {name: 'name', weight: 2},
              {name: 'name_arabic', weight: 2},
              {name: 'translated_name_english', weight: 1.5},
              {name: 'id', weight: 1},
              {name: 'revelation_type', weight: 0.5},
            ],
            threshold: 0.4,
            distance: 200,
            minMatchCharLength: 2,
            useExtendedSearch: true,
            ignoreLocation: true,
            findAllMatches: true,
            includeScore: true,
          }),
        );

        const storedSearches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedSearches) {
          const parsed = JSON.parse(storedSearches);
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            typeof parsed[0] === 'string'
          ) {
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
            setRecentSearches([]);
          } else {
            setRecentSearches(parsed);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing search:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, [visible, isSearchMode]);

  const performSearch = useCallback(() => {
    if (!reciterFuse || !surahFuse || !debouncedQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    try {
      const surahResults = surahFuse.search(debouncedQuery).map(result => ({
        type: 'surah' as const,
        item: result.item,
        score: result.score || 1,
      }));

      const reciterResults = reciterFuse.search(debouncedQuery).map(result => ({
        type: 'reciter' as const,
        item: result.item,
        score: result.score || 1,
      }));

      const combinedResults = [...surahResults, ...reciterResults].sort(
        (a, b) => a.score - b.score,
      );

      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }

    setSearching(false);
  }, [debouncedQuery, reciterFuse, surahFuse]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const addToRecentSearches = useCallback(
    async (result: SearchResult) => {
      const newItem: RecentSearchItem = {
        type: result.type,
        item: result.item,
        timestamp: Date.now(),
      };

      // Remove duplicate if exists (same type and id)
      const filteredSearches = recentSearches.filter(search => {
        if (search.type !== result.type) return true;
        if (search.type === 'surah') {
          return (search.item as Surah).id !== (result.item as Surah).id;
        } else {
          return (search.item as Reciter).id !== (result.item as Reciter).id;
        }
      });

      const updatedSearches = [newItem, ...filteredSearches].slice(
        0,
        MAX_RECENT_SEARCHES,
      );

      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(updatedSearches),
      );
    },
    [recentSearches],
  );

  // Tap on surah → open mushaf at that surah's page
  const handleResultPress = useCallback(
    async (result: SearchResult) => {
      Keyboard.dismiss();
      await addToRecentSearches(result);

      if (result.type === 'reciter') {
        const reciter = result.item as Reciter;
        router.push({
          pathname: '/(tabs)/(b.search)/reciter/[id]',
          params: {id: reciter.id, name: reciter.name},
        });
      } else {
        const surah = result.item as Surah;
        router.push({
          pathname: '/mushaf',
          params: {surah: surah.id.toString()},
        });
      }
    },
    [router, addToRecentSearches],
  );

  // Long-press on surah → audio playback flow
  const handleSurahLongPress = useCallback(
    async (result: SearchResult) => {
      Keyboard.dismiss();
      await addToRecentSearches(result);

      const surah = result.item as Surah;
      if (askEveryTime) {
        SheetManager.show('select-reciter', {
          payload: {surahId: surah.id.toString(), source: 'search'},
        });
        return;
      }

      switch (defaultReciterSelection) {
        case 'browseAll':
          router.push({
            pathname: '/(tabs)/(b.search)/reciter/browse',
            params: {view: 'all', surahId: surah.id},
          });
          break;
        case 'searchFavorites':
          router.push({
            pathname: '/(tabs)/(b.search)/reciter/browse',
            params: {view: 'favorites', surahId: surah.id},
          });
          break;
        case 'useDefault':
          if (defaultReciter) {
            router.push({
              pathname: '/player',
              params: {reciterImageUrl: defaultReciter.image_url},
            });
          } else {
            SheetManager.show('select-reciter', {
              payload: {surahId: surah.id.toString(), source: 'search'},
            });
          }
          break;
        default:
          SheetManager.show('select-reciter', {
            payload: {surahId: surah.id.toString(), source: 'search'},
          });
      }
    },
    [
      router,
      addToRecentSearches,
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
    ],
  );

  const renderSearchResult = useCallback(
    ({item}: {item: SearchResult}) => {
      if (item.type === 'surah') {
        return (
          <SurahItem
            item={item.item as Surah}
            onPress={() => handleResultPress(item)}
            onLongPress={() => handleSurahLongPress(item)}
          />
        );
      } else {
        return (
          <ReciterItem
            item={item.item as Reciter}
            onPress={() => handleResultPress(item)}
          />
        );
      }
    },
    [handleResultPress, handleSurahLongPress],
  );

  const renderRecentSearch = useCallback(
    ({item: recentItem}: {item: RecentSearchItem}) => {
      const handlePress = () => {
        handleResultPress({
          type: recentItem.type,
          item: recentItem.item,
          score: 0,
        });
      };

      if (recentItem.type === 'surah') {
        return (
          <SurahItem item={recentItem.item as Surah} onPress={handlePress} />
        );
      } else {
        return (
          <ReciterItem
            item={recentItem.item as Reciter}
            onPress={handlePress}
          />
        );
      }
    },
    [handleResultPress],
  );

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Browse Mode — always mounted, hidden via opacity */}
      <RNAnimated.View
        style={[styles.modeContainer, {opacity: browseOpacity}]}
        pointerEvents={isSearchMode ? 'none' : 'auto'}>
        <ExploreView onSearchPress={enterSearchMode} />
      </RNAnimated.View>

      {/* Search Mode — always mounted, hidden via opacity */}
      <RNAnimated.View
        style={[
          styles.modeContainer,
          styles.modeOverlay,
          {
            opacity: searchOpacity,
            backgroundColor: theme.colors.background,
            paddingTop: insets.top,
          },
        ]}
        pointerEvents={isSearchMode ? 'auto' : 'none'}>
        <SearchInput
          ref={searchInputRef}
          placeholder="Search surahs or reciters"
          value={query}
          onChangeText={setQuery}
          onCancel={exitSearchMode}
          iconColor={theme.colors.text}
          iconOpacity={0.25}
          placeholderTextColor={Color(theme.colors.text).alpha(0.35).toString()}
          textColor={theme.colors.text}
          backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
          borderColor={Color(theme.colors.text).alpha(0.06).toString()}
          keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="none"
        />

        {query.length === 0 ? (
          <ScrollView
            style={styles.flexFill}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {recentSearches.length > 0 ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color: Color(theme.colors.textSecondary)
                          .alpha(0.5)
                          .toString(),
                      },
                    ]}>
                    Recent searches
                  </Text>
                  <Pressable onPress={clearRecentSearches}>
                    <Text
                      style={[
                        styles.clearButton,
                        {
                          color: Color(theme.colors.textSecondary)
                            .alpha(0.5)
                            .toString(),
                        },
                      ]}>
                      Clear
                    </Text>
                  </Pressable>
                </View>
                <FlatList
                  data={recentSearches}
                  renderItem={renderRecentSearch}
                  keyExtractor={(item, index) =>
                    `${item.type}-${
                      item.type === 'surah'
                        ? (item.item as Surah).id
                        : (item.item as Reciter).id
                    }-${index}`
                  }
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather
                  name="search"
                  size={moderateScale(36)}
                  color={Color(theme.colors.textSecondary)
                    .alpha(0.12)
                    .toString()}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    {
                      color: Color(theme.colors.textSecondary)
                        .alpha(0.35)
                        .toString(),
                    },
                  ]}>
                  No recent searches
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    {
                      color: Color(theme.colors.textSecondary)
                        .alpha(0.2)
                        .toString(),
                    },
                  ]}>
                  Your search history will appear here
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <FlatList
            style={styles.flexFill}
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            ListHeaderComponent={
              searching ? (
                <View style={styles.loadingContainer}>
                  <LoadingIndicator size={24} />
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather
                    name="search"
                    size={moderateScale(36)}
                    color={Color(theme.colors.textSecondary)
                      .alpha(0.12)
                      .toString()}
                  />
                  <Text
                    style={[
                      styles.emptyTitle,
                      {
                        color: Color(theme.colors.textSecondary)
                          .alpha(0.35)
                          .toString(),
                      },
                    ]}>
                    No results found
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      {
                        color: Color(theme.colors.textSecondary)
                          .alpha(0.2)
                          .toString(),
                      },
                    ]}>
                    Try different keywords or check the spelling
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={<View style={styles.footer} />}
          />
        )}
      </RNAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeContainer: {
    flex: 1,
  },
  modeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  flexFill: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: moderateScale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(10.5),
    fontFamily: 'Manrope-SemiBold',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  clearButton: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
  },
  resultsContent: {
    paddingTop: moderateScale(8),
  },
  loadingContainer: {
    paddingVertical: moderateScale(20),
    alignItems: 'center',
  },
  footer: {
    height: moderateScale(20),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '35%',
    gap: moderateScale(5),
  },
  emptyTitle: {
    fontSize: moderateScale(15),
    fontFamily: 'Manrope-SemiBold',
    marginTop: moderateScale(14),
  },
  emptySubtitle: {
    fontSize: moderateScale(12.5),
    fontFamily: 'Manrope-Medium',
  },
});
