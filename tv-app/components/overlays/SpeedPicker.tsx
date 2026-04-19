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
      <Text style={styles.kicker}>PLAYBACK</Text>
      <Text style={styles.title}>Speed</Text>
      <View style={styles.row}>
        {SPEEDS.map((s, i) => {
          const selected = speed === s;
          return (
            <FocusableButton
              key={s}
              onPress={() => {
                setSpeed(s);
                close();
              }}
              accessibilityLabel={`${s}x`}
              style={[styles.chip, selected && styles.chipActive]}
              hasTVPreferredFocus={selected || (speed == null && i === 2)}>
              <Text
                style={[styles.chipText, selected && styles.chipTextActive]}>
                {s}x
              </Text>
            </FocusableButton>
          );
        })}
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
  row: {flexDirection: 'row', gap: spacing.sm},
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {backgroundColor: colors.text},
  chipText: {color: colors.text, fontSize: 20, fontWeight: '700'},
  chipTextActive: {color: colors.background},
});
