// components/search/v2/SignalIcon.tsx
import { Text, View, StyleSheet } from 'react-native';
import type { Signal } from '@/services/search/types';

const GLYPH: Record<Signal, string> = {
  loved: '♥',
  recent: '⏱',
  default: '★',
  morning: '☀',
  evening: '☾',
  friday: 'F',
};

export function SignalIcon({ signal }: { signal: Signal | null }) {
  if (!signal) return null;
  return (
    <View accessibilityLabel={signal} style={styles.box}>
      <Text style={styles.glyph}>{GLYPH[signal]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginLeft: 6, opacity: 0.75 },
  glyph: { color: '#d4af37', fontSize: 12, fontWeight: '600' },
});
