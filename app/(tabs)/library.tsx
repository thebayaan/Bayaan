import React from 'react';
import {View, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {createStyles} from './styles';

export default function LibraryScreen() {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Your library is empty</Text>
      </View>
    </SafeAreaView>
  );
}
