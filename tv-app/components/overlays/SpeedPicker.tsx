// tv-app/components/overlays/SpeedPicker.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useOverlayStore} from '../../store/overlayStore';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SpeedPicker(): React.ReactElement {
  const {speed, setSpeed} = useTVPlayerStore();
  const close = useOverlayStore(s => s.close);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Playback Speed</Text>
      <View style={styles.row}>
        {SPEEDS.map((s, i) => (
          <FocusableButton
            key={s}
            onPress={() => {
              setSpeed(s);
              close();
            }}
            accessibilityLabel={`${s}x`}
            style={[styles.chip, speed === s && styles.chipActive]}
            hasTVPreferredFocus={speed === s || (speed == null && i === 2)}>
            <Text style={styles.chipText}>{s}x</Text>
          </FocusableButton>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {padding: spacing.lg, gap: spacing.md, alignItems: 'center'},
  title: {color: colors.text, fontSize: 24, fontWeight: '600'},
  row: {flexDirection: 'row', gap: spacing.sm},
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {backgroundColor: colors.text},
  chipText: {color: colors.text, fontSize: 18, fontWeight: '600'},
});
