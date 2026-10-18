import React, {useEffect, useRef, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusIcon, FocusText} from '../primitives/focusContext';
import {ProgressLine} from './ProgressLine';
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
import {useMenuReturn} from '../../hooks/useMenuReturn';
import {usePlaylists} from '../../hooks/usePlaylists';
import {playlistHas} from '../../services/playlistsStore';
import {useContextMenuStore} from '../../store/contextMenuStore';
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
 * ticks, verse-by-verse transport with a heart for favorite surahs, and one
 * row of labeled tools (Repeat, Speed, On screen, Reciter, Sleep, Sound,
 * Queue) that each show their current value. Pressing a tool opens its panel
 * beside the tray.
 */
export function ControlsTray({
  synced,
  ticks,
  onStep,
  reciterName,
  onActivity,
}: Props): React.ReactElement {
  const status = useTVPlayerStore(s => s.status);
  const position = useTVPlayerStore(s => s.positionSeconds);
  const duration = useTVPlayerStore(s => s.durationSeconds);
  const speed = useTVPlayerStore(s => s.speed);
  const sleep = useTVPlayerStore(s => s.sleep);
  const toggle = useTVPlayerStore(s => s.toggle);
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const ambientOn = useAmbientStore(s => s.enabled);
  const ambientSound = useAmbientStore(s => s.currentSound);
  const loved = useLovedSurahs();
  const repeat = useListeningStore(s => s.repeat);
  const sleepChoice = useListeningStore(s => s.sleepChoice);
  const panel = useListeningStore(s => s.panel);
  const setPanel = useListeningStore(s => s.setPanel);
  const mode = useDisplayStore(s => s.mode);
  const edition = useDisplayStore(s => s.edition);

  // When a panel closes, focus goes back to the setting that opened it
  // (otherwise the panel unmounting drops focus on the nearest transport
  // button).
  const [returnTo, setReturnTo] = useState<PanelKey | null>(null);
  const lastPanel = useRef<PanelKey | null>(null);
  useEffect(() => {
    if (panel === null && lastPanel.current !== null) {
      setReturnTo(lastPanel.current);
    }
    lastPanel.current = panel;
  }, [panel]);

  const isPlaying = status === 'playing';
  const sleepOn = sleep.kind !== 'off';
  const press = (fn: () => void) => () => {
    onActivity();
    fn();
  };
  const open = (key: PanelKey) => press(() => setPanel(key));
  const tool = (key: PanelKey) => ({
    active: panel === key,
    focusOnReturn: returnTo === key && panel === null,
    onPress: open(key),
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
  const nextCount = Math.max(0, queue.length - currentIndex - 1);

  // Save: the playlists this surah (in this voice) is in; OK opens the
  // playlist picker over the player, and focus comes back here after.
  const playlists = usePlaylists();
  const savedIn = item
    ? playlists.filter(p =>
        playlistHas(p, {
          surahNumber: item.surahNumber,
          reciterId: item.reciterId,
          ...(item.rewayahId ? {rewayahId: item.rewayahId} : {}),
        }),
      ).length
    : 0;
  const saveReturn = useMenuReturn('player');
  const openSave = press(() => {
    if (!item) return;
    useContextMenuStore.getState().openSurah({
      surahNumber: item.surahNumber,
      reciterId: item.reciterId,
      ...(item.rewayahId ? {rewayahId: item.rewayahId} : {}),
      origin: 'player',
      page: 'playlists',
    });
  });

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
            <FocusIcon icon={PreviousIcon} size={30} />
          </FocusableButton>
          <FocusableButton
            onPress={press(toggle)}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            hasTVPreferredFocus={returnTo === null}
            outlined
            style={[styles.round, styles.roundBig]}>
            <FocusIcon icon={isPlaying ? PauseIcon : PlayIcon} size={40} />
          </FocusableButton>
          <FocusableButton
            onPress={press(() => onStep(1))}
            accessibilityLabel={synced ? 'Next verse' : 'Forward 15 seconds'}
            style={styles.round}>
            <FocusIcon icon={NextIcon} size={30} />
          </FocusableButton>
        </View>
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
            value={savedIn > 0 ? `In ${savedIn}` : 'Not saved'}
            on={savedIn > 0}
            active={false}
            focusOnReturn={saveReturn}
            onPress={openSave}
          />
          <FocusableButton
            onPress={toggleLoved}
            accessibilityLabel={
              isLoved ? 'Remove from favorite surahs' : 'Add to favorite surahs'
            }
            style={styles.round}>
            <FocusIcon
              icon={HeartIcon}
              size={30}
              filled={isLoved}
              color={isLoved ? colors.accent : colors.text}
            />
          </FocusableButton>
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
  focusOnReturn,
  onPress,
}: {
  label: string;
  value: string;
  on: boolean;
  /** Its panel is open. */
  active: boolean;
  /** Take focus back when its panel closes. */
  focusOnReturn: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      hasTVPreferredFocus={focusOnReturn}
      style={[styles.tool, active && styles.toolActive]}>
      <FocusText
        style={styles.toolLabel}
        color={colors.textSecondary}
        focusedColor={colors.onFocusSecondary}>
        {label}
      </FocusText>
      <FocusText
        style={styles.toolValue}
        color={on ? colors.accent : colors.text}
        numberOfLines={1}>
        {value}
      </FocusText>
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
  transport: {flexDirection: 'row', alignItems: 'center', gap: 16},
  round: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBig: {
    width: 96,
    height: 96,
    borderRadius: 30,
  },
  tools: {flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1},
  tool: {
    maxWidth: 280,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 2,
  },
  // Its panel is open beside the tray.
  toolActive: {backgroundColor: 'rgba(244,243,236,0.1)'},
  toolLabel: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  toolValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 21,
  },
});
