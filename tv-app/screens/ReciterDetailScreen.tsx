import React, {useEffect, useState} from 'react';
import {Image} from 'expo-image';
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
  const totalSurahs = rewayat.reduce((sum, r) => sum + r.surah_list.length, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        {reciter.image_url ? (
          <Image
            source={{uri: reciter.image_url}}
            style={styles.heroImg}
            contentFit="cover"
            blurRadius={80}
            cachePolicy="memory-disk"
          />
        ) : null}
        <View style={styles.heroScrim} />
        <View style={styles.heroContent}>
          {reciter.image_url ? (
            <Image
              source={{uri: reciter.image_url}}
              style={styles.portrait}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.portrait, styles.portraitPlaceholder]}>
              <Text style={styles.portraitInitial}>
                {reciter.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroMeta}>
            <Text style={styles.kicker}>RECITER</Text>
            <Text style={styles.title}>{reciter.name}</Text>
            <Text style={styles.sub}>
              {rewayat.length} {rewayat.length === 1 ? 'rewayah' : 'rewayat'}
              {'  ·  '}
              {totalSurahs} surahs
            </Text>
          </View>
        </View>
      </View>

      {rewayat.length > 1 && (
        <View style={styles.rewayahRow}>
          {rewayat.map((r, i) => (
            <FocusableCard
              key={r.id}
              style={[
                styles.chip,
                activeRewayahId === r.id && styles.chipActive,
              ]}
              onPress={() => setActive(r.id)}
              hasTVPreferredFocus={i === 0}>
              <Text style={styles.chipText}>{r.name}</Text>
            </FocusableCard>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>SURAHS</Text>
      <View style={styles.grid}>
        {surahNumbers.map((n, i) => (
          <FocusableCard
            key={n}
            style={styles.surahCard}
            hasTVPreferredFocus={rewayat.length <= 1 && i === 0}
            onPress={async () => {
              if (!current) return;
              await playRewayah(reciter.id, reciter.name, current, n);
              push({screen: 'nowPlaying'});
            }}>
            <Text style={styles.num}>{n}</Text>
            <Text style={styles.name} numberOfLines={1}>
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
  scroll: {paddingBottom: spacing.xxl},
  hero: {
    height: 320,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  heroImg: {...StyleSheet.absoluteFillObject, opacity: 0.55},
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  portrait: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  portraitPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  portraitInitial: {
    color: colors.text,
    fontSize: 96,
    fontWeight: '200',
    opacity: 0.5,
  },
  heroMeta: {flex: 1, paddingBottom: spacing.sm, gap: 4},
  kicker: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {color: colors.text, ...typography.title, lineHeight: 56},
  sub: {color: colors.text, fontSize: 16, opacity: 0.7, marginTop: 2},
  rewayahRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: 2,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  chipActive: {backgroundColor: colors.surfaceElevated},
  chipText: {color: colors.text, fontSize: 15, fontWeight: '600'},
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: 12,
    opacity: 0.85,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: spacing.xl,
  },
  surahCard: {
    width: 150,
    height: 110,
    backgroundColor: colors.surface,
    padding: 14,
    justifyContent: 'space-between',
  },
  num: {color: colors.text, fontSize: 26, fontWeight: '700'},
  name: {color: colors.text, fontSize: 14, opacity: 0.85},
});
