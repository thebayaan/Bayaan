import {FlashList} from '@shopify/flash-list';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FilterChip} from '../components/browse/FilterChip';
import {SurahTile, SURAH_TILE_WIDTH} from '../components/browse/SurahTile';
import {
  BROWSE_GUTTER,
  cellHeightLayout,
  useGridColumns,
} from '../components/browse/gridLayout';
import {ReciterGrid} from '../components/catalog/ReciterGrid';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusIcon, FocusText} from '../components/primitives/focusContext';
import {PlayIcon} from '../../components/Icons';
import {useFavorites} from '../hooks/useFavorites';
import {useReciters} from '../hooks/useReciters';
import {useSurahProgress} from '../hooks/useSurahProgress';
import {
  featuredFirst,
  filterSurahs,
  surahFilterPlayLabel,
  type SurahFilter,
} from '../services/browseCatalog';
import {
  playOrOpen,
  surahTitle,
  voiceForSurah,
  type PlayItemInput,
} from '../services/playbackRouting';
import {pushScreenBack} from '../services/screenBack';
import {firstVoice, visibleQueue} from '../services/surahsPlayback';
import {getCachedRewayat} from '../services/tvDataService';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useSettingsStore} from '../store/settingsStore';
import {showToast} from '../store/toastStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';
import type {Reciter, Surah} from '../types/reciter';

const FILTERS: ReadonlyArray<{key: SurahFilter; label: string}> = [
  {key: 'all', label: 'All 114'},
  {key: 'juz', label: 'Juz'},
  {key: 'short', label: 'Short'},
  {key: 'makki', label: 'Makki'},
  {key: 'madani', label: 'Madani'},
];

const JUZ_NUMBERS = Array.from({length: 30}, (_, i) => i + 1);

/** Horizontal room around a tile inside its column, in design pixels. */
const CELL_PAD = 14;
const CELL_WIDTH = SURAH_TILE_WIDTH + CELL_PAD * 2;
/** A tile (artwork, meaning) plus its cell padding, for Vega's FlashList. */
const cellLayout = cellHeightLayout(222);
/** How long a focus request stays up before it is dropped. */
const FOCUS_REQUEST_MS = 1500;

/**
 * Surahs: every surah as artwork, filtered by chips (a juz, the short ones,
 * Makki, Madani). A press plays the surahs shown, from the one pressed, with
 * the reciter named on the right of the chips; that chip changes him in
 * place. Holding Select on a tile opens its menu.
 *
 * Focus: the first tile on arrival; the selected juz when entering the juz
 * row; the reciter chip again after the reciter picker closes.
 */
