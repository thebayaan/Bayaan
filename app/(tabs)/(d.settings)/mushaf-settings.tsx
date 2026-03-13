import React, {useCallback} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';
import {verticalScale} from 'react-native-size-matters';
import {useRouter} from 'expo-router';

export default function MushafSettingsScreen() {
  const {theme} = useTheme();
  const router = useRouter();

  const handleOpenThemePicker = useCallback(() => {
    router.push('/(tabs)/(d.settings)/reading-theme');
  }, [router]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
        },
      ]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <MushafSettingsContent
          showTitle={false}
          onOpenThemePicker={handleOpenThemePicker}
        />
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
