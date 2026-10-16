import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image} from 'expo-image';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusIcon, FocusText} from '../components/primitives/focusContext';
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
import {fonts, typography} from '../theme/typography';
import {spacing} from '../theme/spacing';
import {createScaledStyles} from '../theme/scale';
import {getReciterArtwork} from '../services/reciterArtwork';

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
  const pop = useNavStore(s => s.pop);
  const [sort, setSort] = useState<SortMode>('asc');
  const [loading, setLoading] = useState<boolean>(
    () => (getCachedRewayat(reciterId)?.length ?? 0) === 0,
  );

  const scrollRef = useRef<ScrollView>(null);
  const restoredRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetchRewayat(reciterId)
      .then(r => {
        if (cancelled || r.length === 0) return;
        setRewayat(r);
        setActive(prev => prev ?? r[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  if (!reciter) {
    return (
      <View style={[styles.container, styles.notFound]}>
        <Text style={styles.notFoundTitle}>Reciter unavailable</Text>
        <Text style={styles.notFoundSub}>
          We couldn&apos;t load this reciter. Head back and pick another.
        </Text>
        <FocusableButton
          onPress={pop}
          accessibilityLabel="Go back"
          hasTVPreferredFocus
          outlined
          style={styles.notFoundBtn}>
          <FocusText style={styles.notFoundBtnText}>Go back</FocusText>
        </FocusableButton>
      </View>
    );
  }

  const surahByNumber = new Map<number, string>(
    SURAHS.map(s => [s.id, s.name]),
  );
  const totalSurahs = rewayat.reduce((sum, r) => sum + r.surah_list.length, 0);

  const artwork = getReciterArtwork(reciter);

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
        {artwork ? (
          <Image
            source={artwork}
            style={styles.heroImg}
            contentFit="cover"
            blurRadius={80}
            cachePolicy="memory-disk"
          />
        ) : null}
        <View style={styles.heroScrim} />
        <FocusableButton
          onPress={pop}
          accessibilityLabel="Back"
          style={styles.back}>
          <FocusText style={styles.backText}>‹ Back</FocusText>
        </FocusableButton>
        <View style={styles.heroContent}>
          {artwork ? (
            <Image
              source={artwork}
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
            <TVFocusGuideView autoFocus style={styles.heroActions}>
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
                  outlined
                  style={styles.actionBtn}>
                  <View style={styles.favInner}>
                    <FocusIcon icon={PlayIcon} size={20} />
                    <FocusText style={styles.actionText}>
                      {resumeEntry
                        ? `Continue · ${
                            surahByNumber.get(resumeEntry.surahNumber) ??
                            `Surah ${resumeEntry.surahNumber}`
                          }`
                        : 'Play'}
                    </FocusText>
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
                  style={styles.actionBtn}>
                  <View style={styles.favInner}>
                    <FocusIcon icon={ShuffleIcon} size={20} />
                    <FocusText style={styles.actionText}>Shuffle</FocusText>
                  </View>
                </FocusableButton>
              ) : null}
              <FocusableButton
                onPress={() => toggleFavorite(reciterId)}
                accessibilityLabel={
                  isFav ? 'Remove from favorites' : 'Add to favorites'
                }
                style={styles.actionBtn}>
                <View style={styles.favInner}>
                  <FocusIcon icon={HeartIcon} size={20} filled={isFav} />
                  <FocusText style={styles.actionText}>
                    {isFav ? 'Favorited' : 'Favorite'}
                  </FocusText>
                </View>
              </FocusableButton>
            </TVFocusGuideView>
          </View>
        </View>
      </View>

      {rewayat.length > 1 && (
        <TVFocusGuideView autoFocus style={styles.rewayahRow}>
          {rewayat.map(r => (
            <Tab
              key={r.id}
              label={r.name}
              selected={activeRewayahId === r.id}
              onPress={() => setActive(r.id)}
            />
          ))}
        </TVFocusGuideView>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>Surahs</Text>
        {sortedSurahNumbers.length > 1 ? (
          <TVFocusGuideView autoFocus style={styles.sortRow}>
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
          </TVFocusGuideView>
        ) : null}
      </View>
      {sortedSurahNumbers.length > 0 ? (
        <TVFocusGuideView autoFocus style={styles.grid}>
          {sortedSurahNumbers.map(n => {
            const p = progressByNumber.get(n);
            const ratio =
              p && p.durationSeconds > 0
                ? Math.min(1, p.positionSeconds / p.durationSeconds)
                : 0;
            const completed = ratio >= 0.97;
            const inProgress = ratio > 0.02 && !completed;
            return (
              <FocusableButton
                key={n}
                style={styles.surahCard}
                accessibilityLabel={surahByNumber.get(n) ?? `Surah ${n}`}
                onPress={async () => {
                  if (!current) return;
                  await playRewayah(reciter.id, reciter.name, current, n);
                  push({screen: 'nowPlaying'});
                }}>
                {focused => (
                  <>
                    <View style={styles.surahTop}>
                      <FocusText
                        style={styles.num}
                        color={colors.textTertiary}
                        focusedColor={colors.onFocusSecondary}>
                        {n}
                      </FocusText>
                      {completed ? (
                        <FocusIcon
                          icon={CheckIcon}
                          color={colors.accent}
                          size={20}
                        />
                      ) : null}
                    </View>
                    <FocusText style={styles.name} numberOfLines={1}>
                      {surahByNumber.get(n) ?? `Surah ${n}`}
                    </FocusText>
                    {inProgress ? (
                      <View
                        style={[
                          styles.progressTrack,
                          focused && styles.progressTrackFocused,
                        ]}>
                        <View
                          style={[
                            styles.progressFill,
                            focused && styles.progressFillFocused,
                            {width: `${ratio * 100}%`},
                          ]}
                        />
                      </View>
                    ) : null}
                  </>
                )}
              </FocusableButton>
            );
          })}
        </TVFocusGuideView>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : (
        <View style={styles.noSurahs}>
          <Text style={styles.noSurahsText}>
            No surahs are available for this rewayah yet.
          </Text>
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

type TabProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  small?: boolean;
  accessibilityLabel?: string;
};

/**
 * A plain text tab: the selected one is cream with a thin sky underline, so
 * "selected" and "focused" (the cream fill) never look alike.
 */
function Tab({
  label,
  selected,
  onPress,
  small,
  accessibilityLabel,
}: TabProps): React.ReactElement {
  const name = accessibilityLabel ?? label;
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={selected ? `${name}, selected` : name}
      style={[styles.tab, small && styles.tabSmall]}>
      {focused => (
        <>
          <FocusText
            style={[styles.tabText, small && styles.tabTextSmall]}
            color={selected ? colors.text : colors.textSecondary}>
            {label}
          </FocusText>
          <View
            style={[styles.tabLine, selected && !focused && styles.tabLineOn]}
          />
        </>
      )}
    </FocusableButton>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Tab
      small
      label={label}
      selected={active}
      onPress={onPress}
      accessibilityLabel={`Sort ${label}`}
    />
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {paddingBottom: spacing.xxl},
  back: {
    position: 'absolute',
    top: 24,
    // Not left of the grid's edge: Android's focus finder would treat Back
    // as "left of" the first surah and jump up to it.
    left: spacing.xl,
    zIndex: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
  },
  backText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
  },
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
    borderRadius: 120,
    backgroundColor: colors.surfaceElevated,
  },
  portraitPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  portraitInitial: {
    color: colors.text,
    fontFamily: fonts.extraLight,
    fontSize: 104,
    fontWeight: '200',
    opacity: 0.45,
  },
  heroMeta: {flex: 1, paddingBottom: spacing.sm, gap: 6},
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    ...typography.titleXL,
    lineHeight: 70,
    letterSpacing: -1,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    marginTop: 6,
  },
  heroActions: {flexDirection: 'row', marginTop: 16, gap: 12, flexWrap: 'wrap'},
  favInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  actionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 19,
    fontWeight: '700',
  },
  tab: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  tabSmall: {paddingHorizontal: 14, paddingTop: 7, paddingBottom: 4},
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
  },
  tabTextSmall: {fontSize: 16},
  tabLine: {
    marginTop: 6,
    height: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabLineOn: {backgroundColor: colors.accent},
  rewayahRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.xl - 18,
    marginTop: 2,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 24,
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
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(244,243,236,0.16)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressTrackFocused: {backgroundColor: 'rgba(6,21,28,0.18)'},
  progressFill: {height: '100%', backgroundColor: colors.text, borderRadius: 2},
  progressFillFocused: {backgroundColor: colors.onFocus},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: spacing.xl,
    paddingVertical: 8,
  },
  surahCard: {
    width: 196,
    height: 112,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  surahTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  num: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 19,
    fontWeight: '600',
  },
  loadingRow: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'flex-start',
  },
  noSurahs: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  noSurahsText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    opacity: 0.8,
  },
  notFound: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  notFoundTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  notFoundSub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 30,
    opacity: 0.8,
  },
  notFoundBtn: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: spacing.sm,
  },
  notFoundBtnText: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
  },
  bioBlock: {marginTop: spacing.xl},
  bio: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 30,
    paddingHorizontal: spacing.xl,
    opacity: 0.85,
    maxWidth: 900,
  },
});