export function SurahsScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const favorites = useFavorites();
  const progressBySurah = useSurahProgress();
  const numColumns = useGridColumns(CELL_WIDTH);

  const [filter, setFilter] = useState<SurahFilter>('all');
  const [juz, setJuz] = useState<number>(1);
  const [picking, setPicking] = useState<boolean>(false);
  // Entering the juz row lands on the selected juz.
  const [selectedJuzChip, setSelectedJuzChip] = useState<View | null>(null);
  // The first tile takes focus when the screen opens, but not after a chip
  // changes the grid: focus stays on the chip the viewer pressed.
  const [focusGridFirst, setFocusGridFirst] = useState<boolean>(true);
  // After the reciter picker closes, focus goes back to the reciter chip.
  const [focusReciterChip, setFocusReciterChip] = useState<boolean>(false);
  // Drop the requests once they have had time to land: FlashList recycles
  // cells, and a recycled cell becoming index 0 again would pull focus back.
  useEffect(() => {
    const timer = setTimeout(() => setFocusGridFirst(false), FOCUS_REQUEST_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!focusReciterChip) return;
    const timer = setTimeout(
      () => setFocusReciterChip(false),
      FOCUS_REQUEST_MS,
    );
    return () => clearTimeout(timer);
  }, [focusReciterChip]);
  // The picker opens on its first portrait (the current reciter).
  const [focusPickerFirst, setFocusPickerFirst] = useState<boolean>(false);
  useEffect(() => {
    if (!focusPickerFirst) return;
    const timer = setTimeout(
      () => setFocusPickerFirst(false),
      FOCUS_REQUEST_MS,
    );
    return () => clearTimeout(timer);
  }, [focusPickerFirst]);

  const reciter = useMemo<Reciter | null>(() => {
    const chosen = defaultReciterId
      ? reciters.find(r => r.id === defaultReciterId)
      : undefined;
    return chosen ?? featuredFirst(reciters)[0] ?? null;
  }, [reciters, defaultReciterId]);

  // The default reciter first; if they lack a surah, the first featured
  // reciter who has it, so a press always plays something.
  const candidates = useMemo<Reciter[]>(
    () => [
      ...(reciter ? [reciter] : []),
      ...featuredFirst(reciters).filter(r => r.id !== reciter?.id),
    ],
    [reciter, reciters],
  );

  const surahs = useMemo(() => filterSurahs(filter, juz), [filter, juz]);
  const shownNumbers = useMemo(() => surahs.map(s => s.id), [surahs]);

  // Who the picker offers: the current reciter first (where focus lands),
  // then favourites, then the featured order.
  const pickerReciters = useMemo<Reciter[]>(() => {
    if (!picking) return [];
    const favoriteIds = new Set(favorites.map(f => f.reciterId));
    const ordered = featuredFirst(reciters);
    const rank = (r: Reciter): number =>
      r.id === reciter?.id ? 0 : favoriteIds.has(r.id) ? 1 : 2;
    return ordered
      .map((r, i) => ({r, i}))
      .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
      .map(x => x.r);
  }, [picking, reciters, reciter, favorites]);

  const play = useCallback(
    (voice: PlayItemInput, source: string): void => {
      if (reciter && voice.reciterId !== reciter.id) {
        const who = reciters.find(r => r.id === voice.reciterId);
        showToast(
          `Playing with ${who?.name ?? 'another reciter'}: ${reciter.name} has no recording of ${surahTitle(voice.surahNumber)}.`,
        );
      }
      // A filtered grid plays what it shows; "All 114" plays the recitation.
      const queue =
        filter === 'all'
          ? undefined
          : visibleQueue(
              voice,
              shownNumbers,
              getCachedRewayat(voice.reciterId) ??
                reciters.find(r => r.id === voice.reciterId)?.rewayat,
            );
      void playOrOpen({...voice, queue, source});
    },
    [reciter, reciters, filter, shownNumbers],
  );

  const handleSelect = useCallback(
    (surahNumber: number): void => {
      const voice = voiceForSurah(candidates, surahNumber);
      if (!voice) {
        showToast(`No reciter has ${surahTitle(surahNumber)} yet.`, 'error');
        return;
      }
      play(voice, 'surahs');
    },
    [candidates, play],
  );

  const handleLongPress = useCallback(
    (surahNumber: number): void => {
      const voice = voiceForSurah(candidates, surahNumber);
      useContextMenuStore.getState().openSurah({
        surahNumber,
        reciterId: voice?.reciterId,
        rewayahId: voice?.rewayahId,
        origin: 'surahs',
      });
    },
    [candidates],
  );

  function playShown(): void {
    const voice = firstVoice(candidates, shownNumbers);
    if (!voice) {
      showToast('No reciter has these surahs yet.', 'error');
      return;
    }
    play(voice, 'surahs-all');
  }

  const closePicker = useCallback((): void => {
    setPicking(false);
    setFocusReciterChip(true);
  }, []);

  // Back closes the reciter picker before it leaves Surahs (after a menu
  // opened over it, which closes first).
  useEffect(() => {
    if (!picking) return;
    return pushScreenBack(() => {
      if (useContextMenuStore.getState().target) return false;
      closePicker();
      return true;
    });
  }, [picking, closePicker]);

  const pickReciter = useCallback(
    (next: Reciter): void => {
      if (next.id !== reciter?.id) {
        setDefaultReciterId(next.id);
        showToast(`${next.name} is now your default reciter.`);
      }
      closePicker();
    },
    [reciter, setDefaultReciterId, closePicker],
  );

  function chooseFilter(next: SurahFilter): void {
    setFocusGridFirst(false);
    setFilter(next);
  }

  function chooseJuz(next: number): void {
    setFocusGridFirst(false);
    setJuz(next);
  }

  const renderItem = useCallback(
    ({item, index}: {item: Surah; index: number}) => (
      <View style={styles.cell}>
        <SurahTile
          surahNumber={item.id}
          name={item.name}
          meaning={item.translated_name_english}
          progress={progressBySurah.get(item.id) ?? 0}
          onSelect={handleSelect}
          onLongPress={handleLongPress}
          hasTVPreferredFocus={focusGridFirst && index === 0}
        />
      </View>
    ),
    [progressBySurah, handleSelect, handleLongPress, focusGridFirst],
  );

  if (picking) {
    return (
      <View style={styles.container}>
        {/* A guide across the full width, so Up from any column of the
            grid reaches Cancel at the far right (tvOS looks straight up). */}
        <TVFocusGuideView
          autoFocus
          style={[styles.header, styles.pickerHeader]}>
          <View style={styles.pickerText}>
            <Text style={styles.kicker}>Choose a reciter</Text>
            <Text style={styles.title}>Who recites the surahs</Text>
            <Text style={styles.pickerMeta}>
              Saved as your default reciter · Back returns to the surahs
            </Text>
          </View>
          <FocusableButton
            onPress={closePicker}
            accessibilityLabel="Cancel"
            outlined
            style={styles.cancel}>
            <FocusText style={styles.buttonText}>Cancel</FocusText>
          </FocusableButton>
        </TVFocusGuideView>
        <TVFocusGuideView autoFocus style={styles.gridWrap}>
          <ReciterGrid
            reciters={pickerReciters}
            onSelect={pickReciter}
            focusFirst={focusPickerFirst}
          />
        </TVFocusGuideView>
      </View>
    );
  }

  const playLabel = surahFilterPlayLabel(filter, juz);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Surahs</Text>
      </View>
      <View style={styles.chipBar}>
        <TVFocusGuideView autoFocus style={styles.chipRow}>
          {FILTERS.map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              selected={filter === f.key}
              onPress={() => chooseFilter(f.key)}
            />
          ))}
          <View style={styles.chipSpacer} />
          <FocusableButton
            onPress={playShown}
            accessibilityLabel={playLabel}
            style={styles.actionChip}>
            <View style={styles.actionInner}>
              <FocusIcon icon={PlayIcon} size={18} />
              <FocusText style={styles.buttonText}>{playLabel}</FocusText>
            </View>
          </FocusableButton>
          {reciter ? (
            <FocusableButton
              onPress={() => {
                setFocusPickerFirst(true);
                setPicking(true);
              }}
              accessibilityLabel={`Reciter: ${reciter.name}. Change reciter`}
              hasTVPreferredFocus={focusReciterChip}
              outlined
              style={[styles.actionChip, styles.reciterChip]}>
              <Text numberOfLines={1}>
                <FocusText
                  style={styles.reciterKicker}
                  color={colors.textSecondary}
                  focusedColor={colors.onFocusSecondary}>
                  {'Reciter  '}
                </FocusText>
                <FocusText style={styles.buttonText}>{reciter.name}</FocusText>
                <FocusText
                  style={styles.reciterKicker}
                  color={colors.textSecondary}
                  focusedColor={colors.onFocusSecondary}>
                  {'  ·  Change'}
                </FocusText>
              </Text>
            </FocusableButton>
          ) : null}
        </TVFocusGuideView>
        {filter === 'juz' ? (
          // The row mounts afresh with each visit to Juz, so it has nothing
          // to remember: point it at the selected juz instead.
          <TVFocusGuideView
            destinations={selectedJuzChip ? [selectedJuzChip] : undefined}
            style={styles.juzWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.juzRow}>
              <Text style={styles.juzKicker}>JUZ</Text>
              {JUZ_NUMBERS.map(n => (
                <FilterChip
                  key={n}
                  small
                  label={String(n)}
                  accessibilityLabel={`Juz ${n}`}
                  selected={juz === n}
                  chipRef={juz === n ? setSelectedJuzChip : undefined}
                  onPress={() => chooseJuz(n)}
                />
              ))}
            </ScrollView>
          </TVFocusGuideView>
        ) : null}
      </View>
      <TVFocusGuideView autoFocus style={styles.gridWrap}>
        <FlashList
          key={`${filter}-${juz}-${numColumns}`}
          data={surahs}
          numColumns={numColumns}
          renderItem={renderItem}
          keyExtractor={s => String(s.id)}
          overrideItemLayout={cellLayout}
          extraData={focusGridFirst}
          // Rows ready well below the fold, so a held Down never reaches the
          // edge of what is mounted and jumps out of the grid.
          drawDistance={scale(900)}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.empty}>No surahs match this filter.</Text>
          }
        />
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    paddingHorizontal: BROWSE_GUTTER,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: {color: colors.text, ...typography.title, letterSpacing: -0.5},
  // Chips carry 18 px of side padding: pull the row out so their text lines
  // up with the title and the tiles.
  chipBar: {
    paddingHorizontal: BROWSE_GUTTER - 18,
    paddingBottom: spacing.xs,
  },
  chipRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  chipSpacer: {flex: 1},
  actionChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  reciterChip: {marginRight: 18, maxWidth: 620},
  actionInner: {flexDirection: 'row', alignItems: 'center', gap: 10},
  reciterKicker: {
    fontFamily: fonts.medium,
    fontSize: 17,
    fontWeight: '500',
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    fontWeight: '700',
  },
  juzWrap: {marginTop: 4},
  juzRow: {alignItems: 'center', gap: 2, paddingRight: spacing.xl},
  juzKicker: {
    color: colors.accent,
    ...typography.label,
    paddingLeft: 18,
    paddingRight: 8,
  },
  gridWrap: {flex: 1},
  gridContent: {
    paddingHorizontal: BROWSE_GUTTER - CELL_PAD,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  cell: {paddingHorizontal: CELL_PAD, paddingVertical: 10},
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    paddingHorizontal: CELL_PAD,
    paddingTop: spacing.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 24,
    paddingBottom: spacing.md,
  },
  pickerText: {flex: 1, gap: 6},
  kicker: {...typography.label, color: colors.accent},
  pickerMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 18,
    fontWeight: '500',
  },
  cancel: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
});
