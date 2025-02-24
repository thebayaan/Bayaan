import React from 'react';
import {View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import SearchBar from '@/components/SearchBar';
import {SearchHeaderProps} from '@/components/reciter-profile/types';

/**
 * SearchHeader component for the ReciterProfile
 *
 * This component displays the search bar at the top of the ReciterProfile screen
 * when search is active.
 *
 * @component
 */
export const SearchHeader: React.FC<SearchHeaderProps> = ({
  showSearch,
  searchQuery,
  onSearchChange,
  insets,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  if (!showSearch) return null;

  return (
    <View
      style={[
        styles.searchBarContainer,
        {paddingTop: insets.top + moderateScale(15)},
      ]}>
      <SearchBar
        placeholder="Search Surahs"
        onChangeText={onSearchChange}
        value={searchQuery}
      />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    searchBarContainer: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(10),
      zIndex: 1,
    },
  });
