import {FlashList} from '@shopify/flash-list';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {AdhkarChip} from '../components/adhkar/AdhkarChip';
import {FilterChip} from '../components/browse/FilterChip';
import {
  ROOT_TITLE_GAP,
  RootClock,
  RootTitle,
} from '../components/browse/RootHeader';
import {LibraryFirstRun} from '../components/library/LibraryFirstRun';
import {ShelfFade} from '../components/library/ShelfFade';
import {
  SHELF_ART,
  SHELF_RING,
  ShelfNewPlaylistTile,
  ShelfPlaylistTile,
  ShelfReciterTile,
  ShelfSurahTile,
} from '../components/library/ShelfTile';
import {useLibraryPlayback} from '../components/library/useLibraryPlayback';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {useFavorites} from '../hooks/useFavorites';
import {useLovedSurahs} from '../hooks/useLovedSurahs';
import {usePlaylists} from '../hooks/usePlaylists';
import {useReciters} from '../hooks/useReciters';
import {surahTitle} from '../services/playbackRouting';
import {
  buildShelf,
  isShelfEmpty,
  playlistCaption,
  reciterTileLabel,
  shelfCounts,
  surahTileCaption,
  tabItems,
  type ShelfFilter,
  type ShelfItem,
  type ShelfSort,
} from '../services/libraryShelf';
import {claimFocusReturn} from '../services/focusReturn';
import {shortReciterName} from '../services/listeningChoices';
import {getCachedRewayat} from '../services/tvDataService';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useNavStore} from '../store/navStore';
import {useScreenActive} from '../components/nav/ScreenLayer';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';
import {cellHeightLayout} from '../components/browse/gridLayout';
import {SCREEN_GUTTER} from '../theme/spacing';
import type {Playlist} from '../services/playlistsStore';
import type {Reciter} from '../types/reciter';

// Layout in design px, beside the folded sidebar (1920 - 112 = 1808 wide).
const PAD_LEFT = SCREEN_GUTTER;
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
  {key: 'playlists', label: 'Playlists'},
  {key: 'loved', label: 'Loved'},
  {key: 'reciters', label: 'Reciters'},
];

const SORTS: ReadonlyArray<{key: ShelfSort; label: string}> = [
  {key: 'recent', label: 'Recent'},
  {key: 'az', label: 'A–Z'},
];

/** What an empty tab says, and the one place it sends you. */
const EMPTY: Record<
  Exclude<ShelfFilter, 'playlists'>,
  {text: string; action: string; tab: 'surahs' | 'reciters'}
> = {
  loved: {
    text: 'Hold OK on any surah and choose Love, or press the heart in the player.',
    action: 'Browse surahs',
    tab: 'surahs',
  },
  reciters: {
    text: 'Open a reciter and choose Favourite.',
    action: 'Browse reciters',
    tab: 'reciters',
  },
};

// The place kept between visits (the screen unmounts under the player, a
// reciter page or a playlist): the tab, the sort, and the tile last opened.
let lastFilter: ShelfFilter = 'playlists';
let lastSort: ShelfSort = 'recent';
let lastTile: {filter: ShelfFilter; key: string; index: number} | null = null;

/** For Vega's FlashList (see cellHeightLayout). */
const overrideItemLayout = cellHeightLayout(ROW_HEIGHT);

/** The tile to focus: the key's place, else the nearest one still there. */
function placeOf(
  items: readonly ShelfItem[],
  key: string,
  index: number,
): number {
  if (items.length === 0) return -1;
  const at = items.findIndex(i => i.key === key);
  return at >= 0 ? at : Math.min(index, items.length - 1);
}

/**
 * The Library: what the listener chose to keep, under Playlists / Loved /
 * Reciters tabs and a Recent / A–Z sort. Playlists always start with a New
 * playlist tile. History (continue listening, recently played) is Home's.
 * Before anything is kept, a first-run page explains the three.
 */
