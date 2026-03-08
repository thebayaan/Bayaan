import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {MushafSettingsContent} from '@/components/MushafSettingsContent';
import {verticalScale} from 'react-native-size-matters';

export default function MushafSettingsScreen() {
  const {theme} = useTheme();

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
