import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Icon} from '@rneui/base';
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import {RECITERS, Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import BrowseGrid from './BrowseGrid';
import FilterModal, {FilterOptions} from './FilterModal';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {getFeaturedReciters} from '@/data/featuredReciters';
import {useRouter} from 'expo-router';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {createTracksForReciter} from '@/utils/track';
import {QueueContext} from '@/services/queue/QueueContext';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {getSurahById} from '@/services/dataService';

interface BrowseRecitersProps {
  theme: Theme;
  onBack: () => void;
  surahId?: number; // Optional surah ID for filtering
  title?: string; // Optional custom title, defaults to "Browse All"
}

// Get unique teacher names from rewayat names
const getTeacherNames = (): string[] => {
  const teachers = new Set<string>();

  RECITERS.forEach(reciter => {
    reciter.rewayat.forEach(rewaya => {
      if (rewaya.name) {
        const parts = rewaya.name.split("A'n");
        if (parts.length > 1) {
          const teacherName = parts[0].trim();
          teachers.add(teacherName);
        }
      }
    });
  });

  return ['All', ...Array.from(teachers).sort()];
};

// Get filter options for the chips
const getFilterOptions = (): {label: string}[] => {
  return getTeacherNames().map(teacher => ({
    label: teacher,
  }));
};

export default function BrowseReciters({
  theme,
  onBack,
  surahId,
  title = 'Browse All',
}: BrowseRecitersProps) {
  const router = useRouter();
  const {updateQueue, play} = useUnifiedPlayer();
  const queueContext = QueueContext.getInstance();
  const {addRecentTrack} = useRecentlyPlayedStore();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterOptions>({
    styles: [],
    rewayat: [],
    sortBy: 'featured',
  });
  const {favoriteReciters} = useFavoriteReciters();

  const filterOptions = useMemo(() => getFilterOptions(), []);

  // Apply all filters including search and surah availability
  const filteredReciters = useMemo(() => {
    let result = [...RECITERS];

    // Filter by surah availability if surahId is provided
    if (surahId) {
      result = result.filter(reciter => {
        return reciter.rewayat.some(rewaya =>
          rewaya.surah_list?.includes(surahId),
        );
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(reciter => {
        if (reciter.name.toLowerCase().includes(query)) return true;
        return reciter.rewayat.some(rewaya =>
          rewaya.name?.toLowerCase().includes(query),
        );
      });
    }

    // Apply teacher filter
    if (activeFilter !== 'All') {
      result = result.filter(reciter =>
        reciter.rewayat.some(rewaya => {
          if (!rewaya.name) return false;
          return rewaya.name.startsWith(activeFilter);
        }),
      );
    }

    // Apply advanced filters - styles
    if (advancedFilters.styles.length > 0) {
      result = result.filter(reciter =>
        reciter.rewayat.some(rewaya => {
          if (!rewaya.style) return false;
          return advancedFilters.styles.some(style => {
            if (
              style.toLowerCase() === 'murattal' &&
              rewaya.style.toLowerCase().startsWith('murattal')
            ) {
              return true;
            }
            return rewaya.style.toLowerCase() === style.toLowerCase();
          });
        }),
      );
    }

    // Apply advanced filters - rewayat
    if (advancedFilters.rewayat.length > 0) {
      result = result.filter(reciter =>
        reciter.rewayat.some(rewaya =>
          advancedFilters.rewayat.includes(rewaya.name || ''),
        ),
      );
    }

    // Apply sorting
    if (advancedFilters.sortBy === 'alphabetical') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (advancedFilters.sortBy === 'favorites') {
      const favoriteIds = new Set(favoriteReciters.map(r => r.id));
      result.sort((a, b) => {
        if (favoriteIds.has(a.id) && !favoriteIds.has(b.id)) return -1;
        if (!favoriteIds.has(a.id) && favoriteIds.has(b.id)) return 1;
        return 0;
      });
    } else if (advancedFilters.sortBy === 'featured') {
      const featuredReciters = getFeaturedReciters(20);
      const featuredIds = new Set(featuredReciters.map(r => r.id));
      result.sort((a, b) => {
        if (featuredIds.has(a.id) && !featuredIds.has(b.id)) return -1;
        if (!featuredIds.has(a.id) && featuredIds.has(b.id)) return 1;
        return 0;
      });
    }

    return result;
  }, [activeFilter, advancedFilters, favoriteReciters, searchQuery, surahId]);

  const handleFilterPress = () => {
    setIsFilterModalVisible(true);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
  };

  const handleApplyFilters = (filters: FilterOptions) => {
    setAdvancedFilters(filters);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleClearFilters = () => {
    setActiveFilter('All');
    setSearchQuery('');
    setAdvancedFilters({
      styles: [],
      rewayat: [],
      sortBy: 'featured',
    });
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  const handleSearchCancel = () => {
    setSearchQuery('');
    setIsSearchFocused(false);
    Keyboard.dismiss();
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      advancedFilters.styles.length > 0 ||
      advancedFilters.rewayat.length > 0 ||
      advancedFilters.sortBy !== 'featured' ||
      activeFilter !== 'All' ||
      searchQuery.trim() !== ''
    );
  }, [advancedFilters, activeFilter, searchQuery]);

  const handleReciterPress = useCallback(
    async (reciter: Reciter) => {
      if (surahId) {
        // Case 1: Surah is selected - play the surah with this reciter
        try {
          const surah = await getSurahById(surahId);
          if (!surah) return;

          // Create track for the selected surah
          const tracks = await createTracksForReciter(
            reciter,
            [surah],
            reciter.rewayat[0]?.id,
          );

          // Update queue and start playing
          await updateQueue(tracks, 0);
          await play();

          // Add to recently played list
          await addRecentTrack(reciter, surah, 0, 0);

          // Set current reciter for batch loading
          queueContext.setCurrentReciter(reciter);

          // Navigate back
          router.back();
        } catch (error) {
          console.error('Error playing surah:', error);
        }
      } else {
        // Case 2: Browse all mode - navigate to reciter profile
        router.push({
          pathname: '/(tabs)/(home)/reciter/[id]',
          params: {id: reciter.id},
        });
      }
    },
    [surahId, updateQueue, play, queueContext, router, addRecentTrack],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top}]}>
        <BlurView
          blurAmount={10}
          blurType={theme.isDarkMode ? 'dark' : 'light'}
          style={styles.blurContainer}>
          <View
            style={[
              styles.overlay,
              {
                backgroundColor: theme.colors.background,
              },
            ]}
          />
        </BlurView>
        <View>
          {/* Main Header */}
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={onBack}>
              <Icon
                name="arrow-left"
                type="feather"
                size={moderateScale(24)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Search and Filter Bar */}
          <View style={styles.searchFilterContainer}>
            <View
              style={[
                styles.searchButton,
                isSearchFocused && styles.searchButtonFocused,
              ]}>
              <Icon
                name="search"
                type="feather"
                size={moderateScale(18)}
                color={theme.colors.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, {color: theme.colors.text}]}
                placeholder="Search reciters..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={styles.clearSearchButton}
                  activeOpacity={0.7}>
                  <Icon
                    name="x"
                    type="feather"
                    size={moderateScale(16)}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
            {isSearchFocused ? (
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.7}
                onPress={handleSearchCancel}>
                <Text
                  style={[styles.cancelButtonText, {color: theme.colors.text}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.filterButton}
                activeOpacity={0.7}
                onPress={handleFilterPress}>
                <Icon
                  name="sliders"
                  type="feather"
                  size={moderateScale(18)}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterSectionsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBarContainer}
              keyboardShouldPersistTaps="handled">
              {filterOptions.map(({label}) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.filterChip,
                    activeFilter === label && styles.filterChipActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleFilterChange(label)}>
                  <Text
                    style={[
                      styles.filterChipText,
                      activeFilter === label && styles.filterChipTextActive,
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Active Filters Indicator */}
          {hasActiveFilters && (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersText}>
                {filteredReciters.length} reciters found with current filters
              </Text>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={handleClearFilters}
                activeOpacity={0.7}>
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={[styles.contentContainer, {paddingTop: insets.top}]}>
        <BrowseGrid
          reciters={filteredReciters}
          onReciterPress={handleReciterPress}
          theme={theme}
          keyboardShouldPersistTaps="handled"
        />
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        onApplyFilters={handleApplyFilters}
        theme={theme}
        initialFilters={advancedFilters}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
    },
    blurContainer: {
      overflow: 'hidden',
      borderWidth: 0.1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.85,
    },
    headerContent: {
      height: moderateScale(40),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
    },
    backButton: {
      marginRight: moderateScale(16),
    },
    headerTitle: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      flex: 1,
      color: theme.colors.text,
      textAlign: 'center',
      marginRight: moderateScale(40),
    },
    searchFilterContainer: {
      flexDirection: 'row',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(6),
      gap: moderateScale(8),
    },
    searchButton: {
      flex: 1,
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(16),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    searchButtonFocused: {
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
      backgroundColor: Color(theme.colors.card).alpha(0.7).toString(),
    },
    filterButton: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(10),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    contentContainer: {
      flex: 1,
      marginTop: moderateScale(170),
      paddingTop: 0,
      zIndex: 1,
    },
    filterBarContainer: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(8),
    },
    filterChip: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      marginRight: moderateScale(8),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    filterChipActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    filterChipText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    filterChipTextActive: {
      color: theme.colors.text,
      fontFamily: theme.fonts.semiBold,
    },
    filterSectionsContainer: {},
    activeFiltersContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(4),
    },
    activeFiltersText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    clearFiltersButton: {
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(4),
    },
    clearFiltersText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    searchInput: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      marginLeft: moderateScale(8),
      padding: 0,
    },
    clearSearchButton: {
      padding: moderateScale(4),
    },
    cancelButton: {
      paddingHorizontal: moderateScale(12),
      justifyContent: 'center',
    },
    cancelButtonText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
    },
  });
