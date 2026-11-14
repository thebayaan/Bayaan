import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react'; // @ai
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Keyboard,
  Platform,
  Animated as RNAnimated,
  type ListRenderItemInfo,
} from 'react-native';
import {useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAllReciters, getAllSurahs} from '@/services/dataService';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
// @ai-start
import {
  createCatalogSearch,
  type CatalogSearchResult,
} from '@/utils/search/catalog';
// @ai-end
import {Feather} from '@expo/vector-icons';
import {ReciterItem} from '@/components/ReciterItem';
import {SurahItem} from '@/components/SurahItem';
import {ReciteToSearchRow} from '@/components/search/ReciteToSearchRow';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {useReciterSelection} from '@/hooks/useReciterSelection'; // @ai
import {resolveSurahPlaybackAction} from '@/utils/surahPlaybackChoice'; // @ai
import {StyleSheet} from 'react-native';
import Color from 'color';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SheetManager} from 'react-native-actions-sheet';
import {ExploreView} from '@/components/search/ExploreView';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {useHeaderHeight} from 'expo-router/react-navigation'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps'; // @ai
import {usePlayerActions} from '@/hooks/usePlayerActions'; // @ai
import {createTracksForReciter} from '@/utils/track'; // @ai
import {TabletSearchResults} from '@/components/search/TabletSearchResults'; // @ai
// @ai-start
import {SurahOptionsProvider} from '@/components/sheets/options/surahOptions';
import type {SurahOptionsBuilder} from '@/components/sheets/options/SurahOptionsContext';
// @ai-end
import {analyticsService} from '@/services/analytics/AnalyticsService';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
// @ai-end
// @ai-start
import {
  isQuranQuery,
  prefetchQuranSearch,
  useQuranSearch,
} from '@/hooks/useQuranSearch';
import {
  QURAN_PAGE_SIZE,
  quranResultRows,
  type QuranResultRow,
} from '@/components/search/quran/quranResultRows';
import {
  QuranResultRowView,
  type QuranResultRowViewProps,
} from '@/components/search/quran/QuranResultRowView';
import {RecentVerseRow} from '@/components/search/quran/RecentVerseRow';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {quranHitLinkParams} from '@/utils/quranLink';
import {swapKeyboardLayout} from '@/utils/search/keyboardLayout';
import {matchedPositions} from '@/utils/search/quranSearch';
import {parseQuranQuery, rootQuery} from '@/utils/search/quranText';
// @ai-end

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 10;
const SEARCH_DEBOUNCE_MS = 300;

// @ai-start
// A surah or reciter opened from the results, or an ayah opened from the
// Quran search (its Hafs key and the matched Digital Khatt slots).
type RecentSearchItem =
  | {type: 'surah' | 'reciter'; item: Surah | Reciter; timestamp: number}
  | {type: 'verse'; verseKey: string; positions: number[]; timestamp: number};

/** Drops verse items a later format could store differently. */
function isUsableRecent(item: RecentSearchItem): boolean {
  return (
    item.type !== 'verse' ||
    (typeof item.verseKey === 'string' && Array.isArray(item.positions))
  );
}

function recentId(item: RecentSearchItem): string | number {
  if (item.type === 'verse') return item.verseKey;
  return item.type === 'surah'
    ? (item.item as Surah).id
    : (item.item as Reciter).id;
}
// @ai-end

// @ai-start
type SearchResult = CatalogSearchResult;
// Catalogue rows, then the Quran results ("Ayahs") section.
type SearchListItem = SearchResult | QuranResultRow;

function isCatalogResult(item: SearchListItem): item is SearchResult {
  return item.type === 'surah' || item.type === 'reciter';
}

/**
 * The Quran query of a Latin query the catalogue cannot match: the same
 * keys on the Arabic layout, when they read as Arabic words ('' if not).
 */
function swappedQuranQuery(query: string, catalogueHits: number): string {
  if (catalogueHits > 0 || isQuranQuery(query)) return '';
  const swapped = swapKeyboardLayout(query);
  return swapped && isQuranQuery(swapped) ? swapped : '';
}
// @ai-end

interface SearchViewProps {
  onClose: () => void;
  visible: boolean;
  /** Query text driven by the native Stack.SearchBar */
  query: string;
  /** True when the native search bar is focused / active */
  isSearchActive: boolean;
  /** Skip the built-in safe-area top padding (when the parent already handles it) */
  skipTopInset?: boolean;
  // @ai-start
  /** Replaces the query (a root suggestion opens `root:ر ح م`). */
  onQueryChange?: (query: string) => void;
  // @ai-end
}

