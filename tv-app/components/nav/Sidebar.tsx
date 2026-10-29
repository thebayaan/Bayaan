import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  findNodeHandle,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {LogoMark} from '../brand/LogoMark';
import {NowPlayingGlyph} from './NowPlayingGlyph';
import {useNavStore, type TabKey} from '../../store/navStore';
import {useNowPlayingTile} from '../../hooks/useNowPlayingTile';
import {restorePlaceContent} from '../../services/focusReturn';
import {focusInSteps, requestFocus} from '../../services/layerFocus';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {
  CollectionIcon,
  HomeIcon,
  PersonAudioIcon,
  QuranBookIcon,
  SearchIcon,
  SettingsIcon,
  TasbihIcon,
  type IconProps,
} from '../../../components/Icons';

/** Width the sidebar keeps when folded; screens leave this much room on the left. */
export const SIDEBAR_COLLAPSED_WIDTH = 112;
const SIDEBAR_EXPANDED_WIDTH = 300;
// The soft edge past the open panel, so it reads as a layer over the
// content rather than a cut through it.
const EDGE_WIDTH = 180;
const PANEL_INK = 'rgba(5,11,16,0.97)';

type Place = {key: TabKey; label: string; icon: React.FC<IconProps>};

const PLACES: Place[] = [
  {key: 'home', label: 'Home', icon: HomeIcon},
  {key: 'search', label: 'Search', icon: SearchIcon},
  {key: 'surahs', label: 'Surahs', icon: QuranBookIcon},
  {key: 'reciters', label: 'Reciters', icon: PersonAudioIcon},
  {key: 'adhkar', label: 'Adhkar', icon: TasbihIcon},
  {key: 'collection', label: 'Library', icon: CollectionIcon},
  {key: 'settings', label: 'Settings', icon: SettingsIcon},
];
const LAST_PLACE = PLACES[PLACES.length - 1].key;

type Focusable = View & {requestTVFocus?: () => void};

// The current place's item, for Back from the content (see focusSidebar).
let currentPlaceItem: Focusable | null = null;
// Every place's item, for focusing a given place (see focusSidebar).
const placeItems = new Map<TabKey, Focusable>();

function placeItem(place?: TabKey): Focusable | null {
  return place ? (placeItems.get(place) ?? null) : currentPlaceItem;
}

/**
 * Asks a place's item for focus, once and unchecked (the root layer's last
 * resort, which is itself checked). False when the sidebar isn't there.
 */
export function requestSidebarFocus(place?: TabKey): boolean {
  return requestFocus(placeItem(place));
}

// The sidebar item (place, or 'nowPlaying') that has focus now, from the
// items' own events, keyed so either order of blur and focus holds.
let sidebarHolder: string | null = null;

/** Whether a sidebar item (a place or the tile) has focus now. */
export function sidebarHasFocus(): boolean {
  return sidebarHolder !== null;
}

let pendingFocus: (() => void) | null = null;

/**
 * Moves focus onto a place in the sidebar, the current one by default. Back
 * on a root place does this first, so it never leaves the app from deep in
 * the content, and again onto Home after it switches there. False when the
 * sidebar isn't there to take it.
 *
 * Checked: a request the focus engine drops (Home still mounting, a view
 * that just left) is asked again, and if the sidebar still has no focus the
 * place's content takes it back (its last element, else its first, and its
 * own chain ends on the sidebar again, retried), so Back never leaves focus
 * nowhere.
 */
export function focusSidebar(place?: TabKey): boolean {
  if (!placeItem(place)) return false;
  pendingFocus?.();
  pendingFocus = focusInSteps(
    [
      () => requestFocus(placeItem(place)),
      () => requestFocus(placeItem(place)),
      restorePlaceContent,
    ],
    // Onto that place's item: still on the place just left is not there.
    () => (place ? sidebarHolder === place : sidebarHolder !== null),
  );
  return true;
}

