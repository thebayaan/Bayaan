import React, {useMemo, useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {SurahCard} from './cards/SurahCard';
import {SurahItem} from './SurahItem';
import {SURAHS, Surah} from '@/data/surahData';
import Color from 'color';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {Feather} from '@expo/vector-icons';
import {useSettings} from '@/hooks/useSettings';
import {useBottomInset} from '@/hooks/useBottomInset';
// @ai-start
import {buildSurahListItems, type SurahListItem} from '@/utils/surahListItems';
// @ai-end
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ContinueReadingHero} from '@/components/hero/ContinueReadingHero';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {computeGridLayout} from '@/utils/gridLayout';
// @ai-start
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import {ReciterViewMenu} from '@/components/reciter-profile/components/ReciterViewMenu';
import {CollectionSearchField} from '@/components/collection/CollectionScreenHeader';
import {
  PANEL_MARGIN,
  PANEL_ROW_PADDING,
  PanelRow,
} from '@/components/collection/CollectionPanel';
import {
  GROUPED_HEADER_GAP,
  GROUPED_SECTION_GAP,
  groupedHeaderStyle,
} from '@/components/settings/SettingsList';
import {matchesQuery} from '@/utils/collectionSearch';
// @ai-end
// @ai-end

interface SurahsViewProps {
  onSurahPress: (surah: Surah) => void;
  onSurahLongPress?: (surah: Surah) => void;
}

type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation';

type FlatItem = SurahListItem; // @ai

// @ai-start
// Tablet card grid: as many phone-sized cards as the pane fits. The list
// view flows into columns at least TABLET_MIN_LIST_COLUMN_WIDTH wide, two on
// every iPad in portrait (mockup N5, ipad-standards §5.3).
const TABLET_GRID_PADDING = moderateScale(16);
const TABLET_GRID_GAP = moderateScale(12);
const TABLET_MIN_CARD_WIDTH = moderateScale(150);
const TABLET_LIST_GAP = 24;
const TABLET_MIN_LIST_COLUMN_WIDTH = 300;
// Rows bring their own 12pt start padding, so this lines a row's content up
// with the juz header, as on phones.
const TABLET_LIST_PADDING = moderateScale(4);
// @ai-end

