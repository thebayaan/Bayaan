import React, {useState, useMemo, useCallback} from 'react';
import {View, FlatList, TouchableOpacity, Text} from 'react-native';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {
  moderateScale,
  verticalScale,
  ScaledSheet,
} from 'react-native-size-matters';
import {SURAHS, Surah} from '@/data/surahData';
import {SurahCard} from '@/components/cards/SurahCard';
import {SurahItem} from '@/components/SurahItem';
import Header from '@/components/Header';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import Animated, {FadeIn} from 'react-native-reanimated';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {useModal} from '@/components/providers/ModalProvider';
import {GRADIENT_COLORS} from '@/utils/gradientColors';

// Define types for clarity, matching the ones in useSettings
type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation';

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
    optionsRow: {
      height: moderateScale(40),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      marginHorizontal: moderateScale(16),
      borderRadius: moderateScale(8),
      marginBottom: moderateScale(2), // Reduced from 5 to 2
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
  });
};

export default function BrowseAllSurahsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {showSelectReciter} = useModal();
  // Retrieve persisted settings
  const browseViewModeSetting = useSettings(state => state.browseViewMode);
  const setBrowseViewModeSetting = useSettings(
    state => state.setBrowseViewMode,
  );
  const browseSortOptionSetting = useSettings(state => state.browseSortOption);
  const setBrowseSortOptionSetting = useSettings(
    state => state.setBrowseSortOption,
  );

  // Define styles *before* callbacks that use them
  const styles = useStyles();
  const {theme} = useTheme(); // Keep theme for options row styling

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

  const handleBack = () => {
    router.back();
  };

  // Function to generate a consistent color for each surah
  const getColorForSurah = useCallback((id: number): string => {
    return GRADIENT_COLORS[id % GRADIENT_COLORS.length];
  }, []);

  const handleSurahPress = useCallback(
    (surah: Surah) => {
      // For consistency and immediate feedback, always use showSelectReciter directly
      // if askEveryTime is true
      if (askEveryTime) {
        showSelectReciter(surah.id.toString(), 'home');
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
            router.push({
              pathname: '/player',
              params: {reciterImageUrl: defaultReciter.image_url},
            });
          } else {
            showSelectReciter(surah.id.toString(), 'home');
          }
          break;
        default:
          showSelectReciter(surah.id.toString(), 'home');
      }
    },
    [
      askEveryTime,
      defaultReciterSelection,
      defaultReciter,
      router,
      showSelectReciter,
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

  // Render a list item using SurahItem
  const renderListItem = useCallback(
    ({item}: {item: Surah}) => (
      <SurahItem item={item} onPress={handleSurahPress} />
    ),
    [handleSurahPress],
  );

  // Sort and view options row
  const renderOptionsRow = () => (
    <Animated.View entering={FadeIn.delay(100)} style={styles.optionsRow}>
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
    </Animated.View>
  );

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header title="All Surahs" onBack={handleBack} showBlur={true} />

      <View
        style={[styles.content, {marginTop: insets.top + moderateScale(56)}]}>
        {renderOptionsRow()}

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
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              contentContainerStyle={[styles.listContent, styles.scrollContent]}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              initialNumToRender={25}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              ItemSeparatorComponent={ItemSeparator}
            />
          </View>

          {/* List View */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'list' && styles.hiddenView,
            ]}>
            <FlatList
              data={displaySurahs}
              renderItem={renderListItem}
              keyExtractor={item => `list-${item.id}`}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              contentContainerStyle={[
                styles.listContent,
                styles.listViewContent,
                styles.scrollContent,
              ]}
              numColumns={1}
              initialNumToRender={25}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              ItemSeparatorComponent={ItemSeparator}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