/**
 * Left navigation for the TV app. Folded to icons while focus is in the
 * content, it opens with labels as soon as focus moves onto it, drawing over
 * the screen (dimmed behind it) instead of pushing it, so content never
 * reflows. Whatever is playing sits right under the places, one Down from
 * Settings and one press from the player.
 */
export function Sidebar(): React.ReactElement {
  const current = useNavStore(s => s.currentTab);
  const switchTab = useNavStore(s => s.switchTab);
  const setSidebarFocused = useNavStore(s => s.setSidebarFocused);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef(new Map<TabKey, Focusable>());
  // Native tags for the explicit Settings <-> tile links (nextFocusDown/Up).
  const [lastTag, setLastTag] = useState<number | undefined>();
  const [tileTag, setTileTag] = useState<number | undefined>();

  // Whether the sidebar has focus (navStore.sidebarFocused) follows the
  // items' own events at once (sidebarHolder): Back reads it, and a Right
  // then Back must never act on a sidebar focus that already left.
  // Moving focus between two sidebar items fires blur then focus; waiting a
  // beat before folding keeps the sidebar from flickering closed in between
  // (the fold only: the flag above never waits). On tvOS the new item's
  // focus often comes before the old item's blur (Settings -> tile, Library
  // -> Home after Back, one item to the next), so when the beat is over the
  // panel follows whichever item holds focus then, and folds only when none
  // does: a late blur never folds the panel over a focused item.
  const handleFocus = useCallback(
    (key: string) => {
      sidebarHolder = key;
      if (!useNavStore.getState().sidebarFocused) setSidebarFocused(true);
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setFocusedKey(key);
    },
    [setSidebarFocused],
  );
  const handleBlur = useCallback(
    (key: string) => {
      if (sidebarHolder === key) {
        sidebarHolder = null;
        setSidebarFocused(false);
      }
      if (blurTimer.current) clearTimeout(blurTimer.current);
      blurTimer.current = setTimeout(() => setFocusedKey(sidebarHolder), 80);
    },
    [setSidebarFocused],
  );
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      sidebarHolder = null;
      pendingFocus?.();
      setSidebarFocused(false);
    },
    [setSidebarFocused],
  );

  const open = focusedKey !== null;

  // Entering from the content (Left from any row, at any height) always
  // lands on the current place, never on whatever was focused here last, so
  // an OK straight after never switches places by surprise.
  const [entry, setEntry] = useState<Focusable | null>(null);
  useEffect(() => {
    const item = itemRefs.current.get(current) ?? null;
    currentPlaceItem = item;
    setEntry(item);
    return () => {
      if (currentPlaceItem === item) currentPlaceItem = null;
    };
  }, [current]);
  const destinations = useMemo(() => (entry ? [entry] : undefined), [entry]);

  // Down from Settings goes to the tile and Up from the tile to Settings, on
  // both focus engines, whatever sits behind the open panel.
  useEffect(() => {
    const last = itemRefs.current.get(LAST_PLACE);
    setLastTag(last ? (findNodeHandle(last) ?? undefined) : undefined);
  }, []);

  return (
    <>
      {open ? (
        <View style={styles.scrim} pointerEvents="none">
          <View style={styles.edge}>
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="sidebar-edge" x1="0" y1="0" x2="1" y2="0">
                  <Stop
                    offset="0"
                    stopColor={colors.background}
                    stopOpacity={0.97}
                  />
                  <Stop
                    offset="1"
                    stopColor={colors.background}
                    stopOpacity={0}
                  />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#sidebar-edge)"
              />
            </Svg>
          </View>
        </View>
      ) : null}
      {/* The guide spans the sidebar's full height, so Left from any row of
          the screen lands in it, even rows below the last item. Up and Down
          are trapped: the open panel draws over content, and without the
          trap the focus engines pick the cards under it. */}
      <TVFocusGuideView
        destinations={destinations}
        trapFocusUp
        trapFocusDown
        trapFocusLeft
        style={[styles.root, open ? styles.rootOpen : styles.rootFolded]}>
        <View style={styles.brand}>
          <LogoMark size={scale(36)} color={colors.text} />
          {open ? <Text style={styles.brandText}>BAYAAN</Text> : null}
        </View>
        <View style={styles.places}>
          {PLACES.map(place => (
            <SidebarItem
              key={place.key}
              itemRef={node => {
                if (node) {
                  itemRefs.current.set(place.key, node);
                  placeItems.set(place.key, node);
                } else {
                  itemRefs.current.delete(place.key);
                  placeItems.delete(place.key);
                }
              }}
              label={place.label}
              icon={place.icon}
              active={current === place.key}
              open={open}
              focused={focusedKey === place.key}
              nextFocusDown={place.key === LAST_PLACE ? tileTag : undefined}
              onFocus={() => handleFocus(place.key)}
              onBlur={() => handleBlur(place.key)}
              onPress={() => {
                // OK on the place already showing goes into it, like Right.
                if (place.key === current && restorePlaceContent()) return;
                switchTab(place.key);
              }}
            />
          ))}
        </View>
        <SidebarNowPlaying
          open={open}
          focused={focusedKey === 'nowPlaying'}
          nextFocusUp={lastTag}
          onTag={setTileTag}
          onFocus={() => handleFocus('nowPlaying')}
          onBlur={() => handleBlur('nowPlaying')}
        />
      </TVFocusGuideView>
    </>
  );
}

