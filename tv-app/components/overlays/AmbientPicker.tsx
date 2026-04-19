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
      <Text style={styles.kicker}>BACKDROP</Text>
      <Text style={styles.title}>Ambient Sound</Text>
      <FocusableButton
        onPress={toggle}
        accessibilityLabel="Toggle ambient"
        style={[styles.toggle, enabled && styles.toggleOn]}
        hasTVPreferredFocus>
        <Text style={[styles.toggleText, enabled && styles.toggleTextOn]}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </FocusableButton>
      <View style={styles.grid}>
        {SOUNDS.map(s => {
          const active = currentSound === s;
          return (
            <FocusableButton
              key={s}
              onPress={() => setSound(s)}
              accessibilityLabel={s}
              style={[styles.card, active && styles.cardActive]}>
              <Text style={[styles.cardText, active && styles.cardTextActive]}>
                {s}
              </Text>
            </FocusableButton>
          );
        })}
      </View>
      <View style={styles.volRow}>
        <FocusableButton
          onPress={() => setVolume(volume - 0.1)}
          accessibilityLabel="Volume down"
          style={styles.volBtn}>
          <Text style={styles.volBtnText}>−</Text>
        </FocusableButton>
        <Text style={styles.volText}>{Math.round(volume * 100)}%</Text>
        <FocusableButton
          onPress={() => setVolume(volume + 0.1)}
          accessibilityLabel="Volume up"
          style={styles.volBtn}>
          <Text style={styles.volBtnText}>+</Text>
        </FocusableButton>
      </View>
      <FocusableButton
        onPress={close}
        accessibilityLabel="Close"
        style={styles.close}>
        <Text style={styles.closeText}>Done</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {padding: spacing.xl, gap: 4, alignItems: 'center'},
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
    marginBottom: 18,
  },
  toggle: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
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
    gap: 10,
    justifyContent: 'center',
    maxWidth: 520,
  },
  card: {
    width: 124,
    height: 80,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActive: {backgroundColor: colors.text},
  cardText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardTextActive: {color: colors.background},
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  close: {paddingHorizontal: 32, paddingVertical: 10, marginTop: 8},
  closeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.7,
  },
});
