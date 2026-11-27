import React from 'react';
import {View, StyleSheet, ScrollView, type ScrollViewProps} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {MushafOptionsContent} from '@/components/mushaf-options/MushafOptionsContent'; // @ai

// @ai: the screen's scroll view sits under the large title, as on every
// settings screen.
function SettingsScrollView(props: ScrollViewProps): React.JSX.Element {
  return <ScrollView {...props} contentInsetAdjustmentBehavior="automatic" />;
}

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
      {/* @ai: the same Reading options as the mushaf's sheet */}
      <MushafOptionsContent
        context="settings"
        ScrollComponent={SettingsScrollView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