export function CollectionScreen(): React.ReactElement {
  const favorites = useFavorites();
  const loved = useLovedSurahs();
  const playlists = usePlaylists();
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

  const playlistById = useMemo(
    () => new Map<string, Playlist>(playlists.map(p => [p.id, p])),
    [playlists],
  );

  const {defaultReciter, playTile, playInDefault} = useLibraryPlayback(
    reciters,
    reciterById,
  );

  const shelf = useMemo(
    () =>
      buildShelf({
        playlists,
        loved,
        favorites,
        // Before the catalog loads every reciter counts, so tiles don't
        // flash out and back.
        isKnownReciter: id => reciterById.size === 0 || reciterById.has(id),
      }),
    [playlists, loved, favorites, reciterById],
  );
  const counts = useMemo(() => shelfCounts(shelf), [shelf]);

  const [filter, setFilter] = useState<ShelfFilter>(lastFilter);
  const [sort, setSort] = useState<ShelfSort>(lastSort);

  const voiceOf = useCallback(
    (reciterId: string): string => {
      const reciter = reciterById.get(reciterId);
      return reciter ? shortReciterName(reciter.name) : '';
    },
    [reciterById],
  );

  const nameOf = useCallback(
    (item: ShelfItem): string => {
      if (item.kind === 'playlist') return item.name;
      if (item.kind === 'surah') {
        return `${surahTitle(item.surahNumber)} ${voiceOf(item.reciterId)}`;
      }
      if (item.kind === 'reciter') return voiceOf(item.reciterId);
      return '';
    },
    [voiceOf],
  );

  const items = useMemo(
    () => tabItems(shelf, filter, sort, nameOf),
    [shelf, filter, sort, nameOf],
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // The tile that takes focus: on opening, the one last opened (coming back
  // from what it opened) or the first; after a menu removed its tile, the
  // one now in its place. Dropped once focus has landed, so a recycled cell
  // taking that index does not pull focus back.
  const [focusIndex, setFocusIndex] = useState<number | null>(() => {
    if (!lastTile || lastTile.filter !== filter) return 0;
    return Math.max(0, placeOf(items, lastTile.key, lastTile.index));
  });
  const initialIndex = useRef<number>(focusIndex ?? 0).current;
  useEffect(() => {
    if (focusIndex === null) return;
    const timer = setTimeout(() => setFocusIndex(null), 1500);
    return () => clearTimeout(timer);
  }, [focusIndex]);

  // The first-run page and the shelf swap only while no menu is open: a
  // Love on a starter surah (or un-loving the last loved one) must not
  // swap the page, and mount its preferred focus, under the open menu.
  // Nor while a stacked screen covers the Library (a Love in the player):
  // a hidden layer must not take preferred focus; the swap waits for Back.
  const menuOpen = useContextMenuStore(s => s.target !== null);
  const active = useScreenActive();
  const shelfEmpty = isShelfEmpty(shelf);
  const [firstRun, setFirstRun] = useState<boolean>(shelfEmpty);
  const leavingFirstRun = useRef<boolean>(false);
  leavingFirstRun.current = firstRun && !shelfEmpty;
  useEffect(() => {
    if (menuOpen || !active || shelfEmpty === firstRun) return;
    setFirstRun(shelfEmpty);
    if (shelfEmpty) return;
    // The first thing kept: open its tab with focus on it.
    const tab: ShelfFilter =
      counts.loved > 0 ? 'loved' : counts.reciters > 0 ? 'reciters' : filter;
    lastFilter = tab;
    setFilter(tab);
    setFocusIndex(0);
  }, [menuOpen, active, shelfEmpty, firstRun, counts, filter]);

  // A menu that removed its own tile (Remove from Loved, Remove from
  // favourites) leaves focus on the neighbour that took its place, not
  // wherever the engine falls back to (or a recycled cell that held the
  // tile).
  const menuFrom = useRef<{key: string; index: number} | null>(null);
  useEffect(
    () =>
      useContextMenuStore.subscribe((next, prev) => {
        if (!prev.target || next.target) return;
        // Leaving the first run: the shelf's first tile takes focus.
        if (leavingFirstRun.current) claimFocusReturn();
        if (!menuFrom.current) return;
        const from = menuFrom.current;
        menuFrom.current = null;
        const now = itemsRef.current;
        if (now.some(i => i.key === from.key)) return;
        // An emptied tab focuses its one action instead.
        setFocusIndex(Math.max(0, placeOf(now, from.key, from.index)));
        claimFocusReturn();
      }),
    [],
  );

  // Focus coming up from the grid lands on the selected tab.
  const [selectedTab, setSelectedTab] = useState<View | null>(null);

  const chooseFilter = (next: ShelfFilter): void => {
    if (next === filter) return;
    lastFilter = next;
    setFocusIndex(null);
    setFilter(next);
  };

  const chooseSort = (next: ShelfSort): void => {
    if (next === sort) return;
    lastSort = next;
    setFocusIndex(null);
    setSort(next);
  };

  const remember = useCallback(
    (item: ShelfItem, index: number): void => {
      lastTile = {filter, key: item.key, index};
    },
    [filter],
  );

  const renderItem = useCallback(
    ({item, index}: {item: ShelfItem; index: number}) => {
      const preferred = focusIndex === index;
      if (item.kind === 'new') {
        return (
          <View style={styles.cell}>
            <ShelfNewPlaylistTile
              onPress={() => {
                remember(item, index);
                push({screen: 'playlistEdit'});
              }}
              hasTVPreferredFocus={preferred}
            />
          </View>
        );
      }
      if (item.kind === 'playlist') {
        const playlist = playlistById.get(item.playlistId);
        if (!playlist) return <View style={styles.cell} />;
        return (
          <View style={styles.cell}>
            <ShelfPlaylistTile
              name={playlist.name}
              color={playlist.color}
              firstSurah={playlist.items[0]?.surahNumber ?? null}
              caption={playlistCaption(playlist.items, voiceOf)}
              idPrefix={`lib-playlist-${playlist.id}`}
              onPress={() => {
                remember(item, index);
                push({screen: 'playlist', playlistId: playlist.id});
              }}
              hasTVPreferredFocus={preferred}
            />
          </View>
        );
      }
      const reciter = reciterById.get(item.reciterId) ?? null;
      if (item.kind === 'reciter') {
        return (
          <View style={styles.cell}>
            {reciter ? (
              <ShelfReciterTile
                reciter={reciter}
                caption={reciterTileLabel(item.surahCount)}
                onPress={() => {
                  remember(item, index);
                  push({screen: 'reciterDetail', reciterId: reciter.id});
                }}
                onLongPress={() => {
                  menuFrom.current = {key: item.key, index};
                  useContextMenuStore.getState().openReciter(reciter.id);
                }}
                hasTVPreferredFocus={preferred}
              />
            ) : null}
          </View>
        );
      }
      const name = surahTitle(item.surahNumber);
      const voice = reciter ? shortReciterName(reciter.name) : '';
      const rewayah = (
        getCachedRewayat(item.reciterId) ??
        reciter?.rewayat ??
        []
      ).find(r => r.id === item.rewayahId);
      const caption = surahTileCaption(voice, rewayah?.name);
      return (
        <View style={styles.cell}>
          <ShelfSurahTile
            surahNumber={item.surahNumber}
            surahName={name}
            reciter={reciter}
            caption={caption}
            loved
            idPrefix="lib-shelf"
            onPress={() => {
              remember(item, index);
              playTile(item).catch(() => undefined);
            }}
            onLongPress={() => {
              menuFrom.current = {key: item.key, index};
              useContextMenuStore.getState().openSurah({
                surahNumber: item.surahNumber,
                reciterId: item.reciterId,
                ...(item.rewayahId ? {rewayahId: item.rewayahId} : {}),
                origin: 'loved',
              });
            }}
            hasTVPreferredFocus={preferred}
            accessibilityLabel={`Play ${name}${
              reciter ? ` by ${reciter.name}` : ''
            }, loved. Hold OK for more`}
          />
        </View>
      );
    },
    [reciterById, playlistById, focusIndex, push, playTile, voiceOf, remember],
  );

  const clock = <RootClock />;

  if (firstRun) {
    return (
      <View style={styles.container}>
        <LibraryFirstRun
          reciter={defaultReciter}
          onNewPlaylist={() => push({screen: 'playlistEdit'})}
          onBrowseSurahs={() => switchTab('surahs')}
          onPlaySurah={n => {
            playInDefault(n).catch(() => undefined);
          }}
          onSurahMenu={n =>
            useContextMenuStore.getState().openSurah({
              surahNumber: n,
              ...(defaultReciter ? {reciterId: defaultReciter.id} : {}),
            })
          }
        />
        {clock}
      </View>
    );
  }

  const empty =
    filter !== 'playlists' && items.length === 0 ? EMPTY[filter] : null;

  return (
    <View style={styles.container}>
      <RootTitle title="Library" />

      <View style={styles.bar}>
        <TVFocusGuideView
          autoFocus
          destinations={selectedTab ? [selectedTab] : undefined}
          style={styles.tabs}>
          {TABS.map(t => (
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
        {empty ? null : (
          <>
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
          </>
        )}
      </View>

      {empty ? (
        <TVFocusGuideView autoFocus style={styles.empty}>
          <Text style={styles.emptyText}>{empty.text}</Text>
          <FocusableButton
            onPress={() => switchTab(empty.tab)}
            accessibilityLabel={empty.action}
            outlined
            hasTVPreferredFocus={focusIndex !== null}
            style={styles.emptyButton}>
            <FocusText style={styles.emptyButtonText}>{empty.action}</FocusText>
          </FocusableButton>
        </TVFocusGuideView>
      ) : (
        // Right at the end of a short row stays put rather than jumping up
        // to the sort chips; Up is the way to the bar.
        <TVFocusGuideView autoFocus trapFocusRight style={styles.gridWrap}>
          <FlashList
            key={`${filter}-${sort}`}
            data={items}
            numColumns={COLUMNS}
            renderItem={renderItem}
            keyExtractor={item => item.key}
            overrideItemLayout={overrideItemLayout}
            initialScrollIndex={
              initialIndex > 0 && initialIndex < items.length
                ? initialIndex
                : undefined
            }
            extraData={focusIndex}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              filter === 'playlists' && counts.playlists === 0 ? (
                <Text style={styles.hint}>
                  Hold OK on any surah and choose Add to playlist.
                </Text>
              ) : null
            }
          />
          <ShelfFade height={130} />
        </TVFocusGuideView>
      )}

      {clock}
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ROOT_TITLE_GAP,
    minHeight: 64,
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
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 22,
    paddingLeft: SHELF_RING,
  },
  empty: {
    alignSelf: 'flex-start',
    marginTop: 72,
    marginLeft: PAD_LEFT,
    maxWidth: 900,
    gap: 28,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 26,
    lineHeight: 38,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 16,
  },
  emptyButtonText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 24},
});
