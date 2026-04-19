import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {CheckIcon} from '../../components/Icons';
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
        <Text style={styles.pageTitle}>Settings</Text>

        <Text style={styles.sectionLabel}>DEFAULT RECITER</Text>
        <Text style={styles.currentValue}>
          {current?.name ?? 'Not set — pick one below'}
        </Text>
        <View style={styles.grid}>
          {reciters.slice(0, 18).map((r, i) => {
            const selected = defaultReciterId === r.id;
            return (
              <FocusableCard
                key={r.id}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setDefaultReciter(r.id)}
                hasTVPreferredFocus={i === 0}>
                <View style={styles.chipInner}>
                  {selected && <CheckIcon color={colors.text} size={16} />}
                  <Text style={styles.chipText}>{r.name}</Text>
                </View>
              </FocusableCard>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, {marginTop: spacing.xxl}]}>
          ABOUT
        </Text>
        <Text style={styles.aboutText}>Bayaan TV · v0.1.0</Text>
        <Text style={styles.aboutSub}>
          Quran recitations on your television, from the Bayaan team.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.xl, gap: 4, paddingBottom: spacing.xxl},
  pageTitle: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.8,
    marginBottom: 8,
  },
  currentValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: spacing.md,
    opacity: 0.85,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 22,
  },
  chipActive: {backgroundColor: colors.surfaceElevated},
  chipInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  chipText: {color: colors.text, fontSize: 15, fontWeight: '500'},
  aboutText: {color: colors.text, fontSize: 18, fontWeight: '500'},
  aboutSub: {
    color: colors.textSecondary,
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
});
