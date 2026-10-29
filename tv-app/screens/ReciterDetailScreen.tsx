import {FlashList, type FlashListRef} from '@shopify/flash-list';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Image} from 'expo-image';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
} from 'react-native';
import {FilterChip} from '../components/browse/FilterChip';
import {
  ReciterPortrait,
  reciterArabicName,
} from '../components/browse/ReciterPortrait';
import {SurahRow, SURAH_ROW_HEIGHT} from '../components/browse/SurahRow';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusIcon, FocusText} from '../components/primitives/focusContext';
import {fetchRewayat, getCachedRewayat} from '../services/tvDataService';
import {toggleFavorite} from '../services/favoritesStore';
import {
  SURAHS,
  groupRewayat,
  rewayahDisplayName,
  styleLabel,
} from '../services/browseCatalog';
import {useReciters} from '../hooks/useReciters';
import {useFavorites} from '../hooks/useFavorites';
import {useContinueListening} from '../hooks/useContinueListening';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import {useSettingsStore} from '../store/settingsStore';
import type {Rewayah, Surah} from '../types/reciter';
import {
  CheckIcon,
  HeartIcon,
  PlayIcon,
  ShuffleIcon,
} from '../../components/Icons';
import {colors} from '../theme/colors';
import {fonts, typography} from '../theme/typography';
import {spacing} from '../theme/spacing';
import {createScaledStyles, scale} from '../theme/scale';
import {getReciterArtwork} from '../services/reciterArtwork';

type Props = {reciterId: string};
type SortMode = 'asc' | 'desc' | 'revelation';

const COLUMNS = 3;
const CELL_PAD_X = 10;
const CELL_PAD_Y = 8;
const ROW_SIZE = SURAH_ROW_HEIGHT + CELL_PAD_Y * 2;
/** The list's side padding, so rows (inside their cell padding) sit on the gutter. */
const LIST_PAD_X = spacing.xl - CELL_PAD_X;
const PORTRAIT = 240;

const scrollPositions = new Map<string, number>();

const surahById = new Map<number, Surah>(SURAHS.map(s => [s.id, s]));

function surahName(n: number): string {
  return surahById.get(n)?.name ?? `Surah ${n}`;
}

function firstRewayahId(rewayat: Rewayah[]): string | null {
  return groupRewayat(rewayat)[0]?.items[0]?.id ?? null;
}

function overrideItemLayout(layout: {span?: number; size?: number}): void {
  layout.span = 1;
  layout.size = scale(ROW_SIZE);
}

