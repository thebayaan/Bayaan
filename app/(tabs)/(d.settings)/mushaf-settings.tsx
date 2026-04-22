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
        style={styles.content}
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
  // flex: 1 on the ScrollView itself is what lets iOS 26's NativeTabs
  // BottomAccessory (mini player) auto-collapse on scroll — the tab bar
  // tracks the screen's primary scroll view by its frame, and a ScrollView
  // sized to content doesn't register as primary.
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(40),
  },
});
