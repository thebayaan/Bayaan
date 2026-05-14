// components/search/v2/TabBar.tsx
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {EntityType} from '@/services/search/types';

export interface Tab {
  type: EntityType | 'all';
  label: string;
  count: number;
}

interface Props {
  tabs: Tab[];
  active: EntityType | 'all';
  onChange: (t: EntityType | 'all') => void;
}

export function TabBar({tabs, active, onChange}: Props) {
  if (tabs.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {tabs.map(t => {
        const isActive = t.type === active;
        return (
          <Pressable
            key={t.type}
            onPress={() => onChange(t.type)}
            style={[styles.chip, isActive && styles.chipActive]}>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {t.label}
            </Text>
            {t.count > 0 && t.type !== 'all' && (
              <View style={styles.countBox}>
                <Text style={styles.countText}>{t.count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {paddingHorizontal: 12, paddingVertical: 8, gap: 8},
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {backgroundColor: '#d4af37', borderColor: '#d4af37'},
  label: {color: '#8e8e93', fontSize: 12, fontWeight: '600'},
  labelActive: {color: '#0a0a0a'},
  countBox: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {fontSize: 10, color: '#0a0a0a', fontWeight: '700'},
});
