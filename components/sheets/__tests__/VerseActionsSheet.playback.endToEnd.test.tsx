// @ai-generated
/**
 * Play from here and Repeat end to end (decision 3 of Release 1): the real
 * verse actions sheet drives the real mushaf player store (MushafAudioService
 * over a fake expo-audio player, the timing numbering service with its
 * set-level vote) and the real timestamp store, for every verse of the
 * fixture surahs, with reciters whose timings are numbered by the rewayah:
 * real R2 timing files (Warsh 14 for Warsh al-Fatihah, 106, 107 and 112;
 * al-Bazzi 296 for al-Bazzi 112; services/timestamps/__fixtures__/timings)
 * and a synthetic al-Duri set numbered by al-Duri. Verse units are built
 * from the real slots of verseUnitsFixture.json.
 *
 * For each verse, from the sheet as the mushaf and the player open it:
 *  - mushaf Repeat loops exactly that verse's entry, and the follow-along
 *    band and label are that verse;
 *  - mushaf Play from here starts at that verse's own entry (Warsh 1:7, the
 *    second part of Hafs 1:7, starts at Warsh entry 7) and runs on;
 *  - main player Play from here seeks to that verse's own entry and tracks
 *    the Hafs verses it recites;
 *  - main player Repeat opens the mushaf on exactly that verse (its storage
 *    anchor) and makes it the pending start.
 * Hafs (Hafs-numbered reciter): the same flows give the Hafs verse, as
 * before.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {AyahTimestamp} from '@/types/timestamps';

// ── The sheet's screens and native edges ────────────────────────────────────

jest.mock('../verse-actions/HighlightContent', () => ({
  HighlightContent: () => null,
}));
jest.mock('../verse-actions/NoteContent', () => ({NoteContent: () => null}));
jest.mock('../verse-actions/ShareContent', () => ({ShareContent: () => null}));
jest.mock('../verse-actions/SimilarVersesContent', () => ({
  SimilarVersesContent: () => null,
}));
jest.mock('../verse-actions/TranslationContent', () => ({
  TranslationContent: () => null,
}));
jest.mock('../verse-actions/TafseerContent', () => ({
  TafseerContent: () => null,
}));
jest.mock('../verse-actions/ThemeContent', () => ({ThemeContent: () => null}));
jest.mock('../verse-actions/WBWContent', () => ({WBWContent: () => null}));
jest.mock('../verse-actions/CommunityReflectionsContent', () => ({
  CommunityReflectionsContent: () => null,
}));

const mockSheets: {shown: {name: string; payload: unknown}[]} = {shown: []};
jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const Container = (props: {children?: React.ReactNode}) =>
    ReactActual.createElement(View, null, props.children);
  return {
    __esModule: true,
    default: Container,
    ScrollView: Container,
    SheetManager: {
      show: (name: string, options?: {payload?: unknown}) => {
        mockSheets.shown.push({name, payload: options?.payload});
        return Promise.resolve();
      },
      hide: () => Promise.resolve(),
      hideAll: () => undefined,
    },
  };
});
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('@/components/Icons', () => {
  const Icon = () => null;
  return {
    PlayIcon: Icon,
    RepeatIcon: Icon,
    StackedVolumesIcon: Icon,
    PageQuillIcon: Icon,
    MirrorWavesIcon: Icon,
    HighlightIcon: Icon,
    ChainLinksIcon: Icon,
    GroupedLinesIcon: Icon,
    BreakdownIcon: Icon,
    CopyIcon: Icon,
    ShareIcon: Icon,
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#ffffff',
      },
    },
    isDarkMode: false,
  }),
}));
jest.mock('@/utils/haptics', () => ({lightHaptics: () => undefined}));
const mockToasts: string[] = [];
jest.mock('@/utils/toastUtils', () => ({
  showToast: (title: string, message: string) => {
    mockToasts.push(`${title}: ${message}`);
  },
}));
jest.mock('expo-clipboard', () => ({setStringAsync: async () => undefined}));
const mockRoutes: unknown[] = [];
jest.mock('expo-router', () => ({
  router: {push: (route: unknown) => mockRoutes.push(route)},
}));
jest.mock('@/utils/translationLookup', () => ({
  getTranslationTextRaw: (verseKey: string) => `T(${verseKey})`,
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAnnotationsForSurah: async () => ({
      bookmarks: [],
      notes: [],
      highlights: [],
    }),
    addBookmark: async () => undefined,
    removeBookmark: async () => undefined,
    upsertHighlight: async () => undefined,
    removeHighlight: async () => undefined,
    addNote: async () => undefined,
  },
}));
jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {
    hasSimilarVerses: async () => false,
    hasSharedPhrases: async () => false,
  },
}));

// The main player: its current track, and where Play from here seeks.
const mockMainPlayer = {
  track: {rewayatId: 'warsh-14', reciterName: 'Test Reciter'},
  seeks: [] as number[],
};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: [mockMainPlayer.track], currentIndex: 0},
      playback: {state: 'paused'},
      seekTo: (seconds: number) => {
        mockMainPlayer.seeks.push(seconds);
      },
      play: () => undefined,
      pause: () => undefined,
      setSheetMode: () => undefined,
    }),
  },
}));
jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => null},
}));

// The words of every rewayah are in memory; the mushaf shows mockShown.
const mockShown = {rewayah: 'hafs'};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get rewayah() {
      return mockShown.rewayah;
    },
    initialized: true,
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    getVerseText: (key: string) => `HAFS-${key}`,
    getPageForVerse: () => 1,
    getPageLines: () => [],
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: async () => undefined,
    onRewayahChange: () => () => undefined,
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
const mockUnits = new Map<string, unknown>();
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (r: string) => mockUnits.get(r) ?? null,
    getStatus: (r: string) => (mockUnits.has(r) ? 'ready' : 'error'),
  },
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => [],
    getVerseSegmentsForPage: () => [],
  },
}));

// ── Audio: a fake player, real timings ──────────────────────────────────────

interface MockPlayer {
  currentTime: number;
  duration: number;
  listeners: ((status: {didJustFinish: boolean}) => void)[];
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  addListener(
    event: string,
    cb: (status: {didJustFinish: boolean}) => void,
  ): {remove(): void};
  remove(): void;
}
const mockPlayers: MockPlayer[] = [];
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => {
    const player: MockPlayer = {
      currentTime: 0,
      duration: 99999,
      listeners: [],
      play: () => undefined,
      pause: () => undefined,
      seekTo(seconds: number) {
        this.currentTime = seconds;
        return Promise.resolve();
      },
      setPlaybackRate: () => undefined,
      addListener(_event, cb) {
        this.listeners.push(cb);
        return {remove: () => undefined};
      },
      remove: () => undefined,
    };
    mockPlayers.push(player);
    return player;
  },
}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {
    mushafWillPlay: () => undefined,
    sourceDidStop: () => undefined,
  },
}));

// The fixture timing sets, plus 'own-doori': al-Duri numbered by al-Duri.
jest.mock('@/data/reciterData', () => {
  const {fixtureCatalog} = jest.requireActual(
    '@/services/timestamps/__fixtures__/timingFixtures',
  );
  const catalog = fixtureCatalog();
  catalog.push({
    ...catalog[0],
    id: 'reciter-own-doori',
    rewayat: [
      {
        ...catalog[0].rewayat[0],
        id: 'own-doori',
        reciter_id: 'reciter-own-doori',
        name: "Aldori A'n Abi Amr",
      },
    ],
  });
  return {RECITERS: catalog};
});
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: async (set: string, surah: number) => {
      if (set === 'own-doori') {
        const {rewayahVerseMapService} = jest.requireActual(
          '@/services/mushaf/RewayahVerseMapService',
        );
        const count = rewayahVerseMapService.verseCount(
          'al-duri-abi-amr',
          surah,
        );
        return Array.from({length: count}, (_, i) => ({
          surahNumber: surah,
          ayahNumber: i + 1,
          timestampFrom: (i + 1) * 1000,
          timestampTo: (i + 2) * 1000,
          durationMs: 1000,
        }));
      }
      return jest
        .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
        .loadTimings(set, surah);
    },
  },
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

import {VerseActionsSheet} from '../VerseActionsSheet';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTimestampStore} from '@/store/timestampStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {
  registerTimingNumbering,
  type MappedAyahTrackingState,
} from '@/utils/timestampNumbering';
import {verseActionsPayloadForUnits} from '@/store/mushafVerseSelectionStore';
import {
  buildFixtureUnits,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const st = () => useMushafPlayerStore.getState();
const player = () => mockPlayers[mockPlayers.length - 1];

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Move the playhead and let MushafAudioService's 200 ms poll run. */
function at(ms: number) {
  player().currentTime = ms / 1000;
  jest.advanceTimersByTime(200);
}

