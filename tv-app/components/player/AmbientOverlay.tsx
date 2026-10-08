// tv-app/components/player/AmbientOverlay.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useAmbientStore, type AmbientSound} from '../../store/ambientStore';
import {useOverlayStore} from '../../store/overlayStore';
import {colors} from '../../theme/colors';
import {spacing, radius} from '../../theme/spacing';
import {createScaledStyles} from '../../theme/scale';

const SOUNDS: readonly AmbientSound[] = [
  'rain',
  'forest',
  'ocean',
  'stream',
  'wind',
  'fireplace',
];

const VOLUME_STEP = 0.1;

/**
 * Transport overlay for ambient backdrop sound. Self-gates on overlayStore.active.
 * Toggles the ambient layer, selects a sound, and adjusts volume via ambientStore.
 */
export function AmbientOverlay(): React.ReactElement | null {
  const active = useOverlayStore(s => s.active);
  const close = useOverlayStore(s => s.close);
  const enabled = useAmbientStore(s => s.enabled);
  const currentSound = useAmbientStore(s => s.currentSound);
  const volume = useAmbientStore(s => s.volume);
  const toggle = useAmbientStore(s => s.toggle);
  const setSound = useAmbientStore(s => s.setSound);
  const setVolume = useAmbientStore(s => s.setVolume);

  if (active !== 'ambient') return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scrim]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>BACKDROP</Text>
        <Text style={styles.title}>Ambient Sound</Text>
        <FocusableButton
          onPress={toggle}
          accessibilityLabel="Toggle ambient sound"
          hasTVPreferredFocus
          style={[styles.toggle, enabled && styles.toggleOn]}>
          <Text style={[styles.toggleText, enabled && styles.toggleTextOn]}>
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </FocusableButton>
        <View style={styles.grid}>
          {SOUNDS.map(sound => {
            const selected = currentSound === sound;
            return (
              <FocusableButton
                key={sound}
                onPress={() => setSound(sound)}
                accessibilityLabel={sound}
                style={[styles.tile, selected && styles.tileActive]}>
                <Text
                  style={[styles.tileText, selected && styles.tileTextActive]}>
                  {sound}
                </Text>
              </FocusableButton>
            );
          })}
        </View>
        <View style={styles.volRow}>
          <FocusableButton
            onPress={() => setVolume(volume - VOLUME_STEP)}
            accessibilityLabel="Volume down"
            style={styles.volBtn}>
            <Text style={styles.volBtnText}>−</Text>
          </FocusableButton>
          <Text style={styles.volText}>{Math.round(volume * 100)}%</Text>
          <FocusableButton
            onPress={() => setVolume(volume + VOLUME_STEP)}
            accessibilityLabel="Volume up"
            style={styles.volBtn}>
            <Text style={styles.volBtnText}>+</Text>
          </FocusableButton>
        </View>
        <FocusableButton
          onPress={close}
          accessibilityLabel="Done"
          style={styles.done}>
          <Text style={styles.doneText}>Done</Text>
        </FocusableButton>
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
    marginBottom: spacing.sm,
  },
  toggle: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  toggleOn: {backgroundColor: colors.text},
  toggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  toggleTextOn: {color: colors.background},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    maxWidth: 520,
  },
  tile: {
    width: 124,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: {backgroundColor: colors.text},
  tileText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tileTextActive: {color: colors.background},
  volRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  volBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volBtnText: {color: colors.text, fontSize: 22, fontWeight: '700'},
  volText: {
    color: colors.text,
    fontSize: 20,
    minWidth: 72,
    textAlign: 'center',
    fontWeight: '700',
  },
  done: {paddingHorizontal: 32, paddingVertical: 10, marginTop: spacing.sm},
  doneText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
});
