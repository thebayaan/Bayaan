import React from 'react';
import {SidePanel, type PanelOption, type PanelSection} from './SidePanel';
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
import {useNavStore} from '../../store/navStore';
import {useFavorites} from '../../hooks/useFavorites';
import {useRecentlyPlayed} from '../../hooks/useRecentlyPlayed';
import {usePlaylists} from '../../hooks/usePlaylists';
import {
  queueWindow,
  reciterChoicesForSurah,
  rewayahLabel,
  type ReciterChoice,
} from '../../services/listeningChoices';
import {hasPlaylistItem, type PlaylistItem} from '../../services/playlistsStore';
import {
  NEW_PLAYLIST_DETAIL,
  NEW_PLAYLIST_LABEL,
  pickerDetail,
  roomForPlaylist,
  togglePlaylistItem,
} from '../../services/playlistsPicker';
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
/** Surahs listed in the Queue panel after the one playing. */
const QUEUE_SHOWN = 40;
/** Surahs already played that the Queue panel lists before it. */
const QUEUE_PLAYED_SHOWN = 10;
/** The Save panel's "New playlist" row, among the playlist ids. */
const NEW_PLAYLIST = '__new__';
/**
 * The Queue panel's "Start again" row. Not index 0 itself: the first surah
 * can be listed already among the played ones, and rows are keyed by value.
 */
const START_AGAIN = -2;

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
  const playlists = usePlaylists();
  const push = useNavStore(s => s.push);
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
              // During the opening, "this verse" is the first one.
              detail: `Verse ${Math.max(1, currentAyah)}`,
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
    // Already played surahs sit above the one playing (checked, and where
    // focus starts), so the previous surah is a press away too.
    const shown = queueWindow(
      queue,
      currentIndex,
      QUEUE_PLAYED_SHOWN,
      QUEUE_SHOWN,
    );
    const options: PanelOption<number>[] = shown.map(({item, index}) => {
      const meta = surahMeta.get(item.surahNumber);
      const about = meta
        ? `${meta.translated_name_english} · ${meta.verses_count} verses`
        : undefined;
      return {
        value: index,
        label: `${item.surahNumber}. ${item.title}`,
        detail: index === currentIndex ? 'Playing now' : about,
      };
    });
    const last = currentIndex >= queue.length - 1;
    if (last && queue.length > 1) {
      options.push({
        value: START_AGAIN,
        label: 'Start again from the first surah',
      });
    } else if (queue.length <= 1) {
      options.push({value: -1, label: 'Nothing else is queued'});
    }
    const playing = queue[currentIndex];
    sections = [
      {
        title: playing ? `Queue with ${playing.subtitle}` : 'Queue',
        options,
        selected: currentIndex,
        onSelect: (index: number) => {
          setPanel(null);
          // The surah playing is already where the listener wants to be.
          if (index === START_AGAIN) void jumpToIndex(0);
          else if (index >= 0 && index !== currentIndex) {
            void jumpToIndex(index);
          }
        },
      },
    ];
  } else if (panel === 'save') {
    title = 'Add to playlist';
    const item = queue[currentIndex];
    const entry: PlaylistItem | null = item
      ? {
          surahNumber: item.surahNumber,
          reciterId: item.reciterId,
          ...(item.rewayahId ? {rewayahId: item.rewayahId} : {}),
        }
      : null;
    // Read through `playlists` above, so the checks follow every change.
    const holds = (id: string): boolean =>
      entry !== null && hasPlaylistItem(id, entry);
    sections = [
      {
        title: item ? `${item.title} · ${item.subtitle}` : 'This surah',
        options: [
          {
            value: NEW_PLAYLIST,
            label: NEW_PLAYLIST_LABEL,
            detail: NEW_PLAYLIST_DETAIL,
          },
          ...playlists.map(p => ({
            value: p.id,
            label: p.name,
            detail: pickerDetail(p),
          })),
        ],
        selected: null,
        isSelected: (id: string) => holds(id),
        onSelect: (id: string) => {
          if (!entry) return;
          if (id === NEW_PLAYLIST) {
            if (!roomForPlaylist(playlists.length)) return;
            setPanel(null);
            push({screen: 'playlistEdit', seed: entry});
            return;
          }
          const playlist = playlists.find(p => p.id === id);
          if (playlist) togglePlaylistItem(playlist, entry, holds(id));
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
