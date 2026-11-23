import React, {useState, useMemo, useCallback, useLayoutEffect} from 'react';
import {View, FlatList, Text, Pressable} from 'react-native';
// @ai-start
import {Stack, useRouter, useNavigation} from 'expo-router';
import {SearchInput} from '@/components/SearchInput';
import {rankSurahs} from '@/utils/search/catalog'; // @ai
// @ai-end
import {moderateScale, verticalScale, ScaledSheet} from '@/utils/scale';
import {SURAHS, Surah} from '@/data/surahData';
import {SurahCard} from '@/components/cards/SurahCard';
import {SurahItem} from '@/components/SurahItem';
import Header from '@/components/Header';
import {Feather} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import Animated, {FadeIn} from 'react-native-reanimated';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {resolveSurahPlaybackAction} from '@/utils/surahPlaybackChoice'; // @ai
import {Theme} from '@/utils/themeUtils';
import {getJuzForSurah, getJuzName} from '@/data/juzData';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {GlassView} from 'expo-glass-effect';
import {
  USE_GLASS,
  useGlassColorScheme,
  useGlassTint, // @ai
} from '@/hooks/useGlassProps';
// @ai-start
import {useTranslation} from 'react-i18next';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
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
import {tintedHeaderRight} from '@/components/TintedHeader';
import {SearchIcon} from '@/components/ActionIcons';
// @ai-end

const isGlass = USE_GLASS;
// iOS with native menus: search is a header button that opens a search mode,
// and view and sort live in one header menu, as on the Collection screens.
const headerControls = isGlass && nativeMenusAvailable;

// Define types for clarity, matching the ones in useSettings
type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation';

// Type for list items - can be either a Juz header or surah
type ListItem =
  | {type: 'juz-header'; juzNumber: number; juzName: string}
  | {type: 'surah'; surah: Surah};

const ItemSeparator = React.memo(() => {
  const styles = useStyles();
  return <View style={styles.listSeparator} />;
});
ItemSeparator.displayName = 'ItemSeparator';

// @ai-start
const useStyles = () => {
  return ScaledSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      marginTop: moderateScale(4), // Reduced from 10 to 4
    },
    scrollContent: {
      paddingBottom: verticalScale(100),
    },
    stickyBarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    optionsRow: {
      height: moderateScale(40),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      marginHorizontal: moderateScale(16),
      borderRadius: moderateScale(8),
      marginBottom: moderateScale(2),
    },
    optionsRowGlass: {
      marginHorizontal: 0,
      backgroundColor: 'transparent',
    },
    glassWrapper: {
      marginHorizontal: moderateScale(10),
      marginVertical: moderateScale(4),
    },
    glassInner: {
      borderRadius: moderateScale(16),
      overflow: 'hidden',
      paddingVertical: moderateScale(4),
    },
    surahsContainer: {
      flex: 1,
      paddingTop: 0, // Removed padding at top of container
    },
    sortOptions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(6),
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(6),
    },
    listContent: {
      paddingHorizontal: moderateScale(16),
      paddingTop: 0, // Removed padding to bring content closer to options row
    },
    listViewContent: {
      paddingHorizontal: 0, // Remove horizontal padding for list view to match SurahItem styling
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: moderateScale(16), // Space between rows in card view
    },
    surahCard: {
      width: '48%', // Allow some space between cards
    },
    listSeparator: {
      height: moderateScale(4),
    },
    viewContainer: {
      width: '100%',
    },
    hiddenView: {
      display: 'none',
    },
    searchField: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(8),
    },
    panelJuzHeader: {
      paddingHorizontal: PANEL_MARGIN + PANEL_ROW_PADDING,
      paddingTop: GROUPED_SECTION_GAP,
      paddingBottom: GROUPED_HEADER_GAP,
    },
    panelTopGap: {height: moderateScale(8)},
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(20),
      paddingHorizontal: moderateScale(6),
    },
  });
};
// @ai-end

interface BrowseSurahsProps {
  theme: Theme;
  onBack: () => void;
}

