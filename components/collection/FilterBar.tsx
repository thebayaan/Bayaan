import React from 'react';
import {View, Text, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

interface FilterItem {
  id: string;
  label: string;
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {filters.map(filter => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.filterButton,
            {
              backgroundColor: activeFilter === filter.id 
                ? theme.colors.primary 
                : 'transparent',
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => onFilterChange(filter.id)}
          activeOpacity={0.7}>
          <Text
            style={[
              styles.filterText,
              {
                color: activeFilter === filter.id 
                  ? 'white' 
                  : theme.colors.text,
              },
            ]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
  },
  filterButton: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    marginRight: moderateScale(8),
  },
  filterText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});
