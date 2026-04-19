// tv-app/components/overlays/AmbientPicker.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useAmbientStore, type AmbientSound} from '../../store/ambientStore';
import {useOverlayStore} from '../../store/overlayStore';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const SOUNDS: AmbientSound[] = [
  'rain',
  'forest',
  'ocean',
  'stream',
  'wind',
  'fireplace',
];

export function AmbientPicker(): React.ReactElement {
  const {enabled, currentSound, volume, toggle, setSound, setVolume} =
    useAmbientStore();
  const close = useOverlayStore(s => s.close);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Ambient Sound</Text>
      <FocusableButton
        onPress={toggle}
        accessibilityLabel="Toggle ambient"
        style={styles.chip}
        hasTVPreferredFocus>
        <Text style={styles.chipText}>{enabled ? 'On' : 'Off'}</Text>
      </FocusableButton>
      <View style={styles.grid}>
        {SOUNDS.map(s => (
          <FocusableButton
            key={s}
            onPress={() => setSound(s)}
            accessibilityLabel={s}
            style={[styles.card, currentSound === s && styles.cardActive]}>
            <Text style={styles.cardText}>{s}</Text>
          </FocusableButton>
        ))}
      </View>
      <View style={styles.volRow}>
        <FocusableButton
          onPress={() => setVolume(volume - 0.1)}
          accessibilityLabel="Volume down"
          style={styles.volBtn}>
          <Text style={styles.chipText}>−</Text>
        </FocusableButton>
        <Text style={styles.volText}>{Math.round(volume * 100)}%</Text>
        <FocusableButton
          onPress={() => setVolume(volume + 0.1)}
          accessibilityLabel="Volume up"
          style={styles.volBtn}>
          <Text style={styles.chipText}>+</Text>
        </FocusableButton>
      </View>
      <FocusableButton
        onPress={close}
        accessibilityLabel="Close"
        style={styles.close}>
        <Text style={styles.chipText}>Done</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {padding: spacing.lg, gap: spacing.md, alignItems: 'center'},
  title: {color: colors.text, fontSize: 24, fontWeight: '600'},
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  chipText: {color: colors.text, fontSize: 18, fontWeight: '600'},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  card: {
    width: 110,
    height: 70,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActive: {backgroundColor: colors.surfaceElevated},
  cardText: {color: colors.text, fontSize: 14, textTransform: 'capitalize'},
  volRow: {flexDirection: 'row', gap: spacing.md, alignItems: 'center'},
  volBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volText: {
    color: colors.text,
    fontSize: 20,
    minWidth: 60,
    textAlign: 'center',
  },
  close: {paddingHorizontal: 24, paddingVertical: 10},
});