// @ai-start
export default function SurahsView({
  onSurahPress,
  onSurahLongPress,
}: SurahsViewProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common', 'reader']);
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const {isTablet, width: windowWidth} = useResponsive();
  // Size the tablet grid from its own container (the pane beside the
  // sidebar). The window width is only a first guess until onLayout reports.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setContainerWidth(prev => (prev === next ? prev : next));
  }, []);

  // Persisted settings
  const viewMode = useSettings(state => state.browseViewMode);
  const setBrowseViewMode = useSettings(state => state.setBrowseViewMode);
  const sortOption = useSettings(state => state.browseSortOption);
  const setBrowseSortOption = useSettings(state => state.setBrowseSortOption);

  // @ai-start: search is a button; tapping it swaps the top for a field.
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const stopSearching = useCallback(() => {
    setSearching(false);
    setQuery('');
  }, []);
  // @ai-end

  const sortedSurahs = useMemo(() => {
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

  // @ai-start
  const displaySurahs = useMemo(
    () =>
      searching && query.trim()
        ? sortedSurahs.filter(surah =>
            matchesQuery(query, [
              surah.id,
              surah.name,
              surah.name_arabic,
              surah.translated_name_english,
            ]),
          )
        : sortedSurahs,
    [sortedSurahs, searching, query],
  );
  // @ai-end

  // Phones keep the two-column grid and the one-column list; tablets add
  // columns to both.
  const tabletColumns = useMemo(() => {
    if (!isTablet) {
      return null;
    }
    return computeGridLayout(
      containerWidth ?? windowWidth,
      viewMode === 'card'
        ? {
            minCardWidth: TABLET_MIN_CARD_WIDTH,
            horizontalPadding: TABLET_GRID_PADDING,
            gap: TABLET_GRID_GAP,
            minColumns: 2,
          }
        : {
            minCardWidth: TABLET_MIN_LIST_COLUMN_WIDTH,
            horizontalPadding: TABLET_LIST_PADDING,
            gap: TABLET_LIST_GAP,
          },
    );
  }, [isTablet, viewMode, containerWidth, windowWidth]);
  const numColumns = tabletColumns?.numColumns ?? (viewMode === 'card' ? 2 : 1);

  // Build flat data array + sticky header indices
  const {items: data, stickyIndices} = useMemo(
    () =>
      buildSurahListItems(displaySurahs, {
        viewMode,
        numColumns,
        juzHeaders:
          !(searching && query.trim()) && // @ai: results run on, ungrouped
          (sortOption === 'asc' || sortOption === 'desc'),
      }),
    [displaySurahs, viewMode, sortOption, numColumns, searching, query],
  );

  // @ai-start
  // Phone list: each juz is one inset panel in the Settings look, as on the
  // reciter page. Where a row sits in its panel decides its corners.
  const panels = !tabletColumns && viewMode === 'list';
  const panelEdges = useMemo(() => {
    const edges = new Map<string, {first: boolean; last: boolean}>();
    if (!panels) return edges;
    data.forEach((item, i) => {
      if (item.type !== 'surah-row') return;
      edges.set(item.key, {
        first: i === 0 || data[i - 1].type !== 'surah-row',
        last: i === data.length - 1 || data[i + 1].type !== 'surah-row',
      });
    });
    return edges;
  }, [data, panels]);
  // @ai-end

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

  const juzLabel = useCallback(
    (juz: number) =>
      juz === 30 ? t('juz.amma') : t('common:labels.juzNumber', {number: juz}),
    [t],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<FlatItem>) => {
      if (item.type === 'juz-header') {
        // @ai-start
        if (panels) {
          return (
            <Text
              style={[groupedHeaderStyle(theme), styles.panelJuzHeader]}
              accessibilityRole="header">
              {juzLabel(item.juz)}
            </Text>
          );
        }
        // @ai-end
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
              {juzLabel(item.juz)}
            </Text>
          </View>
        );
      }

      const surahs = item.surahs;
      if (viewMode === 'card') {
        const cardStyle = tabletColumns
          ? {width: tabletColumns.itemWidth}
          : styles.surahCard;
        return (
          <View style={[styles.cardRow, tabletColumns && styles.tabletCardRow]}>
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
                style={cardStyle}
              />
            ))}
            {!tabletColumns && surahs.length === 1 && (
              <View style={styles.surahCard} />
            )}
          </View>
        );
      }

      if (tabletColumns) {
        return (
          <View style={styles.tabletListRow}>
            {surahs.map((surah, index) => (
              <View key={surah.id} style={{width: tabletColumns.itemWidth}}>
                {item.juzStarts && (
                  // Every cell in the row keeps the label line, so the
                  // surahs stay level.
                  <Text
                    style={[
                      styles.juzHeaderText,
                      styles.tabletJuzLabel,
                      {color: theme.colors.textSecondary},
                    ]}>
                    {item.juzStarts[index] != null
                      ? juzLabel(item.juzStarts[index])
                      : ' '}
                  </Text>
                )}
                <SurahItem
                  pressAction="read"
                  item={surah}
                  onPress={onSurahPress}
                  onLongPress={onSurahLongPress}
                />
              </View>
            ))}
          </View>
        );
      }

      // @ai-start
      if (panels) {
        const edge = panelEdges.get(item.key);
        return (
          <PanelRow first={edge?.first ?? true} last={edge?.last ?? true}>
            <SurahItem
              pressAction="read"
              item={surahs[0]}
              onPress={onSurahPress}
              onLongPress={onSurahLongPress}
              panel
            />
          </PanelRow>
        );
      }
      // @ai-end
      return (
        <SurahItem
          pressAction="read" // @ai
          item={surahs[0]}
          onPress={onSurahPress}
          onLongPress={onSurahLongPress}
        />
      );
    },
    [
      viewMode,
      tabletColumns,
      getColorForSurah,
      onSurahPress,
      onSurahLongPress,
      theme,
      juzLabel,
      panels,
      panelEdges,
    ],
  );

  const ListHeader = useMemo(
    () =>
      // @ai-start
      searching ? (
        <CollectionSearchField
          value={query}
          onChangeText={setQuery}
          onCancel={stopSearching}
          placeholder={t('reader:mushaf.searchSurahs')}
          resultLabel={
            query.trim() && displaySurahs.length === 0
              ? t('common:status.noResults')
              : undefined
          }
          style={styles.searchField}
        />
      ) : nativeMenusAvailable ? (
        <View>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => setSearching(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common:actions.search')}>
              <Feather
                name="search"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            </Pressable>
            <ReciterViewMenu
              viewMode={viewMode}
              sortOption={sortOption}
              onViewModeChange={setBrowseViewMode}
              onSortChange={changeSortOption}
            />
          </View>
          <View style={styles.heroContainer}>
            <ContinueReadingHero onSurahLongPress={onSurahLongPress} />
          </View>
          <View style={styles.panelTopGap} />
        </View>
      ) : (
        // @ai-end
        <View>
          <View style={styles.heroContainer}>
            <ContinueReadingHero onSurahLongPress={onSurahLongPress} />
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
                  option === 'asc'
                    ? t('sort.asc')
                    : option === 'desc'
                      ? t('sort.desc')
                      : t('sort.revelation');
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
                        isActive
                          ? theme.colors.text
                          : theme.colors.textSecondary
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

            <View style={styles.barActions}>
              <Pressable
                style={styles.viewModeButton}
                onPress={() => setSearching(true)}
                accessibilityRole="button"
                accessibilityLabel={t('common:actions.search')}>
                <Feather
                  name="search"
                  size={moderateScale(16)}
                  color={theme.colors.text}
                />
              </Pressable>
              <Pressable style={styles.viewModeButton} onPress={toggleViewMode}>
                <Feather
                  name={viewMode === 'card' ? 'list' : 'grid'}
                  size={moderateScale(16)}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>
          </View>
        </View>
      ),
    [
      searching,
      query,
      stopSearching,
      displaySurahs.length,
      setBrowseViewMode,
      onSurahLongPress,
      sortOption,
      viewMode,
      theme.colors,
      changeSortOption,
      toggleViewMode,
      t,
    ],
  );

  const keyExtractor = useCallback((item: FlatItem) => item.key, []);

  const getItemType = useCallback((item: FlatItem) => item.type, []);

  // iOS with NativeTabs: automatic content insets handle top/bottom
  // Android / older iOS: manual padding needed
  const contentPadding = USE_GLASS
    ? undefined
    : {paddingTop: insets.top, paddingBottom: bottomInset};

  return (
    <View
      style={styles.container}
      onLayout={isTablet ? handleLayout : undefined}>
      <FlashList
        data={data}
        extraData={tabletColumns}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        stickyHeaderIndices={panels ? undefined : stickyIndices} // @ai
        keyboardShouldPersistTaps="handled" // @ai
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentPadding}
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        drawDistance={moderateScale(300)}
      />
    </View>
  );
}
// @ai-end

// @ai-start
const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  // @ai-start
  barActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: moderateScale(20),
    paddingHorizontal: moderateScale(22),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(8),
  },
  searchField: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(12),
  },
  panelTopGap: {height: moderateScale(4)},
  panelJuzHeader: {
    paddingHorizontal: PANEL_MARGIN + PANEL_ROW_PADDING,
    paddingTop: GROUPED_SECTION_GAP,
    paddingBottom: GROUPED_HEADER_GAP,
  },
  // @ai-end
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(12),
  },
  surahCard: {
    width: '48%',
  },
  tabletCardRow: {
    justifyContent: 'flex-start',
    gap: TABLET_GRID_GAP,
  },
  tabletListRow: {
    flexDirection: 'row',
    gap: TABLET_LIST_GAP,
    paddingHorizontal: TABLET_LIST_PADDING,
  },
  juzHeader: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(14),
    paddingBottom: moderateScale(6),
  },
  // Lines the label up with the surah text, which SurahItem pads 12pt.
  tabletJuzLabel: {
    paddingHorizontal: moderateScale(12),
    paddingTop: moderateScale(14),
    paddingBottom: moderateScale(2),
  },
  juzHeaderText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: latinLetterSpacing(0.8),
  },
});
// @ai-end
