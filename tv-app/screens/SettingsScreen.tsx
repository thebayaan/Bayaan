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
        <Text style={styles.kicker}>PROFILE</Text>
        <Text style={styles.pageTitle}>Settings</Text>

        <Text style={styles.sectionLabel}>Default Reciter</Text>
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
                  {selected && (
                    <CheckIcon color={colors.background} size={16} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextActive,
                    ]}>
                    {r.name}
                  </Text>
                </View>
              </FocusableCard>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, {marginTop: spacing.xxl}]}>
          About
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: 4,
  },
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    opacity: 0.55,
    marginBottom: 6,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  currentValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: spacing.md,
    opacity: 0.75,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
  },
  chipActive: {backgroundColor: colors.text},
  chipInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  chipText: {color: colors.text, fontSize: 15, fontWeight: '600'},
  chipTextActive: {color: colors.background},
  aboutText: {color: colors.text, fontSize: 18, fontWeight: '500'},
  aboutSub: {
    color: colors.textSecondary,
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
});
