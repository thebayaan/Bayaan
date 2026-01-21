import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import {useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAllReciters, getAllSurahs} from '@/services/dataService';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import Fuse from 'fuse.js';
import {Icon} from '@rneui/themed';
import {ReciterItem} from '@/components/ReciterItem';
import {SurahItem} from '@/components/SurahItem';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {BlurView} from '@react-native-community/blur';
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

  const {theme} = useTheme();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const insets = useSafeAreaInsets();

  // Clear query and exit search mode when closing
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setIsSearchMode(false);
    }
  }, [visible]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [query]);

  // Handle search input focus - enter search mode
  const handleSearchFocus = useCallback(() => {
    setIsSearchMode(true);
    // Focus the input after a slight delay to ensure the component is rendered
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  // Handle search cancel - return to explore mode
  const handleSearchCancel = useCallback(() => {
    Keyboard.dismiss();
    setQuery('');
    setIsSearchMode(false);
    searchInputRef.current?.blur();
    onClose();
  }, [onClose]);

  // Initialize search engines and load initial data
  useEffect(() => {
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
          // Check if it's the old format (string[]) and clear it
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            typeof parsed[0] === 'string'
          ) {
            // Old format, clear it
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
            setRecentSearches([]);
          } else {
            // New format
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
  }, []);

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
    [handleResultPress],
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

  // Show ExploreView when not in search mode
  if (!isSearchMode) {
    return <ExploreView onSearchPress={handleSearchFocus} />;
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            blurAmount={80}
            blurType={theme.isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}>
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: Color(theme.colors.card)
                    .alpha(0.7)
                    .toString(),
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.colors.card,
                opacity: 0.95,
              },
            ]}
          />
        )}
        <View style={styles.searchBoxContainer}>
          <SearchInput
            ref={searchInputRef}
            placeholder="Search surahs or reciters"
            value={query}
            onChangeText={setQuery}
            onCancel={handleSearchCancel}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.card).alpha(0.5).toString()}
            borderColor={Color(theme.colors.border).alpha(0.2).toString()}
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
            autoCorrect={false}
            autoComplete="off"
            autoCapitalize="none"
            autoFocus={true}
          />
        </View>
      </View>

      {query.length === 0 ? (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled">
          {recentSearches.length > 0 ? (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
                  Recent searches
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={clearRecentSearches}>
                  <Text
                    style={[styles.clearButton, {color: theme.colors.text}]}>
                    Clear
                  </Text>
                </TouchableOpacity>
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
            <View style={styles.emptyRecentContainer}>
              <Icon
                name="search"
                type="feather"
                size={moderateScale(48)}
                color={theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.emptyRecentText,
                  {color: theme.colors.textSecondary},
                ]}>
                No recent searches
              </Text>
              <Text
                style={[
                  styles.emptyRecentSubtext,
                  {color: theme.colors.textSecondary},
                ]}>
                Your search history will appear here
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          contentContainerStyle={styles.resultsContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          ListHeaderComponent={
            searching ? (
              <View style={styles.loadingContainer}>
                <LoadingIndicator size={24} />
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, {color: theme.colors.text}]}>
                  No results found
                </Text>
                <Text
                  style={[
                    styles.emptySubtext,
                    {color: theme.colors.textSecondary},
                  ]}>
                  Try different keywords or check the spelling
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={styles.footer} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  headerContainer: {
    paddingTop: moderateScale(8),
  },
  searchBoxContainer: {
    paddingBottom: moderateScale(8),
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: moderateScale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-Bold',
  },
  clearButton: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
  },
  resultsContainer: {
    paddingTop: moderateScale(8),
  },
  loadingContainer: {
    paddingVertical: moderateScale(20),
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: moderateScale(20),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(4),
  },
  emptySubtext: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
  },
  footer: {
    height: moderateScale(20),
  },
  emptyRecentContainer: {
    paddingVertical: moderateScale(60),
    paddingHorizontal: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-SemiBold',
    marginTop: moderateScale(16),
  },
  emptyRecentSubtext: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    marginTop: moderateScale(4),
  },
});
