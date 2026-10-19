import React, {useEffect, useRef, useState} from 'react';
import {Platform, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusSpinner} from '../primitives/FocusSpinner';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {ProgressLine} from './ProgressLine';
import {PANEL_WIDTH} from './SidePanel';
import {StepBackIcon, StepForwardIcon} from './StepIcons';
import {useSleepLeftMs} from './useSleepLeft';
import {hasNextIn, useTVPlayerStore} from '../../store/tvPlayerStore';
import {
  formatSpeed,
  repeatLabel,
  sleepLabel,
  sleepLeftLabel,
  useListeningStore,
  type PanelKey,
} from '../../store/listeningStore';
import {onScreenLabel, useDisplayStore} from '../../store/displayStore';
import {ambientChoiceLabel, useAmbientStore} from '../../store/ambientStore';
import {AMBIENT_AVAILABLE} from '../../services/ambientPlayer';
import {shortReciterName} from '../../services/listeningChoices';
import {isLovedIn, toggleLovedSurah} from '../../services/lovedSurahsStore';
import {useLovedSurahs} from '../../hooks/useLovedSurahs';
import {usePlaylists} from '../../hooks/usePlaylists';
import {playlistHas} from '../../services/playlistsStore';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import {
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
} from '../../../components/Icons';

type Props = {
  /** Whether the recitation has verse timings (verse-by-verse transport). */
  synced: boolean;
  ticks: number[];
  onStep: (direction: 1 | -1) => void;
  /** The reciter's name, for the Reciter control. */
  reciterName: string;
  /** Any press inside the tray, so the screen can keep it open. */
  onActivity: () => void;
};

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, '0')}`
    : `${mm}:${String(s).padStart(2, '0')}`;
}

/**
 * Android hands focus back to a panel's tool before the panel unmounts.
 * Removing the focused panel row makes Android park focus on the screen's
 * focus guide and pick a new focus a frame later (ReactViewGroup
 * recoverFocus); a long panel (the Reciter list, with portraits) takes long
 * enough to unmount that the next press arrived in that gap and was lost.
 * So on Android the tools stay focusable under a panel (its guide traps the
 * D-pad, so they can't be reached), and the tool is asked for focus the
 * moment the panel closes, before React redraws: view commands run ahead of
 * the redraw's view changes, so focus is on the tool before the row goes.
 */
const HANDOFF_BEFORE_UNMOUNT = Platform.OS === 'android';

/**
 * The player's controls, raised from the bottom on OK: progress with verse
 * ticks; transport (previous surah, a verse back, play, a verse on, next
 * surah); and one row of labeled tools (Repeat, Speed, On screen, Reciter,
 * Sleep, Sound, Queue, Save, Love) that each show their current value.
 * Pressing a tool opens its panel on the right. While a panel is open the
 * tray keeps left of it and the tools are hidden and out of focus, so
 * nothing focusable sits hidden under the panel (on Android they stay
 * focusable, see HANDOFF_BEFORE_UNMOUNT). They stay mounted, so when the
 * panel closes the tool that opened it is still there to take focus back.
 */
export function ControlsTray({
  synced,
  ticks,
  onStep,
  reciterName,
  onActivity,
}: Props): React.ReactElement {
  const status = useTVPlayerStore(s => s.status);
  const held = useTVPlayerStore(s => s.held);
  const position = useTVPlayerStore(s => s.positionSeconds);
  const duration = useTVPlayerStore(s => s.durationSeconds);
  const speed = useTVPlayerStore(s => s.speed);
  const sleep = useTVPlayerStore(s => s.sleep);
  const toggle = useTVPlayerStore(s => s.toggle);
  const prev = useTVPlayerStore(s => s.prev);
  const next = useTVPlayerStore(s => s.next);
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const hasNext = useTVPlayerStore(hasNextIn);
  const sleepLeftMs = useSleepLeftMs();
  const ambientOn = useAmbientStore(s => s.enabled);
  const ambientSound = useAmbientStore(s => s.currentSound);
  const loved = useLovedSurahs();
  const playlists = usePlaylists();
  const repeat = useListeningStore(s => s.repeat);
  const sleepChoice = useListeningStore(s => s.sleepChoice);
  const panel = useListeningStore(s => s.panel);
  const setPanel = useListeningStore(s => s.setPanel);
  const mode = useDisplayStore(s => s.mode);
  const edition = useDisplayStore(s => s.edition);

  // When a panel closes, focus goes back to the tool that opened it: asked
  // for once, on the tool's own button. A tray that mounts with a panel
  // already open (back from the New playlist editor) returns to its tool.
  const [returnTo, setReturnTo] = useState<PanelKey | null>(
    () => useListeningStore.getState().panel,
  );
  const toolRefs = useRef<Partial<Record<PanelKey, View | null>>>({});
  const returnToRef = useRef(returnTo);
  returnToRef.current = returnTo;
  // Set when the tool already took focus as the panel closed (Android).
  const handedOff = useRef(false);
  useEffect(() => {
    if (!HANDOFF_BEFORE_UNMOUNT) return;
    // Store listeners run inside the store's set, before React redraws.
    return useListeningStore.subscribe((state, prev) => {
      if (prev.panel === null || state.panel !== null || !state.trayOpen) {
        return;
      }
      // A flag left from a close React never redrew must not skip this one.
      handedOff.current = false;
      const key = returnToRef.current;
      const node = key === null ? null : toolRefs.current[key];
      if (!node?.requestTVFocus) return;
      node.requestTVFocus();
      handedOff.current = true;
    });
  }, []);
  const panelOpen = panel !== null;
  const toolsFocusable = HANDOFF_BEFORE_UNMOUNT || !panelOpen;
  const wasOpen = useRef(panelOpen);
  useEffect(() => {
    const closed = wasOpen.current && !panelOpen;
    wasOpen.current = panelOpen;
    if (!closed || returnTo === null) return;
    // Asked again later, it would pull focus back from a tool the next
    // press already moved to.
    if (handedOff.current) {
      handedOff.current = false;
      return;
    }
    const id = setTimeout(
      () => toolRefs.current[returnTo]?.requestTVFocus?.(),
      0,
    );
    return () => clearTimeout(id);
  }, [panelOpen, returnTo]);

  // A verse repeat's gap counts as playing: Pause there stops the replay.
  const isPlaying = status === 'playing' || held;
  const loading = status === 'loading' || status === 'buffering';
  const sleepOn = sleep.kind !== 'off';
  const press = (fn: () => void) => () => {
    onActivity();
    fn();
  };
  const tool = (key: PanelKey) => ({
    focusable: toolsFocusable,
    buttonRef: (node: View | null) => {
      toolRefs.current[key] = node;
    },
    onPress: press(() => {
      setReturnTo(key);
      setPanel(key);
    }),
  });

  const item = queue[currentIndex];
  const isLoved = item
    ? isLovedIn(loved, item.surahNumber, item.reciterId)
    : false;
  const toggleLoved = press(() => {
    if (item) {
      toggleLovedSurah(item.surahNumber, item.reciterId, item.rewayahId ?? '');
    }
  });
  const savedIn = item
    ? playlists.filter(p =>
        playlistHas(p, {
          surahNumber: item.surahNumber,
          reciterId: item.reciterId,
          ...(item.rewayahId ? {rewayahId: item.rewayahId} : {}),
        }),
      ).length
    : 0;
  const nextCount = Math.max(0, queue.length - currentIndex - 1);

  return (
    <View style={[styles.tray, panelOpen && styles.trayBesidePanel]}>
      <View style={styles.progressRow}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <ProgressLine
          progress={duration > 0 ? position / duration : 0}
          ticks={ticks}
          thick
        />
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
      <TVFocusGuideView autoFocus style={styles.row}>
        <View style={styles.transport}>
          <FocusableButton
            onPress={press(() => void prev())}
            accessibilityLabel="Previous surah"
            focusable={!panelOpen}
            style={styles.round}>
            <FocusIcon icon={PreviousIcon} size={26} />
          </FocusableButton>
          <FocusableButton
            onPress={press(() => onStep(-1))}
            accessibilityLabel={synced ? 'Previous verse' : 'Back 15 seconds'}
            focusable={!panelOpen}
            style={styles.round}>
            <FocusIcon icon={StepBackIcon} size={34} />
          </FocusableButton>
          <FocusableButton
            onPress={press(toggle)}
            accessibilityLabel={
              loading ? 'Loading' : isPlaying ? 'Pause' : 'Play'
            }
            hasTVPreferredFocus={returnTo === null}
            focusable={!panelOpen}
            style={[styles.round, styles.roundBig]}>
            {loading ? (
              <FocusSpinner size="large" />
            ) : (
              <FocusIcon icon={isPlaying ? PauseIcon : PlayIcon} size={38} />
            )}
          </FocusableButton>
          <FocusableButton
            onPress={press(() => onStep(1))}
            accessibilityLabel={synced ? 'Next verse' : 'Forward 15 seconds'}
            focusable={!panelOpen}
            style={styles.round}>
            <FocusIcon icon={StepForwardIcon} size={34} />
          </FocusableButton>
          {/* At the end of the queue Next stays a stop for focus (it can
              be the button that just played the last surah) but is dimmed
              and does nothing. */}
          <View style={!hasNext && styles.unavailable}>
            <FocusableButton
              onPress={press(() => void next())}
              accessibilityLabel="Next surah"
              disabled={!hasNext}
              focusable={!panelOpen}
              style={styles.round}>
              <FocusIcon icon={NextIcon} size={26} />
            </FocusableButton>
          </View>
        </View>
        <View
          style={[styles.tools, panelOpen && styles.toolsHidden]}
          importantForAccessibility={
            panelOpen ? 'no-hide-descendants' : 'auto'
          }>
          <Tool
            label="Repeat"
            value={repeatLabel(repeat)}
            on={repeat.kind !== 'off'}
            {...tool('repeat')}
          />
          <Tool
            label="Speed"
            value={formatSpeed(speed)}
            on={speed !== 1}
            {...tool('speed')}
          />
          <Tool
            label="On screen"
            value={onScreenLabel(mode, edition)}
            on={false}
            {...tool('onScreen')}
          />
          <Tool
            label="Reciter"
            value={shortReciterName(reciterName)}
            on={false}
            {...tool('reciter')}
          />
          <Tool
            label="Sleep"
            value={
              sleepLeftMs !== undefined
                ? sleepLeftLabel(sleepLeftMs)
                : sleepOn
                  ? sleepLabel(sleepChoice)
                  : 'Off'
            }
            on={sleepOn}
            {...tool('sleep')}
          />
          {AMBIENT_AVAILABLE ? (
            <Tool
              label="Sound"
              value={ambientChoiceLabel(ambientOn ? ambientSound : 'off')}
              on={ambientOn}
              {...tool('sound')}
            />
          ) : null}
          <Tool
            label="Queue"
            value={nextCount > 0 ? `${nextCount} next` : 'Last'}
            on={false}
            {...tool('queue')}
          />
          <Tool
            label="Save"
            value={
              savedIn === 0 ? 'Add' : savedIn === 1 ? 'Saved' : `In ${savedIn}`
            }
            on={savedIn > 0}
            {...tool('save')}
          />
          <Tool
            label={isLoved ? 'Loved' : 'Love'}
            accessibilityLabel={
              isLoved ? 'Remove from loved surahs' : 'Add to loved surahs'
            }
            icon={
              <FocusIcon
                icon={HeartIcon}
                size={30}
                filled={isLoved}
                color={isLoved ? colors.accent : colors.text}
              />
            }
            on={isLoved}
            focusable={toolsFocusable}
            onPress={toggleLoved}
          />
        </View>
      </TVFocusGuideView>
    </View>
  );
}

function Tool({
  label,
  value,
  icon,
  on,
  focusable,
  buttonRef,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  /** The current value, or an icon in its place (Love). */
  value?: string;
  icon?: React.ReactNode;
  on: boolean;
  /** False while a panel is open and the tools are hidden (not Android). */
  focusable: boolean;
  /** The button, so focus can come back to it when its panel closes. */
  buttonRef?: (node: View | null) => void;
  onPress: () => void;
  accessibilityLabel?: string;
}): React.ReactElement {
  return (
    <FocusableButton
      ref={buttonRef}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value ?? ''}`}
      focusable={focusable}
      containerStyle={styles.toolBox}
      style={styles.tool}>
      <FocusText
        style={styles.toolLabel}
        color={colors.textSecondary}
        focusedColor={colors.onFocusSecondary}
        numberOfLines={1}>
        {label}
      </FocusText>
      {/* An icon sits in the value's own line box, so its label lines up
          with the others. */}
      <View style={styles.toolValueSlot}>
        {icon ?? (
          <FocusText
            style={styles.toolValue}
            color={on ? colors.accent : colors.text}
            numberOfLines={1}>
            {value}
          </FocusText>
        )}
      </View>
    </FocusableButton>
  );
}

const styles = createScaledStyles({
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 96,
    paddingTop: 28,
    paddingBottom: 56,
    gap: 28,
  },
  // Keeps the progress and transport clear of an open panel.
  trayBesidePanel: {right: PANEL_WIDTH, paddingRight: 48},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 20},
  time: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    minWidth: 64,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transport: {flexDirection: 'row', alignItems: 'center', gap: 12},
  round: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The main control is told apart by its size. At rest it wears only the
  // faint divider line, never a bright ring that reads as a second focus
  // beside a focused tool or panel row (Ink & Cream: only focus is cream).
  roundBig: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
  },
  // Next surah at the end of the queue: dimmed, and does nothing.
  unavailable: {opacity: 0.3},
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    marginLeft: 24,
  },
  // Beside an open panel: kept mounted but invisible (and out of focus).
  toolsHidden: {opacity: 0},
  // Long values (a reciter's name, "End of surah") shrink and truncate
  // rather than push the last tools off the screen.
  toolBox: {flexShrink: 1, minWidth: 0},
  tool: {
    maxWidth: 280,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 4,
    justifyContent: 'center',
  },
  toolLabel: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  toolValueSlot: {height: 30, justifyContent: 'center'},
  toolValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 30,
  },
});
