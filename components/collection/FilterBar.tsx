import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, ScrollView, StyleSheet, Keyboard} from 'react-native';
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
  type: 'active' | 'inactive';
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
    
    // Always show the active filter first
    const activeFilterItem = filters.find(f => f.id === activeFilter);
    if (activeFilterItem) {
      chips.push({
        ...activeFilterItem,
        isSelected: true,
        type: 'active'
      });
    }
    
    // Then show all other filters
    filters.forEach(filter => {
      if (filter.id !== activeFilter) {
        chips.push({
          ...filter,
          isSelected: false,
          type: 'inactive'
        });
      }
    });
    
    return chips;
  }, [filters, activeFilter]);
  
  const handleFilterPress = (filterId: string) => {
    Keyboard.dismiss();
    onFilterChange(filterId);
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
            key={chip.id + chip.type}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            layout={LinearTransition.duration(300)}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                chip.isSelected && styles.filterChipActive,
              ]}
              activeOpacity={0.7}
              onPress={() => handleFilterPress(chip.id)}>
              <Text
                style={[
                  styles.filterChipText,
                  chip.isSelected && styles.filterChipTextActive,
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
    filterChipText: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    filterChipTextActive: {
      color: theme.colors.text,
      fontFamily: theme.fonts.semiBold,
    },
  });
