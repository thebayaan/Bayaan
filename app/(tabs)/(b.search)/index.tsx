import React from 'react';
import {View, StyleSheet} from 'react-native';
import {SearchView} from '@/components/search/SearchView';
import {useTheme} from '@/hooks/useTheme';
import {Stack} from 'expo-router';
import {Platform} from 'react-native';
import {useState} from 'react';

export default function SearchScreen() {
  const {theme} = useTheme();
  const [nativeQuery, setNativeQuery] = useState('');

  const handleClose = () => {
    // Close functionality can be added here if needed in the future
    console.log('Search closed');
  };

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Search',
            headerLargeTitle: true,
            headerStyle: {backgroundColor: theme.colors.background},
            headerSearchBarOptions: {
              placeholder: 'Search surahs or reciters',
              hideWhenScrolling: false,
              hideNavigationBar: false,
              onChangeText: (event: any) =>
                setNativeQuery(event?.nativeEvent?.text ?? ''),
              onCancelButtonPress: () => {
                // Don't clear query — keyboard dismiss should keep results visible.
                // The X (clear) button in the search field clears via onChangeText.
              },
            },
          }}
        />
      )}
      <SearchView
        visible={true}
        onClose={handleClose}
        initialQuery={Platform.OS === 'ios' ? nativeQuery : undefined}
        forceNativeSearch={Platform.OS === 'ios'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
