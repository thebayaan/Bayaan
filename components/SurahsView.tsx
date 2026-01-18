import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';
import {SurahItem} from './SurahItem';
import {SURAHS, Surah} from '@/data/surahData';
import Color from 'color';
import {SurahsHero} from '@/components/hero/SurahsHero';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {LinearGradient} from 'expo-linear-gradient';
import {Icon} from '@rneui/themed';
import {useSettings} from '@/hooks/useSettings';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';
import {getJuzForSurah, getJuzName} from '@/data/juzData';

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
}

type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation';

// Type for list items - can be either a Juz header or surah row
type ListItem =
  | {type: 'juz-header'; juzNumber: number; juzName: string}
  | {type: 'surah-row'; surahs: Surah[]};

function getSurahOfTheDay(): Surah {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const surahIndex = dayOfYear % 114;
  return SURAHS[surahIndex];
}

// Group surahs into pairs for card view (2 columns)
function groupSurahsIntoPairs(surahs: Surah[]): Surah[][] {
  const pairs: Surah[][] = [];
  for (let i = 0; i < surahs.length; i += 2) {
    if (i + 1 < surahs.length) {
      pairs.push([surahs[i], surahs[i + 1]]);
    } else {
      pairs.push([surahs[i]]);
    }
  }
  return pairs;
}

// Shared ItemSeparator component
const ItemSeparator = React.memo(() => {
  return <View style={styles.itemSeparator} />;
});
ItemSeparator.displayName = 'ItemSeparator';

