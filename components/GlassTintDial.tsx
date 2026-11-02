// @ai-generated
/**
 * Temporary: a floating dial for the glass tint, so it can be tuned on a
 * device. A chip under the status bar shows the current theme's alpha; tap
 * it for a slider. Remove once store/glassTintStore's defaults are settled.
 */

import React, {useState} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {NativeSlider} from '@/components/native/NativeSlider';
import {
  DEFAULT_GLASS_TINT_ALPHA,
  useGlassTintStore,
} from '@/store/glassTintStore';

const MAX_ALPHA = 0.8;

export function GlassTintDial(): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const isDark = useTheme().theme.isDarkMode;
  const mode = isDark ? 'dark' : 'light';
  const alpha = useGlassTintStore(s => s[mode]);
  const setAlpha = useGlassTintStore(s => s.setAlpha);
  const [open, setOpen] = useState(false);

  if (!USE_GLASS) return null;

  const label = `Tint ${alpha.toFixed(2)}`;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, {top: insets.top + 56}]}>
      {open ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>
              {label} ({mode})
            </Text>
            <Pressable
              onPress={() => setAlpha(mode, DEFAULT_GLASS_TINT_ALPHA[mode])}
              hitSlop={8}>
              <Text style={styles.action}>Reset</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={styles.action}>Done</Text>
            </Pressable>
          </View>
          <NativeSlider
            value={alpha}
            minimumValue={0}
            maximumValue={MAX_ALPHA}
            step={0.01}
            onValueChange={next => setAlpha(mode, Math.round(next * 100) / 100)}
            accessibilityLabel="Glass tint"
            style={styles.slider}
          />
        </View>
      ) : (
        <Pressable onPress={() => setOpen(true)} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {position: 'absolute', left: 12, right: 12, zIndex: 9998},
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,59,48,0.9)',
  },
  chipText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  card: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(20,20,20,0.92)',
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 16},
  title: {flex: 1, color: '#fff', fontSize: 14, fontWeight: '600'},
  action: {color: '#0A84FF', fontSize: 14, fontWeight: '600'},
  slider: {marginTop: 8, height: 32},
});