/** Entries heard while the audio runs forward, as "surah:entry". */
async function listen(maxSteps: number): Promise<string[]> {
  const heard: string[] = [];
  for (let i = 0; i < maxSteps && st().playbackState !== 'idle'; i++) {
    const timings = mushafAudioService.getTimestamps();
    if (timings.length === 0) break;
    const surah = mushafAudioService.getCurrentSurah();
    const pos = player().currentTime * 1000;
    let idx = -1;
    for (let k = 0; k < timings.length; k++) {
      if (timings[k].timestampFrom <= pos) idx = k;
    }
    if (idx >= 0) heard.push(`${surah}:${timings[idx].ayahNumber}`);
    if (idx === timings.length - 1) {
      player().listeners.forEach(l => l({didJustFinish: true}));
      await flush();
      continue;
    }
    at(timings[idx + 1].timestampFrom + 50);
    await flush();
  }
  return heard;
}

// ── The sheet ───────────────────────────────────────────────────────────────

type Payload = React.ComponentProps<typeof VerseActionsSheet>['payload'];
let renderer: TestRenderer.ReactTestRenderer | null = null;

async function openSheet(payload: Payload) {
  if (renderer) {
    const old = renderer;
    act(() => old.unmount());
  }
  const props = {
    sheetId: 'verse-actions',
    payload,
  } as React.ComponentProps<typeof VerseActionsSheet>;
  await act(async () => {
    renderer = TestRenderer.create(<VerseActionsSheet {...props} />);
  });
  await act(async () => {
    await flush();
  });
}

