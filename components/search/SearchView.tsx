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
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useModal} from '@/components/providers/ModalProvider';

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 10;
const SEARCH_DEBOUNCE_MS = 300;

const SEARCH_SUGGESTIONS = {
  surahs: [
    {
      id: 1,
      name: 'Al-Fatiha',
      arabic: 'الفاتحة',
      translation: 'The Opening',
    },
    {
      id: 2,
      name: 'Al-Baqarah',
      arabic: 'البقرة',
      translation: 'The Cow',
    },
    {
      id: 36,
      name: 'Yasin',
      arabic: 'يس',
      translation: 'Ya Sin',
    },
    {
      id: 55,
      name: 'Ar-Rahman',
      arabic: 'الرحمن',
      translation: 'The Most Merciful',
    },
    {
      id: 67,
      name: 'Al-Mulk',
      arabic: 'الملك',
      translation: 'The Sovereignty',
    },
    {
      id: 18,
      name: 'Al-Kahf',
      arabic: 'الكهف',
      translation: 'The Cave',
    },
    {
      id: 112,
      name: 'Al-Ikhlas',
      arabic: 'الإخلاص',
      translation: 'The Sincerity',
    },
  ],
  reciters: [
    {id: 'alafasi', name: 'Mishary'},
    {id: 'hussary', name: 'Hussary'},
    {id: 'muaiqly', name: 'Maher'},
    {id: 'juhany', name: 'Abdullah Al-Johany'},
    {id: 'minshawi', name: 'Minshawi'},
  ],
};

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const [reciterFuse, setReciterFuse] = useState<Fuse<Reciter> | null>(null);
  const [surahFuse, setSurahFuse] = useState<Fuse<Surah> | null>(null);

  const {theme} = useTheme();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const insets = useSafeAreaInsets();
  const {showSelectReciter} = useModal();

  // Focus input when visible
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Clear query when closing
  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [query]);

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
          setRecentSearches(JSON.parse(storedSearches));
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
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      const updatedSearches = [
        searchQuery,
        ...recentSearches.filter(item => item !== searchQuery),
      ].slice(0, MAX_RECENT_SEARCHES);

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
      await addToRecentSearches(query);

      if (result.type === 'reciter') {
        const reciter = result.item as Reciter;
        router.push({
          pathname: '/(tabs)/(search)/reciter/[id]',
          params: {id: reciter.id, name: reciter.name},
        });
      } else {
        const surah = result.item as Surah;
        if (askEveryTime) {
          showSelectReciter(surah.id.toString(), 'search');
          return;
        }

        switch (defaultReciterSelection) {
          case 'browseAll':
            router.push({
              pathname: '/(tabs)/(search)/reciter/browse',
              params: {view: 'all', surahId: surah.id},
            });
            break;
          case 'searchFavorites':
            router.push({
              pathname: '/(tabs)/(search)/reciter/browse',
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
              showSelectReciter(surah.id.toString(), 'search');
            }
            break;
          default:
            showSelectReciter(surah.id.toString(), 'search');
        }
      }
    },
    [
      router,
      query,
      addToRecentSearches,
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      showSelectReciter,
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
    ({item}: {item: string}) => (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.searchItem}
        onPress={() => setQuery(item)}>
        <View style={styles.searchIconContainer}>
          <Icon
            name="history"
            type="material"
            size={moderateScale(18)}
            color={theme.colors.textSecondary}
          />
        </View>
        <Text style={[styles.searchItemText, {color: theme.colors.text}]}>
          {item}
        </Text>
      </TouchableOpacity>
    ),
    [setQuery, theme.colors],
  );

  const renderSuggestion = useCallback(
    ({
      item,
      type,
    }: {
      item:
        | (typeof SEARCH_SUGGESTIONS.surahs)[0]
        | (typeof SEARCH_SUGGESTIONS.reciters)[0];
      type: 'arabic' | 'english' | 'translation' | 'reciter' | 'number';
    }) => (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.suggestionButton}
        onPress={() => {
          if ('arabic' in item) {
            switch (type) {
              case 'arabic':
                setQuery(item.arabic);
                break;
              case 'english':
                setQuery(item.name);
                break;
              case 'translation':
                setQuery(item.translation);
                break;
              case 'number':
                setQuery(item.id.toString());
                break;
            }
          } else {
            setQuery(item.name);
          }
        }}>
        <Icon
          name="search"
          type="feather"
          size={moderateScale(14)}
          color={theme.colors.text}
          containerStyle={styles.searchIconContainer}
        />
        {'arabic' in item ? (
          <Text
            style={[
              type === 'arabic'
                ? styles.suggestionButtonArabic
                : type === 'translation'
                  ? styles.suggestionButtonTranslation
                  : type === 'number'
                    ? styles.suggestionButtonNumber
                    : styles.suggestionButtonText,
              {color: theme.colors.text},
            ]}>
            {type === 'arabic'
              ? item.arabic
              : type === 'translation'
                ? item.translation
                : type === 'number'
                  ? `${item.id}`
                  : item.name}
          </Text>
        ) : (
          <Text
            style={[styles.suggestionButtonText, {color: theme.colors.text}]}>
            {item.name}
          </Text>
        )}
      </TouchableOpacity>
    ),
    [setQuery, theme.colors],
  );

  const renderSuggestionRow = useCallback(
    (
      items:
        | typeof SEARCH_SUGGESTIONS.surahs
        | typeof SEARCH_SUGGESTIONS.reciters,
      title: string,
    ) => (
      <View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
            {title}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionRow}>
          {items.map((item, index) => (
            <View
              key={`${'id' in item ? item.id : index}`}
              style={{flexDirection: 'row'}}>
              {'arabic' in item ? (
                <>
                  {renderSuggestion({item, type: 'number'})}
                  {renderSuggestion({item, type: 'arabic'})}
                  {renderSuggestion({item, type: 'english'})}
                  {renderSuggestion({item, type: 'translation'})}
                </>
              ) : (
                renderSuggestion({item, type: 'reciter'})
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    ),
    [renderSuggestion, theme.colors],
  );

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
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
            onCancel={() => {
              Keyboard.dismiss();
              setQuery('');
              onClose();
            }}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.card).alpha(0.5).toString()}
            borderColor={Color(theme.colors.border).alpha(0.2).toString()}
            keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
            autoCorrect={false}
            autoComplete="off"
            autoCapitalize="none"
          />
        </View>
      </View>

      {query.length === 0 ? (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeIn.delay(100)}>
            {renderSuggestionRow(SEARCH_SUGGESTIONS.surahs, 'Surahs')}
            {renderSuggestionRow(SEARCH_SUGGESTIONS.reciters, 'Reciters')}
          </Animated.View>

          {recentSearches.length > 0 && (
            <Animated.View entering={FadeIn.delay(200)}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
                  Recent Searches
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
                keyExtractor={item => item}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            </Animated.View>
          )}
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          contentContainerStyle={styles.resultsContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
    </Animated.View>
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
    marginHorizontal: moderateScale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-Bold',
  },
  clearButton: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
  },
  suggestionRow: {
    paddingHorizontal: moderateScale(8),
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    marginHorizontal: moderateScale(4),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  suggestionButtonText: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-SemiBold',
    marginLeft: moderateScale(8),
  },
  suggestionButtonArabic: {
    fontSize: moderateScale(16),
    fontFamily: 'Amiri-Bold',
    marginLeft: moderateScale(8),
  },
  suggestionButtonTranslation: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Medium',
    fontStyle: 'italic',
    marginLeft: moderateScale(8),
  },
  suggestionButtonNumber: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Bold',
    marginLeft: moderateScale(8),
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
  },
  searchIconContainer: {},
  searchItemText: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
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
});
