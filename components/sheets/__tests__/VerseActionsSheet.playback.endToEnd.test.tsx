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

import type React from 'react';

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

import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {
  buildFixtureUnits,
  type UnitsFixtureDb,
} from '@/services/mushaf/__fixtures__/verseUnitPages';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  checkMainPlayerPlayback,
  checkMushafPlayback,
  closeSheet,
  type SheetPlaybackCase,
  type SheetPlaybackEnv,
} from '../__fixtures__/sheetPlaybackEndToEnd';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const env: SheetPlaybackEnv = {
  player: () => mockPlayers[mockPlayers.length - 1],
  resetPlayers: () => {
    mockPlayers.length = 0;
  },
  mainPlayer: mockMainPlayer,
  routes: mockRoutes,
};

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
  closeSheet();
  jest.useRealTimers();
});

describe.each(CASES)(
  '$rewayah mushaf, reciter $set',
  ({db, rewayah, set, surahs}) => {
    let c: SheetPlaybackCase;

    beforeAll(() => {
      const units = buildFixtureUnits(db);
      mockUnits.clear();
      // Hafs on screen never builds verse units (identity).
      if (rewayah !== 'hafs') mockUnits.set(rewayah, units);
      mockShown.rewayah = rewayah;
      (
        useMushafSettingsStore as unknown as {setState: (s: object) => void}
      ).setState({rewayah});
      timingNumberingService.reset();
      c = {
        rewayah,
        units,
        set,
        verses: surahs.flatMap(surah => [...units.unitsOfSurah(surah)]),
      };
    });

    it('mushaf Repeat loops exactly the verse; Play from here starts at it', async () => {
      expect(await checkMushafPlayback(c, env)).toEqual([]);
      expect(mockToasts).toEqual([]);
    });

    it("main player Play from here seeks to the verse's own entry; Repeat opens exactly it", async () => {
      expect(await checkMainPlayerPlayback(c, env)).toEqual([]);
      expect(mockToasts).toEqual([]);
    });
  },
);
