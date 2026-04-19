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
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>AUTO-STOP</Text>
      <Text style={styles.title}>Sleep Timer</Text>
      <View style={styles.col}>
        {OPTIONS.map((o, i) => (
          <FocusableButton
            key={o.label}
            onPress={close}
            accessibilityLabel={o.label}
            hasTVPreferredFocus={i === 0}
            style={styles.row}>
            <Text style={styles.rowText}>{o.label}</Text>
          </FocusableButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {padding: spacing.xl, gap: 6, alignItems: 'center'},
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    opacity: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  col: {gap: 8, width: 340},
  row: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowText: {color: colors.text, fontSize: 18, fontWeight: '600'},
});
