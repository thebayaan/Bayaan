import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Stack} from 'expo-router';
import {SearchView} from '@/components/search/SearchView';
import {useTheme} from '@/hooks/useTheme';

export default function SearchScreen() {
  const {theme} = useTheme();
  const [query, setQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Stack.SearchBar
        placement="automatic"
        placeholder="Search surahs or reciters"
        onChangeText={e => setQuery(e.nativeEvent.text)}
        onFocus={_e => setIsSearchActive(true)}
        onCancelButtonPress={() => {
          setQuery('');
          setIsSearchActive(false);
        }}
        hideNavigationBar
      />
      <SearchView
        visible={true}
        onClose={() => {
          setQuery('');
          setIsSearchActive(false);
        }}
        query={query}
        isSearchActive={isSearchActive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