// @ai-start
export function SearchView({
  onClose,
  visible,
  query,
  isSearchActive,
  skipTopInset,
  onQueryChange,
}: SearchViewProps) {
  const bottomInset = useBottomInset();
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const router = useRouter();
  const [catalogSearch, setCatalogSearch] = useState<ReturnType<
    typeof createCatalogSearch
  > | null>(null);

  // Fade animation — both views always mounted
  const browseOpacity = useRef(new RNAnimated.Value(1)).current;
  const searchOpacity = useRef(new RNAnimated.Value(0)).current;

  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common', 'reader']);
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();
  const {addToQueue} = usePlayerActions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Explore and the results fill the iPad pane, but recent searches and the
  // loading and empty states stay in the 720pt reading column
  // (ipad-standards §5.3).
  const {isTablet} = useResponsive();
  const listStyle = isTablet
    ? [styles.flexFill, styles.tabletColumn]
    : styles.flexFill;
  // On iPad the native search field floats in the navigation bar, so results
  // start below the whole bar instead of just the status bar.
  const headerHeight = useHeaderHeight();
  const topInset = isTablet && USE_GLASS ? headerHeight : insets.top;

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Drive the mode transition from external state
  const isSearchMode = isSearchActive || query.length > 0;

  useEffect(() => {
    if (isSearchMode) {
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
    } else {
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
    }
  }, [isSearchMode, browseOpacity, searchOpacity]);

  // Reset when closed
  useEffect(() => {
    if (!visible) {
      browseOpacity.setValue(1);
      searchOpacity.setValue(0);
    }
  }, [visible, browseOpacity, searchOpacity]);

  // Debounce the incoming query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [query]);

  // The Quran text search runs beside the catalogue on the same debounced
  // query. A root query ('root:ر ح م') skips the catalogue; a Latin query the
  // catalogue cannot match runs on the Arabic layout's letters.
  const queryKind = useMemo(
    () => parseQuranQuery(debouncedQuery).kind,
    [debouncedQuery],
  );
  const rootMode = queryKind === 'root';
  // Set by the catalogue search, for the query it searched.
  const [swapped, setSwapped] = useState({from: '', query: ''});
  let quranQuery = debouncedQuery;
  if (queryKind === 'none') {
    quranQuery = swapped.from === debouncedQuery ? swapped.query : '';
  }
  const quranState = useQuranSearch(quranQuery, {
    enabled: visible && quranQuery.length > 0,
  });
  // Rows shown and the lemma chosen, both reset when the query changes.
  const [quranPaging, setQuranPaging] = useState({
    query: '',
    shown: QURAN_PAGE_SIZE,
    lemma: null as number | null,
  });
  const paging =
    quranPaging.query === quranQuery
      ? quranPaging
      : {query: quranQuery, shown: QURAN_PAGE_SIZE, lemma: null};
  const hafsNote = useMushafSettingsStore(s => s.rewayah) !== 'hafs';
  const quranRows = useMemo(
    () =>
      quranResultRows(quranState, {
        shown: paging.shown,
        selectedLemma: paging.lemma,
        hafsNote,
        query: quranQuery,
        includeEmpty: false,
      }),
    [quranState, paging.shown, paging.lemma, hafsNote, quranQuery],
  );
  const listData = useMemo<SearchListItem[]>(
    () => [...searchResults, ...quranRows],
    [searchResults, quranRows],
  );

  // Lazy-init Fuse.js when user first activates search
  const fuseInitialized = useRef(false);
  useEffect(() => {
    if (!visible || !isSearchMode || fuseInitialized.current) return;
    fuseInitialized.current = true;
    prefetchQuranSearch(); // The first Arabic query skips the DB import.

    const fetchData = async () => {
      try {
        const [reciterData, surahData] = await Promise.all([
          getAllReciters(),
          getAllSurahs(),
        ]);

        setCatalogSearch(createCatalogSearch(reciterData, surahData)); // @ai

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
            setRecentSearches(
              Array.isArray(parsed) ? parsed.filter(isUsableRecent) : [],
            );
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
    // A root query lists the root's words only.
    if (!catalogSearch || !debouncedQuery.trim() || rootMode) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    try {
      const combinedResults = catalogSearch.search(debouncedQuery);

      setSearchResults(combinedResults);
      setSwapped({
        from: debouncedQuery,
        query: swappedQuranQuery(debouncedQuery, combinedResults.length),
      });

      // Fire analytics after search completes (already debounced via debouncedQuery)
      if (debouncedQuery.trim().length > 0) {
        analyticsService.trackSearchPerformed({
          query: debouncedQuery.trim(),
          results_count: combinedResults.length,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }

    setSearching(false);
  }, [debouncedQuery, catalogSearch, rootMode]);

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

      const filteredSearches = recentSearches.filter(search => {
        if (search.type === 'verse' || search.type !== result.type) return true;
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
        router.push({
          pathname: '/mushaf',
          params: {surah: surah.id.toString()},
        });
      }
    },
    [router, addToRecentSearches],
  );

  // An ayah from the Quran search opens in the Mushaf on the page of its
  // first matched word, with the matched words flashed, and is remembered.
  const openVerse = useCallback(
    (verseKey: string, positions: readonly number[]) => {
      Keyboard.dismiss();
      const newItem: RecentSearchItem = {
        type: 'verse',
        verseKey,
        positions: [...positions],
        timestamp: Date.now(),
      };
      const updatedSearches = [
        newItem,
        ...recentSearches.filter(
          search => search.type !== 'verse' || search.verseKey !== verseKey,
        ),
      ].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updatedSearches);
      AsyncStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(updatedSearches),
      ).catch(error => {
        console.error('Error saving recent searches:', error);
      });
      router.push({
        pathname: '/mushaf',
        params: quranHitLinkParams(verseKey, positions, (key, position) =>
          digitalKhattDataService.getPageForWord(key, position),
        ),
      });
    },
    [router, recentSearches],
  );

  const quranRowAction = useMemo<Omit<QuranResultRowViewProps, 'row'>>(
    () => ({
      onVersePress: hit => openVerse(hit.verseKey, matchedPositions(hit)),
      onRootPress: root => {
        onQueryChange?.(
          rootQuery(root.root, t('reader:quranSearch.rootKeyword')),
        );
      },
      onLemmaPress: lemma =>
        setQuranPaging({query: quranQuery, shown: QURAN_PAGE_SIZE, lemma}),
      onShowMore: () =>
        setQuranPaging({
          query: quranQuery,
          shown: paging.shown + QURAN_PAGE_SIZE,
          lemma: paging.lemma,
        }),
    }),
    [openVerse, onQueryChange, t, quranQuery, paging.shown, paging.lemma],
  );

  const handleSurahLongPress = useCallback(
    async (result: SearchResult) => {
      Keyboard.dismiss();
      await addToRecentSearches(result);

      const surah = result.item as Surah;
      // @ai-start
      const surahId = surah.id.toString();
      const action = resolveSurahPlaybackAction({
        askEveryTime,
        defaultReciterSelection,
        hasDefaultReciter: !!defaultReciter,
      });

      switch (action) {
        case 'browseAll':
        case 'browseFavorites':
          router.push({
            pathname: '/(tabs)/(b.search)/reciter/browse',
            params: {
              view: action === 'browseAll' ? 'all' : 'favorites',
              surahId: surah.id,
            },
          });
          break;
        case 'playDefault':
          if (defaultReciter) {
            playWithReciter(defaultReciter, surahId).catch(error => {
              console.error('Error playing with default reciter:', error);
            });
          }
          break;
        case 'playRandom':
          playWithRandomReciter(surahId).catch(error => {
            console.error('Error playing with random reciter:', error);
          });
          break;
        default:
          SheetManager.show('select-reciter', {
            payload: {surahId, source: 'search'},
          });
      }
      // @ai-end
    },
    [
      router,
      addToRecentSearches,
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      playWithReciter,
      playWithRandomReciter,
    ],
  );

  // The iPad results' options button. The menu acts on the default reciter
  // and the rewayah its play button uses, and names the reciter in its
  // header.
  // @ai-start
  const buildSurahOptions = useCallback<SurahOptionsBuilder>(
    surah => {
      const rewayatId = defaultReciter?.rewayat[0]?.id;
      return {
        surah,
        reciterId: defaultReciter?.id,
        rewayatId,
        onAddToQueue: defaultReciter
          ? async (s: Surah) => {
              const tracks = await createTracksForReciter(
                defaultReciter,
                [s],
                rewayatId,
              );
              await addToQueue(tracks);
            }
          : undefined,
      };
    },
    [defaultReciter, addToQueue],
  );

  const handleSurahOptions = useCallback(
    (result: SearchResult) => {
      Keyboard.dismiss();
      const payload = buildSurahOptions(result.item as Surah);
      if (payload) SheetManager.show('surah-options', {payload});
    },
    [buildSurahOptions],
  );
  // @ai-end

  const renderSearchResult = useCallback(
    ({item}: {item: SearchResult}) => {
      if (item.type === 'surah') {
        return (
          <SurahItem
            pressAction="read" // @ai
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

  const renderListItem = useCallback(
    ({item}: ListRenderItemInfo<SearchListItem>) =>
      isCatalogResult(item) ? (
        renderSearchResult({item})
      ) : (
        <QuranResultRowView row={item} {...quranRowAction} />
      ),
    [renderSearchResult, quranRowAction],
  );

  const renderRecentSearch = useCallback(
    ({item: recentItem}: ListRenderItemInfo<RecentSearchItem>) => {
      if (recentItem.type === 'verse') {
        return (
          <RecentVerseRow
            verseKey={recentItem.verseKey}
            onPress={() => openVerse(recentItem.verseKey, recentItem.positions)}
          />
        );
      }
      const handlePress = () => {
        handleResultPress({
          type: recentItem.type,
          item: recentItem.item,
          score: 0,
        });
      };

      if (recentItem.type === 'surah') {
        return (
          <SurahItem
            pressAction="read" // @ai
            item={recentItem.item as Surah}
            onPress={handlePress}
          />
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
    [handleResultPress, openVerse],
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
        <ExploreView />
      </RNAnimated.View>

      {/* Search Mode — always mounted, hidden via opacity */}
      <RNAnimated.View
        style={[
          styles.modeContainer,
          styles.modeOverlay,
          isTablet && styles.tabletOverlay,
          {
            opacity: searchOpacity,
            backgroundColor: theme.colors.background,
            paddingTop: skipTopInset ? 0 : topInset,
          },
        ]}
        pointerEvents={isSearchMode ? 'auto' : 'none'}>
        {query.length === 0 ? (
          <ScrollView
            style={listStyle}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              {paddingBottom: Math.max(keyboardHeight, bottomInset)},
            ]}
            keyboardShouldPersistTaps="handled">
            {!Platform.isTV && <ReciteToSearchRow />}
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
                    {t('search.recentSearches')}
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
                      {t('common:actions.clear')}
                    </Text>
                  </Pressable>
                </View>
                <FlatList
                  data={recentSearches}
                  renderItem={renderRecentSearch}
                  keyExtractor={(item, index) =>
                    `${item.type}-${recentId(item)}-${index}`
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
                  {t('search.noRecent')}
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
                  {t('search.noRecentHint')}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : isTablet &&
          !searching &&
          !rootMode &&
          (searchResults.length > 0 || quranRows.length > 0) ? (
          <SurahOptionsProvider build={buildSurahOptions}>
            <TabletSearchResults
              results={searchResults}
              onResultPress={handleResultPress}
              onSurahPlay={handleSurahLongPress}
              onSurahOptions={handleSurahOptions}
              quranRows={quranRows}
              onQuranRowAction={quranRowAction}
              bottomPadding={Math.max(keyboardHeight, bottomInset)}
              style={styles.tabletFullWidth}
            />
          </SurahOptionsProvider>
        ) : (
          <FlatList<SearchListItem>
            style={listStyle}
            data={listData}
            renderItem={renderListItem}
            keyExtractor={(item, index) =>
              isCatalogResult(item) ? `${item.type}-${index}` : item.key
            }
            contentContainerStyle={[
              styles.resultsContent,
              {paddingBottom: Math.max(keyboardHeight, bottomInset)},
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            ListHeaderComponent={
              searching ? (
                <View style={styles.loadingContainer}>
                  <LoadingIndicator size={24} />
                </View>
              ) : searchResults.length === 0 && quranRows.length === 0 ? (
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
                    {t('common:status.noResults')}
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
                    {queryKind === 'none'
                      ? t('search.noResultsHint')
                      : t('reader:quranSearch.noAyahsHint')}
                  </Text>
                </View>
              ) : undefined
            }
            ListFooterComponent={<View style={styles.footer} />}
          />
        )}
      </RNAnimated.View>
    </View>
  );
}
// @ai-end

// @ai-start
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeContainer: {
    flex: 1,
  },
  modeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  flexFill: {
    flex: 1,
  },
  tabletOverlay: {
    alignItems: 'center',
  },
  tabletColumn: {
    width: '100%',
    maxWidth: 720,
  },
  tabletFullWidth: {
    alignSelf: 'stretch',
  },
  scrollContent: {},
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
    letterSpacing: latinLetterSpacing(1.0),
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
// @ai-end