type NowPlayingProps = {
  open: boolean;
  focused: boolean;
  nextFocusUp?: number;
  /** Reports the tile's native tag (or undefined while there is no tile). */
  onTag: (tag: number | undefined) => void;
  onFocus: () => void;
  onBlur: () => void;
};

/**
 * The way back to the player: the same squircle as the places, a little
 * taller for two lines once the panel opens (the surah, then the state and
 * the reciter, or what OK will do). Its own component, so the progress it
 * follows doesn't redraw the places.
 */
function SidebarNowPlaying({
  open,
  focused,
  nextFocusUp,
  onTag,
  onFocus,
  onBlur,
}: NowPlayingProps): React.ReactElement | null {
  const {tile, press} = useNowPlayingTile();
  const ref = useRef<Focusable | null>(null);
  const shown = tile !== null;

  useEffect(() => {
    onTag(
      shown && ref.current
        ? (findNodeHandle(ref.current) ?? undefined)
        : undefined,
    );
  }, [shown, onTag]);

  if (!tile) return null;
  return (
    <>
      <View style={[styles.divider, open && styles.dividerOpen]} />
      <Pressable
        ref={node => {
          ref.current = node as Focusable | null;
        }}
        onPress={press}
        onFocus={onFocus}
        onBlur={onBlur}
        nextFocusUp={nextFocusUp}
        accessibilityRole="button"
        accessibilityLabel={tile.accessibilityLabel}
        style={[
          styles.tile,
          open && styles.tileOpen,
          focused && styles.tileFocused,
        ]}>
        <View style={styles.tileGlyph}>
          <NowPlayingGlyph state={tile.state} focused={focused} />
        </View>
        {open ? (
          <View
            style={[
              styles.tileText,
              tile.progress !== null && styles.tileTextAboveProgress,
            ]}>
            <Text
              numberOfLines={1}
              style={[styles.tileTitle, focused && styles.onFocus]}>
              {tile.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.tileDetail, focused && styles.onFocusSecondary]}>
              {tile.detail}
            </Text>
          </View>
        ) : null}
        {tile.progress !== null ? (
          <View
            style={[
              styles.progressTrack,
              focused && styles.progressTrackFocused,
            ]}>
            <View
              style={[
                styles.progressFill,
                // A started surah always shows a little of the bar.
                {
                  width: `${Math.max(3, Math.round(tile.progress * 100))}%`,
                },
                focused && styles.progressFocused,
              ]}
            />
          </View>
        ) : null}
      </Pressable>
    </>
  );
}

