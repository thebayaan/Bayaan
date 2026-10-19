import React, {useEffect, useState} from 'react';
import {Platform} from 'react-native';
import {SidePanel, type PanelOption, type PanelSection} from './SidePanel';
import {useSleepLeftMs} from './useSleepLeft';
import SURAHS from '../../../data/surahData.json';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useOverlayStore} from '../../store/overlayStore';
import {
  DEFAULT_VERSE_TIMES,
  formatSpeed,
  pauseLabel,
  REPEAT_PAUSES,
  REPEAT_TIMES,
  SLEEP_CYCLE,
  sleepLabel,
  sleepLeftLabel,
  SPEED_CYCLE,
  timesLabel,
  useListeningStore,
  type PanelKey,
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
  choiceKey,
  queueWindow,
  reciterChoicesForSurah,
  rewayahLabel,
  shortReciterName,
  type ReciterChoice,
} from '../../services/listeningChoices';
import {
  hasPlaylistItem,
  type PlaylistItem,
} from '../../services/playlistsStore';
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

/**
 * Reciters the Reciter panel lists at first; an "All reciters" row reveals
 * the rest in place (each row has a portrait, so not all at once).
 */
const RECITER_CHOICES = 40;
/** The Reciter panel's "All reciters" row, among the choice keys. */
const ALL_RECITERS = '__all__';
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
/** The Queue panel's note that more surahs follow than it lists. */
const MORE_QUEUED = -3;

// Kept here too for the screens that import it from the panels.
export {formatSpeed};

type Props = {
  currentAyah: number;
  /** Whether the recitation has verse timings (enables verse repeat). */
  synced: boolean;
  onActivity: () => void;
  reciters: Reciter[];
  /** The rewayah playing now, so a new reciter keeps it when they have it. */
  rewayahName: string;
  /** Its style (Murattal, Mujawwad...), kept the same way. */
  rewayahStyle: string;
  /** Switch the current surah to another reciter. */
  onSwitchReciter: (choice: ReciterChoice) => void;
};

/**
 * How long a closed panel stays drawn on Android. Removing the focused row
 * makes Android park focus on the screen's focus guide and choose a new
 * focus a frame later (ReactViewGroup recoverFocus), which landed on the
 * first transport button or lost the next press. Kept a moment, the row is
 * still there while the tray's tool takes focus back, so nothing focused is
 * removed. tvOS moves focus itself when the row goes.
 */
const LINGER_MS = Platform.OS === 'ios' ? 0 : 200;

/** The open panel, or on Android the one just closed, for LINGER_MS. */
function useShownPanel(): PanelKey | null {
  const panel = useListeningStore(s => s.panel);
  const [lingering, setLingering] = useState<PanelKey | null>(null);
  const [last, setLast] = useState<PanelKey | null>(panel);
  if (panel !== last) {
    // Set while drawing, so the closing draw already keeps the panel.
    setLast(panel);
    setLingering(panel === null && LINGER_MS > 0 ? last : null);
  }
  useEffect(() => {
    if (lingering === null) return;
    // TEMP focusdbg
    console.log(`[focusdbg] linger ${lingering}`);
    const id = setTimeout(() => {
      console.log(`[focusdbg] linger end ${lingering}`);
      setLingering(null);
    }, LINGER_MS);
    return () => clearTimeout(id);
  }, [lingering]);
  return panel ?? lingering;
}

