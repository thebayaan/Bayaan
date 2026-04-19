import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image} from 'expo-image';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusableCard} from '../components/primitives/FocusableCard';
import {fetchRewayat, getCachedRewayat} from '../services/tvDataService';
import {toggleFavorite} from '../services/favoritesStore';
import {useReciters} from '../hooks/useReciters';
import {useFavorites} from '../hooks/useFavorites';
import {useContinueListening} from '../hooks/useContinueListening';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import type {Rewayah} from '../types/reciter';
import {SURAHS} from '../../data/surahData';
import {
  CheckIcon,
  HeartIcon,
  PlayIcon,
  ShuffleIcon,
} from '../../components/Icons';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';
import {spacing} from '../theme/spacing';

type Props = {reciterId: string};
type SortMode = 'asc' | 'desc' | 'revelation';

const scrollPositions = new Map<string, number>();

const revelationOrder = new Map<number, number>(
  SURAHS.map(s => [s.id, s.revelation_order]),
);

export function ReciterDetailScreen({reciterId}: Props): React.ReactElement {
  const {reciters} = useReciters();
  const reciter = reciters.find(r => r.id === reciterId);
  const [rewayat, setRewayat] = useState<Rewayah[]>(
    () => getCachedRewayat(reciterId) ?? [],
  );
  const [activeRewayahId, setActive] = useState<string | null>(
    () => getCachedRewayat(reciterId)?.[0]?.id ?? null,
  );
  const {playRewayah, shufflePlayRewayah} = usePlayer();
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const isFav = favorites.some(f => f.reciterId === reciterId);
  const push = useNavStore(s => s.push);
  const [sort, setSort] = useState<SortMode>('asc');

  const scrollRef = useRef<ScrollView>(null);
  const restoredRef = useRef<boolean>(false);

  useEffect(() => {
    fetchRewayat(reciterId).then(r => {
      if (r.length === 0) return;
      setRewayat(r);
      setActive(prev => prev ?? r[0]?.id ?? null);
    });
  }, [reciterId]);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>): void {
    scrollPositions.set(reciterId, e.nativeEvent.contentOffset.y);
  }

  function handleContentSizeChange(_: number, height: number): void {
    if (restoredRef.current) return;
    const saved = scrollPositions.get(reciterId);
    if (saved === undefined || saved <= 0) {
      restoredRef.current = true;
      return;
    }
    if (height < saved) return;
    scrollRef.current?.scrollTo({y: saved, animated: false});
    restoredRef.current = true;
  }

  const current = rewayat.find(r => r.id === activeRewayahId);
  const baseSurahNumbers: number[] = useMemo(
    () => (current ? current.surah_list.filter(n => n > 0) : []),
    [current],
  );

  const sortedSurahNumbers = useMemo(() => {
    const copy = baseSurahNumbers.slice();
    if (sort === 'asc') return copy.sort((a, b) => a - b);
    if (sort === 'desc') return copy.sort((a, b) => b - a);
    return copy.sort(
      (a, b) => (revelationOrder.get(a) ?? a) - (revelationOrder.get(b) ?? b),
    );
  }, [baseSurahNumbers, sort]);

  const resumeEntry = useMemo(() => {
    if (!current) return null;
    return (
      continueEntries.find(
        e => e.reciterId === reciterId && e.rewayahId === current.id,
      ) ?? null
    );
  }, [continueEntries, current, reciterId]);

  const progressByNumber = useMemo(() => {
    const map = new Map<
      number,
      {positionSeconds: number; durationSeconds: number}
    >();
    continueEntries
      .filter(e => e.reciterId === reciterId)
      .forEach(e =>
        map.set(e.surahNumber, {
          positionSeconds: e.positionSeconds,
          durationSeconds: e.durationSeconds,
        }),
      );
    return map;
  }, [continueEntries, reciterId]);

  if (!reciter) return <View style={styles.container} />;

  const surahByNumber = new Map<number, string>(
    SURAHS.map(s => [s.id, s.name]),
  );
  const totalSurahs = rewayat.reduce((sum, r) => sum + r.surah_list.length, 0);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.scroll}
      scrollEventThrottle={250}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}>
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
            {rewayat.length > 0 ? (
              <Text style={styles.sub}>
                {rewayat.length} {rewayat.length === 1 ? 'rewayah' : 'rewayat'}
                {'  ·  '}
                {totalSurahs} surahs
              </Text>
            ) : null}
            <View style={styles.heroActions}>
              {current ? (
                <FocusableButton
                  onPress={async () => {
                    const target =
                      resumeEntry?.surahNumber ?? sortedSurahNumbers[0];
                    if (target === undefined) return;
                    await playRewayah(
                      reciter.id,
                      reciter.name,
                      current,
                      target,
                    );
                    push({screen: 'nowPlaying'});
                  }}
                  accessibilityLabel={resumeEntry ? 'Continue' : 'Play'}
                  hasTVPreferredFocus
                  style={[styles.primaryBtn]}>
                  <View style={styles.favInner}>
                    <PlayIcon color={colors.background} size={18} />
                    <Text style={styles.primaryText}>
                      {resumeEntry
                        ? `Continue · ${
                            surahByNumber.get(resumeEntry.surahNumber) ??
                            `Surah ${resumeEntry.surahNumber}`
                          }`
                        : 'Play'}
                    </Text>
                  </View>
                </FocusableButton>
              ) : null}
              {current && sortedSurahNumbers.length > 1 ? (
                <FocusableButton
                  onPress={async () => {
                    await shufflePlayRewayah(reciter.id, reciter.name, current);
                    push({screen: 'nowPlaying'});
                  }}
                  accessibilityLabel="Shuffle play"
                  style={styles.ghostBtn}>
                  <View style={styles.favInner}>
                    <ShuffleIcon color={colors.text} size={18} />
                    <Text style={styles.favText}>Shuffle</Text>
                  </View>
                </FocusableButton>
              ) : null}
              <FocusableButton
                onPress={() => toggleFavorite(reciterId)}
                accessibilityLabel={
                  isFav ? 'Remove from favorites' : 'Add to favorites'
                }
                style={[styles.favBtn, isFav && styles.favBtnActive]}>
                <View style={styles.favInner}>
                  <HeartIcon
                    color={isFav ? colors.background : colors.text}
                    size={18}
                    filled={isFav}
                  />
                  <Text style={[styles.favText, isFav && styles.favTextActive]}>
                    {isFav ? 'Favorited' : 'Favorite'}
                  </Text>
                </View>
              </FocusableButton>
            </View>
          </View>
        </View>
      </View>

      {rewayat.length > 1 && (
        <View style={styles.rewayahRow}>
          {rewayat.map(r => (
            <FocusableCard
              key={r.id}
              style={[
                styles.chip,
                activeRewayahId === r.id && styles.chipActive,
              ]}
              onPress={() => setActive(r.id)}>
              <Text
                style={[
                  styles.chipText,
                  activeRewayahId === r.id && styles.chipTextActive,
                ]}>
                {r.name}
              </Text>
            </FocusableCard>
          ))}
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>Surahs</Text>
        {sortedSurahNumbers.length > 1 ? (
          <View style={styles.sortRow}>
            <SortChip
              label="1–114"
              active={sort === 'asc'}
              onPress={() => setSort('asc')}
            />
            <SortChip
              label="114–1"
              active={sort === 'desc'}
              onPress={() => setSort('desc')}
            />
            <SortChip
              label="Revelation"
              active={sort === 'revelation'}
              onPress={() => setSort('revelation')}
            />
          </View>
        ) : null}
      </View>
      {sortedSurahNumbers.length > 0 ? (
        <View style={styles.grid}>
          {sortedSurahNumbers.map(n => {
            const p = progressByNumber.get(n);
            const ratio =
              p && p.durationSeconds > 0
                ? Math.min(1, p.positionSeconds / p.durationSeconds)
                : 0;
            const completed = ratio >= 0.97;
            const inProgress = ratio > 0.02 && !completed;
            return (
              <FocusableCard
                key={n}
                style={styles.surahCard}
                onPress={async () => {
                  if (!current) return;
                  await playRewayah(reciter.id, reciter.name, current, n);
                  push({screen: 'nowPlaying'});
                }}>
                <View style={styles.numBadge}>
                  {completed ? (
                    <CheckIcon color={colors.text} size={20} />
                  ) : (
                    <Text style={styles.num}>{n}</Text>
                  )}
                </View>
                <View style={styles.surahMeta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {surahByNumber.get(n) ?? `Surah ${n}`}
                  </Text>
                  {inProgress ? (
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {width: `${ratio * 100}%`},
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              </FocusableCard>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyGrid}>
          {Array.from({length: 10}).map((_, i) => (
            <View key={i} style={[styles.surahCard, styles.surahSkeleton]} />
          ))}
        </View>
      )}

      {reciter.bio ? (
        <View style={styles.bioBlock}>
          <Text style={styles.sectionLabel}>About</Text>
          <Text style={styles.bio}>{reciter.bio}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

type SortChipProps = {label: string; active: boolean; onPress: () => void};

function SortChip({label, active, onPress}: SortChipProps): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={`Sort ${label}`}
      style={[styles.sortChip, active && styles.sortChipActive]}>
      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
        {label}
      </Text>
    </FocusableButton>
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
  heroActions: {flexDirection: 'row', marginTop: 16, gap: 12, flexWrap: 'wrap'},
  primaryBtn: {
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 26,
    backgroundColor: colors.text,
  },
  primaryText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ghostBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  favBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  favBtnActive: {backgroundColor: colors.text},
  favInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  favText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  favTextActive: {color: colors.background},
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
  chipTextActive: {color: colors.background},
  sectionLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.xl,
  },
  sortRow: {flexDirection: 'row', gap: 8, marginTop: spacing.md},
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sortChipActive: {backgroundColor: colors.text},
  sortChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  sortChipTextActive: {color: colors.background},
  surahMeta: {flex: 1, gap: 4},
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {height: '100%', backgroundColor: colors.text, borderRadius: 2},
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
  emptyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: spacing.xl,
  },
  bioBlock: {marginTop: spacing.xl},
  bio: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 28,
    paddingHorizontal: spacing.xl,
    opacity: 0.85,
    maxWidth: 900,
  },
  surahSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    opacity: 0.5,
  },
});
