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

      <Text style={styles.sectionLabel}>Surahs</Text>
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
            <View style={styles.numBadge}>
              <Text style={styles.num}>{n}</Text>
            </View>
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
    height: 380,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  heroImg: {...StyleSheet.absoluteFillObject, opacity: 0.6},
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  portrait: {
    width: 240,
    height: 240,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  portraitPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  portraitInitial: {
    color: colors.text,
    fontSize: 104,
    fontWeight: '200',
    opacity: 0.45,
  },
  heroMeta: {flex: 1, paddingBottom: spacing.sm, gap: 6},
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    opacity: 0.7,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    ...typography.titleXL,
    lineHeight: 70,
    letterSpacing: -1,
  },
  sub: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    opacity: 0.75,
    marginTop: 6,
  },
  rewayahRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: 2,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
  },
  chipActive: {backgroundColor: colors.text},
  chipText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: spacing.xl,
  },
  surahCard: {
    width: 170,
    height: 120,
    backgroundColor: colors.surface,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
  },
});
