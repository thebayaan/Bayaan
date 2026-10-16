import React from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {ProgressLine} from './ProgressLine';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {
  repeatLabel,
  sleepLabel,
  useListeningStore,
  type PanelKey,
} from '../../store/listeningStore';
import {onScreenLabel, useDisplayStore} from '../../store/displayStore';
import {formatSpeed} from './ListeningPanels';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles, scale} from '../../theme/scale';
import {
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
 * ticks, verse-by-verse transport, and one row of labeled settings that each
 * show their current value. Pressing a setting opens its panel beside the
 * tray.
 */
export function ControlsTray({
  synced,
  ticks,
  onStep,
  onActivity,
}: Props): React.ReactElement {
  const status = useTVPlayerStore(s => s.status);
  const position = useTVPlayerStore(s => s.positionSeconds);
  const duration = useTVPlayerStore(s => s.durationSeconds);
  const speed = useTVPlayerStore(s => s.speed);
  const sleep = useTVPlayerStore(s => s.sleep);
  const toggle = useTVPlayerStore(s => s.toggle);
  const repeat = useListeningStore(s => s.repeat);
  const sleepChoice = useListeningStore(s => s.sleepChoice);
  const panel = useListeningStore(s => s.panel);
  const setPanel = useListeningStore(s => s.setPanel);
  const mode = useDisplayStore(s => s.mode);
  const edition = useDisplayStore(s => s.edition);

  const isPlaying = status === 'playing';
  const sleepOn = sleep.kind !== 'off';
  const press = (fn: () => void) => () => {
    onActivity();
    fn();
  };
  const open = (key: PanelKey) => press(() => setPanel(key));

  return (
    <View style={styles.tray}>
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
            onPress={press(() => onStep(-1))}
            accessibilityLabel={synced ? 'Previous verse' : 'Back 15 seconds'}
            style={styles.round}>
            <PreviousIcon color={colors.text} size={scale(30)} />
          </FocusableButton>
          <FocusableButton
            onPress={press(toggle)}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            hasTVPreferredFocus
            style={[styles.round, styles.roundBig]}>
            {isPlaying ? (
              <PauseIcon color={colors.accentInk} size={scale(40)} />
            ) : (
              <PlayIcon color={colors.accentInk} size={scale(40)} />
            )}
          </FocusableButton>
          <FocusableButton
            onPress={press(() => onStep(1))}
            accessibilityLabel={synced ? 'Next verse' : 'Forward 15 seconds'}
            style={styles.round}>
            <NextIcon color={colors.text} size={scale(30)} />
          </FocusableButton>
        </View>
        <View style={styles.tools}>
          <Tool
            label="Repeat"
            value={repeatLabel(repeat)}
            on={repeat.kind !== 'off'}
            active={panel === 'repeat'}
            onPress={open('repeat')}
          />
          <Tool
            label="Speed"
            value={formatSpeed(speed)}
            on={speed !== 1}
            active={panel === 'speed'}
            onPress={open('speed')}
          />
          <Tool
            label="On screen"
            value={onScreenLabel(mode, edition)}
            on={false}
            active={panel === 'onScreen'}
            onPress={open('onScreen')}
          />
          <Tool
            label="Sleep"
            value={sleepOn ? sleepLabel(sleepChoice) : 'Off'}
            on={sleepOn}
            active={panel === 'sleep'}
            onPress={open('sleep')}
          />
        </View>
      </TVFocusGuideView>
    </View>
  );
}

function Tool({
  label,
  value,
  on,
  active,
  onPress,
}: {
  label: string;
  value: string;
  on: boolean;
  /** Its panel is open. */
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.tool, (on || active) && styles.toolOn]}>
      <Text style={styles.toolLabel}>{label}</Text>
      <Text style={[styles.toolValue, on && styles.toolValueOn]}>{value}</Text>
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
  transport: {flexDirection: 'row', alignItems: 'center', gap: 18},
  round: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(244,243,236,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBig: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent,
  },
  tools: {flexDirection: 'row', gap: 14},
  tool: {
    minWidth: 170,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(244,243,236,0.08)',
    gap: 2,
  },
  toolOn: {backgroundColor: colors.accentSoft},
  toolLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  toolValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 22,
  },
  toolValueOn: {color: colors.accent},
});
