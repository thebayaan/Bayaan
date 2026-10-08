// tv-app/components/player/SleepTimerOverlay.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useOverlayStore} from '../../store/overlayStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import type {SleepMode} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';
import {spacing, radius} from '../../theme/spacing';
import {createScaledStyles} from '../../theme/scale';

type SleepOption = {label: string; minutes: number};

const OPTIONS: readonly SleepOption[] = [
  {label: 'Off', minutes: 0},
  {label: '15 minutes', minutes: 15},
  {label: '30 minutes', minutes: 30},
  {label: '60 minutes', minutes: 60},
  {label: 'End of surah', minutes: -1},
];

function isOptionActive(sleep: SleepMode, minutes: number): boolean {
  if (minutes === 0) return sleep.kind === 'off';
  if (minutes < 0) return sleep.kind === 'endOfSurah';
  return false;
}

/**
 * Transport overlay for the sleep timer. Self-gates on overlayStore.active.
 * Selecting an option schedules (or clears) the timer on the player and closes.
 */
export function SleepTimerOverlay(): React.ReactElement | null {
  const active = useOverlayStore(s => s.active);
  const sleep = useTVPlayerStore(s => s.sleep);
  const applySleep = useOverlayStore(s => s.applySleep);

  if (active !== 'sleep') return null;

  const hasActiveTimer = sleep.kind !== 'off';

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>AUTO-STOP</Text>
        <Text style={styles.title}>Sleep Timer</Text>
        <View style={styles.col}>
          {OPTIONS.map((option, index) => {
            const selected = isOptionActive(sleep, option.minutes);
            const preferFocus = selected || (!hasActiveTimer && index === 0);
            return (
              <FocusableButton
                key={option.label}
                onPress={() => applySleep(option.minutes)}
                accessibilityLabel={option.label}
                hasTVPreferredFocus={preferFocus}
                style={[styles.option, selected && styles.optionActive]}>
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextActive,
                  ]}>
                  {option.label}
                </Text>
              </FocusableButton>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
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
  col: {gap: spacing.xs, width: 360},
  option: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  optionActive: {backgroundColor: colors.text},
  optionText: {color: colors.text, fontSize: 18, fontWeight: '600'},
  optionTextActive: {color: colors.background},
});
