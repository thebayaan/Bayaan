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
import {cellHeightLayout} from '../components/browse/gridLayout';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusSpinner} from '../components/primitives/FocusSpinner';
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
import {useSurahProgress} from '../hooks/useSurahProgress';
import {
  OFFLINE_MESSAGE,
  playOrOpen,
  randomSurah,
} from '../services/playbackRouting';
import {defaultRewayah} from '../services/menuChoices';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useNavStore} from '../store/navStore';
import {useSettingsStore} from '../store/settingsStore';
import {showToast} from '../store/toastStore';
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

/** The sort control cycles through these, in order. */
const SORTS: ReadonlyArray<{key: SortMode; label: string; spoken: string}> = [
  {key: 'asc', label: '1–114', spoken: '1 to 114'},
  {key: 'desc', label: '114–1', spoken: '114 to 1'},
  {key: 'revelation', label: 'Revelation', spoken: 'revelation order'},
];

/** A play press made before the rewayat arrive, carried out when they do. */
type QueuedPlay = 'play' | 'shuffle' | null;

const COLUMNS = 3;
const CELL_PAD_X = 10;
const CELL_PAD_Y = 8;
/** A surah row plus its cell padding, for Vega's FlashList. */
const cellLayout = cellHeightLayout(SURAH_ROW_HEIGHT + CELL_PAD_Y * 2);
/** The list's side padding, so rows (inside their cell padding) sit on the gutter. */
const LIST_PAD_X = spacing.xl - CELL_PAD_X;
const PORTRAIT = 240;

const scrollPositions = new Map<string, number>();

const surahById = new Map<number, Surah>(SURAHS.map(s => [s.id, s]));

function surahName(n: number): string {
  return surahById.get(n)?.name ?? `Surah ${n}`;
}

