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
import {Icon} from '@rneui/themed';
import {useSettings} from '@/hooks/useSettings';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
}

type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation';

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
    if (viewMode === 'card') {
      const pairs = groupSurahsIntoPairs(displaySurahs);
      return [{title: 'surahs', data: pairs, viewMode: 'card' as const}];
    } else {
      return [
        {
          title: 'surahs',
          data: displaySurahs.map(s => [s]),
          viewMode: 'list' as const,
        },
      ];
    }
  }, [displaySurahs, viewMode]);

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
    ({item, section}: {item: Surah[]; section: {viewMode: ViewMode}}) => {
      if (section.viewMode === 'card') {
        return (
          <View style={styles.cardRow}>
            {item.map(surah => (
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
            {item.length === 1 && <View style={styles.surahCard} />}
          </View>
        );
      } else {
        return <SurahItem item={item[0]} onPress={onSurahPress} />;
      }
    },
    [getColorForSurah, onSurahPress],
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

  const keyExtractor = useCallback(
    (item: Surah[], index: number) =>
      `row-${index}-${item.map(s => s.id).join('-')}`,
    [],
  );

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
});
