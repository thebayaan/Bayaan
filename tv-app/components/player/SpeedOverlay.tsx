// tv-app/components/player/SpeedOverlay.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useOverlayStore} from '../../store/overlayStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';
import {spacing, radius} from '../../theme/spacing';

const SPEEDS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Transport overlay for playback speed. Self-gates on overlayStore.active and
 * renders nothing unless it is the active overlay. Selecting a chip persists
 * the preference, applies the rate to the live engine, and closes the overlay.
 */
export function SpeedOverlay(): React.ReactElement | null {
  const active = useOverlayStore(s => s.active);
  const speed = useTVPlayerStore(s => s.speed);
  const applySpeed = useOverlayStore(s => s.applySpeed);
  const close = useOverlayStore(s => s.close);

  if (active !== 'speed') return null;

  const hasSelection = SPEEDS.includes(speed);

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>PLAYBACK</Text>
        <Text style={styles.title}>Speed</Text>
        <View style={styles.row}>
          {SPEEDS.map((value, index) => {
            const selected = value === speed;
            const preferFocus = selected || (!hasSelection && index === 2);
            return (
              <FocusableButton
                key={value}
                onPress={() => applySpeed(value)}
                accessibilityLabel={`${value}x`}
                hasTVPreferredFocus={preferFocus}
                style={[styles.chip, selected && styles.chipActive]}>
                <Text
                  style={[styles.chipText, selected && styles.chipTextActive]}>
                  {value}x
                </Text>
              </FocusableButton>
            );
          })}
        </View>
        <FocusableButton
          onPress={close}
          accessibilityLabel="Close"
          style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </FocusableButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  row: {flexDirection: 'row', gap: spacing.sm},
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {backgroundColor: colors.text},
  chipText: {color: colors.text, fontSize: 20, fontWeight: '700'},
  chipTextActive: {color: colors.background},
  close: {paddingHorizontal: 32, paddingVertical: 10, marginTop: spacing.md},
  closeText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
});
