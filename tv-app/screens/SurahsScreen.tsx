import {FlashList} from '@shopify/flash-list';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FilterChip} from '../components/browse/FilterChip';
import {SurahTile, SURAH_TILE_WIDTH} from '../components/browse/SurahTile';
import {BROWSE_GUTTER, useGridColumns} from '../components/browse/gridLayout';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {useContinueListening} from '../hooks/useContinueListening';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {usePlayer} from '../hooks/usePlayer';
import {useReciters} from '../hooks/useReciters';
import {
  featuredFirst,
  filterSurahs,
  pickPlayableRewayah,
  type SurahFilter,
} from '../services/browseCatalog';
import {fetchRewayat, getCachedRewayat} from '../services/tvDataService';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';
import type {Reciter, Rewayah, Surah} from '../types/reciter';

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
/** Art 168 + label row and gaps + the cell's vertical padding. */
const ROW_HEIGHT = 236;

async function rewayatFor(reciter: Reciter): Promise<Rewayah[]> {
  const cached = getCachedRewayat(reciter.id);
  if (cached && cached.length > 0) return cached;
  if (reciter.rewayat && reciter.rewayat.length > 0) return reciter.rewayat;
  return fetchRewayat(reciter.id);
}

function overrideItemLayout(layout: {span?: number; size?: number}): void {
  layout.span = 1;
  layout.size = scale(ROW_HEIGHT);
}

export function SurahsScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const continueEntries = useContinueListening();
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);
  const numColumns = useGridColumns(CELL_WIDTH);

  const [filter, setFilter] = useState<SurahFilter>('all');
  const [juz, setJuz] = useState<number>(1);
  // The first tile takes focus when the screen opens, but not after a chip
  // changes the grid: focus stays on the chip the viewer pressed.
  const [focusGridFirst, setFocusGridFirst] = useState<boolean>(true);
  // Drop the request once it has had time to land: FlashList recycles cells,
  // and a recycled cell becoming index 0 again would pull focus back up.
  useEffect(() => {
    const timer = setTimeout(() => setFocusGridFirst(false), 1500);
    return () => clearTimeout(timer);
  }, []);
  const busyRef = useRef<boolean>(false);

  const reciter = useMemo<Reciter | null>(() => {
    const chosen = defaultReciterId
      ? reciters.find(r => r.id === defaultReciterId)
      : undefined;
    return chosen ?? featuredFirst(reciters)[0] ?? null;
  }, [reciters, defaultReciterId]);

  const surahs = useMemo(() => filterSurahs(filter, juz), [filter, juz]);

  const progressBySurah = useMemo(() => {
    const map = new Map<number, number>();
    // Entries are most recent first: keep the latest per surah.
    for (const e of continueEntries) {
      if (map.has(e.surahNumber) || e.durationSeconds <= 0) continue;
      map.set(
        e.surahNumber,
        Math.min(1, e.positionSeconds / e.durationSeconds),
      );
    }
    return map;
  }, [continueEntries]);

  const handleSelect = useCallback(
    async (surahNumber: number): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        // The default reciter first; if they lack this surah, the first
        // featured reciter who has it, so a press always plays something.
        const candidates = [
          ...(reciter ? [reciter] : []),
          ...featuredFirst(reciters).filter(r => r.id !== reciter?.id),
        ].slice(0, 12);
        for (const candidate of candidates) {
          const rewayah = pickPlayableRewayah(
            await rewayatFor(candidate),
            surahNumber,
          );
          if (!rewayah || !rewayah.surah_list.includes(surahNumber)) continue;
          await playRewayah(candidate.id, candidate.name, rewayah, surahNumber);
          push({screen: 'nowPlaying'});
          return;
        }
      } finally {
        busyRef.current = false;
      }
    },
    [reciter, reciters, playRewayah, push],
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
          progress={progressBySurah.get(item.id) ?? 0}
          onSelect={handleSelect}
          hasTVPreferredFocus={focusGridFirst && index === 0}
        />
      </View>
    ),
    [progressBySurah, handleSelect, focusGridFirst],
  );

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
          {reciter ? (
            <FocusableButton
              onPress={() =>
                push({screen: 'reciterDetail', reciterId: reciter.id})
              }
              accessibilityLabel={`Playing with ${reciter.name}. Open reciter`}
              outlined
              style={styles.playingChip}>
              <Text numberOfLines={1}>
                <FocusText
                  style={styles.playingText}
                  color={colors.textSecondary}
                  focusedColor={colors.onFocusSecondary}>
                  {'Playing with '}
                </FocusText>
                <FocusText style={styles.playingName}>{reciter.name}</FocusText>
              </Text>
            </FocusableButton>
          ) : null}
        </TVFocusGuideView>
        {filter === 'juz' ? (
          <TVFocusGuideView autoFocus style={styles.juzWrap}>
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
          overrideItemLayout={overrideItemLayout}
          extraData={focusGridFirst}
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
  playingChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 18,
    maxWidth: 560,
  },
  playingText: {
    fontFamily: fonts.medium,
    fontSize: 17,
    fontWeight: '500',
  },
  playingName: {
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
});
