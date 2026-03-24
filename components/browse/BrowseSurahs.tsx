import React, {useState, useMemo, useCallback, useLayoutEffect} from 'react';
import {View, FlatList, Text, Pressable} from 'react-native';
import {useRouter, useNavigation} from 'expo-router';
import {
  moderateScale,
  verticalScale,
  ScaledSheet,
} from 'react-native-size-matters';
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
import {SheetManager} from 'react-native-actions-sheet';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {Theme} from '@/utils/themeUtils';
import {getJuzForSurah, getJuzName} from '@/data/juzData';
import {useHeaderHeight} from '@react-navigation/elements';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';

const isGlass = USE_GLASS;

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
};

interface BrowseSurahsProps {
  theme: Theme;
  onBack: () => void;
}

export default function BrowseSurahs({theme, onBack}: BrowseSurahsProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const glassColorScheme = useGlassColorScheme();
  const insets = useSafeAreaInsets();
  const iosHeaderHeight = isGlass ? useHeaderHeight() : 0;
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
  useLayoutEffect(() => {
    if (!isGlass) return;
    navigation.setOptions({
      headerTitle: 'All Surahs',
    });
  }, [navigation]);

  // Define styles *before* callbacks that use them
  const styles = useStyles();

  const [searchQuery] = useState('');
  // Initialize local state from persisted settings
  const [viewMode, setViewMode] = useState<ViewMode>(browseViewModeSetting);
  const [sortOption, setSortOption] = useState<SortOption>(
    browseSortOptionSetting,
  );

  // Filter and sort surahs
  const displaySurahs = useMemo(() => {
    // First filter based on search query
    const result = searchQuery.trim()
      ? SURAHS.filter(
          surah =>
            surah.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            surah.translated_name_english
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        )
      : [...SURAHS];

    // Then sort based on selected option
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
  }, [searchQuery, sortOption]);

  // Prepare list data with Juz headers (only for list view with asc/desc sort)
  const listDataWithJuzHeaders = useMemo(() => {
    const shouldShowJuzHeaders =
      viewMode === 'list' && (sortOption === 'asc' || sortOption === 'desc');

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
          juzName: getJuzName(surahJuz),
        });
      }

      // Add the surah
      data.push({
        type: 'surah',
        surah,
      });
    });

    return data;
  }, [displaySurahs, viewMode, sortOption]);

  // Function to generate a consistent color for each surah
  const getColorForSurah = useCallback((id: number): string => {
    return GRADIENT_COLORS[id % GRADIENT_COLORS.length];
  }, []);

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      // For consistency and immediate feedback, always show select reciter sheet
      // if askEveryTime is true
      if (askEveryTime) {
        SheetManager.show('select-reciter', {
          payload: {surahId: surah.id.toString(), source: 'home'},
        });
        return;
      }

      // Otherwise check the various conditions
      switch (defaultReciterSelection) {
        case 'browseAll':
          router.push({
            pathname: './reciter/browse',
            params: {view: 'all', surahId: surah.id},
          });
          break;
        case 'searchFavorites':
          router.push({
            pathname: './reciter/browse',
            params: {view: 'favorites', surahId: surah.id},
          });
          break;
        case 'useDefault':
          if (defaultReciter) {
            playWithReciter(defaultReciter, surah.id.toString()).catch(
              error => {
                console.error('Error playing with default reciter:', error);
              },
            );
          } else {
            SheetManager.show('select-reciter', {
              payload: {surahId: surah.id.toString(), source: 'home'},
            });
          }
          break;
        case 'randomReciter':
          playWithRandomReciter(surah.id.toString()).catch(error => {
            console.error('Error playing with random reciter:', error);
          });
          break;
        default:
          SheetManager.show('select-reciter', {
            payload: {surahId: surah.id.toString(), source: 'home'},
          });
      }
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
    ({item}: {item: ListItem}) => {
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
    [handleSurahPress, styles, theme.colors],
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
            option === 'asc' ? 'Asc' : option === 'desc' ? 'Desc' : 'Rev';
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
          <GlassView style={styles.glassInner} colorScheme={glassColorScheme}>
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
    showsVerticalScrollIndicator: false,
    scrollEnabled: true,
    initialNumToRender: 25,
    maxToRenderPerBatch: 10,
    windowSize: 5,
    removeClippedSubviews: true,
    ItemSeparatorComponent: ItemSeparator,
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* Android: custom header | iOS: native header via layout */}
      {!isGlass && <Header title="All Surahs" onBack={onBack} showBlur={true} />}

      <View
        style={[
          styles.content,
          !isGlass && {marginTop: insets.top + moderateScale(56)},
        ]}>
        {/* Android: inline options row (normal flow) */}
        {!isGlass && renderOptionsRow()}

        {/* iOS: floating sticky options bar below native header */}
        {isGlass && (
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
                isGlass && {paddingTop: stickyBarTotalHeight},
              ]}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
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
                isGlass && {paddingTop: stickyBarTotalHeight},
              ]}
              numColumns={1}
              {...flatListProps}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
