import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, Text, TVFocusGuideView, View} from 'react-native';
import {LogoMark} from '../brand/LogoMark';
import {SurahArtwork} from '../brand/SurahArtwork';
import {useNavStore, type TabKey} from '../../store/navStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {openPlayer} from '../../services/playbackRouting';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {
  CollectionIcon,
  HomeIcon,
  PauseIcon,
  PersonAudioIcon,
  PlayIcon,
  QuranBookIcon,
  SearchIcon,
  SettingsIcon,
  TasbihIcon,
  type IconProps,
} from '../../../components/Icons';

/** Width the sidebar keeps when folded; screens leave this much room on the left. */
export const SIDEBAR_COLLAPSED_WIDTH = 112;
const SIDEBAR_EXPANDED_WIDTH = 300;

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

/**
 * Left navigation for the TV app. Folded to icons while focus is in the
 * content, it opens with labels as soon as focus moves onto it, drawing over
 * the screen instead of pushing it, so content never reflows. Whatever is
 * playing stays pinned at the bottom, one press from the player.
 */
export function Sidebar(): React.ReactElement {
  const current = useNavStore(s => s.currentTab);
  const switchTab = useNavStore(s => s.switchTab);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Moving focus between two sidebar items fires blur then focus; waiting a
  // beat before folding keeps the sidebar from flickering closed in between.
  const handleFocus = useCallback((key: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocusedKey(key);
  }, []);
  const handleBlur = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setFocusedKey(null), 80);
  }, []);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const open = focusedKey !== null;

  return (
    // The guide spans the sidebar's full height, so Left from any row of the
    // screen lands in it, even rows below the last item where the focus engine
    // would otherwise find nothing (tvOS) or the nearest item (Android). Focus
    // enters on Home the first time, then wherever it last was.
    <TVFocusGuideView
      autoFocus
      style={[styles.root, open ? styles.rootOpen : styles.rootFolded]}>
      <View style={styles.brand}>
        <LogoMark size={scale(36)} color={colors.text} />
        {open ? <Text style={styles.brandText}>BAYAAN</Text> : null}
      </View>
      <View style={styles.places}>
        {PLACES.map(place => (
          <SidebarItem
            key={place.key}
            label={place.label}
            icon={place.icon}
            active={current === place.key}
            open={open}
            focused={focusedKey === place.key}
            onFocus={() => handleFocus(place.key)}
            onBlur={handleBlur}
            onPress={() => switchTab(place.key)}
          />
        ))}
      </View>
      <View style={styles.spacer} />
      <SidebarNowPlaying
        open={open}
        focused={focusedKey === 'nowPlaying'}
        onFocus={() => handleFocus('nowPlaying')}
        onBlur={handleBlur}
      />
    </TVFocusGuideView>
  );
}

type ItemProps = {
  label: string;
  icon: React.FC<IconProps>;
  active: boolean;
  open: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onPress: () => void;
};

function SidebarItem({
  label,
  icon: Icon,
  active,
  open,
  focused,
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
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
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
            focused && styles.itemLabelFocused,
          ]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

type NowPlayingProps = {
  open: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
};

function SidebarNowPlaying({
  open,
  focused,
  onFocus,
  onBlur,
}: NowPlayingProps): React.ReactElement | null {
  const status = useTVPlayerStore(s => s.status);
  const finished = useTVPlayerStore(s => s.finished);
  const item = useTVPlayerStore(s => s.queue[s.currentIndex]);
  if (!item) return null;

  const isPlaying = status === 'playing';
  const failed = status === 'error';
  const loading = status === 'loading' || status === 'buffering';
  // The second line says what OK will do when it's not just "open".
  const note = failed
    ? "Couldn't play · Open to retry"
    : finished
      ? 'Finished · Play again'
      : loading
        ? 'Loading…'
        : item.subtitle;
  const state = failed
    ? "Couldn't play"
    : finished
      ? 'Finished'
      : isPlaying
        ? 'Playing'
        : loading
          ? 'Loading'
          : 'Paused';
  return (
    <Pressable
      onPress={() => {
        if (finished) useTVPlayerStore.getState().replay();
        openPlayer();
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityLabel={`${state}: ${item.title}. ${
        finished ? 'Play again' : 'Open player'
      }.`}
      style={[
        styles.nowPlaying,
        open && styles.nowPlayingOpen,
        focused && styles.itemFocused,
      ]}>
      <View style={styles.tile}>
        <SurahArtwork
          surahNumber={item.surahNumber}
          glyphSize={26}
          id="sidebar-now-playing"
        />
        <View style={[styles.badge, failed && styles.badgeError]}>
          {failed ? (
            <Text style={styles.badgeMark}>!</Text>
          ) : isPlaying ? (
            <PauseIcon color={colors.accentInk} size={scale(10)} />
          ) : (
            <PlayIcon color={colors.accentInk} size={scale(10)} />
          )}
        </View>
      </View>
      {open ? (
        <View style={styles.nowPlayingText}>
          <Text
            numberOfLines={1}
            style={[
              styles.nowPlayingTitle,
              focused && styles.itemLabelFocused,
            ]}>
            {item.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.nowPlayingSub, focused && styles.itemLabelFocused]}>
            {note}
          </Text>
        </View>
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
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  rootFolded: {
    width: SIDEBAR_COLLAPSED_WIDTH,
    backgroundColor: 'rgba(5,11,16,0.55)',
  },
  rootOpen: {
    width: SIDEBAR_EXPANDED_WIDTH,
    backgroundColor: 'rgba(5,11,16,0.97)',
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
  itemLabelFocused: {color: colors.onFocus},
  spacer: {flex: 1},
  nowPlaying: {
    width: 64,
    borderRadius: 14,
    padding: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // No negative margin: an edge left of the items' makes Android treat the
  // tile as "left of" Home, so an extra Left press would jump down to it.
  nowPlayingOpen: {width: 252, padding: 8},
  tile: {
    width: 64,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A failure: a hollow ring with "!" (sky stays the only indicator color).
  badgeError: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  badgeMark: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 14,
  },
  nowPlayingText: {flex: 1, minWidth: 0},
  nowPlayingTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 16,
  },
  nowPlayingSub: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 13,
  },
});