// @ai-start
export default function BrowseSurahs({theme, onBack}: BrowseSurahsProps) {
  const router = useRouter();
  const {t} = useTranslation(['home', 'common']);
  const navigation = useNavigation();
  const glassColorScheme = useGlassColorScheme();
  const glassTint = useGlassTint(); // @ai
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const iosHeaderHeight = isGlass ? headerHeight : 0;
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {playWithReciter, playWithRandomReciter} = useReciterSelection();
  // Retrieve persisted settings
  const browseViewModeSetting = useSettings(state => state.browseViewMode);
  const setBrowseViewModeSetting = useSettings(
    state => state.setBrowseViewMode,
  );
  const browseSortOptionSetting = useSettings(state => state.browseSortOption);
  const setBrowseSortOptionSetting = useSettings(
    state => state.setBrowseSortOption,
  );

  // iOS: set native header title
  const headerMenu = (
    <ReciterViewMenu
      viewMode={browseViewModeSetting}
      sortOption={browseSortOptionSetting}
      onViewModeChange={mode => {
        setViewMode(mode);
        setBrowseViewModeSetting(mode);
      }}
      onSortChange={option => {
        setSortOption(option);
        setBrowseSortOptionSetting(option);
      }}
    />
  );
  useLayoutEffect(() => {
    if (!isGlass) return;
    navigation.setOptions({
      headerTitle: t('browse.allSurahs'),
      ...(headerControls
        ? tintedHeaderRight(
            searching
              ? undefined
              : () => (
                  <View style={styles.headerActions}>
                    <Pressable
                      onPress={() => setSearching(true)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('common:actions.search')}>
                      <SearchIcon
                        size={moderateScale(20)}
                        color={theme.colors.text}
                      />
                    </Pressable>
                    {headerMenu}
                  </View>
                ),
          )
        : {}),
    });
  });

  // Define styles *before* callbacks that use them
  const styles = useStyles();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const stopSearching = useCallback(() => {
    setSearching(false);
    setSearchQuery('');
  }, []);
  // Initialize local state from persisted settings
  const [viewMode, setViewMode] = useState<ViewMode>(browseViewModeSetting);
  const [sortOption, setSortOption] = useState<SortOption>(
    browseSortOptionSetting,
  );

  // Filter and sort surahs
  // @ai-start
  const isSearching = searchQuery.trim().length > 0;
  const displaySurahs = useMemo(() => {
    // A query ranks by relevance; the sort option applies to the full list.
    if (isSearching) return [...rankSurahs(searchQuery)];
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
  }, [isSearching, searchQuery, sortOption]);
  // @ai-end

  // Prepare list data with Juz headers (only for list view with asc/desc sort)
  const listDataWithJuzHeaders = useMemo(() => {
    // Juz headers assume mushaf order, which ranked results don't have.
    const shouldShowJuzHeaders =
      !isSearching && // @ai
      viewMode === 'list' &&
      (sortOption === 'asc' || sortOption === 'desc');

    if (!shouldShowJuzHeaders) {
      // No Juz headers - just return surahs as ListItems
      return displaySurahs.map(surah => ({
        type: 'surah' as const,
        surah,
      }));
    }

    // Add Juz headers when Juz changes
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
          juzName:
            surahJuz === 30
              ? t('juz.amma')
              : t('common:labels.juzNumber', {number: surahJuz}),
        });
      }

      // Add the surah
      data.push({
        type: 'surah',
        surah,
      });
    });

    return data;
  }, [displaySurahs, isSearching, viewMode, sortOption, t]); // @ai

  // The list groups each juz into one inset panel in the Settings look; a
  // row's place in its panel decides its corners.
  const panelEdges = useMemo(
    () =>
      listDataWithJuzHeaders.map((item, i, all) =>
        item.type !== 'surah'
          ? undefined
          : {
              first: i === 0 || all[i - 1].type !== 'surah',
              last: i === all.length - 1 || all[i + 1].type !== 'surah',
            },
      ),
    [listDataWithJuzHeaders],
  );

  // Function to generate a consistent color for each surah
  const getColorForSurah = useCallback((id: number): string => {
    return GRADIENT_COLORS[id % GRADIENT_COLORS.length];
  }, []);

  const handleSurahPress = useCallback(
    (surah: Surah) => {
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
            pathname: './reciter/browse',
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
          showSheet('select-reciter', {payload: {surahId}});
      }
      // @ai-end
    },
    [
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      router,
      playWithReciter,
      playWithRandomReciter,
    ],
  );

  const toggleViewMode = () => {
    const newMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(newMode);
    setBrowseViewModeSetting(newMode); // Persist the change
  };

  const changeSortOption = (option: SortOption) => {
    setSortOption(option);
    setBrowseSortOptionSetting(option); // Persist the change
  };

  // Render a card item
  const renderCardItem = useCallback(
    ({item}: {item: Surah}) => (
      <SurahCard
        id={item.id}
        name={item.name}
        translatedName={item.translated_name_english}
        versesCount={item.verses_count}
        revelationPlace={item.revelation_place}
        color={getColorForSurah(item.id)}
        onPress={() => handleSurahPress(item)}
        style={styles.surahCard}
      />
    ),
    [getColorForSurah, handleSurahPress, styles.surahCard],
  );

  // Render a list item (either Juz header or SurahItem)
  const renderListItem = useCallback(
    ({item, index}: {item: ListItem; index: number}) => {
      if (item.type === 'juz-header') {
        return (
          <Text
            style={[groupedHeaderStyle(theme), styles.panelJuzHeader]}
            accessibilityRole="header">
            {item.juzName}
          </Text>
        );
      }
      const edge = panelEdges[index];
      return (
        <PanelRow first={edge?.first ?? true} last={edge?.last ?? true}>
          <SurahItem item={item.surah} onPress={handleSurahPress} panel />
        </PanelRow>
      );
    },
    [handleSurahPress, styles, theme, panelEdges],
  );

  // Inner controls content (shared between glass and non-glass)
  const controlsContent = (
    <View style={[styles.optionsRow, USE_GLASS && styles.optionsRowGlass]}>
      {/* Sort options */}
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
                    .alpha(0.08)
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

      {/* View mode toggle */}
      <Pressable style={styles.viewModeButton} onPress={toggleViewMode}>
        <Feather
          name={viewMode === 'card' ? 'list' : 'grid'}
          size={moderateScale(16)}
          color={theme.colors.text}
        />
      </Pressable>
    </View>
  );

  // Options row: wrapped in GlassView on iOS, plain on Android
  const renderOptionsRow = () => {
    if (USE_GLASS) {
      return (
        <View style={styles.glassWrapper}>
          <GlassView
            style={styles.glassInner}
            colorScheme={glassColorScheme}
            tintColor={glassTint}>
            {controlsContent}
          </GlassView>
        </View>
      );
    }
    return controlsContent;
  };

  // Sticky bar height for iOS content offset
  const stickyBarTotalHeight = USE_GLASS
    ? moderateScale(40 + 4 + 8 + 8) // optionsRow + glassInner padding + glassWrapper margin
    : moderateScale(40 + 4); // optionsRow + margin

  const flatListProps = {
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    scrollEnabled: true,
    initialNumToRender: 25,
    maxToRenderPerBatch: 10,
    windowSize: 5,
    removeClippedSubviews: true,
    ItemSeparatorComponent: ItemSeparator,
  };

  // iOS search mode: the field sits at the top of the list, under the header.
  const listHeader = !headerControls ? undefined : searching ? (
    <CollectionSearchField
      value={searchQuery}
      onChangeText={setSearchQuery}
      onCancel={stopSearching}
      placeholder={t('browse.searchSurahs')}
      resultLabel={
        isSearching && displaySurahs.length === 0
          ? t('common:status.noResults')
          : undefined
      }
      style={styles.searchField}
    />
  ) : (
    <View style={styles.panelTopGap} />
  );

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {isGlass && !headerControls && (
        <Stack.SearchBar
          placeholder={t('browse.searchSurahs')}
          onChangeText={event => setSearchQuery(event.nativeEvent.text)}
          onCancelButtonPress={() => setSearchQuery('')}
          onClose={() => setSearchQuery('')}
          hideWhenScrolling={false}
        />
      )}
      {/* Android: custom header | iOS: native header via layout */}
      {!isGlass && (
        <Header title={t('browse.allSurahs')} onBack={onBack} showBlur={true} />
      )}

      <View
        style={[
          styles.content,
          !isGlass && {marginTop: insets.top + moderateScale(56)},
        ]}>
        {!isGlass && (
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('browse.searchSurahs')}
            showCancelButton={false}
            iconColor={theme.colors.text}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
            borderColor={Color(theme.colors.text).alpha(0.06).toString()}
          />
        )}
        {/* Android: inline options row (normal flow) */}
        {!isGlass && renderOptionsRow()}

        {/* iOS: floating sticky options bar below native header */}
        {isGlass && !headerControls && (
          <View style={[styles.stickyBarContainer, {top: iosHeaderHeight}]}>
            {renderOptionsRow()}
          </View>
        )}

        <Animated.View
          entering={FadeIn.delay(200)}
          style={styles.surahsContainer}>
          {/* Card View */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'card' && styles.hiddenView,
            ]}>
            <FlatList
              data={displaySurahs}
              renderItem={renderCardItem}
              keyExtractor={item => `card-${item.id}`}
              contentInsetAdjustmentBehavior={isGlass ? 'automatic' : 'never'}
              contentContainerStyle={[
                styles.listContent,
                styles.scrollContent,
                isGlass &&
                  !headerControls && {paddingTop: stickyBarTotalHeight},
              ]}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              ListHeaderComponent={listHeader}
              {...flatListProps}
            />
          </View>

          {/* List View */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'list' && styles.hiddenView,
            ]}>
            <FlatList
              data={listDataWithJuzHeaders}
              renderItem={renderListItem}
              keyExtractor={(item, index) =>
                item.type === 'juz-header'
                  ? `juz-${item.juzNumber}`
                  : `list-${item.surah.id}-${index}`
              }
              contentInsetAdjustmentBehavior={isGlass ? 'automatic' : 'never'}
              contentContainerStyle={[
                styles.listContent,
                styles.listViewContent,
                styles.scrollContent,
                isGlass &&
                  !headerControls && {paddingTop: stickyBarTotalHeight},
              ]}
              numColumns={1}
              {...flatListProps}
              ListHeaderComponent={listHeader}
              ItemSeparatorComponent={undefined}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
// @ai-end
