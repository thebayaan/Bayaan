import React, {useState, useMemo, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Keyboard,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  BackHandler,
} from 'react-native';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {moderateScale as ms} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SearchInput} from '@/components/SearchInput';
import {SurahItem} from '@/components/SurahItem';
import {SURAHS, Surah} from '@/data/surahData';
import {getJuzForSurah, getJuzName} from '@/data/juzData';
import {useSettings} from '@/hooks/useSettings';
import {BookmarkChips} from './BookmarkChips';
import {JUZ_START_PAGES} from './constants';
import {useMushafSettingsStore, RecentRead} from '@/store/mushafSettingsStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';

// ============================================================================
// Types
// ============================================================================

interface MushafSearchViewProps {
  onNavigateToPage: (page: number) => void;
  onNavigateToSurah: (surahId: number) => void;
  onNavigateToVerse: (verseKey: string, page: number) => void;
  onClose: () => void;
  surahStartPages: Record<number, number>;
  pageToSurah: Record<number, number>;
}

type SortOption = 'asc' | 'desc' | 'revelation';

type BrowseItem =
  | {type: 'juz-header'; juzName: string; key: string}
  | {type: 'surah-row'; surah: Surah; key: string};

type SearchResultItem =
  | {type: 'surah'; surah: Surah; primary: string; secondary: string}
  | {
      type: 'verse';
      surahId: number;
      verse: number;
      primary: string;
      secondary: string;
    }
  | {type: 'page'; page: number; primary: string; secondary: string}
  | {
      type: 'juz';
      juz: number;
      page: number;
      primary: string;
      secondary: string;
    };

