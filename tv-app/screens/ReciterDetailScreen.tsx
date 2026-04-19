import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {fetchRewayat} from '../services/tvDataService';
import {useReciters} from '../hooks/useReciters';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import type {Rewayah} from '../types/reciter';
import {SURAHS} from '../../data/surahData';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';
import {spacing} from '../theme/spacing';

type Props = {reciterId: string};

export function ReciterDetailScreen({reciterId}: Props): React.ReactElement {
  const {reciters} = useReciters();
  const reciter = reciters.find(r => r.id === reciterId);
  const [rewayat, setRewayat] = useState<Rewayah[]>([]);
  const [activeRewayahId, setActive] = useState<string | null>(null);
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);

  useEffect(() => {
    fetchRewayat(reciterId).then(r => {
      setRewayat(r);
      setActive(r[0]?.id ?? null);
    });
  }, [reciterId]);

  if (!reciter) return <View style={styles.container} />;

  const current = rewayat.find(r => r.id === activeRewayahId);
  const surahNumbers: number[] = current
    ? current.surah_list.filter(n => n > 0)
    : [];
  const surahByNumber = new Map<number, string>(
    SURAHS.map(s => [s.id, s.name]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{reciter.name}</Text>
      <View style={styles.rewayahRow}>
        {rewayat.map((r, i) => (
          <FocusableCard
            key={r.id}
            style={[styles.chip, activeRewayahId === r.id && styles.chipActive]}
            onPress={() => setActive(r.id)}
            hasTVPreferredFocus={i === 0}>
            <Text style={styles.chipText}>{r.name}</Text>
          </FocusableCard>
        ))}
      </View>
      <View style={styles.grid}>
        {surahNumbers.map(n => (
          <FocusableCard
            key={n}
            style={styles.surahCard}
            onPress={async () => {
              if (!current) return;
              await playRewayah(reciter.id, reciter.name, current, n);
              push({screen: 'nowPlaying'});
            }}>
            <Text style={styles.num}>{n}</Text>
            <Text style={styles.name}>
              {surahByNumber.get(n) ?? `Surah ${n}`}
            </Text>
          </FocusableCard>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {padding: spacing.xl},
  title: {color: colors.text, ...typography.title},
  rewayahRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  chipActive: {backgroundColor: colors.surfaceElevated},
  chipText: {color: colors.text, fontSize: 14},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: spacing.lg,
  },
  surahCard: {
    width: 120,
    height: 90,
    backgroundColor: colors.surface,
    padding: 10,
    justifyContent: 'space-between',
  },
  num: {color: colors.text, fontSize: 18, fontWeight: '700'},
  name: {color: colors.text, fontSize: 12},
});
