import React, {useEffect, useRef, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusSpinner} from '../primitives/FocusSpinner';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {ProgressLine} from './ProgressLine';
import {PANEL_WIDTH} from './SidePanel';
import {StepBackIcon, StepForwardIcon} from './StepIcons';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {
  repeatLabel,
  sleepLabel,
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
import {
  returningToSave,
  takeReturnToSave,
} from '../../services/playlistsPicker';
import {formatSpeed} from './ListeningPanels';
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
 * The player's controls, raised from the bottom on OK: progress with verse
 * ticks; transport (previous surah, a verse back, play, a verse on, next
 * surah); and one row of labeled tools (Repeat, Speed, On screen, Reciter,
 * Sleep, Sound, Queue, Save, Love) that each show their current value.
 * Pressing a tool opens its panel on the right. While a panel is open the
 * tray keeps left of it and the tools step aside, so nothing focusable sits
 * hidden under the panel.
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
  const playerRepeat = useTVPlayerStore(s => s.repeat);
  const shuffle = useTVPlayerStore(s => s.shuffle);
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

  // When a panel closes, focus goes back to the tool that opened it. It is
  // set when the tool is pressed, so the tools mount again already knowing
  // which one takes focus.
  // Back from the playlist editor the Save panel opened, Save takes it.
  const [returnTo, setReturnTo] = useState<PanelKey | null>(() =>
    returningToSave() ? 'save' : null,
  );
  useEffect(() => {
    takeReturnToSave();
  }, []);

  const panelOpen = panel !== null;
  // A verse repeat's gap counts as playing: Pause there stops the replay.
  const isPlaying = status === 'playing' || held;
  const loading = status === 'loading' || status === 'buffering';
  const sleepOn = sleep.kind !== 'off';
  const press = (fn: () => void) => () => {
    onActivity();
    fn();
  };
  const tool = (key: PanelKey) => ({
    focusOnReturn: returnTo === key,
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
  const hasNext =
    nextCount > 0 || playerRepeat === 'all' || (shuffle && queue.length > 1);

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
            outlined
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
          <View style={!hasNext && styles.unavailable}>
            <FocusableButton
              onPress={press(() => void next())}
              accessibilityLabel="Next surah"
              focusable={!panelOpen && hasNext}
              style={styles.round}>
              <FocusIcon icon={NextIcon} size={26} />
            </FocusableButton>
          </View>
        </View>
        {panelOpen ? null : (
          <View style={styles.tools}>
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
              value={sleepOn ? sleepLabel(sleepChoice) : 'Off'}
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
                savedIn === 0
                  ? 'Add'
                  : savedIn === 1
                    ? 'Saved'
                    : `In ${savedIn}`
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
                  size={26}
                  filled={isLoved}
                  color={isLoved ? colors.accent : colors.text}
                />
              }
              on={isLoved}
              focusOnReturn={false}
              onPress={toggleLoved}
            />
          </View>
        )}
      </TVFocusGuideView>
    </View>
  );
}

function Tool({
  label,
  value,
  icon,
  on,
  focusOnReturn,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  /** The current value, or an icon in its place (Love). */
  value?: string;
  icon?: React.ReactNode;
  on: boolean;
  /** Take focus when the tray comes back from this tool's panel. */
  focusOnReturn: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}): React.ReactElement {
  // The tools mount again when a panel closes; hasTVPreferredFocus takes
  // focus then, and asking once mounted backs it up in case the focus
  // engine was still busy with the closing panel.
  const ref = useRef<View>(null);
  const returning = useRef(focusOnReturn).current;
  useEffect(() => {
    if (!returning) return;
    const id = setTimeout(() => ref.current?.requestTVFocus?.(), 0);
    return () => clearTimeout(id);
  }, [returning]);
  return (
    <FocusableButton
      ref={ref}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value ?? ''}`}
      hasTVPreferredFocus={focusOnReturn}
      containerStyle={styles.toolBox}
      style={styles.tool}>
      <FocusText
        style={styles.toolLabel}
        color={colors.textSecondary}
        focusedColor={colors.onFocusSecondary}
        numberOfLines={1}>
        {label}
      </FocusText>
      {icon ?? (
        <FocusText
          style={styles.toolValue}
          color={on ? colors.accent : colors.text}
          numberOfLines={1}>
          {value}
        </FocusText>
      )}
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
  roundBig: {
    width: 88,
    height: 88,
    borderRadius: 24,
  },
  // Next surah at the end of the queue: shown, but not a stop for focus.
  unavailable: {opacity: 0.3},
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    marginLeft: 24,
  },
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
  toolValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
  },
});
