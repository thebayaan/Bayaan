// @ai-generated
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import type {FlatList} from 'react-native-gesture-handler';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerA11y} from '@/hooks/usePlayerA11y';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {ReciterImage} from '@/components/ReciterImage';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  type IconProps,
} from '@/components/Icons';
import {
  getTrackArtistDisplay,
  getTrackDisplayTitle,
  localizeDigits,
} from '@/i18n/format';
import {latinLetterSpacing} from '@/utils/rtl';
import type {Track} from '@/types/audio';
import {useRowDisplay} from '../PlayerContent/QueueList';
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai

const EMPTY_TRACKS: Track[] = [];

// The chip says which repeat is on, as Apple Music's does.
const REPEAT_LABELS = {
  none: 'a11y.repeat',
  queue: 'queue.repeatAll',
  track: 'queue.repeatOne',
} as const;

/**
 * How long the handle is held before a row lifts. Starting on touch down let
 * a quick swipe begin scrolling the list before the drag took over, which
 * dropped the row in the wrong place and left it lifted.
 */
const DRAG_HOLD_MS = 150;

/**
 * How close to the list's top or bottom edge a lifted row starts scrolling
 * the list. The library's 30pt sits under the finger at the screen's edge.
 */
const AUTOSCROLL_EDGE = 72;

type RowSection = 'nowPlaying' | 'upNext' | 'played';

interface UpNextItem {
  key: string;
  track: Track;
  index: number;
}

/** Keys that survive a reorder, even when a track is queued twice. */
function keyTracks(tracks: Track[], from: number): UpNextItem[] {
  const seen = new Map<string, number>();
  return tracks.slice(from).map((track, i) => {
    const n = seen.get(track.id) ?? 0;
    seen.set(track.id, n + 1);
    return {key: `${track.id}#${n}`, track, index: from + i};
  });
}