type ItemProps = {
  itemRef: (node: Focusable | null) => void;
  label: string;
  icon: React.FC<IconProps>;
  active: boolean;
  open: boolean;
  focused: boolean;
  nextFocusDown?: number;
  onFocus: () => void;
  onBlur: () => void;
  onPress: () => void;
};

function SidebarItem({
  itemRef,
  label,
  icon: Icon,
  active,
  open,
  focused,
  nextFocusDown,
  onFocus,
  onBlur,
  onPress,
}: ItemProps): React.ReactElement {
  // Focus is the cream fill with ink; the current place keeps a sky icon.
  const tint = focused
    ? colors.onFocus
    : active
      ? colors.accent
      : colors.textSecondary;
  return (
    <Pressable
      ref={node => itemRef(node as Focusable | null)}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      nextFocusDown={nextFocusDown}
      accessibilityLabel={label}
      accessibilityState={{selected: active}}
      style={[
        styles.item,
        open && styles.itemOpen,
        focused && styles.itemFocused,
      ]}>
      <Icon color={tint} size={scale(28)} filled={active || focused} />
      {open ? (
        <Text
          numberOfLines={1}
          style={[
            styles.itemLabel,
            active && styles.itemLabelActive,
            focused && styles.onFocus,
          ]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = createScaledStyles({
  root: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  rootFolded: {
    width: SIDEBAR_COLLAPSED_WIDTH,
    backgroundColor: 'rgba(5,11,16,0.55)',
  },
  rootOpen: {
    width: SIDEBAR_EXPANDED_WIDTH,
    backgroundColor: PANEL_INK,
  },
  // Dims the content while the panel is open, with a soft edge after it.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
    backgroundColor: 'rgba(5,11,16,0.45)',
  },
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SIDEBAR_EXPANDED_WIDTH,
    width: EDGE_WIDTH,
  },
  brand: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    marginBottom: 40,
  },
  brandText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 2,
  },
  places: {gap: 10},
  item: {
    height: 56,
    width: 64,
    borderRadius: 16,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  itemOpen: {
    width: 252,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
  },
  itemFocused: {backgroundColor: colors.focusFill},
  itemLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 20,
  },
  itemLabelActive: {color: colors.text},
  onFocus: {color: colors.onFocus},
  onFocusSecondary: {color: colors.onFocusSecondary},
  divider: {
    height: 1,
    width: 40,
    marginLeft: 12,
    marginVertical: 14,
    backgroundColor: colors.border,
  },
  dividerOpen: {width: 228},
  // The same squircle as the places, a little taller for two lines. The
  // glyph sits where the place icons do, so it doesn't jump as the panel
  // opens. A hairline outline marks it as the player's control at rest.
  tile: {
    height: 64,
    width: 64,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileOpen: {width: 252},
  tileFocused: {
    backgroundColor: colors.focusFill,
    borderColor: colors.focusFill,
  },
  tileGlyph: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {flex: 1, minWidth: 0, paddingRight: 14},
  // The two lines sit higher, so the progress bar runs below the detail
  // line's descenders, not through them.
  tileTextAboveProgress: {paddingBottom: 8},
  // Line heights fixed, so Android's font padding can't push the lines down.
  tileTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
  },
  tileDetail: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  // Inset from the squircle's curve, on a faint track, so it reads as
  // progress rather than a stray mark in the corner.
  progressTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 6,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  progressFill: {height: 3, borderRadius: 2, backgroundColor: colors.accent},
  progressFocused: {backgroundColor: colors.onFocus},
  // Ink at low strength on the cream tile, so track and fill both read.
  progressTrackFocused: {backgroundColor: 'rgba(6, 21, 28, 0.2)'},
});
