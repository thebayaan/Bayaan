import React, {useState, useMemo, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {SearchInput} from '@/components/SearchInput';
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
// @ai-start
import {
  QIRAAT_TEACHERS,
  resolveRewayatName,
  getRewayatPersonLabel,
} from '@/data/rewayat';
import {rankReciters} from '@/utils/search/catalog'; // @ai
// @ai-end
import {resolveRewayahFromName} from '@/services/rewayah/RewayahIdentity';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useGlassHeaderHeight} from '@/hooks/useGlassHeaderHeight'; // @ai
import branding from '@/config/branding';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useReciterProfilePathname} from '@/hooks/useTabReciterPath'; // @ai
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

interface BrowseRecitersProps {
  theme: Theme;
  onBack: () => void;
  surahId?: number;
  title?: string;
  initialTeacher?: string;
  initialStudent?: string;
  /**
   * RFC-012 — initial value for the `has-photo` filter chip. When the
   * chip is enabled in `branding.searchFilters`, this prop seeds its
   * starting state. Defaults to `false` (chip un-toggled).
   */
  initialHasPhoto?: boolean;
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

// @ai-start
export default function BrowseReciters({
  theme,
  onBack,
  surahId,
  title,
  initialTeacher,
  initialStudent,
  initialHasPhoto = false,
}: BrowseRecitersProps) {
  const router = useRouter();
  const profilePathname = useReciterProfilePathname(); // @ai
  const {t} = useTranslation('home');
  const {updateQueue, play} = usePlayerActions();
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain);
  const {setReciterPreference} = useSettings();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // On iOS, the native Stack header handles the top area; on Android, use custom Header
  const useNativeHeader = USE_GLASS;
  const iosHeaderHeight = useGlassHeaderHeight(useNativeHeader); // @ai

  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(
    initialTeacher || null,
  );
  const [selectedStudent, setSelectedStudent] = useState<string | null>(
    initialStudent || null,
  );

