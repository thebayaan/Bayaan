import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  SectionList,
  Keyboard,
  StyleSheet,
  Pressable,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {SearchInput} from '@/components/SearchInput';
import {SurahItem} from '@/components/SurahItem';
import {SURAHS, Surah} from '@/data/surahData';
import {getJuzForSurah, getJuzName} from '@/data/juzData';
import {useSettings} from '@/hooks/useSettings';
import {ContinueReadingCard} from './ContinueReadingCard';
import {BookmarkChips} from './BookmarkChips';

interface MushafSearchViewProps {
  onNavigateToPage: (page: number) => void;
  onNavigateToSurah: (surahId: number) => void;
  onClose: () => void;
  surahStartPages: Record<number, number>;
  pageToSurah: Record<number, number>;
}

type SortOption = 'asc' | 'desc' | 'revelation';

type ListItem =
  | {type: 'juz-header'; juzNumber: number; juzName: string}
  | {type: 'surah-row'; surah: Surah};

const MushafSearchView: React.FC<MushafSearchViewProps> = ({
  onNavigateToPage,
  onNavigateToSurah,
  onClose,
  surahStartPages,
  pageToSurah,
}) => {
  const {theme, isDarkMode} = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const browseSortOption = useSettings(s => s.browseSortOption);
  const setBrowseSortOption = useSettings(s => s.setBrowseSortOption);
  const [sortOption, setSortOption] = useState<SortOption>(browseSortOption);

  const isSearching = searchQuery.trim().length > 0;

  const changeSortOption = useCallback(
    (option: SortOption) => {
      setSortOption(option);
      setBrowseSortOption(option);
    },
    [setBrowseSortOption],
  );

  const listData = useMemo(() => {
    let filtered: Surah[];
    if (isSearching) {
      const q = searchQuery.trim().toLowerCase();
      filtered = SURAHS.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.translated_name_english.toLowerCase().includes(q) ||
          s.id.toString() === q,
      );
    } else {
      filtered = [...SURAHS];
    }

    switch (sortOption) {
      case 'asc':
        filtered.sort((a, b) => a.id - b.id);
        break;
      case 'desc':
        filtered.sort((a, b) => b.id - a.id);
        break;
      case 'revelation':
        filtered.sort((a, b) => a.revelation_order - b.revelation_order);
        break;
    }

    const shouldShowJuzHeaders =
      !isSearching && (sortOption === 'asc' || sortOption === 'desc');

    if (!shouldShowJuzHeaders) {
      return filtered.map(s => ({type: 'surah-row' as const, surah: s}));
    }

    const items: ListItem[] = [];
    let currentJuz: number | null = null;
    for (const surah of filtered) {
      const juz = getJuzForSurah(surah.id);
      if (juz !== currentJuz) {
        currentJuz = juz;
        items.push({
          type: 'juz-header',
          juzNumber: juz,
          juzName: getJuzName(juz),
        });
      }
      items.push({type: 'surah-row', surah});
    }
    return items;
  }, [searchQuery, sortOption, isSearching]);

  const sections = useMemo(
    () => [{title: 'surahs', data: listData}],
    [listData],
  );

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      Keyboard.dismiss();
      onNavigateToSurah(surah.id);
    },
    [onNavigateToSurah],
  );

  const handleBookmarkPress = useCallback(
    (surahId: number) => {
      Keyboard.dismiss();
      onNavigateToSurah(surahId);
    },
    [onNavigateToSurah],
  );

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({item}: {item: ListItem}) => {
      if (item.type === 'juz-header') {
        return (
          <View style={styles.juzHeader}>
            <LinearGradient
              colors={['transparent', theme.colors.border]}
              locations={[0, 0.5]}
              start={{x: 0, y: 0.5}}
              end={{x: 1, y: 0.5}}
              style={styles.juzHeaderLine}
            />
            <View
              style={[
                styles.juzHeaderPill,
                {
                  backgroundColor: Color(theme.colors.text)
                    .alpha(0.05)
                    .toString(),
                },
              ]}>
              <Text
                style={[
                  styles.juzHeaderText,
                  {color: theme.colors.textSecondary},
                ]}>
                {item.juzName}
              </Text>
            </View>
            <LinearGradient
              colors={[theme.colors.border, 'transparent']}
              locations={[0.5, 1]}
              start={{x: 0, y: 0.5}}
              end={{x: 1, y: 0.5}}
              style={styles.juzHeaderLine}
            />
          </View>
        );
      }

      return <SurahItem item={item.surah} onPress={handleSurahPress} />;
    },
    [handleSurahPress, theme.colors],
  );

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.type === 'juz-header') return `juz-${item.juzNumber}`;
    return `surah-${item.surah.id}-${index}`;
  }, []);

  const ListHeader = useMemo(() => {
    if (isSearching) return null;
    return (
      <View>
        <ContinueReadingCard
          onPress={onNavigateToPage}
          pageToSurah={pageToSurah}
        />
        <BookmarkChips onPress={handleBookmarkPress} />
      </View>
    );
  }, [isSearching, onNavigateToPage, pageToSurah, handleBookmarkPress]);

  const renderSectionHeader = useCallback(
    () => (
      <View
        style={[styles.sortBar, {backgroundColor: theme.colors.background}]}>
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
                  size={moderateScale(14)}
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        },
      ]}>
      {/* Header with search input */}
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        onCancel={handleCancel}
        placeholder="Search surahs..."
        autoFocus
        showCancelButton={true}
        iconColor={theme.colors.textSecondary}
        textColor={theme.colors.text}
        backgroundColor={Color(theme.colors.text).alpha(0.06).toString()}
        borderColor={Color(theme.colors.border).alpha(0.2).toString()}
        keyboardAppearance={isDarkMode ? 'dark' : 'light'}
      />

      {/* Surah list with sticky sort header */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeader}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
};

export default MushafSearchView;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  sortBar: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(8),
    paddingBottom: moderateScale(8),
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    marginRight: moderateScale(8),
  },
  sortButtonText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    marginLeft: moderateScale(4),
  },
  listContent: {
    paddingBottom: moderateScale(40),
  },
  juzHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    marginTop: moderateScale(8),
    marginBottom: moderateScale(-4),
  },
  juzHeaderLine: {
    flex: 1,
    height: 1,
  },
  juzHeaderPill: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(5),
    borderRadius: moderateScale(12),
    marginHorizontal: moderateScale(8),
  },
  juzHeaderText: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
