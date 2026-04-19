import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {useReciters} from '../hooks/useReciters';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

export function SettingsScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const {defaultReciterId, setDefaultReciter} = useDefaultReciter();
  const current = reciters.find(r => r.id === defaultReciterId);

  return (
    <View style={styles.container}>
      <TopTabBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Default reciter</Text>
        <Text style={styles.sub}>{current?.name ?? 'Not set'}</Text>
        <View style={styles.grid}>
          {reciters.slice(0, 12).map((r, i) => (
            <FocusableCard
              key={r.id}
              style={[
                styles.chip,
                defaultReciterId === r.id && styles.chipActive,
              ]}
              onPress={() => setDefaultReciter(r.id)}
              hasTVPreferredFocus={i === 0}>
              <Text style={styles.chipText}>{r.name}</Text>
            </FocusableCard>
          ))}
        </View>
        <Text style={[styles.section, {marginTop: spacing.xl}]}>About</Text>
        <Text style={styles.sub}>Bayaan TV · v0.1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.xl, gap: spacing.sm},
  section: {color: colors.text, ...typography.heading},
  sub: {
    color: colors.textSecondary,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  chipActive: {backgroundColor: colors.surfaceElevated},
  chipText: {color: colors.text, fontSize: 14},
});
