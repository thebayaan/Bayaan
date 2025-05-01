import React from 'react';
import {View, StyleSheet} from 'react-native';
import {SearchView} from '@/components/search/SearchView';
import {useTheme} from '@/hooks/useTheme';
import {useIsFocused} from '@react-navigation/native';

export default function SearchScreen() {
  const {theme} = useTheme();
  const isFocused = useIsFocused();

  const handleClose = () => {
    // Close functionality can be added here if needed in the future
    console.log('Search closed');
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <SearchView visible={isFocused} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