export default function SurahsView({onSurahPress}: SurahsViewProps) {
  const {theme} = useTheme();

  // Memoize the surah of the day to prevent recalculation
  const surahOfTheDay = useMemo(() => getSurahOfTheDay(), []);

  // Retrieve persisted settings
  const browseViewModeSetting = useSettings(state => state.browseViewMode);
  const setBrowseViewModeSetting = useSettings(
    state => state.setBrowseViewMode,
  );
  const browseSortOptionSetting = useSettings(state => state.browseSortOption);
  const setBrowseSortOptionSetting = useSettings(
    state => state.setBrowseSortOption,
  );

  // Initialize local state from persisted settings
  const [viewMode, setViewMode] = useState<ViewMode>(browseViewModeSetting);
  const [sortOption, setSortOption] = useState<SortOption>(
    browseSortOptionSetting,
  );

  // Sort surahs based on selected option
  const displaySurahs = useMemo(() => {
    const result = [...SURAHS];

    switch (sortOption) {
      case 'asc':
        return result.sort((a, b) => a.id - b.id);
      case 'desc':
        return result.sort((a, b) => b.id - a.id);
      case 'revelation':
        return result.sort((a, b) => a.revelation_order - b.revelation_order);
      default:
        return result;
    }
  }, [sortOption]);

  // Prepare section data based on view mode
  const sections = useMemo(() => {
    // Only show Juz headers in list view with asc/desc sort (not revelation)
    const shouldShowJuzHeaders =
      viewMode === 'list' && (sortOption === 'asc' || sortOption === 'desc');

    if (viewMode === 'card') {
      // Card view: pairs of surahs, no Juz headers
      const pairs = groupSurahsIntoPairs(displaySurahs);
      const data: ListItem[] = pairs.map(pair => ({
        type: 'surah-row' as const,
        surahs: pair,
      }));
      return [{title: 'surahs', data, viewMode: 'card' as const}];
    } else if (shouldShowJuzHeaders) {
      // List view with Juz grouping
      const data: ListItem[] = [];
      let currentJuz: number | null = null;

      displaySurahs.forEach(surah => {
        const surahJuz = getJuzForSurah(surah.id);

        // Add Juz header when we encounter a new Juz
        if (surahJuz !== currentJuz) {
          currentJuz = surahJuz;
          data.push({
            type: 'juz-header',
            juzNumber: surahJuz,
            juzName: getJuzName(surahJuz),
          });
        }

        // Add the surah
        data.push({
          type: 'surah-row',
          surahs: [surah],
        });
      });

      return [{title: 'surahs', data, viewMode: 'list' as const}];
    } else {
      // List view without Juz grouping (revelation order)
      const data: ListItem[] = displaySurahs.map(s => ({
        type: 'surah-row' as const,
        surahs: [s],
      }));
      return [{title: 'surahs', data, viewMode: 'list' as const}];
    }
  }, [displaySurahs, viewMode, sortOption]);

  // Function to generate a consistent color for each surah
  const getColorForSurah = useCallback((id: number): string => {
    return GRADIENT_COLORS[id % GRADIENT_COLORS.length];
  }, []);

  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(newMode);
    setBrowseViewModeSetting(newMode);
  }, [viewMode, setBrowseViewModeSetting]);

  const changeSortOption = useCallback(
    (option: SortOption) => {
      setSortOption(option);
      setBrowseSortOptionSetting(option);
    },
    [setBrowseSortOptionSetting],
  );

  // Render item for SectionList
  const renderItem = useCallback(
    ({item, section}: {item: ListItem; section: {viewMode: ViewMode}}) => {
      // Handle Juz header
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

      // Handle surah row
      const surahs = item.surahs;
      if (section.viewMode === 'card') {
        return (
          <View style={styles.cardRow}>
            {surahs.map(surah => (
              <SurahCard
                key={surah.id}
                id={surah.id}
                name={surah.name}
                translatedName={surah.translated_name_english}
                versesCount={surah.verses_count}
                revelationPlace={surah.revelation_place}
                color={getColorForSurah(surah.id)}
                onPress={() => onSurahPress(surah)}
                style={styles.surahCard}
              />
            ))}
            {surahs.length === 1 && <View style={styles.surahCard} />}
          </View>
        );
      } else {
        return <SurahItem item={surahs[0]} onPress={onSurahPress} />;
      }
    },
    [
      getColorForSurah,
      onSurahPress,
      theme.colors.textSecondary,
      theme.colors.border,
      theme.colors.text,
    ],
  );

  // Render section header (sticky sort options)
  const renderSectionHeader = useCallback(
    () => (
      <View
        style={[
          styles.stickyHeader,
          {backgroundColor: theme.colors.background},
        ]}>
        <View style={styles.optionsRow}>
          {/* Sort options */}
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={[
                styles.sortButton,
                sortOption === 'asc' && {
                  backgroundColor: Color(theme.colors.primary)
                    .alpha(0.1)
                    .toString(),
                },
              ]}
              activeOpacity={1}
              onPress={() => changeSortOption('asc')}>
              <Icon
                name="arrow-up"
                type="feather"
                size={moderateScale(14)}
                color={
                  sortOption === 'asc'
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.sortButtonText,
                  {
                    color:
                      sortOption === 'asc'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                  },
                ]}>
                Asc
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortButton,
                sortOption === 'desc' && {
                  backgroundColor: Color(theme.colors.primary)
                    .alpha(0.1)
                    .toString(),
                },
              ]}
              activeOpacity={1}
              onPress={() => changeSortOption('desc')}>
              <Icon
                name="arrow-down"
                type="feather"
                size={moderateScale(14)}
                color={
                  sortOption === 'desc'
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.sortButtonText,
                  {
                    color:
                      sortOption === 'desc'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                  },
                ]}>
                Desc
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortButton,
                sortOption === 'revelation' && {
                  backgroundColor: Color(theme.colors.primary)
                    .alpha(0.1)
                    .toString(),
                },
              ]}
              activeOpacity={1}
              onPress={() => changeSortOption('revelation')}>
              <Icon
                name="calendar"
                type="feather"
                size={moderateScale(14)}
                color={
                  sortOption === 'revelation'
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.sortButtonText,
                  {
                    color:
                      sortOption === 'revelation'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                  },
                ]}>
                Rev
              </Text>
            </TouchableOpacity>
          </View>

          {/* View mode toggle */}
          <TouchableOpacity
            style={styles.viewModeButton}
            onPress={toggleViewMode}
            activeOpacity={1}>
            <Icon
              name={viewMode === 'card' ? 'list' : 'grid'}
              type="feather"
              size={moderateScale(16)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [sortOption, viewMode, theme, changeSortOption, toggleViewMode],
  );

  // List header (hero section)
  const ListHeader = useMemo(
    () => (
      <View style={styles.heroContainer}>
        <SurahsHero surahOfTheDay={surahOfTheDay} onSurahPress={onSurahPress} />
      </View>
    ),
    [surahOfTheDay, onSurahPress],
  );

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.type === 'juz-header') {
      return `juz-${item.juzNumber}`;
    }
    return `row-${index}-${item.surahs.map(s => s.id).join('-')}`;
  }, []);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeader}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ItemSeparatorComponent={ItemSeparator}
        initialNumToRender={25}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: TOTAL_BOTTOM_PADDING,
  },
  heroContainer: {
    marginBottom: 0,
  },
  stickyHeader: {
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  viewModeButton: {
    padding: moderateScale(6),
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
  },
  surahCard: {
    width: '48%',
  },
  itemSeparator: {
    height: moderateScale(12),
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
