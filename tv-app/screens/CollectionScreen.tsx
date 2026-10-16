import {FlashList} from '@shopify/flash-list';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {AdhkarChip} from '../components/adhkar/AdhkarChip';
import {FilterChip} from '../components/browse/FilterChip';
import {HomeClock} from '../components/home/HomeClock';
import {LibraryFirstRun} from '../components/library/LibraryFirstRun';
import {ShelfFade} from '../components/library/ShelfFade';
import {
  SHELF_ART,
  SHELF_RING,
  ShelfReciterTile,
  ShelfSurahTile,
} from '../components/library/ShelfTile';
import {useLibraryPlayback} from '../components/library/useLibraryPlayback';
import {useClock} from '../hooks/useClock';
import {useContinueListening} from '../hooks/useContinueListening';
import {useFavorites} from '../hooks/useFavorites';
import {useLovedSurahs} from '../hooks/useLovedSurahs';
import {useRecentlyPlayed} from '../hooks/useRecentlyPlayed';
import {useReciters} from '../hooks/useReciters';
import {nowListId} from '../services/adhkarBrowse';
import {SURAHS} from '../services/browseCatalog';
import {
  buildShelf,
  filterShelf,
  reciterTileLabel,
  shelfCounts,
  sortShelf,
  surahTileCaption,
  type ShelfFilter,
  type ShelfItem,
  type ShelfSort,
} from '../services/libraryShelf';
import {shortReciterName} from '../services/listeningChoices';
import {getCachedRewayat} from '../services/tvDataService';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';
import type {Reciter} from '../types/reciter';

// Layout in design px, beside the folded sidebar (1920 - 112 = 1808 wide).
const PAD_LEFT = 72;
const PAD_RIGHT = 84;
const COLUMNS = 6;
const COLUMN_GAP = 44;
/** One column: the artwork plus the gap after it. */
const CELL_WIDTH = SHELF_ART + COLUMN_GAP;
/** Ring frame (art + 18) + two label lines + the gap to the next row. */
const ROW_HEIGHT = 352;
// The list starts one ring-width left of the title so the artwork, not the
// focus ring's reserved space, lines up with it; the right padding leaves
// exactly six cells.
const LIST_PAD_LEFT = PAD_LEFT - SHELF_RING;
const LIST_PAD_RIGHT = 1808 - LIST_PAD_LEFT - CELL_WIDTH * COLUMNS;

/** Chips carry 24 px of side padding: pull the row out to line text up. */
const CHIP_PAD = 24;

const TABS: ReadonlyArray<{key: ShelfFilter; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'surahs', label: 'Surahs'},
  {key: 'reciters', label: 'Reciters'},
];

const SORTS: ReadonlyArray<{key: ShelfSort; label: string}> = [
  {key: 'recent', label: 'Recent'},
  {key: 'az', label: 'A–Z'},
];

// The tab and sort chosen last time, so coming back keeps the place.
let lastFilter: ShelfFilter = 'all';
let lastSort: ShelfSort = 'recent';

const surahNames = new Map<number, string>(SURAHS.map(s => [s.id, s.name]));

function surahName(n: number): string {
  return surahNames.get(n) ?? `Surah ${n}`;
}

function overrideItemLayout(layout: {span?: number; size?: number}): void {
  layout.span = 1;
  layout.size = scale(ROW_HEIGHT);
}

/**
 * The Library as a shelf: everything kept (unfinished and loved surahs in
 * their voice, reciters played or favorited) as one grid of same-size tiles,
 * newest first, under All / Surahs / Reciters tabs and a Recent / A–Z sort.
 * Before anything is kept, a first-run page offers one clear first step.
 */
