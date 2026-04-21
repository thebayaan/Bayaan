import React from 'react';
import {View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ReadingThemeContent} from '@/components/ReadingThemeContent';
import {useRouter} from 'expo-router';

export default function ReadingThemeScreen() {
  const {theme} = useTheme();
  const router = useRouter();

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <ReadingThemeContent onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