/** The panel for whichever tray setting is open, or nothing. */
export function ListeningPanels({
  currentAyah,
  synced,
  onActivity,
  reciters,
  rewayahName,
  rewayahStyle,
  onSwitchReciter,
}: Props): React.ReactElement | null {
  const panel = useShownPanel();
  const setPanel = useListeningStore(s => s.setPanel);
  const setResumePanel = useListeningStore(s => s.setResumePanel);
  const sleepLeftMs = useSleepLeftMs();
  // The Reciter panel's full list, once asked for; it starts short again
  // each time the panel opens.
  const [allReciters, setAllReciters] = useState(false);
  useEffect(() => {
    if (panel !== 'reciter') setAllReciters(false);
  }, [panel]);
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
      ...(queue.length > 1
        ? [
            {
              value: 'queue' as const,
              label: 'Whole queue',
              detail: `All ${queue.length} surahs, then from the first again`,
            },
          ]
        : []),
    ];
    const times = repeat.kind === 'verse' ? repeat.times : DEFAULT_VERSE_TIMES;
    sections = [
      {
        title: 'Repeat',
        options: kinds,
        selected: repeat.kind,
        onSelect: (kind: RepeatChoice['kind']) =>
          setRepeat(
            kind === 'verse'
              ? {kind, times}
              : kind === 'surah' || kind === 'queue'
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
        // The running timer's row says how long is left.
        options: SLEEP_CYCLE.map(m => ({
          value: m,
          label: sleepLabel(m),
          detail:
            sleepLeftMs !== undefined && m === sleepChoice
              ? sleepLeftLabel(sleepLeftMs)
              : undefined,
        })),
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
      currentRewayahId: item?.rewayahId,
      preferredIds,
      preferRewayahName: rewayahName,
      preferStyle: rewayahStyle,
      limit: Infinity,
    });
    const listed = choices.filter(
      (c, i) =>
        allReciters || i < RECITER_CHOICES || c.reciter.id === item?.reciterId,
    );
    const hidden = choices.length - listed.length;
    const keyOf = (c: ReciterChoice): string =>
      choiceKey(c.reciter.id, c.rewayah.id);
    const options: PanelOption<string>[] = listed.map(c => ({
      value: keyOf(c),
      label: c.reciter.name,
      detail: rewayahLabel(c.rewayah),
      face: {source: getReciterArtwork(c.reciter), name: c.reciter.name},
    }));
    if (hidden > 0) {
      options.push({
        value: ALL_RECITERS,
        // The current reciter's extra styles are rows, not more reciters.
        label: `All ${new Set(choices.map(c => c.reciter.id)).size} reciters`,
        detail: `${hidden} more who recite this surah`,
      });
    }
    const current = item ? choiceKey(item.reciterId, item.rewayahId) : null;
    sections = [
      {
        title: `Recite ${surahMeta.get(surahNumber)?.name ?? 'this surah'} with`,
        options,
        selected: current,
        // Once the full list shows, focus goes to the first reciter it
        // added, where the "All reciters" row was.
        focusOn:
          allReciters && listed.length > RECITER_CHOICES
            ? keyOf(listed[RECITER_CHOICES])
            : undefined,
        onSelect: (key: string) => {
          if (key === ALL_RECITERS) {
            setAllReciters(true);
            return;
          }
          const choice = choices.find(c => keyOf(c) === key);
          setPanel(null);
          if (choice && key !== current) onSwitchReciter(choice);
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
    // A queue of several voices (a playlist) says who recites each surah.
    const mixed = queue.some(q => q.reciterId !== queue[0]?.reciterId);
    const options: PanelOption<number>[] = shown.map(({item, index}) => {
      const meta = surahMeta.get(item.surahNumber);
      const about = meta
        ? `${meta.translated_name_english} · ${meta.verses_count} verses`
        : undefined;
      const voice = mixed ? shortReciterName(item.subtitle) : null;
      return {
        value: index,
        label: `${item.surahNumber}. ${item.title}`,
        detail:
          index === currentIndex
            ? voice
              ? `Playing now · ${voice}`
              : 'Playing now'
            : voice
              ? `${voice} · ${meta?.translated_name_english ?? ''}`
              : about,
      };
    });
    const last = currentIndex >= queue.length - 1;
    const beyond = queue.length - 1 - (shown[shown.length - 1]?.index ?? 0);
    if (beyond > 0) {
      options.push({
        value: MORE_QUEUED,
        label: `${beyond} more ${beyond === 1 ? 'surah follows' : 'surahs follow'}`,
      });
    }
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
        // One voice is named once; several are named on each row.
        title: playing && !mixed ? `Queue with ${playing.subtitle}` : 'Queue',
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
            // The player unmounts under the editor; it comes back to this
            // panel, showing the new playlist checked.
            setResumePanel('save');
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
