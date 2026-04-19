// tv-app/components/overlays/SleepTimer.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useOverlayStore} from '../../store/overlayStore';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const OPTIONS = [
  {label: 'Off', minutes: 0},
  {label: '15 min', minutes: 15},
  {label: '30 min', minutes: 30},
  {label: '60 min', minutes: 60},
  {label: 'End of surah', minutes: -1},
];

export function SleepTimer(): React.ReactElement {
  const close = useOverlayStore(s => s.close);
  // For v1 we show the UI; wiring to an actual timer that pauses playback
  // is done inline in tvPlayerStore in a follow-up.
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sleep Timer</Text>
      <View style={styles.col}>
        {OPTIONS.map(o => (
          <FocusableButton
            key={o.label}
            onPress={close}
            accessibilityLabel={o.label}
            style={styles.row}>
            <Text style={styles.rowText}>{o.label}</Text>
          </FocusableButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {padding: spacing.lg, gap: spacing.md, alignItems: 'center'},
  title: {color: colors.text, fontSize: 24, fontWeight: '600'},
  col: {gap: 6, width: 280},
  row: {paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8},
  rowText: {color: colors.text, fontSize: 18},
});