export function CollectionScreen(): React.ReactElement {
  const now = useClock();
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const recent = useRecentlyPlayed();
  const loved = useLovedSurahs();
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

  const {defaultReciter, playTile, playInDefault} = useLibraryPlayback(
    reciters,
    reciterById,
  );

  const shelf = useMemo(
    () =>
      buildShelf({
        continueEntries,
        loved,
        recent,
        favorites,
        isKnownReciter: id => reciterById.has(id),
      }),
    [continueEntries, loved, recent, favorites, reciterById],
  );
  const counts = useMemo(() => shelfCounts(shelf), [shelf]);
  const tabs = TABS.filter(t => t.key === 'all' || counts[t.key] > 0);

  const [filterChoice, setFilter] = useState<ShelfFilter>(lastFilter);
  const [sort, setSort] = useState<ShelfSort>(lastSort);
  // A tab that has emptied (its last tile removed elsewhere) falls back to All.
  const filter = counts[filterChoice] > 0 ? filterChoice : 'all';

  // The first tile takes focus when the screen opens, but not after a tab
  // or the sort changes the grid: focus stays where the viewer is. Dropped
  // once it has landed, so a recycled cell becoming index 0 again does not
  // pull focus back (as on Surahs).
  const [focusGridFirst, setFocusGridFirst] = useState<boolean>(true);
  useEffect(() => {
    const timer = setTimeout(() => setFocusGridFirst(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Focus coming up from the grid lands on the selected tab.
  const [selectedTab, setSelectedTab] = useState<View | null>(null);

  const nameOf = useCallback(
    (item: ShelfItem): string =>
      item.kind === 'surah'
        ? `${surahName(item.surahNumber)} ${reciterById.get(item.reciterId)?.name ?? ''}`
        : (reciterById.get(item.reciterId)?.name ?? ''),
    [reciterById],
  );

  const items = useMemo(
    () => sortShelf(filterShelf(shelf, filter), sort, nameOf),
    [shelf, filter, sort, nameOf],
  );

  const chooseFilter = (next: ShelfFilter): void => {
    if (next === filter) return;
    lastFilter = next;
    setFocusGridFirst(false);
    setFilter(next);
  };

  const chooseSort = (next: ShelfSort): void => {
    if (next === sort) return;
    lastSort = next;
    setFocusGridFirst(false);
    setSort(next);
  };

  const renderItem = useCallback(
    ({item, index}: {item: ShelfItem; index: number}) => {
      const reciter = reciterById.get(item.reciterId) ?? null;
      const preferred = focusGridFirst && index === 0;
      if (item.kind === 'reciter') {
        return (
          <View style={styles.cell}>
            {reciter ? (
              <ShelfReciterTile
                reciter={reciter}
                caption={reciterTileLabel(item.surahCount)}
                onPress={() =>
                  push({screen: 'reciterDetail', reciterId: reciter.id})
                }
                onLongPress={() =>
                  useContextMenuStore.getState().open(reciter.id)
                }
                hasTVPreferredFocus={preferred}
              />
            ) : null}
          </View>
        );
      }
      const name = surahName(item.surahNumber);
      const voice = reciter ? shortReciterName(reciter.name) : '';
      const rewayah = (
        getCachedRewayat(item.reciterId) ??
        reciter?.rewayat ??
        []
      ).find(r => r.id === item.rewayahId);
      const caption = surahTileCaption(item, voice, rewayah?.name);
      return (
        <View style={styles.cell}>
          <ShelfSurahTile
            surahNumber={item.surahNumber}
            surahName={name}
            reciter={reciter}
            caption={caption}
            loved={item.loved}
            progress={item.progress}
            idPrefix="lib-shelf"
            onPress={() => {
              playTile(item).catch(() => undefined);
            }}
            hasTVPreferredFocus={preferred}
            accessibilityLabel={`${item.progress ? 'Resume' : 'Play'} ${name}${
              reciter ? ` by ${reciter.name}` : ''
            }${caption && item.progress ? `, ${caption}` : ''}${
              item.loved ? ', loved' : ''
            }`}
          />
        </View>
      );
    },
    [reciterById, focusGridFirst, push, playTile],
  );

  const clock = (
    <View style={styles.clock} pointerEvents="none">
      <HomeClock now={now} />
    </View>
  );

  if (shelf.length === 0) {
    return (
      <View style={styles.container}>
        <LibraryFirstRun
          reciter={defaultReciter}
          adhkarListId={nowListId(now)}
          onPlaySurah={n => {
            playInDefault(n).catch(() => undefined);
          }}
          onBrowseReciters={() => switchTab('reciters')}
          onOpenAdhkar={listId => push({screen: 'adhkarReader', listId})}
        />
        {clock}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library</Text>

      <View style={styles.bar}>
        <TVFocusGuideView
          autoFocus
          destinations={selectedTab ? [selectedTab] : undefined}
          style={styles.tabs}>
          {tabs.map(t => (
            <AdhkarChip
              key={t.key}
              ref={t.key === filter ? setSelectedTab : undefined}
              label={t.label}
              count={counts[t.key]}
              selected={t.key === filter}
              onSelect={() => chooseFilter(t.key)}
            />
          ))}
        </TVFocusGuideView>
        <View style={styles.barSpacer} />
        <Text style={styles.sortKicker}>SORT</Text>
        <TVFocusGuideView autoFocus style={styles.sorts}>
          {SORTS.map(s => (
            <FilterChip
              key={s.key}
              label={s.label}
              accessibilityLabel={
                s.key === 'az' ? 'Sort A to Z' : 'Sort by most recent'
              }
              selected={s.key === sort}
              onPress={() => chooseSort(s.key)}
            />
          ))}
        </TVFocusGuideView>
      </View>

      <TVFocusGuideView autoFocus style={styles.gridWrap}>
        <FlashList
          key={`${filter}-${sort}`}
          data={items}
          numColumns={COLUMNS}
          renderItem={renderItem}
          keyExtractor={item => item.key}
          overrideItemLayout={overrideItemLayout}
          extraData={focusGridFirst}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
        <ShelfFade height={130} />
      </TVFocusGuideView>

      {clock}
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  clock: {position: 'absolute', top: 62, right: PAD_RIGHT},
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 66,
    letterSpacing: -1.6,
    marginTop: 58,
    paddingLeft: PAD_LEFT,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingLeft: PAD_LEFT - CHIP_PAD,
    paddingRight: PAD_RIGHT - 18,
  },
  tabs: {flexDirection: 'row', gap: 8},
  barSpacer: {flex: 1},
  sortKicker: {
    color: colors.textTertiary,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 3,
    marginRight: 6,
  },
  sorts: {flexDirection: 'row', gap: 4},
  gridWrap: {flex: 1},
  gridContent: {
    paddingLeft: LIST_PAD_LEFT,
    paddingRight: LIST_PAD_RIGHT,
    paddingTop: 36,
    paddingBottom: 160,
  },
  cell: {height: ROW_HEIGHT},
});