interface QueueRowProps {
  track: Track;
  index: number;
  section: RowSection;
  onPress: (index: number) => void;
  onMore?: (track: Track, index: number) => void;
  /** The row's ••• as a native menu (iPad and Android tablets). */
  renderMenu?: (track: Track, index: number) => React.ReactNode;
  /** Starts a drag; only Up Next rows have a handle. */
  drag?: () => void;
  /**
   * The handle is touched or released. The list stops scrolling while a
   * finger rests on a handle, so the list can't take the touch from the
   * hold that lifts the row (which left the row lifted). A quick swipe from
   * a handle still scrolls, because it starts before the lock lands, and
   * no row lifts.
   */
  onHandleTouch?: (down: boolean) => void;
  isDragging?: boolean;
  onMove?: (index: number, by: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const QueueRow = React.memo(function QueueRow({
  track,
  index,
  section,
  onPress,
  onMore,
  renderMenu,
  drag,
  onHandleTouch,
  isDragging = false,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: QueueRowProps) {
  const {t} = useTranslation(['player', 'common']);
  const colors = useReadingThemeColors();
  const display = useRowDisplay(track);
  const isCurrent = section === 'nowPlaying';
  const isPlaying = usePlayerStore(
    s =>
      isCurrent &&
      (s.playback.state === 'playing' || s.playback.state === 'buffering'),
  );
  const subtle = Color(colors.text).alpha(0.06).toString();
  const showArtwork =
    !!track.reciterName && track.reciterName !== 'My Recitations';

  const actions = [
    ...(canMoveUp ? [{name: 'moveUp', label: t('queue.moveUp')}] : []),
    ...(canMoveDown ? [{name: 'moveDown', label: t('queue.moveDown')}] : []),
  ];
  const handleAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'moveUp') onMove?.(index, -1);
    if (e.nativeEvent.actionName === 'moveDown') onMove?.(index, 1);
  };

  return (
    <View
      style={[
        styles.row,
        isCurrent && {backgroundColor: subtle},
        isDragging && [styles.dragging, {backgroundColor: colors.card}],
        section === 'played' && styles.played,
      ]}>
      <Pressable
        style={({pressed}) => [
          styles.rowBody,
          pressed && !isCurrent && {opacity: 0.6},
        ]}
        onPress={() => onPress(index)}
        onLongPress={onMore ? () => onMore(track, index) : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${display.title}, ${display.subtitle}`}
        accessibilityActions={actions}
        onAccessibilityAction={handleAction}>
        {showArtwork ? (
          <ReciterImage
            reciterName={track.reciterName}
            imageUrl={track.artwork || undefined}
            style={styles.art}
          />
        ) : (
          <View
            style={[
              styles.art,
              styles.artPlaceholder,
              {backgroundColor: subtle},
            ]}>
            <Feather name="music" size={18} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text
            style={[styles.rowTitle, {color: colors.text}]}
            numberOfLines={1}>
            {display.title}
          </Text>
          <Text
            style={[styles.rowSubtitle, {color: colors.textSecondary}]}
            numberOfLines={1}>
            {display.tags.length
              ? `${display.subtitle} · ${display.tags.join(' · ')}`
              : display.subtitle}
          </Text>
        </View>
      </Pressable>
      {isCurrent ? (
        <View style={styles.indicator}>
          <NowPlayingIndicator
            isPlaying={isPlaying}
            barCount={3}
            surahId={display.surahId}
          />
        </View>
      ) : null}
      {onMore ? (
        <Pressable
          onPress={() => onMore(track, index)}
          style={({pressed}) => [styles.rowButton, pressed && {opacity: 0.6}]}
          accessibilityRole="button"
          accessibilityLabel={t('queue.moreFor', {title: display.title})}>
          <Feather
            name="more-horizontal"
            size={18}
            color={colors.textSecondary}
          />
          {renderMenu?.(track, index)}
        </Pressable>
      ) : null}
      {drag ? (
        <Pressable
          onPressIn={() => onHandleTouch?.(true)}
          onPressOut={() => onHandleTouch?.(false)}
          onLongPress={drag}
          delayLongPress={DRAG_HOLD_MS}
          style={styles.rowButton}
          accessibilityRole="button"
          accessibilityLabel={t('queue.reorder', {title: display.title})}
          accessibilityHint={t('queue.reorderHint')}>
          <MaterialCommunityIcons
            name="drag-horizontal-variant"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

function Overline({children}: {children: string}) {
  const colors = useReadingThemeColors();
  return (
    <Text
      style={[styles.overline, {color: colors.textSecondary}]}
      accessibilityRole="header">
      {children}
    </Text>
  );
}

function Chip({
  label,
  icon: Icon,
  selected = false,
  disabled = false,
  onPress,
  a11y,
}: {
  label: string;
  icon: React.ComponentType<IconProps>;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  a11y?: object;
}) {
  const {theme} = useTheme();
  const colors = useReadingThemeColors();
  const tint = selected ? theme.colors.primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled, selected}}
      {...a11y}
      style={({pressed}) => [
        styles.chip,
        {
          backgroundColor: selected
            ? Color(theme.colors.primary).alpha(0.12).toString()
            : Color(colors.text).alpha(0.06).toString(),
        },
        disabled && styles.disabled,
        pressed && {opacity: 0.6},
      ]}>
      <Icon size={16} color={tint} />
      <Text style={[styles.chipText, {color: tint}]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The Queue pane of the iPad player (listening/02, Surface 4; mockup L3):
 * Up Next with Repeat, Shuffle and Clear, the current track, rows that
 * drag to reorder and open a menu, and the played tracks behind a
 * disclosure row.
 */
export function QueuePane({bottomInset}: {bottomInset: number}) {
  const {t} = useTranslation(['player', 'common', 'sheets']);
  const {theme} = useTheme();
  const colors = useReadingThemeColors();
  const a11y = usePlayerA11y();
  const {
    updateQueue,
    removeFromQueue,
    moveInQueue,
    shuffleUpNext,
    play,
    updateSettings,
  } = usePlayerActions();
  const {navigateToReciterProfile} = useReciterNavigation();
  const tracks = usePlayerStore(s => s.queue.tracks) ?? EMPTY_TRACKS;
  const currentIndex = usePlayerStore(s => s.queue.currentIndex);
  const repeatMode = usePlayerStore(s => s.settings.repeatMode);
  const [showPlayed, setShowPlayed] = useState(false);
  const [handleTouched, setHandleTouched] = useState(false);
  const listRef = useRef<FlatList<UpNextItem>>(null);
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const disclosureHeight = useRef(0);
  // Where the Played row starts while its rows are being revealed.
  const revealFrom = useRef<number | null>(null);
  const paddingBottom = bottomInset + 24;

  const current = tracks[currentIndex];
  const upNext = useMemo(
    () => keyTracks(tracks, currentIndex + 1),
    [tracks, currentIndex],
  );
  const played = useMemo(
    () => keyTracks(tracks.slice(0, currentIndex), 0),
    [tracks, currentIndex],
  );

  const playAt = useCallback(
    async (index: number) => {
      try {
        await updateQueue(tracks, index);
        await play();
      } catch (e) {
        console.error('QueuePane: play failed', e);
      }
    },
    [tracks, updateQueue, play],
  );

  const move = useCallback(
    (index: number, by: -1 | 1) => {
      moveInQueue(index, index + by);
    },
    [moveInQueue],
  );

  const buildMenu = useCallback(
    (track: Track, index: number): CollectionOptionsPayload => {
      const nextSlot = index > currentIndex ? currentIndex + 1 : currentIndex;
      const options = [
        {
          label: t('sheets:options.playNow'),
          icon: 'play',
          onPress: () => playAt(index),
        },
        ...(index !== nextSlot
          ? [
              {
                label: t('queue.playNext'),
                icon: 'corner-down-right',
                onPress: () => moveInQueue(index, nextSlot),
              },
            ]
          : []),
        ...(track.reciterId
          ? [
              {
                label: t('sheets:options.goToReciter'),
                icon: 'user',
                onPress: () => navigateToReciterProfile(track.reciterId),
              },
            ]
          : []),
        {
          label: t('common:actions.remove'),
          icon: 'trash-2',
          destructive: true,
          onPress: () => removeFromQueue([index]),
        },
      ];
      return {
        title: getTrackDisplayTitle(track),
        subtitle: getTrackArtistDisplay(track),
        options,
      };
    },
    [
      currentIndex,
      t,
      playAt,
      moveInQueue,
      navigateToReciterProfile,
      removeFromQueue,
    ],
  );

  const openMenu = useCallback(
    (track: Track, index: number) => {
      showSheet('collection-options', {
        payload: buildMenu(track, index),
      });
    },
    [buildMenu],
  );

  const nativeMenus = useNativeOptionsMenu();
  const renderMenu = useCallback(
    (track: Track, index: number) => (
      <CollectionOptionsMenu
        payload={buildMenu(track, index)}
        layout="overlay"
        accessibilityLabel={t('queue.moreFor', {
          title: getTrackDisplayTitle(track),
        })}
      />
    ),
    [buildMenu, t],
  );
  const rowMenu = nativeMenus ? renderMenu : undefined;

  const cycleRepeat = useCallback(() => {
    updateSettings({
      repeatMode: ({none: 'queue', queue: 'track', track: 'none'} as const)[
        repeatMode
      ],
    });
  }, [repeatMode, updateSettings]);

  const togglePlayed = useCallback(() => {
    revealFrom.current = showPlayed
      ? null
      : contentHeight.current - paddingBottom - disclosureHeight.current;
    setShowPlayed(!showPlayed);
  }, [showPlayed, paddingBottom]);

  // Opened, Played adds its rows under the fold. Scroll them into view, as
  // far as keeping the Played row itself on screen allows.
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.current = height;
    const from = revealFrom.current;
    if (from === null) return;
    revealFrom.current = null;
    const target = Math.min(from, height - viewportHeight.current);
    if (target > scrollOffset.current) {
      listRef.current?.scrollToOffset({offset: target, animated: true});
    }
  }, []);

  const clearUpNext = useCallback(() => {
    removeFromQueue(upNext.map(item => item.index));
  }, [removeFromQueue, upNext]);

  const renderItem = useCallback(
    ({item, drag, isActive}: RenderItemParams<UpNextItem>) => (
      <QueueRow
        track={item.track}
        index={item.index}
        section="upNext"
        onPress={playAt}
        onMore={openMenu}
        renderMenu={rowMenu}
        drag={drag}
        onHandleTouch={setHandleTouched}
        isDragging={isActive}
        onMove={move}
        canMoveUp={item.index > currentIndex + 1}
        canMoveDown={item.index < tracks.length - 1}
      />
    ),
    [playAt, openMenu, rowMenu, move, currentIndex, tracks.length],
  );

  const header = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text
            style={[styles.title, {color: colors.text}]}
            accessibilityRole="header">
            {t('queue.upNext')}
          </Text>
          <Text style={[styles.count, {color: colors.textSecondary}]}>
            {t('common:counts.tracks', {count: upNext.length})}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Chip
            label={t(REPEAT_LABELS[repeatMode])}
            selected={repeatMode !== 'none'}
            onPress={cycleRepeat}
            a11y={a11y.repeat(repeatMode)}
            icon={repeatMode === 'track' ? RepeatOneIcon : RepeatIcon}
          />
          <Chip
            label={t('common:actions.shuffle')}
            disabled={upNext.length < 2}
            onPress={shuffleUpNext}
            icon={ShuffleIcon}
          />
          <Pressable
            onPress={clearUpNext}
            disabled={upNext.length === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('queue.clearUpNext')}
            accessibilityState={{disabled: upNext.length === 0}}
            style={({pressed}) => [
              styles.clear,
              upNext.length === 0 && styles.disabled,
              pressed && {opacity: 0.6},
            ]}>
            <Text style={[styles.clearText, {color: theme.colors.primary}]}>
              {t('common:actions.clear')}
            </Text>
          </Pressable>
        </View>
      </View>
      {current ? (
        <>
          <Overline>{t('queue.nowPlaying')}</Overline>
          <QueueRow
            track={current}
            index={currentIndex}
            section="nowPlaying"
            onPress={playAt}
          />
        </>
      ) : null}
      <Overline>{t('queue.upNext')}</Overline>
      {upNext.length === 0 ? (
        <Text style={[styles.empty, {color: colors.textSecondary}]}>
          {t('queue.nothingNext')}
        </Text>
      ) : null}
    </View>
  );

  const footer =
    played.length > 0 ? (
      <View>
        <Pressable
          onPress={togglePlayed}
          onLayout={(e: LayoutChangeEvent) => {
            disclosureHeight.current = e.nativeEvent.layout.height;
          }}
          accessibilityRole="button"
          accessibilityState={{expanded: showPlayed}}
          style={({pressed}) => [styles.disclosure, pressed && {opacity: 0.6}]}>
          <Feather
            name={showPlayed ? 'chevron-down' : 'chevron-right'}
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.disclosureText, {color: colors.textSecondary}]}>
            {`${t('queue.played')} (${localizeDigits(played.length)})`}
          </Text>
        </Pressable>
        {showPlayed
          ? played.map(item => (
              <QueueRow
                key={item.key}
                track={item.track}
                index={item.index}
                section="played"
                onPress={playAt}
                onMore={openMenu}
                renderMenu={rowMenu}
              />
            ))
          : null}
      </View>
    ) : null;

  return (
    <DraggableFlatList
      ref={listRef}
      data={upNext}
      scrollEnabled={!handleTouched}
      autoscrollThreshold={AUTOSCROLL_EDGE}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      onDragEnd={({from, to}) => {
        if (from !== to) {
          moveInQueue(currentIndex + 1 + from, currentIndex + 1 + to);
        }
      }}
      ListHeaderComponent={header}
      ListFooterComponent={footer ?? undefined}
      onContentSizeChange={onContentSizeChange}
      onContainerLayout={({layout}) => {
        viewportHeight.current = layout.height;
      }}
      onScrollOffsetChange={offset => {
        scrollOffset.current = offset;
      }}
      containerStyle={styles.fill}
      contentContainerStyle={[styles.content, {paddingBottom}]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Manrope-Bold',
  },
  count: {
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
  },
  clear: {
    height: 32,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  disabled: {
    opacity: 0.4,
  },
  overline: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    textTransform: 'uppercase',
    letterSpacing: latinLetterSpacing(0.6),
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  empty: {
    fontSize: 15,
    fontFamily: 'Manrope-Medium',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingStart: 12,
    paddingEnd: 4,
  },
  dragging: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  played: {
    opacity: 0.7,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  art: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  rowSubtitle: {
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  indicator: {
    width: 44,
    alignItems: 'center',
  },
  rowButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  disclosureText: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
});
