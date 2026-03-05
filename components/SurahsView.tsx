import React, {useMemo, useCallback} from 'react';
import {View, Text, StyleSheet, Pressable} from 'react-native';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {SurahCard} from './cards/SurahCard';
import {SurahItem} from './SurahItem';
import {SURAHS, Surah} from '@/data/surahData';
import Color from 'color';
import {SurahsHero} from '@/components/hero/SurahsHero';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {Feather} from '@expo/vector-icons';
import {useSettings} from '@/hooks/useSettings';
import {TOTAL_BOTTOM_PADDING} from '@/utils/constants';
import {getJuzForSurah, getJuzName} from '@/data/juzData';

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
  onSurahLongPress?: (surah: Surah) => void;
}

type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation';

type FlatItem =
  | {type: 'juz-header'; juzName: string; key: string}
  | {type: 'surah-row'; surahs: Surah[]; key: string};

function getSurahOfTheDay(): Surah {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
  );
  const surahIndex = dayOfYear % 114;
  return SURAHS[surahIndex];
}

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

export default function SurahsView({
  onSurahPress,
  onSurahLongPress,
}: SurahsViewProps) {
  const {theme} = useTheme();

  const surahOfTheDay = useMemo(() => getSurahOfTheDay(), []);

  // Persisted settings
  const viewMode = useSettings(state => state.browseViewMode);
  const setBrowseViewMode = useSettings(state => state.setBrowseViewMode);
  const sortOption = useSettings(state => state.browseSortOption);
  const setBrowseSortOption = useSettings(state => state.setBrowseSortOption);

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

  // Build flat data array + sticky header indices
  const {data, stickyIndices} = useMemo(() => {
    const items: FlatItem[] = [];
    const stickies: number[] = [];
    const showJuzHeaders =
      viewMode === 'list' && (sortOption === 'asc' || sortOption === 'desc');

    if (viewMode === 'card') {
      const pairs = groupSurahsIntoPairs(displaySurahs);
      for (const pair of pairs) {
        items.push({
          type: 'surah-row',
          surahs: pair,
          key: `card-${pair.map(s => s.id).join('-')}`,
        });
      }
    } else if (showJuzHeaders) {
      let currentJuz: number | null = null;
      for (const surah of displaySurahs) {
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
        items.push({
          type: 'surah-row',
          surahs: [surah],
          key: `surah-${surah.id}`,
        });
      }
    } else {
      for (const surah of displaySurahs) {
        items.push({
          type: 'surah-row',
          surahs: [surah],
          key: `surah-${surah.id}`,
        });
      }
    }

    return {data: items, stickyIndices: stickies};
  }, [displaySurahs, viewMode, sortOption]);

  const getColorForSurah = useCallback((id: number): string => {
    return GRADIENT_COLORS[id % GRADIENT_COLORS.length];
  }, []);

  const toggleViewMode = useCallback(() => {
    setBrowseViewMode(viewMode === 'card' ? 'list' : 'card');
  }, [viewMode, setBrowseViewMode]);

  const changeSortOption = useCallback(
    (option: SortOption) => {
      setBrowseSortOption(option);
    },
    [setBrowseSortOption],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<FlatItem>) => {
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

      const surahs = item.surahs;
      if (viewMode === 'card') {
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
                onLongPress={
                  onSurahLongPress ? () => onSurahLongPress(surah) : undefined
                }
                style={styles.surahCard}
              />
            ))}
            {surahs.length === 1 && <View style={styles.surahCard} />}
          </View>
        );
      }

      return (
        <SurahItem
          item={surahs[0]}
          onPress={onSurahPress}
          onLongPress={onSurahLongPress}
        />
      );
    },
    [
      viewMode,
      getColorForSurah,
      onSurahPress,
      onSurahLongPress,
      theme.colors.background,
      theme.colors.textSecondary,
    ],
  );

  const ListHeader = useMemo(
    () => (
      <View>
        <View style={styles.heroContainer}>
          <SurahsHero
            surahOfTheDay={surahOfTheDay}
            onSurahPress={onSurahPress}
            onSurahLongPress={onSurahLongPress}
          />
        </View>

        <View style={styles.optionsBar}>
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

          <Pressable style={styles.viewModeButton} onPress={toggleViewMode}>
            <Feather
              name={viewMode === 'card' ? 'list' : 'grid'}
              size={moderateScale(16)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      </View>
    ),
    [
      surahOfTheDay,
      onSurahPress,
      onSurahLongPress,
      sortOption,
      viewMode,
      theme.colors,
      changeSortOption,
      toggleViewMode,
    ],
  );

  const keyExtractor = useCallback((item: FlatItem) => item.key, []);

  const getItemType = useCallback((item: FlatItem) => item.type, []);

  return (
    <View style={styles.container}>
      <FlashList
        data={data}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        stickyHeaderIndices={stickyIndices}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.contentContainer}
        drawDistance={moderateScale(300)}
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
  optionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(12),
    paddingHorizontal: moderateScale(16),
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
    paddingBottom: moderateScale(12),
  },
  surahCard: {
    width: '48%',
  },
  juzHeader: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(14),
    paddingBottom: moderateScale(6),
  },
  juzHeaderText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