async function press(label: string) {
  const target = renderer!.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  await act(async () => {
    await target.props.onPress();
  });
  // The sheet starts playback without waiting for it.
  await act(async () => {
    await flush();
  });
}

// ── Cases ───────────────────────────────────────────────────────────────────

interface Case {
  db: UnitsFixtureDb;
  rewayah: RewayahId;
  /** A timing set numbered by the rewayah (Hafs: by Hafs). */
  set: string;
  surahs: number[];
}

const CASES: Case[] = [
  {db: 'warsh', rewayah: 'warsh', set: 'warsh-14', surahs: [1, 106, 107, 112]},
  {db: 'bazzi', rewayah: 'al-bazzi', set: 'bazzi-296', surahs: [112]},
  {
    db: 'doori',
    rewayah: 'al-duri-abi-amr',
    set: 'own-doori',
    surahs: [1, 71, 103, 106, 107, 112, 114],
  },
  {db: 'hafs', rewayah: 'hafs', set: 'hafs-clean', surahs: [1, 112]},
];

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(() => {
  if (renderer) {
    const old = renderer;
    act(() => old.unmount());
  }
  jest.useRealTimers();
});

function resetPlayer() {
  st().stop();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  st().clearRange();
  st().setPendingStart(null);
  mockPlayers.length = 0;
}

