import React from 'react';
import {View, StyleSheet} from 'react-native';
import MushafViewer from '@/components/mushaf/main';
import {useTheme} from '@/hooks/useTheme';
import {Text} from 'react-native';
export default function MushafTab() {
  const {theme} = useTheme();

  // Start with page 1, can be made dynamic later
  const initialPageNumber = 1;

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <MushafViewer pageNumber={initialPageNumber} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