interface SearchHistoryItem {
  type: string;
  label: string;
  surahId?: number;
  page?: number;
  verse?: number;
  juz?: number;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const SEARCH_HISTORY_KEY = 'mushaf-search-history';
const MAX_HISTORY = 10;

// ============================================================================
// Smart Search Parser
// ============================================================================

function parseSearchQuery(
  query: string,
  surahStartPages: Record<number, number>,
  pageToSurah: Record<number, number>,
): SearchResultItem[] {
  const q = query.trim();
  if (!q) return [];

  const lower = q.toLowerCase();
  const results: SearchResultItem[] = [];

  // 1. "page N" or "pg N"
  const pageMatch = q.match(/^(?:page|pg)\s+(\d+)$/i);
  if (pageMatch) {
    const page = parseInt(pageMatch[1], 10);
    if (page >= 1 && page <= 604) {
      const surahId = pageToSurah[page];
      const surahName =
        surahId >= 1 && surahId <= 114 ? SURAHS[surahId - 1].name : '';
      results.push({
        type: 'page',
        page,
        primary: `Page ${page}`,
        secondary: surahName,
      });
    }
    return results;
  }

  // 2. Show all Juz list if typing "juz" or "jz"
  if (lower === 'juz' || lower === 'jz') {
    for (let i = 1; i <= 30; i++) {
      const page = JUZ_START_PAGES[i - 1];
      const surahId = pageToSurah[page];
      const surahName =
        surahId >= 1 && surahId <= 114 ? SURAHS[surahId - 1].name : '';
      results.push({
        type: 'juz',
        juz: i,
        page,
        primary: i === 30 ? "Juz 'Amma" : i === 29 ? 'Juz Tabarak' : `Juz ${i}`,
        secondary: `Page ${page} \u00B7 ${surahName}`,
      });
    }
    return results;
  }

  // 3. "juz N", "j N", "jz N" or common names like "Amma"
  const juzMatch = q.match(/^(?:juz|j|jz)\s*(\d+)$/i);
  const juzNames: Record<string, number> = {
    amma: 30,
    'juz amma': 30,
    tabarak: 29,
    'juz tabarak': 29,
  };

  if (juzMatch || juzNames[lower]) {
    const juz = juzMatch ? parseInt(juzMatch[1], 10) : juzNames[lower];
    if (juz >= 1 && juz <= 30) {
      const page = JUZ_START_PAGES[juz - 1];
      const surahId = pageToSurah[page];
      const surahName =
        surahId >= 1 && surahId <= 114 ? SURAHS[surahId - 1].name : '';
      results.push({
        type: 'juz',
        juz,
        page,
        primary:
          juz === 30 ? "Juz 'Amma" : juz === 29 ? 'Juz Tabarak' : `Juz ${juz}`,
        secondary: `Page ${page} \u00B7 ${surahName}`,
      });
    }
    if (juzMatch) return results; // Only return early if it was an explicit "juz N" search
  }

  // 4. "N:M" (surah:verse)
  const verseMatch = q.match(/^(\d+):(\d+)$/);
  if (verseMatch) {
    const surahId = parseInt(verseMatch[1], 10);
    const verse = parseInt(verseMatch[2], 10);
    if (surahId >= 1 && surahId <= 114) {
      const surah = SURAHS[surahId - 1];
      if (verse >= 1 && verse <= surah.verses_count) {
        results.push({
          type: 'verse',
          surahId,
          verse,
          primary: `${surah.name} ${surahId}:${verse}`,
          secondary: `Verse ${verse}`,
        });
      }
    }
    return results;
  }

  // 4. Plain number → show matching surah, page, and juz
  const plainNum = /^\d+$/.test(q) ? parseInt(q, 10) : null;
  if (plainNum !== null) {
    // Surah result
    if (plainNum >= 1 && plainNum <= 114) {
      const surah = SURAHS[plainNum - 1];
      results.push({
        type: 'surah',
        surah,
        primary: surah.name,
        secondary: `Surah ${surah.id} \u00B7 ${surah.translated_name_english}`,
      });
    }
    // Juz result
    if (plainNum >= 1 && plainNum <= 30) {
      const page = JUZ_START_PAGES[plainNum - 1];
      const surahId = pageToSurah[page];
      const surahName =
        surahId >= 1 && surahId <= 114 ? SURAHS[surahId - 1].name : '';
      results.push({
        type: 'juz',
        juz: plainNum,
        page,
        primary: `Juz ${plainNum}`,
        secondary: `Page ${page} \u00B7 ${surahName}`,
      });
    }
    // Page result
    if (plainNum >= 1 && plainNum <= 604) {
      const surahId = pageToSurah[plainNum];
      const surahName =
        surahId >= 1 && surahId <= 114 ? SURAHS[surahId - 1].name : '';
      results.push({
        type: 'page',
        page: plainNum,
        primary: `Page ${plainNum}`,
        secondary: surahName,
      });
    }
    return results;
  }

  // 5. Fuzzy match on surah names
  for (const surah of SURAHS) {
    if (
      surah.name.toLowerCase().includes(lower) ||
      surah.translated_name_english.toLowerCase().includes(lower) ||
      surah.name_arabic.includes(q)
    ) {
      results.push({
        type: 'surah',
        surah,
        primary: surah.name,
        secondary: `Surah ${surah.id} \u00B7 ${surah.translated_name_english}`,
      });
    }
  }

  return results;
}

// ============================================================================
// Sub-components
// ============================================================================

const SearchResultRow: React.FC<{
  item: SearchResultItem;
  textColor: string;
  secondaryColor: string;
  onPress: () => void;
}> = React.memo(({item, textColor, secondaryColor, onPress}) => (
  <Pressable
    style={({pressed}) => [styles.resultRow, {opacity: pressed ? 0.5 : 1}]}
    onPress={onPress}>
    <Feather
      name="search"
      size={ms(16)}
      color={Color(secondaryColor).alpha(0.3).toString()}
    />
    <View style={styles.resultTextContainer}>
      <Text
        style={[styles.resultPrimary, {color: textColor}]}
        numberOfLines={1}>
        {item.primary}
      </Text>
      <Text
        style={[
          styles.resultSecondary,
          {color: Color(secondaryColor).alpha(0.45).toString()},
        ]}
        numberOfLines={1}>
        {item.secondary}
      </Text>
    </View>
  </Pressable>
));

SearchResultRow.displayName = 'SearchResultRow';

const HistoryRow: React.FC<{
  item: SearchHistoryItem;
  textColor: string;
  secondaryColor: string;
  onPress: () => void;
}> = React.memo(({item, textColor, secondaryColor, onPress}) => (
  <Pressable
    style={({pressed}) => [styles.historyRow, {opacity: pressed ? 0.5 : 1}]}
    onPress={onPress}>
    <Feather
      name="clock"
      size={ms(16)}
      color={Color(secondaryColor).alpha(0.35).toString()}
    />
    <Text
      style={[
        styles.historyText,
        {color: Color(textColor).alpha(0.85).toString()},
      ]}
      numberOfLines={1}>
      {item.label}
    </Text>
  </Pressable>
));

HistoryRow.displayName = 'HistoryRow';

const RecentReadChips: React.FC<{
  recentPages: RecentRead[];
  textColor: string;
  secondaryColor: string;
  onPress: (page: number) => void;
}> = React.memo(({recentPages, textColor, secondaryColor, onPress}) => {
  if (recentPages.length === 0) return null;

  return (
    <View style={styles.recentReadContainer}>
      <Text
        style={[
          styles.sectionLabel,
          {
            color: Color(secondaryColor).alpha(0.5).toString(),
            marginTop: ms(4),
          },
        ]}>
        RECENT READS
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}>
        {recentPages.map((item, index) => {
          const surah =
            item.surahId >= 1 && item.surahId <= 114
              ? SURAHS[item.surahId - 1]
              : null;
          if (!surah) return null;

          return (
            <Pressable
              key={`${item.surahId}-${item.page}-${index}`}
              style={[
                styles.chip,
                {
                  backgroundColor: Color(textColor).alpha(0.05).toString(),
                  borderColor: Color(textColor).alpha(0.08).toString(),
                },
              ]}
              onPress={() => onPress(item.page)}>
              <Text style={[styles.chipName, {color: textColor}]}>
                {surah.name}
              </Text>
              <Text
                style={[
                  styles.chipPage,
                  {color: Color(secondaryColor).alpha(0.5).toString()},
                ]}>
                Page {item.page}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

RecentReadChips.displayName = 'RecentReadChips';

// ============================================================================
// Main Component
// ============================================================================

const MushafSearchView: React.FC<MushafSearchViewProps> = ({
  onNavigateToPage,
  onNavigateToSurah,
  onNavigateToVerse,
  onClose,
  surahStartPages,
  pageToSurah,
}) => {
  const {theme, isDarkMode} = useTheme();
  const insets = useSafeAreaInsets();
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  const browseSortOption = useSettings(s => s.browseSortOption);
  const setBrowseSortOption = useSettings(s => s.setBrowseSortOption);
  const [sortOption, setSortOption] = useState<SortOption>(browseSortOption);

  const recentPages = useMushafSettingsStore(s => s.recentPages);
  const searchInputRef = useRef<TextInput>(null);

  // Fade animation refs
  const browseOpacity = useRef(new RNAnimated.Value(1)).current;
  const searchOpacity = useRef(new RNAnimated.Value(0)).current;

  // Load search history when entering search mode
  useEffect(() => {
    if (!isSearchMode) return;
    AsyncStorage.getItem(SEARCH_HISTORY_KEY).then(raw => {
      if (raw) {
        try {
          setSearchHistory(JSON.parse(raw));
        } catch {
          setSearchHistory([]);
        }
      }
    });
  }, [isSearchMode]);

  // Android back handler — exit search mode instead of closing overlay
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSearchMode) {
        exitSearchMode();
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [isSearchMode, onClose]);

  const changeSortOption = useCallback(
    (option: SortOption) => {
      setSortOption(option);
      setBrowseSortOption(option);
    },
    [setBrowseSortOption],
  );

  // ──────────────────────────────────────────────────────────
  // Mode transitions
  // ──────────────────────────────────────────────────────────
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
    setSearchQuery('');
    setIsSearchMode(false);
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
  }, [browseOpacity, searchOpacity]);

  // ──────────────────────────────────────────────────────────
  // Search history management
  // ──────────────────────────────────────────────────────────
  const addToHistory = useCallback(
    async (item: SearchHistoryItem) => {
      const deduped = searchHistory.filter(
        h =>
          !(
            h.type === item.type &&
            h.surahId === item.surahId &&
            h.page === item.page &&
            h.juz === item.juz
          ),
      );
      const updated = [item, ...deduped].slice(0, MAX_HISTORY);
      setSearchHistory(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    },
    [searchHistory],
  );

  const clearHistory = useCallback(async () => {
    setSearchHistory([]);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify([]));
  }, []);

  // ──────────────────────────────────────────────────────────
  // Search results
  // ──────────────────────────────────────────────────────────
  const searchResults = useMemo(
    () => parseSearchQuery(searchQuery, surahStartPages, pageToSurah),
    [searchQuery, surahStartPages, pageToSurah],
  );

  const handleResultPress = useCallback(
    (item: SearchResultItem) => {
      Keyboard.dismiss();
      const historyItem: SearchHistoryItem = {
        type: item.type,
        label: item.primary,
        timestamp: Date.now(),
      };

      switch (item.type) {
        case 'surah':
          historyItem.surahId = item.surah.id;
          addToHistory(historyItem);
          onNavigateToSurah(item.surah.id);
          break;
        case 'verse': {
          historyItem.surahId = item.surahId;
          historyItem.verse = item.verse;
          addToHistory(historyItem);
          const verseKey = `${item.surahId}:${item.verse}`;
          const versePage = digitalKhattDataService.getPageForVerse(verseKey);
          if (versePage) {
            onNavigateToVerse(verseKey, versePage);
          } else {
            onNavigateToSurah(item.surahId);
          }
          break;
        }
        case 'page':
          historyItem.page = item.page;
          addToHistory(historyItem);
          onNavigateToPage(item.page);
          break;
        case 'juz':
          historyItem.juz = item.juz;
          historyItem.page = item.page;
          addToHistory(historyItem);
          onNavigateToPage(item.page);
          break;
      }
    },
    [addToHistory, onNavigateToPage, onNavigateToSurah, onNavigateToVerse],
  );

  const handleHistoryPress = useCallback(
    (item: SearchHistoryItem) => {
      Keyboard.dismiss();
      if (item.surahId && item.verse) {
        const verseKey = `${item.surahId}:${item.verse}`;
        const versePage = digitalKhattDataService.getPageForVerse(verseKey);
        if (versePage) {
          onNavigateToVerse(verseKey, versePage);
          return;
        }
      }
      if (item.page) {
        onNavigateToPage(item.page);
      } else if (item.surahId) {
        onNavigateToSurah(item.surahId);
      }
    },
    [onNavigateToPage, onNavigateToSurah, onNavigateToVerse],
  );

  // ──────────────────────────────────────────────────────────
  // Browse mode data
  // ──────────────────────────────────────────────────────────
  const {browseData, stickyIndices} = useMemo(() => {
    const sorted = [...SURAHS];
    switch (sortOption) {
      case 'asc':
        sorted.sort((a, b) => a.id - b.id);
        break;
      case 'desc':
        sorted.sort((a, b) => b.id - a.id);
        break;
      case 'revelation':
        sorted.sort((a, b) => a.revelation_order - b.revelation_order);
        break;
    }

    const items: BrowseItem[] = [];
    const stickies: number[] = [];
    const showJuzHeaders = sortOption === 'asc' || sortOption === 'desc';

    if (showJuzHeaders) {
      let currentJuz: number | null = null;
      for (const surah of sorted) {
        const juz = getJuzForSurah(surah.id);
        if (juz !== currentJuz) {
          currentJuz = juz;
          stickies.push(items.length);
          items.push({
            type: 'juz-header',
            juzName: getJuzName(juz),
            key: `juz-${juz}`,
          });
        }
        items.push({type: 'surah-row', surah, key: `surah-${surah.id}`});
      }
    } else {
      for (const surah of sorted) {
        items.push({type: 'surah-row', surah, key: `surah-${surah.id}`});
      }
    }

    return {browseData: items, stickyIndices: stickies};
  }, [sortOption]);

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      Keyboard.dismiss();
      onNavigateToSurah(surah.id);
    },
    [onNavigateToSurah],
  );

  const handleBookmarkPress = useCallback(
    (surahId: number, ayahNumber: number) => {
      Keyboard.dismiss();
      const verseKey = `${surahId}:${ayahNumber}`;
      const versePage = digitalKhattDataService.getPageForVerse(verseKey);
      if (versePage) {
        onNavigateToVerse(verseKey, versePage);
      } else {
        onNavigateToSurah(surahId);
      }
    },
    [onNavigateToSurah, onNavigateToVerse],
  );

  const handleChipPress = useCallback(
    (page: number) => {
      onNavigateToPage(page);
    },
    [onNavigateToPage],
  );

  // ──────────────────────────────────────────────────────────
  // Browse mode renderers
  // ──────────────────────────────────────────────────────────
  const renderBrowseItem = useCallback(
    ({item}: ListRenderItemInfo<BrowseItem>) => {
      if (item.type === 'juz-header') {
        return (
          <View
            style={[
              styles.juzHeader,
              {backgroundColor: theme.colors.background},
            ]}>
            <Text
              style={[
                styles.juzHeaderText,
                {color: theme.colors.textSecondary},
              ]}>
              {item.juzName}
            </Text>
          </View>
        );
      }
      return <SurahItem item={item.surah} onPress={handleSurahPress} />;
    },
    [handleSurahPress, theme.colors],
  );

  const browseKeyExtractor = useCallback((item: BrowseItem) => item.key, []);

  const getItemType = useCallback((item: BrowseItem) => item.type, []);

  const SortBar = useMemo(
    () => (
      <View style={styles.sortBar}>
        <View style={styles.sortOptions}>
          {(['asc', 'desc', 'revelation'] as SortOption[]).map(option => {
            const isActive = sortOption === option;
            const iconName =
              option === 'asc'
                ? 'arrow-up'
                : option === 'desc'
                ? 'arrow-down'
                : 'calendar';
            const label =
              option === 'asc' ? 'Asc' : option === 'desc' ? 'Desc' : 'Rev';
            return (
              <Pressable
                key={option}
                style={[
                  styles.sortButton,
                  isActive && {
                    backgroundColor: Color(theme.colors.text)
                      .alpha(0.1)
                      .toString(),
                  },
                ]}
                onPress={() => changeSortOption(option)}>
                <Feather
                  name={iconName}
                  size={ms(14)}
                  color={
                    isActive ? theme.colors.text : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.sortButtonText,
                    {
                      color: isActive
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [sortOption, theme.colors, changeSortOption],
  );

  const BrowseListHeader = useMemo(
    () => (
      <View>
        <RecentReadChips
          recentPages={recentPages}
          textColor={theme.colors.text}
          secondaryColor={theme.colors.textSecondary}
          onPress={handleChipPress}
        />
        <BookmarkChips onPress={handleBookmarkPress} />
        {SortBar}
      </View>
    ),
    [recentPages, theme.colors, handleBookmarkPress, handleChipPress, SortBar],
  );

  // ──────────────────────────────────────────────────────────
  // Search mode renderers
  // ──────────────────────────────────────────────────────────
  const renderSearchResult = useCallback(
    ({item}: {item: SearchResultItem}) => (
      <SearchResultRow
        item={item}
        textColor={theme.colors.text}
        secondaryColor={theme.colors.textSecondary}
        onPress={() => handleResultPress(item)}
      />
    ),
    [theme.colors, handleResultPress],
  );

  const renderHistoryItem = useCallback(
    ({item}: {item: SearchHistoryItem}) => (
      <HistoryRow
        item={item}
        textColor={theme.colors.text}
        secondaryColor={theme.colors.textSecondary}
        onPress={() => handleHistoryPress(item)}
      />
    ),
    [theme.colors, handleHistoryPress],
  );

  const isQueryEmpty = searchQuery.trim().length === 0;

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        },
      ]}>
      {/* ============================================================ */}
      {/* Browse Mode — always mounted, hidden via opacity              */}
      {/* ============================================================ */}
      <RNAnimated.View
        style={[styles.modeContainer, {opacity: browseOpacity}]}
        pointerEvents={isSearchMode ? 'none' : 'auto'}>
        {/* Header: back button + inactive search bar */}
        <View style={styles.browseHeader}>
          <Pressable
            style={({pressed}) => [
              styles.backButton,
              {opacity: pressed ? 0.3 : 0.6},
            ]}
            onPress={onClose}
            hitSlop={8}>
            <Feather
              name="chevron-left"
              size={ms(20)}
              color={theme.colors.text}
            />
          </Pressable>
          <Pressable style={styles.searchBarTap} onPress={enterSearchMode}>
            <SearchInput
              value=""
              onChangeText={() => {}}
              placeholder="Search surahs, pages, or juz..."
              showCancelButton={false}
              editable={false}
              pointerEvents="none"
              iconColor={theme.colors.textSecondary}
              iconOpacity={0.25}
              placeholderTextColor={Color(theme.colors.text)
                .alpha(0.35)
                .toString()}
              textColor={theme.colors.text}
              backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
              borderColor={Color(theme.colors.text).alpha(0.06).toString()}
              containerStyle={styles.searchBarContainer}
              style={styles.searchBarInput}
            />
          </Pressable>
        </View>

        {/* Surah list with sticky juz headers */}
        <FlashList
          data={browseData}
          renderItem={renderBrowseItem}
          ListHeaderComponent={BrowseListHeader}
          keyExtractor={browseKeyExtractor}
          getItemType={getItemType}
          stickyHeaderIndices={stickyIndices}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          drawDistance={ms(300)}
        />
      </RNAnimated.View>

      {/* ============================================================ */}
      {/* Search Mode — always mounted, hidden via opacity              */}
      {/* ============================================================ */}
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
        {/* Active search input with cancel */}
        <SearchInput
          ref={searchInputRef}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onCancel={exitSearchMode}
          placeholder="Search surahs, pages, or juz..."
          showCancelButton={true}
          iconColor={theme.colors.textSecondary}
          textColor={theme.colors.text}
          backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
          borderColor={Color(theme.colors.text).alpha(0.06).toString()}
          keyboardAppearance={isDarkMode ? 'dark' : 'light'}
        />

        {isQueryEmpty ? (
          // Empty query: show history or empty state
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.searchContent}>
            {searchHistory.length > 0 ? (
              <View>
                <View style={styles.historyHeader}>
                  <Text
                    style={[styles.historyTitle, {color: theme.colors.text}]}>
                    Recent searches
                  </Text>
                  <Pressable onPress={clearHistory}>
                    <Text
                      style={[
                        styles.historyClear,
                        {color: theme.colors.textSecondary},
                      ]}>
                      Clear
                    </Text>
                  </Pressable>
                </View>
                {searchHistory.map((item, index) => (
                  <HistoryRow
                    key={`${item.type}-${item.label}-${index}`}
                    item={item}
                    textColor={theme.colors.text}
                    secondaryColor={theme.colors.textSecondary}
                    onPress={() => handleHistoryPress(item)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather
                  name="search"
                  size={ms(36)}
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
                  Search the Mushaf
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
                  Find surahs, verses, pages, or juz
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          // With query: show results
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) =>
              `${item.type}-${item.primary}-${index}`
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.searchContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather
                  name="search"
                  size={ms(36)}
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
              </View>
            }
          />
        )}
      </RNAnimated.View>
    </View>
  );
};

export default MushafSearchView;

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modeContainer: {
    flex: 1,
  },
  modeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // Browse header
  browseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: ms(10),
    paddingBottom: ms(6),
    paddingHorizontal: ms(12),
    gap: ms(4),
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarTap: {
    flex: 1,
  },
  searchBarContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  searchBarInput: {
    height: ms(42),
  },

  // Section labels (uppercase editorial)
  sectionLabel: {
    fontSize: ms(10.5),
    fontFamily: 'Manrope-SemiBold',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: ms(8),
    marginTop: ms(12),
    paddingHorizontal: ms(16),
  },

  // Recently Read chips
  chipsScroll: {
    paddingHorizontal: ms(16),
    gap: ms(8),
  },
  chip: {
    paddingVertical: ms(10),
    paddingHorizontal: ms(14),
    borderRadius: ms(10),
    borderWidth: 1,
  },
  chipName: {
    fontSize: ms(13),
    fontFamily: 'Manrope-SemiBold',
  },
  chipPage: {
    fontSize: ms(11),
    fontFamily: 'Manrope-Medium',
    marginTop: ms(2),
  },

  // Sort bar
  sortBar: {
    paddingHorizontal: ms(16),
    paddingTop: ms(12),
    paddingBottom: ms(4),
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: ms(6),
    borderRadius: ms(16),
    marginRight: ms(8),
  },
  sortButtonText: {
    fontSize: ms(12),
    fontFamily: 'Manrope-SemiBold',
    marginLeft: ms(4),
  },

  // Juz headers
  juzHeader: {
    paddingHorizontal: ms(16),
    paddingTop: ms(14),
    paddingBottom: ms(6),
  },
  juzHeaderText: {
    fontSize: ms(12),
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Recent Read chips
  recentReadContainer: {
    paddingTop: ms(4),
  },

  listContent: {
    paddingBottom: ms(40),
  },

  // Search mode
  searchContent: {
    paddingTop: ms(8),
    paddingBottom: ms(40),
  },

  // Search history
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    marginBottom: ms(12),
  },
  historyTitle: {
    fontSize: ms(17),
    fontFamily: 'Manrope-Bold',
  },
  historyClear: {
    fontSize: ms(13),
    fontFamily: 'Manrope-SemiBold',
  },

  // History rows
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ms(48),
    paddingHorizontal: ms(16),
    gap: ms(14),
  },
  historyText: {
    flex: 1,
    fontSize: ms(15),
    fontFamily: 'Manrope-Medium',
  },

  // Search result rows
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ms(52),
    paddingHorizontal: ms(16),
    gap: ms(14),
  },
  resultTextContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: ms(2),
  },
  resultPrimary: {
    fontSize: ms(15),
    fontFamily: 'Manrope-Medium',
  },
  resultSecondary: {
    fontSize: ms(12),
    fontFamily: 'Manrope-Regular',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '35%',
    gap: ms(5),
  },
  emptyTitle: {
    fontSize: ms(15),
    fontFamily: 'Manrope-SemiBold',
    marginTop: ms(14),
  },
  emptySubtitle: {
    fontSize: ms(12.5),
    fontFamily: 'Manrope-Medium',
  },
});