describe.each(CASES)(
  '$rewayah mushaf, reciter $set',
  ({db, rewayah, set, surahs}) => {
    const isHafs = rewayah === 'hafs';
    let units: RewayahVerseUnits;

    beforeAll(() => {
      units = buildFixtureUnits(db);
      mockUnits.clear();
      if (!isHafs) mockUnits.set(rewayah, units);
      mockShown.rewayah = rewayah;
      (
        useMushafSettingsStore as unknown as {setState: (s: object) => void}
      ).setState({rewayah});
      timingNumberingService.reset();
    });

    const cases = () => surahs.flatMap(surah => [...units.unitsOfSurah(surah)]);

    /** The sheet as a mushaf long-press opens it (contract 4.1). */
    const mushafPayload = (key: string): Payload => {
      const unit = units.unitByKey(key)!;
      return verseActionsPayloadForUnits(rewayah, [
        {
          key: unit.key,
          anchor: units.hafsAnchor(unit).key,
          hafsKeys: [...unit.hafsKeys],
        },
      ])!;
    };

    /** Timings of a surah as the timing set has them. */
    async function timingsOf(surah: number): Promise<AyahTimestamp[]> {
      await useTimestampStore.getState().loadTimestampsForSurah(set, surah);
      return useTimestampStore.getState().currentSurahTimestamps!;
    }

    it('mushaf Repeat loops exactly the verse; Play from here starts at it', async () => {
      const problems: string[] = [];
      for (const unit of cases()) {
        const next = units.next(unit);
        const hasNext = next !== null && next.surah === unit.surah;
        // Repeat
        resetPlayer();
        st().setReciter(set, 'Test Reciter');
        await openSheet(mushafPayload(unit.key));
        await press('Repeat');
        const looped = await listen(3);
        const want = `${unit.surah}:${unit.ayah}`;
        if (looped.join() !== [want, want, want].join()) {
          problems.push(`${unit.key} Repeat heard [${looped}]`);
        }
        if (st().currentUnitKeys.join() !== unit.key) {
          problems.push(`${unit.key} Repeat band [${st().currentUnitKeys}]`);
        }
        if (st().currentVerseLabel !== unit.key) {
          problems.push(`${unit.key} Repeat label ${st().currentVerseLabel}`);
        }
        // Play from here
        resetPlayer();
        st().setReciter(set, 'Test Reciter');
        await openSheet(mushafPayload(unit.key));
        await press('Play from Here');
        if (st().currentUnitKeys.join() !== unit.key) {
          problems.push(`${unit.key} Play band [${st().currentUnitKeys}]`);
        }
        const heard = await listen(2);
        const expected = hasNext
          ? [want, `${next!.surah}:${next!.ayah}`]
          : [want];
        if (heard.slice(0, expected.length).join() !== expected.join()) {
          problems.push(`${unit.key} Play from here heard [${heard}]`);
        }
      }
      resetPlayer();
      expect(problems).toEqual([]);
      expect(mockToasts).toEqual([]);
    });

    it("main player Play from here seeks to the verse's own entry; Repeat opens exactly it", async () => {
      const problems: string[] = [];
      mockMainPlayer.track = {rewayatId: set, reciterName: 'Test Reciter'};
      useTimestampStore.setState({
        supportedRewayatIds: new Set([set]),
      } as never);
      for (const surah of surahs) {
        const timings = await timingsOf(surah);
        registerTimingNumbering(
          timings,
          await timingNumberingService.resolve(set, surah, timings),
        );
        for (const unit of units.unitsOfSurah(surah)) {
          const anchor = units.hafsAnchor(unit);
          // The payload a player verse row sends (contract 4.1).
          const playerPayload = {
            ...mushafPayload(unit.key),
            source: 'player' as const,
          } as Payload;
          mockMainPlayer.seeks.length = 0;
          await openSheet(playerPayload);
          await press('Play from Here');
          const entry = timings.find(e => e.ayahNumber === unit.ayah)!;
          if (
            mockMainPlayer.seeks.join() !== String(entry.timestampFrom / 1000)
          ) {
            problems.push(`${unit.key} seeks [${mockMainPlayer.seeks}]`);
          }
          const tracking = useTimestampStore.getState()
            .currentAyah as Partial<MappedAyahTrackingState> | null;
          if (
            tracking?.verseKeys?.join() !== unit.hafsKeys.join() ||
            tracking?.reciterVerseKey !== `${unit.surah}:${unit.ayah}`
          ) {
            problems.push(`${unit.key} tracks ${JSON.stringify(tracking)}`);
          }
          // Repeat from the player: the mushaf opens on exactly this verse.
          mockRoutes.length = 0;
          resetPlayer();
          await openSheet(playerPayload);
          await press('Repeat');
          const route = mockRoutes[0] as {params?: Record<string, string>};
          const params = route?.params ?? {};
          if (
            params.surah !== String(anchor.surah) ||
            params.ayah !== String(anchor.ayah) ||
            params.anchor !== (isHafs ? undefined : anchor.key)
          ) {
            problems.push(`${unit.key} Repeat opens ${JSON.stringify(params)}`);
          }
          const pending = st().pendingStartUnit;
          if (
            isHafs
              ? pending !== null || st().pendingStartVerseKey !== unit.key
              : pending?.key !== unit.key || pending?.rewayah !== rewayah
          ) {
            problems.push(
              `${unit.key} pending start ${JSON.stringify(pending)} / ${st().pendingStartVerseKey}`,
            );
          }
        }
      }
      resetPlayer();
      expect(problems).toEqual([]);
    });
  },
);
