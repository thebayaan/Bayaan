import React, {useState, useMemo, useCallback} from 'react';
import {View, FlatList, SectionList, TouchableOpacity, Text} from 'react-native';
import {useRouter} from 'expo-router';
import {
  moderateScale,
  verticalScale,
  ScaledSheet,
} from 'react-native-size-matters';
import {SURAHS, Surah} from '@/data/surahData';
import {SurahCard} from '@/components/cards/SurahCard';
import {SurahItem} from '@/components/SurahItem';
import {JuzSectionHeader} from '@/components/JuzSectionHeader';
import Header from '@/components/Header';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import Animated, {FadeIn} from 'react-native-reanimated';
import {useSettings} from '@/hooks/useSettings';
import {useReciterStore} from '@/store/reciterStore';
import {useModal} from '@/components/providers/ModalProvider';
import {GRADIENT_COLORS} from '@/utils/gradientColors';
import {useReciterSelection} from '@/hooks/useReciterSelection';
import {Theme} from '@/utils/themeUtils';
import {groupSurahsByJuz, JuzSection} from '@/data/juzData';

// Define types for clarity, matching the ones in useSettings
type ViewMode = 'card' | 'list';
type SortOption = 'asc' | 'desc' | 'revelation' | 'juz';

const ItemSeparator = React.memo(() => {
  const styles = useStyles();
  return <View style={styles.listSeparator} />;
});
ItemSeparator.displayName = 'ItemSeparator';

// Card row component for card grid in section list
const CardRow = React.memo(
  ({
    surahs,
    onPress,
    getColorForSurah,
    styles,
  }: {
    surahs: Surah[];
    onPress: (surah: Surah) => void;
    getColorForSurah: (id: number) => string;
    styles: ReturnType<typeof useStyles>;
  }) => (
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
          onPress={() => onPress(surah)}
          style={styles.surahCard}
        />
      ))}
      {/* Add placeholder if odd number of cards */}
      {surahs.length === 1 && <View style={styles.surahCard} />}
    </View>
  ),
);
CardRow.displayName = 'CardRow';

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
      marginTop: moderateScale(4),
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
      marginBottom: moderateScale(2),
    },
    surahsContainer: {
      flex: 1,
      paddingTop: 0,
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
      paddingTop: 0,
    },
    listViewContent: {
      paddingHorizontal: 0,
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: moderateScale(16),
    },
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      marginBottom: moderateScale(16),
    },
    surahCard: {
      width: '48%',
    },
    listSeparator: {
      height: moderateScale(4),
    },
    viewContainer: {
      width: '100%',
      flex: 1,
    },
    hiddenView: {
      display: 'none',
    },
  });
};

interface BrowseSurahsProps {
  theme: Theme;
  onBack: () => void;
}

export default function BrowseSurahs({theme, onBack}: BrowseSurahsProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {askEveryTime, defaultReciterSelection} = useSettings();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const {showSelectReciter} = useModal();
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
    if (sortOption === 'juz') {
      // For juz, sort by ID ascending (grouping is handled separately)
      return result.sort((a, b) => a.id - b.id);
    }

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

  // Group surahs by Juz for juz sort option
  const juzSections = useMemo(() => {
    if (sortOption !== 'juz') return [];
    return groupSurahsByJuz(displaySurahs);
  }, [displaySurahs, sortOption]);

  // Prepare card rows for Juz sections (2 cards per row)
  const juzCardSections = useMemo(() => {
    if (sortOption !== 'juz' || viewMode !== 'card') return [];

    return juzSections.map(section => {
      // Group surahs into rows of 2
      const rows: Surah[][] = [];
      for (let i = 0; i < section.data.length; i += 2) {
        rows.push(section.data.slice(i, i + 2));
      }
      return {
        ...section,
        data: rows,
      };
    });
  }, [juzSections, viewMode, sortOption]);

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
            playWithReciter(defaultReciter, surah.id.toString()).catch(
              error => {
                console.error('Error playing with default reciter:', error);
              },
            );
          } else {
            showSelectReciter(surah.id.toString(), 'home');
          }
          break;
        case 'randomReciter':
          playWithRandomReciter(surah.id.toString()).catch(error => {
            console.error('Error playing with random reciter:', error);
          });
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
      playWithReciter,
      playWithRandomReciter,
    ],
  );

  const toggleViewMode = () => {
    const newMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(newMode);
    setBrowseViewModeSetting(newMode);
  };

  const changeSortOption = (option: SortOption) => {
    setSortOption(option);
    setBrowseSortOptionSetting(option);
  };

  // Render a card item for FlatList
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

  // Render section header for Juz
  const renderSectionHeader = useCallback(
    ({section}: {section: JuzSection<Surah> | JuzSection<Surah[]>}) => (
      <JuzSectionHeader
        juzNumber={section.juzNumber}
        juzName={section.juzName}
        juzArabicName={section.juzArabicName}
        surahCount={
          Array.isArray(section.data[0])
            ? (section.data as Surah[][]).reduce((acc, row) => acc + row.length, 0)
            : section.data.length
        }
      />
    ),
    [],
  );

  // Render card row for SectionList
  const renderCardRow = useCallback(
    ({item}: {item: Surah[]}) => (
      <CardRow
        surahs={item}
        onPress={handleSurahPress}
        getColorForSurah={getColorForSurah}
        styles={styles}
      />
    ),
    [handleSurahPress, getColorForSurah, styles],
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

        <TouchableOpacity
          style={[
            styles.sortButton,
            sortOption === 'juz' && {
              backgroundColor: Color(theme.colors.primary)
                .alpha(0.1)
                .toString(),
            },
          ]}
          activeOpacity={1}
          onPress={() => changeSortOption('juz')}>
          <Icon
            name="layers"
            type="feather"
            size={moderateScale(14)}
            color={
              sortOption === 'juz'
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.sortButtonText,
              {
                color:
                  sortOption === 'juz'
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
              },
            ]}>
            Juz
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

  // Render content based on sort option
  const renderContent = () => {
    // For Juz view, use SectionList
    if (sortOption === 'juz') {
      return (
        <Animated.View
          entering={FadeIn.delay(200)}
          style={styles.surahsContainer}>
          {/* Card View with Juz sections */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'card' && styles.hiddenView,
            ]}>
            <SectionList
              sections={juzCardSections}
              renderItem={renderCardRow}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={(item, index) =>
                `juz-card-row-${item.map(s => s.id).join('-')}-${index}`
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, styles.scrollContent]}
              stickySectionHeadersEnabled={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              ItemSeparatorComponent={ItemSeparator}
            />
          </View>

          {/* List View with Juz sections */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'list' && styles.hiddenView,
            ]}>
            <SectionList
              sections={juzSections}
              renderItem={renderListItem}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={item => `juz-list-${item.id}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                styles.listViewContent,
                styles.scrollContent,
              ]}
              stickySectionHeadersEnabled={false}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              ItemSeparatorComponent={ItemSeparator}
            />
          </View>
        </Animated.View>
      );
    }

    // For other views, use FlatList
    return (
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
    );
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Header title="All Surahs" onBack={onBack} showBlur={true} />

      <View
        style={[styles.content, {marginTop: insets.top + moderateScale(56)}]}>
        {renderOptionsRow()}
        {renderContent()}
      </View>
    </View>
  );
}
