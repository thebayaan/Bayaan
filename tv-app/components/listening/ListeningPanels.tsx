import React from 'react';
import {SidePanel, type PanelSection} from './SidePanel';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useOverlayStore} from '../../store/overlayStore';
import {
  pauseLabel,
  REPEAT_PAUSES,
  REPEAT_TIMES,
  SLEEP_CYCLE,
  sleepLabel,
  SPEED_CYCLE,
  timesLabel,
  useListeningStore,
  type RepeatChoice,
} from '../../store/listeningStore';
import {
  ON_SCREEN_MODES,
  TEXT_SIZES,
  TRANSLATIONS,
  useDisplayStore,
} from '../../store/displayStore';

type Props = {
  currentAyah: number;
  /** Whether the recitation has verse timings (enables verse repeat). */
  synced: boolean;
  onActivity: () => void;
};

export function formatSpeed(speed: number): string {
  return `${Number.isInteger(speed) ? speed.toFixed(1) : speed}×`;
}

/** The panel for whichever tray setting is open, or nothing. */
export function ListeningPanels({
  currentAyah,
  synced,
  onActivity,
}: Props): React.ReactElement | null {
  const panel = useListeningStore(s => s.panel);
  const repeat = useListeningStore(s => s.repeat);
  const setRepeat = useListeningStore(s => s.setRepeat);
  const setRepeatTimes = useListeningStore(s => s.setRepeatTimes);
  const repeatPauseMs = useListeningStore(s => s.repeatPauseMs);
  const setRepeatPause = useListeningStore(s => s.setRepeatPause);
  const sleepChoice = useListeningStore(s => s.sleepChoice);
  const setSleepChoice = useListeningStore(s => s.setSleepChoice);
  const sleep = useTVPlayerStore(s => s.sleep);
  const speed = useTVPlayerStore(s => s.speed);
  const applySpeed = useOverlayStore(s => s.applySpeed);
  const mode = useDisplayStore(s => s.mode);
  const setMode = useDisplayStore(s => s.setMode);
  const edition = useDisplayStore(s => s.edition);
  const setEdition = useDisplayStore(s => s.setEdition);
  const textSize = useDisplayStore(s => s.textSize);
  const setTextSize = useDisplayStore(s => s.setTextSize);

  if (panel === null) return null;

  let title = '';
  let sections: PanelSection<any>[] = [];

  if (panel === 'repeat') {
    title = 'Repeat';
    const kinds: {
      value: RepeatChoice['kind'];
      label: string;
      detail?: string;
    }[] = [
      {value: 'off', label: 'Off'},
      ...(synced
        ? [
            {
              value: 'verse' as const,
              label: 'This verse',
              detail: currentAyah > 0 ? `Verse ${currentAyah}` : undefined,
            },
          ]
        : []),
      {value: 'surah', label: 'Surah'},
    ];
    const times = repeat.kind === 'verse' ? repeat.times : 3;
    sections = [
      {
        title: 'Repeat',
        options: kinds,
        selected: repeat.kind,
        onSelect: (kind: RepeatChoice['kind']) =>
          setRepeat(
            kind === 'verse'
              ? {kind, times}
              : kind === 'surah'
                ? {kind}
                : {kind: 'off'},
            currentAyah,
          ),
      },
    ];
    if (repeat.kind === 'verse') {
      sections.push(
        {
          title: 'Times',
          options: REPEAT_TIMES.map(t => ({value: t, label: timesLabel(t)})),
          selected: repeat.times,
          onSelect: setRepeatTimes,
        },
        {
          title: 'Pause between',
          options: REPEAT_PAUSES.map(ms => ({
            value: ms,
            label: pauseLabel(ms),
          })),
          selected: repeatPauseMs,
          onSelect: setRepeatPause,
        },
      );
    }
  } else if (panel === 'speed') {
    title = 'Speed';
    sections = [
      {
        title: 'Playback speed',
        options: SPEED_CYCLE.map(s => ({value: s, label: formatSpeed(s)})),
        selected: speed,
        onSelect: applySpeed,
      },
    ];
  } else if (panel === 'sleep') {
    title = 'Sleep';
    sections = [
      {
        title: 'Stop playing after',
        options: SLEEP_CYCLE.map(m => ({value: m, label: sleepLabel(m)})),
        selected: sleep.kind === 'off' ? 0 : sleepChoice,
        onSelect: setSleepChoice,
      },
    ];
  } else {
    title = 'On screen';
    sections = [
      {
        title: 'Show',
        options: ON_SCREEN_MODES,
        selected: mode,
        onSelect: setMode,
      },
    ];
    if (mode === 'both' || mode === 'translation') {
      sections.push({
        title: 'Translation',
        options: TRANSLATIONS.map(t => ({
          value: t.id,
          label: t.name,
          detail: t.language,
        })),
        selected: edition,
        onSelect: setEdition,
      });
    }
    if (mode !== 'calligraphy') {
      sections.push({
        title: 'Text size',
        options: TEXT_SIZES,
        selected: textSize,
        onSelect: setTextSize,
      });
    }
  }

  return (
    <SidePanel title={title} sections={sections} onActivity={onActivity} />
  );
}
