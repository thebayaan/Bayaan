import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import Header from '@/components/Header';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';
import {verticalScale} from 'react-native-size-matters';
import {useRouter} from 'expo-router';

export default function MushafSettingsScreen() {
  const insets = useSafeAreaInsets();
  const {theme} = useTheme();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
        },
      ]}>
      <Header title="Mushaf Settings" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: insets.top + 56}, // Account for header height
        ]}
        showsVerticalScrollIndicator={false}>
        <MushafSettingsContent showTitle={false} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(40),
  },
});