export function ReciterDetailScreen({reciterId}: Props): React.ReactElement {
  const {reciters} = useReciters();
  const reciter = reciters.find(r => r.id === reciterId);
  const [rewayat, setRewayat] = useState<Rewayah[]>(
    () => getCachedRewayat(reciterId) ?? [],
  );
  const groups = useMemo(() => groupRewayat(rewayat), [rewayat]);
  const [activeRewayahId, setActive] = useState<string | null>(() =>
    firstRewayahId(getCachedRewayat(reciterId) ?? []),
  );
  const {playRewayah, shufflePlayRewayah} = usePlayer();
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const isFav = favorites.some(f => f.reciterId === reciterId);
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const isDefault = defaultReciterId === reciterId;
  const push = useNavStore(s => s.push);
  const pop = useNavStore(s => s.pop);
  const [sort, setSort] = useState<SortMode>('asc');
  const [loading, setLoading] = useState<boolean>(
    () => (getCachedRewayat(reciterId)?.length ?? 0) === 0,
  );

  const listRef = useRef<FlashListRef<Surah>>(null);
  const restoredRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetchRewayat(reciterId)
      .then(r => {
        if (cancelled || r.length === 0) return;
        setRewayat(r);
        setActive(prev =>
          prev && r.some(x => x.id === prev) ? prev : firstRewayahId(r),
        );
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
    listRef.current?.scrollToOffset({offset: saved, animated: false});
    restoredRef.current = true;
  }

  const current = rewayat.find(r => r.id === activeRewayahId);
  const activeGroup = groups.find(g => g.items.some(r => r.id === current?.id));

  const sortedSurahs: Surah[] = useMemo(() => {
    const numbers = current ? current.surah_list.filter(n => n > 0) : [];
    const list = numbers
      .map(n => surahById.get(n))
      .filter((s): s is Surah => !!s);
    if (sort === 'asc') return list.sort((a, b) => a.id - b.id);
    if (sort === 'desc') return list.sort((a, b) => b.id - a.id);
    return list.sort((a, b) => a.revelation_order - b.revelation_order);
  }, [current, sort]);

  const resumeEntry = useMemo(() => {
    if (!current) return null;
    return (
      continueEntries.find(
        e => e.reciterId === reciterId && e.rewayahId === current.id,
      ) ?? null
    );
  }, [continueEntries, current, reciterId]);

  const progressByNumber = useMemo(() => {
    const map = new Map<number, number>();
    continueEntries
      .filter(e => e.reciterId === reciterId && e.durationSeconds > 0)
      .forEach(e => {
        if (map.has(e.surahNumber)) return;
        map.set(
          e.surahNumber,
          Math.min(1, e.positionSeconds / e.durationSeconds),
        );
      });
    return map;
  }, [continueEntries, reciterId]);

  const playSurah = useCallback(
    async (surahNumber: number): Promise<void> => {
      if (!reciter || !current) return;
      await playRewayah(reciter.id, reciter.name, current, surahNumber);
      push({screen: 'nowPlaying'});
    },
    [reciter, current, playRewayah, push],
  );

  const renderItem = useCallback(
    ({item}: {item: Surah}) => (
      <View style={styles.cell}>
        <SurahRow
          surah={item}
          progress={progressByNumber.get(item.id) ?? 0}
          onSelect={playSurah}
        />
      </View>
    ),
    [progressByNumber, playSurah],
  );

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

  const artwork = getReciterArtwork(reciter);
  const arabicName = reciterArabicName(reciter);
  const firstSurah = sortedSurahs[0]?.id;
  const playLabel = resumeEntry
    ? `Continue ${surahName(resumeEntry.surahNumber)}`
    : firstSurah !== undefined
      ? `Play from ${surahName(firstSurah)}`
      : 'Play';
  const meta = [
    current ? rewayahDisplayName(current.name) : null,
    current ? `${sortedSurahs.length} surahs` : null,
    groups.length > 1 ? `${groups.length} rewayat` : null,
  ].filter((part): part is string => !!part);
  const styleItems =
    activeGroup && activeGroup.items.length > 1 ? activeGroup.items : [];

  // Header, footer and empty state sit inside the list's side padding: bleed
  // them back out so the hero spans the screen.
  const header = (
    <View style={styles.bleed}>
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
        {/* A sky glow behind the portrait that fades into the page, so the
            hero has no hard bottom edge. */}
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          pointerEvents="none">
          <Defs>
            <RadialGradient
              id="reciter-hero-glow"
              cx="0.18"
              cy="0.2"
              rx="0.7"
              ry="1.1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="reciter-hero-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0.45"
                stopColor={colors.background}
                stopOpacity={0}
              />
              <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#reciter-hero-glow)" />
          <Rect width="100%" height="100%" fill="url(#reciter-hero-fade)" />
        </Svg>
        <FocusableButton
          onPress={pop}
          accessibilityLabel="Back"
          style={styles.back}>
          <FocusText style={styles.backText}>‹ Back</FocusText>
        </FocusableButton>
        <View style={styles.heroContent}>
          <View style={styles.portrait}>
            <ReciterPortrait
              reciter={reciter}
              size={PORTRAIT}
              idPrefix="detail"
            />
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.kicker}>RECITER</Text>
            <View style={styles.names}>
              <Text style={styles.title} numberOfLines={2}>
                {reciter.name}
              </Text>
              {arabicName ? (
                <Text style={styles.arabic} numberOfLines={1}>
                  {arabicName}
                </Text>
              ) : null}
            </View>
            {meta.length > 0 ? (
              <Text style={styles.sub}>{meta.join('  ·  ')}</Text>
            ) : null}
            <TVFocusGuideView autoFocus style={styles.heroActions}>
              <FocusableButton
                onPress={async () => {
                  const target = resumeEntry?.surahNumber ?? firstSurah;
                  if (target === undefined) return;
                  await playSurah(target);
                }}
                accessibilityLabel={playLabel}
                hasTVPreferredFocus
                outlined
                style={styles.actionBtn}>
                <View style={styles.actionInner}>
                  <FocusIcon icon={PlayIcon} size={20} />
                  <FocusText style={styles.actionText}>{playLabel}</FocusText>
                </View>
              </FocusableButton>
              {current && sortedSurahs.length > 1 ? (
                <FocusableButton
                  onPress={async () => {
                    await shufflePlayRewayah(reciter.id, reciter.name, current);
                    push({screen: 'nowPlaying'});
                  }}
                  accessibilityLabel="Shuffle play"
                  style={styles.actionBtn}>
                  <View style={styles.actionInner}>
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
                <View style={styles.actionInner}>
                  <FocusIcon icon={HeartIcon} size={20} filled={isFav} />
                  <FocusText style={styles.actionText}>
                    {isFav ? 'Favorited' : 'Favorite'}
                  </FocusText>
                </View>
              </FocusableButton>
              <FocusableButton
                onPress={() => {
                  if (!isDefault) setDefaultReciterId(reciterId);
                }}
                accessibilityLabel={
                  isDefault ? 'Your default reciter' : 'Make default reciter'
                }
                style={styles.actionBtn}>
                <View style={styles.actionInner}>
                  {isDefault ? <FocusIcon icon={CheckIcon} size={20} /> : null}
                  <FocusText style={styles.actionText}>
                    {isDefault ? 'Default reciter' : 'Make default'}
                  </FocusText>
                </View>
              </FocusableButton>
            </TVFocusGuideView>
          </View>
        </View>
      </View>

      {groups.length > 1 ? (
        <TVFocusGuideView autoFocus style={styles.tabRow}>
          {groups.map(g => (
            <FilterChip
              key={g.key}
              label={g.label}
              accessibilityLabel={g.key}
              selected={activeGroup?.key === g.key}
              onPress={() => setActive(g.items[0]?.id ?? null)}
            />
          ))}
        </TVFocusGuideView>
      ) : null}

      {styleItems.length > 0 || sortedSurahs.length > 1 ? (
        <TVFocusGuideView autoFocus style={styles.filterRow}>
          {styleItems.map(r => (
            <FilterChip
              key={r.id}
              small
              label={styleLabel(r.style)}
              selected={r.id === current?.id}
              onPress={() => setActive(r.id)}
            />
          ))}
          <View style={styles.filterSpacer} />
          {sortedSurahs.length > 1 ? (
            <>
              <Text style={styles.sortLabel}>SORT</Text>
              <FilterChip
                small
                label="1–114"
                accessibilityLabel="Sort 1 to 114"
                selected={sort === 'asc'}
                onPress={() => setSort('asc')}
              />
              <FilterChip
                small
                label="114–1"
                accessibilityLabel="Sort 114 to 1"
                selected={sort === 'desc'}
                onPress={() => setSort('desc')}
              />
              <FilterChip
                small
                label="Revelation"
                accessibilityLabel="Sort by revelation order"
                selected={sort === 'revelation'}
                onPress={() => setSort('revelation')}
              />
            </>
          ) : null}
        </TVFocusGuideView>
      ) : null}
    </View>
  );

  const footer = reciter.bio ? (
    <View style={[styles.bleed, styles.bioBlock]}>
      <Text style={styles.sectionLabel}>About</Text>
      <Text style={styles.bio}>{reciter.bio}</Text>
    </View>
  ) : null;

  const empty = loading ? (
    <View style={[styles.bleed, styles.loadingRow]}>
      <ActivityIndicator color={colors.text} size="large" />
    </View>
  ) : (
    <View style={[styles.bleed, styles.noSurahs]}>
      <Text style={styles.noSurahsText}>
        No surahs are available for this rewayah yet.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        data={sortedSurahs}
        numColumns={COLUMNS}
        renderItem={renderItem}
        keyExtractor={s => String(s.id)}
        overrideItemLayout={overrideItemLayout}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={250}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
      />
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  listContent: {paddingHorizontal: LIST_PAD_X, paddingBottom: spacing.xxl},
  bleed: {marginHorizontal: -LIST_PAD_X},
  back: {
    position: 'absolute',
    top: 24,
    // Not left of the list's edge: Android's focus finder would treat Back
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
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  heroImg: {...StyleSheet.absoluteFillObject, opacity: 0.5},
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,11,16,0.45)',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg + 8,
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
    paddingBottom: spacing.lg,
  },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  heroMeta: {flex: 1, gap: 6},
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  names: {alignSelf: 'flex-start', maxWidth: '100%'},
  title: {
    color: colors.text,
    ...typography.titleXL,
    lineHeight: 74,
    letterSpacing: -1,
  },
  arabic: {
    alignSelf: 'flex-end',
    color: colors.textSecondary,
    fontSize: 30,
    lineHeight: 44,
    writingDirection: 'rtl',
    marginTop: -4,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    marginTop: 4,
  },
  heroActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 14,
    flexWrap: 'wrap',
  },
  actionInner: {flexDirection: 'row', alignItems: 'center', gap: 10},
  actionBtn: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 19,
    fontWeight: '700',
  },
  // Chips carry side padding: pull the rows out so their text lines up with
  // the portrait and the list.
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.xl - 18,
    marginBottom: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl - 14,
    marginBottom: spacing.xs,
  },
  filterSpacer: {flex: 1},
  sortLabel: {
    color: colors.textTertiary,
    ...typography.label,
    marginRight: 4,
  },
  cell: {paddingHorizontal: CELL_PAD_X, paddingVertical: CELL_PAD_Y},
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
