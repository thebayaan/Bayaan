import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import {Theme} from '../../utils/themeUtils';

interface FilterItem {
  id: string;
  label: string;
}

interface DynamicChip extends FilterItem {
  isSelected: boolean;
  type: 'active' | 'inactive' | 'clear';
}

interface FilterBarProps {
  filters: FilterItem[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  theme: Theme;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  activeFilter,
  onFilterChange,
  theme,
}) => {
  const styles = createStyles(theme);

  // Create dynamic chips that actually change content to trigger animations
  const dynamicFilterChips = useMemo((): DynamicChip[] => {
    const chips: DynamicChip[] = [];

    // If a specific filter is active, show only the X button and active filter
    if (activeFilter && activeFilter !== '') {
      // Add X button first (on the left)
      chips.push({
        id: 'clear',
        label: '✕',
        isSelected: false,
        type: 'clear',
      });

      // Add the active filter
      const activeFilterItem = filters.find(f => f.id === activeFilter);
      if (activeFilterItem) {
        chips.push({
          ...activeFilterItem,
          isSelected: true,
          type: 'active',
        });
      }
    } else {
      // Show all filters when no filter is active
      filters.forEach(filter => {
        chips.push({
          ...filter,
          isSelected: false,
          type: 'inactive',
        });
      });
    }

    return chips;
  }, [filters, activeFilter]);

  const handleFilterPress = (filterId: string) => {
    Keyboard.dismiss();
    // If clear button is pressed, or if clicking on active filter, clear the filter
    if (filterId === 'clear' || filterId === activeFilter) {
      onFilterChange('');
    } else {
      onFilterChange(filterId);
    }
  };

  return (
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
            <TouchableOpacity
              style={[
                styles.filterChip,
                chip.isSelected && styles.filterChipActive,
                chip.type === 'clear' && styles.filterChipClear,
              ]}
              activeOpacity={0.7}
              onPress={() => {
                Keyboard.dismiss();
                handleFilterPress(chip.id);
              }}>
              <Text
                style={[
                  styles.filterChipText,
                  chip.isSelected && styles.filterChipTextActive,
                  chip.type === 'clear' && styles.filterChipTextClear,
                ]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    filterChipClear: {
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      paddingHorizontal: moderateScale(10),
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
    filterChipTextClear: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.medium,
    },
  });