  // RFC-012 — composable filter chips. Each dimension in
  // `branding.searchFilters` (when configured) gets its own piece of
  // state + a toggleable chip in the strip below the search input.
  // v1 ships `has-photo` end-to-end; `rewaya` / `has-surah` stay on
  // their existing bespoke implementations and migrate later.
  const hasPhotoEnabled = !!branding.searchFilters?.includes('has-photo');
  const [hasPhoto, setHasPhoto] = useState<boolean>(
    hasPhotoEnabled && initialHasPhoto,
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

    chips.push({
      label: t('browse.allChip'),
      type: 'all',
      isSelected: isAllSelected,
    });

    if (!selectedTeacher) {
      primaryTeachers.forEach(teacher => {
        chips.push({label: teacher, type: 'teacher', isSelected: false});
      });
    } else {
      const studentsOfSelectedTeacher = getStudentsForTeacher(
        selectedTeacher,
        RECITERS,
      );

      if (!selectedStudent) {
        studentsOfSelectedTeacher.forEach(student => {
          chips.push({label: student, type: 'student', isSelected: false});
        });

        if (studentsOfSelectedTeacher.length > 0) {
          chips.push({
            label: t('browse.rewayahSeparator'),
            type: 'separator',
            isSelected: false,
          });
        }

        chips.push({
          label: selectedTeacher,
          type: 'teacher',
          isSelected: true,
        });
      } else {
        if (studentsOfSelectedTeacher.includes(selectedStudent)) {
          chips.push({
            label: selectedStudent,
            type: 'student',
            isSelected: true,
          });
          chips.push({
            label: t('browse.rewayahSeparator'),
            type: 'separator',
            isSelected: false,
          });
          chips.push({
            label: selectedTeacher,
            type: 'teacher',
            isSelected: true,
          });
        }
      }
    }
    return chips;
  }, [selectedTeacher, selectedStudent, primaryTeachers, t]);

  const filteredReciters = useMemo(() => {
    // Hoisted above the filter chain so the RFC-012 `has-photo` filter
    // and the existing sort step share one definition. "Has photo" matches
    // a card whose user-visible artwork resolves to something — either a
    // catalog `image_url` OR a bundled local headshot fallback.
    const hasImage = (reciter: Reciter): boolean => {
      if (reciter.image_url) return true;
      const formattedName = reciter.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return !!reciterImages[formattedName];
    };

    let result = [...RECITERS];

    if (surahId) {
      result = result.filter(reciter => {
        return reciter.rewayat.some(rewaya =>
          rewaya.surah_list?.includes(surahId),
        );
      });
    }

    // @ai-start
    const searchRank = searchQuery.trim()
      ? new Map(rankReciters(searchQuery).map((reciter, i) => [reciter.id, i]))
      : null;
    if (searchRank) {
      result = result.filter(reciter => searchRank.has(reciter.id));
    }
    // @ai-end

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
      // Chips use canonical RewayahId slugs as their key (FilterModal
      // getAvailableRewayahChips); match by resolving each rewaya.name to
      // its canonical slug and falling back to the raw name for the
      // un-resolvable cases (combined-recording entries, etc.).
      result = result.filter(reciter =>
        reciter.rewayat.some(rewaya => {
          if (!rewaya.name) return false;
          const key = resolveRewayahFromName(rewaya.name) ?? rewaya.name;
          return advancedFilters.rewayat.includes(key);
        }),
      );
    }

    // RFC-012 — `has-photo` filter dimension. Predicate uses the same
    // `hasImage` helper as the sort step below, so the filter and the
    // sort agree on what counts as "has a photo." No-op when the chip
    // isn't enabled in branding or the user hasn't toggled it on.
    if (hasPhoto) {
      result = result.filter(hasImage);
    }

    const featuredRecitersData = getFeaturedReciters(20);
    const featuredIds = new Set(featuredRecitersData.map(r => r.id));

    result.sort((a, b) => {
      // @ai-start
      if (searchRank) {
        return (searchRank.get(a.id) ?? 0) - (searchRank.get(b.id) ?? 0);
      }
      // @ai-end
      if (featuredIds.has(a.id) && !featuredIds.has(b.id)) return -1;
      if (!featuredIds.has(a.id) && featuredIds.has(b.id)) return 1;
      const aHasImage = hasImage(a);
      const bHasImage = hasImage(b);
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [
    selectedTeacher,
    selectedStudent,
    searchQuery,
    surahId,
    advancedFilters,
    hasPhoto,
    hasPhotoEnabled,
  ]);

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

  const handleClearFilters = () => {
    setSelectedTeacher(null);
    setSelectedStudent(null);
    setSearchQuery('');
    setAdvancedFilters({
      styles: [],
      rewayat: [],
      sortBy: 'featured',
    });
    // RFC-012 — reset the composable chip state too.
    setHasPhoto(false);
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
      advancedFilters.sortBy !== 'featured' ||
      hasPhoto // RFC-012 — `has-photo` chip counts as active
    );
  }, [
    selectedTeacher,
    selectedStudent,
    searchQuery,
    advancedFilters,
    hasPhoto,
  ]);

  const handleReciterPress = useCallback(
    async (reciter: Reciter) => {
      Keyboard.dismiss();

      const currentTeacher = teacherRef.current;
      const currentStudent = studentRef.current;

      let selectedRewayatId: string | undefined;

      if (currentTeacher || currentStudent) {
        let matchingRewayat: Rewayat | undefined;

        if (currentTeacher && currentStudent) {
          matchingRewayat = reciter.rewayat.find(rewaya => {
            if (!rewaya.name) return false;
            const teacher = resolveTeacher(rewaya.name);
            const student = resolveStudent(rewaya.name);
            return teacher === currentTeacher && student === currentStudent;
          });
        }

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

          const rewayatId = selectedRewayatId || reciter.rewayat[0]?.id;

          const tracks = await createTracksForReciter(
            reciter,
            [surah],
            rewayatId,
          );

          await updateQueue(tracks, 0);
          await play();

          await startNewChain(reciter, surah, 0, 0, rewayatId);

          router.back();
        } catch (error) {
          console.error('Error playing surah:', error);
        }
      } else {
        router.push({
          pathname: profilePathname, // @ai
          params: {
            id: reciter.id,
            ...(selectedRewayatId ? {rewayatId: selectedRewayatId} : {}),
          },
        });
      }
    },
    [
      setReciterPreference,
      surahId,
      updateQueue,
      play,
      router,
      startNewChain,
      profilePathname,
    ],
  );

  const handleOutsidePress = useCallback(() => {
    if (isSearchFocused) {
      Keyboard.dismiss();
      handleSearchBlur();
    }
  }, [isSearchFocused, handleSearchBlur]);

  // Resolve the matching rewayat ID for a given reciter based on current teacher/student filter
  const getRewayatIdForReciter = useCallback(
    (reciter: Reciter): string | undefined => {
      const teacher = selectedTeacher;
      const student = selectedStudent;
      if (!teacher && !student) return undefined;

      let match =
        teacher && student
          ? reciter.rewayat.find(r => {
              if (!r.name) return false;
              return (
                resolveTeacher(r.name) === teacher &&
                resolveStudent(r.name) === student
              );
            })
          : undefined;

      if (!match && teacher) {
        match = reciter.rewayat.find(
          r => r.name && resolveTeacher(r.name) === teacher,
        );
      }

      return match?.id;
    },
    [selectedTeacher, selectedStudent],
  );

  // Top offset: native header height on iOS, 0 on Android (custom Header handles it)
  const topOffset = useNativeHeader ? iosHeaderHeight : 0;

  return (
    <TouchableWithoutFeedback onPress={handleOutsidePress}>
      <View style={styles.container}>
        {/* Android: custom Header; iOS: native Stack header handles this */}
        {!useNativeHeader && (
          <Header
            title={title ?? t('browse.browseAll')}
            onBack={onBack}
            showBlur={true}
            containerStyle={{zIndex: 2}}
          />
        )}

        {/* Search and Filter Bar */}
        <View
          style={[
            styles.searchFilterContainer,
            {
              marginTop: useNativeHeader
                ? topOffset
                : insets.top + moderateScale(56),
            },
          ]}>
          <SearchInput
            placeholder={t('browse.searchReciters')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onCancel={handleSearchCancel}
            showCancelButton={isSearchFocused}
            iconColor={theme.colors.text}
            iconOpacity={0.25}
            placeholderTextColor={Color(theme.colors.text)
              .alpha(0.35)
              .toString()}
            textColor={theme.colors.text}
            backgroundColor={Color(theme.colors.text).alpha(0.04).toString()}
            borderColor={Color(theme.colors.text).alpha(0.06).toString()}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            onSubmitEditing={Keyboard.dismiss}
            containerStyle={{paddingHorizontal: 0, flex: 1}}
          />
          {!isSearchFocused && (
            <Pressable
              style={({pressed}) => [
                styles.filterButton,
                pressed && styles.filterButtonPressed,
              ]}
              onPress={handleFilterModalPress}>
              <Feather
                name="sliders"
                size={moderateScale(18)}
                color={Color(theme.colors.text).alpha(0.7).toString()}
              />
            </Pressable>
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
                  <View style={styles.separatorChip}>
                    <Text style={styles.separatorChipText}>{chip.label}</Text>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="togglebutton"
                    accessibilityLabel={getRewayatPersonLabel(chip.label)}
                    accessibilityState={{selected: chip.isSelected}}
                    style={({pressed}) => [
                      styles.filterChip,
                      chip.isSelected && styles.filterChipActive,
                      pressed && styles.filterChipPressed,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleChipPress(chip);
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        chip.isSelected && styles.filterChipTextActive,
                      ]}>
                      {getRewayatPersonLabel(chip.label)}
                    </Text>
                  </Pressable>
                )}
              </Animated.View>
            ))}
            {/* RFC-012 — composable chip(s) from `branding.searchFilters`.
             * v1 ships `has-photo` end-to-end; other dimensions render
             * once they're wired through (or live as bespoke chips above). */}
            {hasPhotoEnabled && (
              <Animated.View
                entering={FadeIn.duration(300)}
                layout={LinearTransition.duration(300)}>
                <Pressable
                  accessibilityRole="togglebutton"
                  accessibilityLabel={t('browse.hasPhoto')}
                  accessibilityState={{selected: hasPhoto}}
                  style={({pressed}) => [
                    styles.filterChip,
                    hasPhoto && styles.filterChipActive,
                    pressed && styles.filterChipPressed,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setHasPhoto(v => !v);
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      hasPhoto && styles.filterChipTextActive,
                    ]}>
                    {t('browse.hasPhoto')}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </ScrollView>
        </View>

        {/* Active Filters Indicator */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersContainer}>
            <Text style={styles.activeFiltersText}>
              {t('browse.recitersFound', {count: filteredReciters.length})}
            </Text>
            <Pressable
              style={({pressed}) => [
                styles.clearFiltersButton,
                pressed && {opacity: 0.6},
              ]}
              onPress={() => {
                Keyboard.dismiss();
                handleClearFilters();
              }}>
              <Text style={styles.clearFiltersText}>
                {t('browse.clearAll')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          <BrowseGrid
            reciters={filteredReciters}
            onReciterPress={handleReciterPress}
            theme={theme}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            getRewayatIdForReciter={getRewayatIdForReciter}
            linkToProfile={!surahId}
            profilePathname={profilePathname} // @ai
            bottomInset={bottomInset}
          />
        </View>

        {/* Filter Modal */}
        <FilterModal
          visible={isFilterModalVisible}
          onClose={() => {
            setIsFilterModalVisible(false);
            Keyboard.dismiss();
          }}
          onApplyFilters={handleApplyAdvancedFilters}
          theme={theme}
          initialFilters={advancedFilters}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}
// @ai-end

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
      zIndex: 1,
    },
    filterButton: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(12),
      padding: moderateScale(10),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      height: moderateScale(44),
      width: moderateScale(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterButtonPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    contentContainer: {
      flex: 1,
      marginTop: moderateScale(8),
      zIndex: 1,
    },
    filterSectionsContainer: {},
    filterBarContainer: {
      flexDirection: 'row',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(6),
    },
    filterChip: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(2),
    },
    filterChipActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    filterChipPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    filterChipText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    filterChipTextActive: {
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
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
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
    },
    clearFiltersButton: {
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(4),
    },
    clearFiltersText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
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
      fontFamily: 'Amiri-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      fontStyle: 'italic',
    },
  });
