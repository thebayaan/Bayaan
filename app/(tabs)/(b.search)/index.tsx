import React from 'react';
import {View, StyleSheet} from 'react-native';
import {SearchView} from '@/components/search/SearchView';
import {useTheme} from '@/hooks/useTheme';

export default function SearchScreen() {
  const {theme} = useTheme();

  const handleClose = () => {
    // Close functionality can be added here if needed in the future
    console.log('Search closed');
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <SearchView visible={true} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