/** The tab a reciter's page opens on: the same voice their menu's Play uses. */
function firstRewayahId(rewayat: Rewayah[]): string | null {
  return defaultRewayah(rewayat)?.id ?? null;
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
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const isFav = favorites.some(f => f.reciterId === reciterId);
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const isDefault = defaultReciterId === reciterId;
  const pop = useNavStore(s => s.pop);
  const [sort, setSort] = useState<SortMode>('asc');
  const [loading, setLoading] = useState<boolean>(
    () => (getCachedRewayat(reciterId)?.length ?? 0) === 0,
  );
  // Bumped to fetch the rewayat again after a failed load.
  const [attempt, setAttempt] = useState<number>(0);
  const [queued, setQueued] = useState<QueuedPlay>(null);
  // The row of tabs, styles and sort: where focus lands coming from above
  // or below (the selected tab, else the selected style, else sort).
  const [rowEntry, setRowEntry] = useState<View | null>(null);

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
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reciterId, attempt]);

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

  const progressByNumber = useSurahProgress(reciterId);

  const playSurah = useCallback(
    (surahNumber: number, startSeconds?: number): void => {
      if (!reciter || !current) return;
      void playOrOpen({
        reciterId: reciter.id,
        rewayahId: current.id,
        surahNumber,
        startSeconds,
        source: 'reciter',
      });
    },
    [reciter, current],
  );

  // Hold OK on a row: the surah's menu, in the recitation shown.
  const openSurahMenu = useCallback(
    (surahNumber: number): void => {
      useContextMenuStore.getState().openSurah({
        surahNumber,
        reciterId,
        ...(current ? {rewayahId: current.id} : {}),
        origin: 'reciter',
      });
    },
    [reciterId, current],
  );

  const firstSurah = sortedSurahs[0]?.id;

  // "Continue" picks up where the surah was left; else the first surah in
  // the order shown.
  const playMain = useCallback((): void => {
    if (resumeEntry) {
      playSurah(resumeEntry.surahNumber, resumeEntry.positionSeconds);
    } else if (firstSurah !== undefined) {
      playSurah(firstSurah);
    }
  }, [resumeEntry, firstSurah, playSurah]);

  const playShuffled = useCallback((): void => {
    if (!reciter || !current) return;
    void playOrOpen({
      reciterId: reciter.id,
      rewayahId: current.id,
      surahNumber: randomSurah(current.surah_list) ?? 1,
      shuffle: true,
      source: 'reciter-shuffle',
    });
  }, [reciter, current]);

  const ready = !!current && sortedSurahs.length > 0;

  // Play and Shuffle work before the rewayat arrive: the press waits for
  // them, and a failed load says so (and tries again) instead of doing
  // nothing.
  function pressPlay(kind: Exclude<QueuedPlay, null>): void {
    if (ready) {
      if (kind === 'play') playMain();
      else playShuffled();
      return;
    }
    setQueued(kind);
    if (!loading) {
      setLoading(true);
      setAttempt(a => a + 1);
    }
  }

  useEffect(() => {
    if (queued === null) return;
    if (ready) {
      setQueued(null);
      if (queued === 'play') playMain();
      else playShuffled();
    } else if (!loading) {
      setQueued(null);
      showToast(
        rewayat.length === 0
          ? OFFLINE_MESSAGE
          : 'No surahs are available for this rewayah yet.',
        'error',
      );
    }
  }, [queued, ready, loading, rewayat, playMain, playShuffled]);

  const renderItem = useCallback(
    ({item}: {item: Surah}) => (
      <View style={styles.cell}>
        <SurahRow
          surah={item}
          progress={progressByNumber.get(item.id) ?? 0}
          onSelect={playSurah}
          onLongPress={openSurahMenu}
        />
      </View>
    ),
    [progressByNumber, playSurah, openSurahMenu],
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
  const waiting = !ready && (loading || queued !== null);
  const playLabel = waiting
    ? 'Loading…'
    : resumeEntry
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
  const showTabs = groups.length > 1;
  const showSort = sortedSurahs.length > 1;
  const sortIndex = SORTS.findIndex(s => s.key === sort);
  const sortNow = SORTS[sortIndex];
  const sortNext = SORTS[(sortIndex + 1) % SORTS.length];
  // Shuffle stays in place while loading so the buttons don't shift under
  // focus when the rewayat arrive.
  const showShuffle = waiting || (current && sortedSurahs.length > 1);

  function pressFavorite(): void {
    toggleFavorite(reciterId);
    showToast(
      isFav
        ? `${reciter?.name} removed from your Library.`
        : `${reciter?.name} added to your Library.`,
    );
  }

  function pressDefault(): void {
    if (isDefault) {
      showToast(
        `${reciter?.name} plays when you pick a surah · change it in Settings or on Surahs.`,
      );
      return;
    }
    setDefaultReciterId(reciterId);
    showToast(`${reciter?.name} is now your default reciter.`);
  }

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
              {/* Each button keeps a minimum width, so a label changing
                  (Favorite → Favorited, Loading… → Play from ...) doesn't
                  shift its neighbours. */}
              <FocusableButton
                onPress={() => pressPlay('play')}
                accessibilityLabel={playLabel}
                hasTVPreferredFocus
                outlined
                style={[styles.actionBtn, styles.playBtn]}>
                <View style={styles.actionInner}>
                  {waiting ? (
                    <FocusSpinner />
                  ) : (
                    <FocusIcon icon={PlayIcon} size={20} />
                  )}
                  <FocusText style={styles.actionText} numberOfLines={1}>
                    {playLabel}
                  </FocusText>
                </View>
              </FocusableButton>
              {showShuffle ? (
                <FocusableButton
                  onPress={() => pressPlay('shuffle')}
                  accessibilityLabel="Shuffle play"
                  style={styles.actionBtn}>
                  <View style={styles.actionInner}>
                    <FocusIcon icon={ShuffleIcon} size={20} />
                    <FocusText style={styles.actionText}>Shuffle</FocusText>
                  </View>
                </FocusableButton>
              ) : null}
              <FocusableButton
                onPress={pressFavorite}
                accessibilityLabel={
                  isFav ? 'Remove from favorites' : 'Add to favorites'
                }
                style={[styles.actionBtn, styles.favoriteBtn]}>
                <View style={styles.actionInner}>
                  <FocusIcon icon={HeartIcon} size={20} filled={isFav} />
                  <FocusText style={styles.actionText}>
                    {isFav ? 'Favorited' : 'Favorite'}
                  </FocusText>
                </View>
              </FocusableButton>
              <FocusableButton
                onPress={pressDefault}
                accessibilityLabel={
                  isDefault ? 'Your default reciter' : 'Make default reciter'
                }
                style={[styles.actionBtn, styles.defaultBtn]}>
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

      {/* Tabs, styles and sort share one left-aligned row, so Down goes
          hero → this row → the first column of surahs on both Apple TV and
          Android TV (a right-aligned sort row of its own drew tvOS to the
          far right and was skipped by Android). Entering the row from above
          or below lands on what is selected. */}
      {showTabs || styleItems.length > 0 || showSort ? (
        <TVFocusGuideView
          autoFocus
          destinations={rowEntry ? [rowEntry] : undefined}
          style={styles.filterRow}>
          {groups.length > 1
            ? groups.map(g => {
                const selected = activeGroup?.key === g.key;
                return (
                  <FilterChip
                    key={g.key}
                    label={g.label}
                    accessibilityLabel={g.key}
                    selected={selected}
                    chipRef={selected ? setRowEntry : undefined}
                    onPress={() => setActive(g.items[0]?.id ?? null)}
                  />
                );
              })
            : null}
          {showTabs && styleItems.length > 0 ? (
            <View style={styles.rowDivider} />
          ) : null}
          {styleItems.map(r => {
            const selected = r.id === current?.id;
            return (
              <FilterChip
                key={r.id}
                small={showTabs}
                label={styleLabel(r.style)}
                selected={selected}
                chipRef={!showTabs && selected ? setRowEntry : undefined}
                onPress={() => setActive(r.id)}
              />
            );
          })}
          {showSort ? (
            <>
              {showTabs || styleItems.length > 0 ? (
                <View style={styles.rowDivider} />
              ) : null}
              <FilterChip
                small={showTabs || styleItems.length > 0}
                label={`Sort: ${sortNow.label}`}
                accessibilityLabel={`Sorted ${sortNow.spoken}. Sort ${sortNext.spoken}`}
                selected={false}
                chipRef={
                  !showTabs && styleItems.length === 0 ? setRowEntry : undefined
                }
                onPress={() => setSort(sortNext.key)}
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
      <FocusSpinner size="large" />
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
        overrideItemLayout={cellLayout}
        // Rows ready well below the fold, so a held Down never reaches the
        // edge of what is mounted and jumps out of the list.
        drawDistance={scale(900)}
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
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionBtn: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
  // Wide enough for the longer of each button's labels.
  playBtn: {minWidth: 300},
  favoriteBtn: {minWidth: 190},
  defaultBtn: {minWidth: 236},
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 19,
    fontWeight: '700',
  },
  // Chips carry side padding (the first one is always full size): pull the
  // row out so its text lines up with the portrait and the list.
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl - 18,
    marginBottom: spacing.xs,
  },
  rowDivider: {
    width: 1,
    height: 28,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.border,
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
