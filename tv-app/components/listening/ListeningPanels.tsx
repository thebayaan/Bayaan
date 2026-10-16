import React from 'react';
import {SidePanel, type PanelSection} from './SidePanel';
import SURAHS from '../../../data/surahData.json';
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
import {
  AMBIENT_SOUND_OPTIONS,
  AMBIENT_VOLUMES,
  useAmbientStore,
  type AmbientChoice,
} from '../../store/ambientStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useFavorites} from '../../hooks/useFavorites';
import {useRecentlyPlayed} from '../../hooks/useRecentlyPlayed';
import {
  reciterChoicesForSurah,
  rewayahLabel,
  upcoming,
  type ReciterChoice,
} from '../../services/listeningChoices';
import {getReciterArtwork} from '../../services/reciterArtwork';
import type {Reciter} from '../../types/reciter';

type SurahMeta = {
  id: number;
  name: string;
  translated_name_english: string;
  verses_count: number;
};

const surahMeta = new Map<number, SurahMeta>(
  (SURAHS as SurahMeta[]).map(s => [s.id, s]),
);

/** Reciters offered in the Reciter panel. */
const RECITER_CHOICES = 40;
/** Surahs listed in the Queue panel. */
const QUEUE_SHOWN = 40;

type Props = {
  currentAyah: number;
  /** Whether the recitation has verse timings (enables verse repeat). */
  synced: boolean;
  onActivity: () => void;
  reciters: Reciter[];
  /** The rewayah playing now, so a new reciter keeps it when they have it. */
  rewayahName: string;
  /** Switch the current surah to another reciter. */
  onSwitchReciter: (choice: ReciterChoice) => void;
};

export function formatSpeed(speed: number): string {
  return `${Number.isInteger(speed) ? speed.toFixed(1) : speed}×`;
}

/** The panel for whichever tray setting is open, or nothing. */
export function ListeningPanels({
  currentAyah,
  synced,
  onActivity,
  reciters,
  rewayahName,
  onSwitchReciter,
}: Props): React.ReactElement | null {
  const panel = useListeningStore(s => s.panel);
  const setPanel = useListeningStore(s => s.setPanel);
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const jumpToIndex = useTVPlayerStore(s => s.jumpToIndex);
  const ambientOn = useAmbientStore(s => s.enabled);
  const ambientSound = useAmbientStore(s => s.currentSound);
  const ambientVolume = useAmbientStore(s => s.volume);
  const chooseAmbient = useAmbientStore(s => s.choose);
  const setAmbientVolume = useAmbientStore(s => s.setVolume);
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const favorites = useFavorites();
  const recent = useRecentlyPlayed();
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
  } else if (panel === 'reciter') {
    title = 'Reciter';
    const item = queue[currentIndex];
    const surahNumber = item?.surahNumber ?? 1;
    const preferredIds = [
      ...favorites.map(f => f.reciterId),
      ...(defaultReciterId ? [defaultReciterId] : []),
      ...recent.map(r => r.reciterId),
    ];
    const choices = reciterChoicesForSurah(reciters, surahNumber, {
      currentId: item?.reciterId ?? null,
      preferredIds,
      preferRewayahName: rewayahName,
      limit: RECITER_CHOICES,
    });
    sections = [
      {
        title: `Recite ${surahMeta.get(surahNumber)?.name ?? 'this surah'} with`,
        options: choices.map(c => ({
          value: c.reciter.id,
          label: c.reciter.name,
          detail: rewayahLabel(c.rewayah),
          face: {source: getReciterArtwork(c.reciter), name: c.reciter.name},
        })),
        selected: item?.reciterId ?? null,
        onSelect: (id: string) => {
          const choice = choices.find(c => c.reciter.id === id);
          setPanel(null);
          if (choice && id !== item?.reciterId) onSwitchReciter(choice);
        },
      },
    ];
  } else if (panel === 'sound') {
    title = 'Sound';
    const choice: AmbientChoice = ambientOn ? ambientSound : 'off';
    sections = [
      {
        title: 'Background sound',
        options: [{value: 'off', label: 'Off'}, ...AMBIENT_SOUND_OPTIONS],
        selected: choice,
        onSelect: chooseAmbient,
      },
    ];
    if (ambientOn) {
      sections.push({
        title: 'Volume',
        options: AMBIENT_VOLUMES,
        selected:
          AMBIENT_VOLUMES.find(v => Math.abs(v.value - ambientVolume) < 0.01)
            ?.value ?? ambientVolume,
        onSelect: setAmbientVolume,
      });
    }
  } else if (panel === 'queue') {
    title = 'Queue';
    const next = upcoming(queue, currentIndex, QUEUE_SHOWN);
    const options = next.map(({item, index}) => {
      const meta = surahMeta.get(item.surahNumber);
      return {
        value: index,
        label: `${item.surahNumber}. ${item.title}`,
        detail: meta
          ? `${meta.translated_name_english} · ${meta.verses_count} verses`
          : undefined,
      };
    });
    const playing = queue[currentIndex];
    sections = [
      {
        title: playing ? `Up next with ${playing.subtitle}` : 'Up next',
        options:
          options.length > 0
            ? options
            : queue.length > 1
              ? [{value: 0, label: 'Start again from the first surah'}]
              : [{value: -1, label: 'Nothing else is queued'}],
        selected: null,
        onSelect: (index: number) => {
          setPanel(null);
          if (index >= 0) void jumpToIndex(index);
        },
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
