import React, {useState, useMemo, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import {moderateScale} from 'react-native-size-matters';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {RECITERS, Reciter, Rewayat} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import BrowseGrid from './BrowseGrid';
import FilterModal, {FilterOptions} from './FilterModal';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {getFeaturedReciters} from '@/data/featuredReciters';
import {useRouter} from 'expo-router';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {createTracksForReciter} from '@/utils/track';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {getSurahById} from '@/services/dataService';
import {reciterImages} from '@/utils/reciterImages';
import Header from '@/components/Header';
import {useSettings} from '@/hooks/useSettings';
import {QIRAAT_TEACHERS, resolveRewayatName} from '@/data/rewayat';

interface BrowseRecitersProps {
  theme: Theme;
  onBack: () => void;
  surahId?: number; // Optional surah ID for filtering
  title?: string; // Optional custom title, defaults to "Browse All"
  initialTeacher?: string; // Optional initial teacher filter
  initialStudent?: string; // Optional initial student filter
}

// Fallback: extract teacher from a rewayat name by splitting on "A'n"
function fallbackTeacher(name: string): string | undefined {
  const parts = name.split("A'n");
  return parts.length > 1 ? parts[1].trim() : undefined;
}

// Fallback: extract student from a rewayat name by splitting on "A'n"
function fallbackStudent(name: string): string | undefined {
  const parts = name.split("A'n");
  return parts.length > 1 ? parts[0].trim() : undefined;
}

// Resolve teacher for a DB rewayat name using the registry, with fallback
function resolveTeacher(dbName: string): string | undefined {
  return resolveRewayatName(dbName)?.teacher ?? fallbackTeacher(dbName);
}

// Resolve student for a DB rewayat name using the registry, with fallback
function resolveStudent(dbName: string): string | undefined {
  return resolveRewayatName(dbName)?.student ?? fallbackStudent(dbName);
}

// Get primary teachers — canonical order from registry
const getPrimaryTeachers = (): string[] => {
  return [...QIRAAT_TEACHERS];
};

// Helper to get students for a teacher
const getStudentsForTeacher = (
  teacherName: string,
  recitersData: Reciter[],
): string[] => {
  const students = new Set<string>();
  recitersData.forEach(reciter => {
    reciter.rewayat.forEach(rewaya => {
      if (rewaya.name) {
        const teacher = resolveTeacher(rewaya.name);
        if (teacher === teacherName) {
          const student = resolveStudent(rewaya.name);
          if (student) {
            students.add(student);
          }
        }
      }
    });
  });
  return Array.from(students).sort();
};

interface Chip {
  label: string;
  type: 'all' | 'teacher' | 'student' | 'separator';
  isSelected: boolean;
}

export default function BrowseReciters({
  theme,
  onBack,
  surahId,
  title = 'Browse All',
  initialTeacher,
  initialStudent,
}: BrowseRecitersProps) {
  const router = useRouter();
  const {updateQueue, play} = usePlayerActions();
  const {startNewChain} = useRecentlyPlayedStore();
  const {setReciterPreference} = useSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(
    initialTeacher || null,
  );
  const [selectedStudent, setSelectedStudent] = useState<string | null>(
    initialStudent || null,
  );

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterOptions>({
    styles: [],
    rewayat: [],
    sortBy: 'featured',
  });
  useFavoriteReciters();

  // Get cached primary teachers (computed once at module level)
  const primaryTeachers = getPrimaryTeachers();

  // Use refs to track actual values for callbacks
  const teacherRef = useRef<string | null>(null);
  const studentRef = useRef<string | null>(null);

  useEffect(() => {
    teacherRef.current = selectedTeacher;
  }, [selectedTeacher]);

  useEffect(() => {
    studentRef.current = selectedStudent;
  }, [selectedStudent]);

  const dynamicFilterChips = useMemo((): Chip[] => {
    const chips: Chip[] = [];
    const isAllSelected = !selectedTeacher && !selectedStudent;

    // Always add the 'All' chip first
    chips.push({label: 'All', type: 'all', isSelected: isAllSelected});

    if (!selectedTeacher) {
      // Initial state: Show all primary teachers
      primaryTeachers.forEach(teacher => {
        chips.push({label: teacher, type: 'teacher', isSelected: false});
      });
    } else {
      // Teacher is selected - get its students
      const studentsOfSelectedTeacher = getStudentsForTeacher(
        selectedTeacher,
        RECITERS,
      );

      // Change ordering: Students, then A'n separator, then Teacher
      // This matches the natural reading order: "Student A'n Teacher"

      if (!selectedStudent) {
        // Teacher selected, no student selected: Show all students of this teacher to the left
        studentsOfSelectedTeacher.forEach(student => {
          chips.push({label: student, type: 'student', isSelected: false});
        });

        // Add the A'n separator between students and teacher
        if (studentsOfSelectedTeacher.length > 0) {
          chips.push({label: "A'n", type: 'separator', isSelected: false});
        }

        // Then add the selected teacher to the right
        chips.push({
          label: selectedTeacher,
          type: 'teacher',
          isSelected: true,
        });
      } else {
        // Teacher and Student selected: Show selected student, then A'n, then selected teacher
        if (studentsOfSelectedTeacher.includes(selectedStudent)) {
          // Student chip first
          chips.push({
            label: selectedStudent,
            type: 'student',
            isSelected: true,
          });

          // A'n separator in the middle
          chips.push({label: "A'n", type: 'separator', isSelected: false});

          // Teacher chip last
          chips.push({
            label: selectedTeacher,
            type: 'teacher',
            isSelected: true,
          });
        }
      }
    }
    return chips;
  }, [selectedTeacher, selectedStudent, primaryTeachers]);

  const filteredReciters = useMemo(() => {
    let result = [...RECITERS];

    if (surahId) {
      result = result.filter(reciter => {
        return reciter.rewayat.some(rewaya =>
          rewaya.surah_list?.includes(surahId),
        );
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(reciter => {
        if (reciter.name.toLowerCase().includes(query)) return true;
        return reciter.rewayat.some(rewaya =>
          rewaya.name?.toLowerCase().includes(query),
        );
      });
    }

    // Apply teacher/student filter
    if (selectedTeacher) {
      result = result.filter(reciter =>
        reciter.rewayat.some(rewaya => {
          if (!rewaya.name) return false;
          const teacher = resolveTeacher(rewaya.name);
          if (teacher !== selectedTeacher) return false;
          if (selectedStudent) {
            const student = resolveStudent(rewaya.name);
            return student === selectedStudent;
          }
          return true;
        }),
      );
    }

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

    if (advancedFilters.rewayat.length > 0) {
      result = result.filter(reciter =>
        reciter.rewayat.some(rewaya =>
          advancedFilters.rewayat.includes(rewaya.name || ''),
        ),
      );
    }

    const hasImage = (reciter: Reciter): boolean => {
      if (reciter.image_url) return true;
      const formattedName = reciter.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return !!reciterImages[formattedName];
    };

    const featuredRecitersData = getFeaturedReciters(20);
    const featuredIds = new Set(featuredRecitersData.map(r => r.id));

    result.sort((a, b) => {
      if (featuredIds.has(a.id) && !featuredIds.has(b.id)) return -1;
      if (!featuredIds.has(a.id) && featuredIds.has(b.id)) return 1;
      const aHasImage = hasImage(a);
      const bHasImage = hasImage(b);
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [selectedTeacher, selectedStudent, searchQuery, surahId, advancedFilters]);

  const handleFilterModalPress = () => {
    setIsFilterModalVisible(true);
  };

  const handleChipPress = useCallback((chip: Chip) => {
    if (chip.type === 'all') {
      setSelectedTeacher(null);
      setSelectedStudent(null);
    } else if (chip.type === 'teacher') {
      if (chip.label === teacherRef.current) {
        setSelectedTeacher(null);
        setSelectedStudent(null);
      } else {
        setSelectedTeacher(chip.label);
        setSelectedStudent(null);
      }
    } else if (chip.type === 'student') {
      if (chip.label === studentRef.current) {
        setSelectedStudent(null);
      } else {
        setSelectedStudent(chip.label);
      }
    }
  }, []);

  const handleApplyAdvancedFilters = (filters: FilterOptions) => {
    setAdvancedFilters(filters);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleClearFilters = () => {
    setSelectedTeacher(null);
    setSelectedStudent(null);
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

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  const handleSearchCancel = useCallback(() => {
    setSearchQuery('');
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      selectedTeacher !== null ||
      selectedStudent !== null ||
      searchQuery.trim() !== '' ||
      advancedFilters.styles.length > 0 ||
      advancedFilters.rewayat.length > 0 ||
      advancedFilters.sortBy !== 'featured'
    );
  }, [selectedTeacher, selectedStudent, searchQuery, advancedFilters]);

  const handleReciterPress = useCallback(
    async (reciter: Reciter) => {
      Keyboard.dismiss();

      // Use refs for most accurate state values
      const currentTeacher = teacherRef.current;
      const currentStudent = studentRef.current;

      // Find appropriate rewayat based on filter selection
      let selectedRewayatId: string | undefined;

      // If filters are active, find a matching rewayat and update preference
      if (currentTeacher || currentStudent) {
        let matchingRewayat: Rewayat | undefined;

        // Case 1: Both teacher and student selected (highest priority)
        if (currentTeacher && currentStudent) {
          matchingRewayat = reciter.rewayat.find(rewaya => {
            if (!rewaya.name) return false;
            const teacher = resolveTeacher(rewaya.name);
            const student = resolveStudent(rewaya.name);
            return teacher === currentTeacher && student === currentStudent;
          });
        }

        // Case 2: Only teacher selected
        if (!matchingRewayat && currentTeacher) {
          matchingRewayat = reciter.rewayat.find(rewaya => {
            if (!rewaya.name) return false;
            return resolveTeacher(rewaya.name) === currentTeacher;
          });
        }

        if (matchingRewayat?.id) {
          selectedRewayatId = matchingRewayat.id;
          setReciterPreference(reciter.id, matchingRewayat.id);
        }
      }

      if (surahId) {
        try {
          const surah = await getSurahById(surahId);
          if (!surah) return;

          // If we found a matching rewayat, use that, otherwise use default
          const rewayatId = selectedRewayatId || reciter.rewayat[0]?.id;

          const tracks = await createTracksForReciter(
            reciter,
            [surah],
            rewayatId,
          );

          // Update queue and start playing
          await updateQueue(tracks, 0);
          await play();

          // Add to recently played list with the rewayatId
          await startNewChain(reciter, surah, 0, 0, rewayatId);

          // Navigate back
          router.back();
        } catch (error) {
          console.error('Error playing surah:', error);
        }
      } else {
        // Case 2: Browse all mode - navigate to reciter profile

        // If filters are not active or no matching rewayat was found,
        // we don't set a preference, allowing the reciter profile to use its default logic
        // or the user's manually selected preference if they previously visited this reciter
        router.push({
          pathname: '/(tabs)/(a.home)/reciter/[id]',
          params: {id: reciter.id},
        });
      }
    },
    [setReciterPreference, surahId, updateQueue, play, router, startNewChain],
  );

  // Handler for tapping outside search area
  const handleOutsidePress = useCallback(() => {
    if (isSearchFocused) {
      Keyboard.dismiss();
      handleSearchBlur();
    }
  }, [isSearchFocused, handleSearchBlur]);

  return (
    <TouchableWithoutFeedback onPress={handleOutsidePress}>
      <View style={styles.container}>
        <Header
          title={title}
          onBack={onBack}
          showBlur={true}
          containerStyle={{zIndex: 2}}
        />

        {/* Search and Filter Bar */}
        <View style={styles.searchFilterContainer}>
          <View
            style={[
              styles.searchButton,
              isSearchFocused && styles.searchButtonFocused,
            ]}>
            <Feather
              name="search"
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
              onSubmitEditing={Keyboard.dismiss}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                style={styles.clearSearchButton}
                activeOpacity={0.7}>
                <Feather
                  name="x"
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
              onPress={handleFilterModalPress}>
              <Feather
                name="sliders"
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
            {dynamicFilterChips.map(chip => (
              <Animated.View
                key={chip.label + chip.type}
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                layout={LinearTransition.duration(300)}>
                {chip.type === 'separator' ? (
                  // Render the A'n separator with different styling
                  <View style={styles.separatorChip}>
                    <Text style={styles.separatorChipText}>{chip.label}</Text>
                  </View>
                ) : (
                  // Regular filter chips
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      chip.isSelected && styles.filterChipActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleChipPress(chip);
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        chip.isSelected && styles.filterChipTextActive,
                      ]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
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
              onPress={() => {
                Keyboard.dismiss(); // Dismiss keyboard when clearing filters
                handleClearFilters();
              }}
              activeOpacity={0.7}>
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          <BrowseGrid
            reciters={filteredReciters}
            onReciterPress={handleReciterPress}
            theme={theme}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()} // Dismiss keyboard on scroll
          />
        </View>

        {/* Filter Modal */}
        <FilterModal
          visible={isFilterModalVisible}
          onClose={() => {
            setIsFilterModalVisible(false);
            Keyboard.dismiss(); // Dismiss keyboard when closing modal
          }}
          onApplyFilters={handleApplyAdvancedFilters}
          theme={theme}
          initialFilters={advancedFilters}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchFilterContainer: {
      flexDirection: 'row',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(6),
      gap: moderateScale(8),
      marginTop: moderateScale(110), // Add top margin to account for header
      zIndex: 1,
    },
    searchButton: {
      flex: 1,
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(12),
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      height: moderateScale(44), // Fixed height to prevent UI shifting
    },
    searchButtonFocused: {
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
      backgroundColor: Color(theme.colors.card).alpha(0.7).toString(),
    },
    searchInput: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.regular,
      marginLeft: moderateScale(8),
      padding: 0,
      height: '100%', // Fill the parent height
    },
    clearSearchButton: {
      padding: moderateScale(4),
    },
    cancelButton: {
      paddingHorizontal: moderateScale(12),
      justifyContent: 'center',
      height: moderateScale(44), // Match search button height
    },
    cancelButtonText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
    },
    filterButton: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(10),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      height: moderateScale(44), // Match search button height
      width: moderateScale(44), // Fixed width for consistent layout
      justifyContent: 'center',
      alignItems: 'center',
    },
    contentContainer: {
      flex: 1,
      marginTop: moderateScale(20),
      paddingTop: 0,
      zIndex: 1,
    },
    filterSectionsContainer: {
      // marginTop: moderateScale(10),
      // marginBottom: moderateScale(8),
    },
    filterBarContainer: {
      flexDirection: 'row',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(6), // Add some vertical padding for better animation visibility
    },
    filterChip: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      marginHorizontal: moderateScale(2), // Add small horizontal margin for nicer spacing during animations
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
    activeFiltersContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(4),
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
    separatorChip: {
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      backgroundColor: 'transparent',
      marginHorizontal: moderateScale(2),
      justifyContent: 'center',
      alignItems: 'center',
    },
    separatorChipText: {
      fontSize: moderateScale(14),
      fontFamily: 'Amiri-Regular', // Using Arabic-friendly font if available
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
  });
