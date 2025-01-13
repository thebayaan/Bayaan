import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity, ScrollView, FlatList} from 'react-native';
import {useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAllReciters, getAllSurahs} from '@/services/dataService';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import Fuse from 'fuse.js';
import {createStyles} from './styles';
import SearchBar from '@/components/SearchBar';
import {Icon} from '@rneui/themed';
import {ReciterItem} from '@/components/ReciterItem';
import {SurahItem} from '@/components/SurahItem';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Button} from '@/components/Button';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {usePlayback} from '@/hooks/usePlayback';

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 5;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [reciterResults, setReciterResults] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reciterFuse, setReciterFuse] = useState<Fuse<Reciter> | null>(null);
  const [surahFuse, setSurahFuse] = useState<Fuse<Surah> | null>(null);

  const searchSuggestions = useMemo(
    () => ['الرحمن', 'Ar-Rahman', 'The Merciful', '55', 'Mishari'],
    [],
  );

  const {theme} = useTheme();
  const styles = createStyles(theme);

  const {askEveryTime, defaultReciterSelection} = useSettings();
  const {playTrack} = usePlayback();
  const defaultReciter = useReciterStore(state => state.defaultReciter);

  useEffect(() => {
    const fetchData = async () => {
      const [reciterData, surahData] = await Promise.all([
        getAllReciters(),
        getAllSurahs(),
      ]);

      setReciterFuse(
        new Fuse(reciterData, {
          keys: ['name'],
          threshold: 0.3,
          distance: 100,
          minMatchCharLength: 2,
        }),
      );
      setSurahFuse(
        new Fuse(surahData, {
          keys: ['name', 'name_arabic', 'translated_name_english', 'id'],
          threshold: 0.3,
          distance: 100,
          minMatchCharLength: 2,
          useExtendedSearch: true,
        }),
      );

      const storedSearches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const performSearch = useCallback(() => {
    if (!reciterFuse || !surahFuse) return; // Early return if Fuse instances aren't ready

    if (query.length === 0) {
      setReciterResults([]);
      setFilteredSurahs([]);
      return;
    }

    const reciterSearchResults = reciterFuse.search(query, {limit: 10});
    const surahSearchResults = surahFuse.search(query, {limit: 5});

    setReciterResults(reciterSearchResults.map(result => result.item));
    setFilteredSurahs(surahSearchResults.map(result => result.item));
  }, [query, reciterFuse, surahFuse]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const addToRecentSearches = useCallback(
    async (searchQuery: string) => {
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

  const handleReciterPress = useCallback(
    (reciter: Reciter) => {
      addToRecentSearches(query);
      router.push({
        pathname: '/(tabs)/(search)/reciter/[id]',
        params: {id: reciter.id, name: reciter.name},
      });
    },
    [router, query, addToRecentSearches],
  );

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      addToRecentSearches(query);
      if (askEveryTime) {
        router.push({
          pathname: '(modals)/select-reciter',
          params: {surahId: surah.id},
        });
      } else {
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
              playTrack(defaultReciter, surah.id.toString());
              router.push({
                pathname: '/player',
                params: {reciterImageUrl: defaultReciter.image_url},
              });
            } else {
              router.push({
                pathname: '(modals)/select-reciter',
                params: {surahId: surah.id},
              });
            }
            break;
          default:
            router.push({
              pathname: '(modals)/select-reciter',
              params: {surahId: surah.id},
            });
        }
      }
    },
    [
      router,
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      playTrack,
      query,
      addToRecentSearches,
    ],
  );

  const renderSurah = useCallback(
    (surah: Surah) => (
      <SurahItem key={surah.id} item={surah} onPress={handleSurahPress} />
    ),
    [handleSurahPress],
  );

  const renderSearchItem = useCallback(
    ({item}: {item: string}) => (
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.searchItem}
        onPress={() => setQuery(item)}>
        <View style={styles.searchIconContainer}>
          <Icon
            name="search"
            type="feather"
            size={moderateScale(16)}
            color={theme.colors.textSecondary}
          />
        </View>
        <Text style={styles.searchItemText}>{item}</Text>
      </TouchableOpacity>
    ),
    [
      setQuery,
      styles.searchItem,
      styles.searchIconContainer,
      styles.searchItemText,
      theme.colors.textSecondary,
    ],
  );

  const renderSuggestionButton = useCallback(
    ({item}: {item: string}) => (
      <Button
        title={item}
        onPress={() => setQuery(item)}
        size="small"
        style={styles.suggestionButton}
        textStyle={styles.suggestionButtonText}
        backgroundColor={theme.colors.card}
        textColor={theme.colors.text}
        borderWidth={1}
        borderColor={theme.colors.border}
      />
    ),
    [setQuery, styles, theme],
  );

  const renderSuggestionRow = useCallback(
    ({item}: {item: string[]}) => (
      <View style={styles.suggestionRow}>
        <FlatList
          data={item}
          renderItem={renderSuggestionButton}
          keyExtractor={suggestion => suggestion}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>
    ),
    [renderSuggestionButton, styles],
  );

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
        <View style={styles.searchBoxContainer}>
          <SearchBar
            placeholder="What do you want to listen to?"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>
      <View style={styles.contentContainer}>
        {query.length === 0 ? (
          <ScrollView>
            <View style={styles.emptyContainer}>
              <View style={styles.suggestionsContainer}>
                <FlatList
                  data={[
                    searchSuggestions.slice(
                      0,
                      Math.ceil(searchSuggestions.length / 2),
                    ),
                    searchSuggestions.slice(
                      Math.ceil(searchSuggestions.length / 2),
                    ),
                  ]}
                  renderItem={renderSuggestionRow}
                  keyExtractor={(_, index) => `row-${index}`}
                  scrollEnabled={false}
                />
              </View>
              {recentSearches.length > 0 && (
                <View>
                  <View style={styles.recentSearchesHeader}>
                    <Text style={styles.placeholderSectionTitle}>
                      RECENT SEARCHES
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.99}
                      onPress={clearRecentSearches}>
                      <Text style={styles.clearButton}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={recentSearches}
                    renderItem={renderSearchItem}
                    keyExtractor={item => item}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.resultsContainer}
            contentContainerStyle={{paddingBottom: 70}}>
            {filteredSurahs.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Surahs</Text>
                {filteredSurahs.map(renderSurah)}
              </View>
            )}
            {reciterResults.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Reciters</Text>
                {reciterResults.map(reciter => (
                  <ReciterItem
                    key={reciter.id}
                    item={reciter}
                    onPress={handleReciterPress}
                  />
                ))}
              </View>
            )}
            {query.length > 0 &&
              filteredSurahs.length === 0 &&
              reciterResults.length === 0 && (
                <Text style={styles.emptyText}>No results found.</Text>
              )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
