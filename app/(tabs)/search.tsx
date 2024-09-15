import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import {useRouter} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAllReciters, getAllSurahs} from '@/services/dataService';
import {Surah} from '@/data/surahData';
import {Reciter} from '@/data/reciterData';
import Fuse from 'fuse.js';
import {createStyles} from './styles';
import SearchBar from '@/components/SearchBar';
import {Icon} from '@rneui/themed';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ReciterItem} from '@/components/ReciterItem';
import {SurahItem} from '@/components/SurahItem';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 5;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [reciterResults, setReciterResults] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();

  const [reciterFuse, setReciterFuse] = useState<Fuse<Reciter> | null>(null);
  const [surahFuse, setSurahFuse] = useState<Fuse<Surah> | null>(null);

  const searchSuggestions = useMemo(
    () => ['الرحمن', 'Al-Rahman', 'The Merciful', '55', 'Mishari'],
    [],
  );

  const {theme} = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    const fetchData = async () => {
      const [reciterData, surahData] = await Promise.all([
        getAllReciters(),
        getAllSurahs(),
      ]);

      setReciterFuse(
        new Fuse(reciterData, {
          keys: ['name'],
          threshold: 0.4,
        }),
      );
      setSurahFuse(
        new Fuse(surahData, {
          keys: ['name', 'name_arabic', 'translated_name_english', 'id'],
          threshold: 0.4,
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
    if (query.length > 0 && reciterFuse && surahFuse) {
      const reciterSearchResults = reciterFuse.search(query).slice(0, 10);
      const surahSearchResults = surahFuse.search(query).slice(0, 5);

      setReciterResults(reciterSearchResults.map(result => result.item));
      setFilteredSurahs(surahSearchResults.map(result => result.item));
    } else {
      setReciterResults([]);
      setFilteredSurahs([]);
    }
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
        pathname: '/reciter/[id]',
        params: {id: reciter.id, name: reciter.name},
      });
    },
    [router, query, addToRecentSearches],
  );

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      addToRecentSearches(query);
      router.push({
        pathname: '/surah/[id]',
        params: {id: surah.id, name: surah.name},
      });
    },
    [router, query, addToRecentSearches],
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, {color: theme.colors.text}]}>
          Search
        </Text>
      </View>
      <View style={styles.searchBoxContainer}>
        <SearchBar
          placeholder="What do you want to listen to?"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {query.length === 0 ? (
        <ScrollView style={styles.emptyContainer}>
          {recentSearches.length > 0 && (
            <View>
              <Text style={styles.placeholderSectionTitle}>
                RECENT SEARCHES
              </Text>
              <FlatList
                data={recentSearches}
                renderItem={renderSearchItem}
                keyExtractor={item => item}
                scrollEnabled={false}
              />
            </View>
          )}
          <View style={styles.searchSuggestionsContainer}>
            <Text style={styles.placeholderSectionTitle}>
              TRY SEARCHING WITH
            </Text>
            <FlatList
              data={searchSuggestions}
              renderItem={renderSearchItem}
              keyExtractor={item => item}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.resultsContainer}>
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
    </SafeAreaView>
  );
}
