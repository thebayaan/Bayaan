// @ai-generated
/**
 * LOCAL-ONLY Play from here and Repeat end to end on every words DB
 * (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.5):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest VerseActionsSheet.playback.endToEnd.alldbs --watchAll=false
 *
 * The real verse actions sheet drives the real mushaf player store (over a
 * fake expo-audio player) and the real timestamp store
 * (__fixtures__/sheetPlaybackEndToEnd.tsx), with verse units built from each
 * Release 1 words DB and a synthetic timing set numbered by each rewayah
 * (Hafs: by Hafs; one entry per verse). Checked for every verse that starts
 * or ends inside a Hafs verse, every verse holding several Hafs verses, and
 * the first and last verse of every surah: mushaf Repeat loops exactly that
 * verse, mushaf Play from here starts at its own entry, the main player's
 * Play from here seeks to its own entry, and the main player's Repeat opens
 * the mushaf on exactly that verse. Hafs gives the Hafs verse, as before.
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
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: (r: string) => mockUnits.get(r) ?? null}),
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

// One timing set per rewayah, numbered by it: 'own-<rewayah id>'.
// (The factory runs before this module's constants exist: names inline.)
jest.mock('@/data/reciterData', () => ({
  RECITERS: Object.entries({
    hafs: "Hafs A'n Assem",
    shubah: "Shu'bah A'n Assem",
    warsh: "Warsh A'n Nafi'",
    qalun: "Qalon A'n Nafi'",
    'al-bazzi': "Albizi A'n Ibn Katheer",
    qunbul: "Qunbol A'n Ibn Katheer",
    'al-duri-abi-amr': "Aldori A'n Abi Amr",
    'al-susi': "Assosi A'n Abi Amr",
  }).map(([rewayah, name]) => ({
    id: `reciter-own-${rewayah}`,
    name: 'Test Reciter',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: `own-${rewayah}`,
        reciter_id: `reciter-own-${rewayah}`,
        name,
        style: 'murattal',
        server: 'https://audio.example.com/test',
        surah_total: 114,
        surah_list: [],
        source_type: 'test',
        created_at: '2026-01-01',
        has_timestamps: true,
      },
    ],
  })),
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: async (set: string, surah: number) => {
      const {rewayahVerseMapService, hafsVerseCount} = jest.requireActual(
        '@/services/mushaf/RewayahVerseMapService',
      );
      const rewayah = set.slice('own-'.length);
      const count =
        rewayah === 'hafs'
          ? hafsVerseCount(surah)
          : rewayahVerseMapService.verseCount(rewayah, surah);
      return Array.from({length: count}, (_, i) => ({
        surahNumber: surah,
        ayahNumber: i + 1,
        timestampFrom: (i + 1) * 1000,
        timestampTo: (i + 2) * 1000,
        durationMs: 1000,
      }));
    },
  },
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  allDbDir,
  loadAllDbUnits,
} from '@/services/timestamps/__fixtures__/allDbVerseUnits';
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

const REWAYAT: RewayahId[] = [
  'hafs',
  'shubah',
  'warsh',
  'qalun',
  'al-bazzi',
  'qunbul',
  'al-duri-abi-amr',
  'al-susi',
];

/**
 * The verses whose playback differs from the Hafs verses holding them: every
 * verse that starts or ends inside a Hafs verse (a split Hafs verse's parts)
 * and every verse holding several Hafs verses; plus the first and last verse
 * of every surah. Reading order.
 */
function versesToCheck(units: RewayahVerseUnits): VerseUnit[] {
  const picked = new Map<number, VerseUnit>();
  for (const unit of units.units) {
    const anchor = units.hafsAnchor(unit);
    const next = units.next(unit);
    const startsInside = anchor.wordPosition > 1;
    const endsInside =
      next !== null &&
      next.surah === unit.surah &&
      units.hafsAnchor(next).wordPosition > 1;
    if (startsInside || endsInside || unit.hafsKeys.length > 1) {
      picked.set(unit.index, unit);
    }
  }
  for (const surah of units.surahs()) {
    const list = units.unitsOfSurah(surah);
    picked.set(list[0].index, list[0]);
    picked.set(list[list.length - 1].index, list[list.length - 1]);
  }
  return [...picked.values()].sort((a, b) => a.index - b.index);
}

const DB_DIR = allDbDir();
const run = DB_DIR ? describe : describe.skip;

run(
  'Play from here and Repeat from the sheet on every words DB (local only)',
  () => {
    let all: Map<RewayahId, RewayahVerseUnits>;

    beforeAll(() => {
      jest.useFakeTimers();
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      all = loadAllDbUnits(DB_DIR!);
    });

    afterAll(() => {
      closeSheet();
      jest.useRealTimers();
    });

    it('finds every words DB', () => {
      expect([...all.keys()].sort()).toEqual([...REWAYAT].sort());
    });

    describe.each(REWAYAT)('%s', rewayah => {
      let c: SheetPlaybackCase;

      beforeAll(() => {
        const units = all.get(rewayah)!;
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
          set: `own-${rewayah}`,
          verses: versesToCheck(units),
        };
      });

      it('mushaf Repeat loops exactly the verse; Play from here starts at it', async () => {
        // First and last of every surah, and (not for Hafs and Shu'bah,
        // whose verses are the Hafs verses) the split and merged verses.
        expect(c.verses.length).toBeGreaterThanOrEqual(
          rewayah === 'hafs' || rewayah === 'shubah' ? 228 : 229,
        );
        expect(await checkMushafPlayback(c, env)).toEqual([]);
        expect(mockToasts).toEqual([]);
      }, 600_000);

      it("main player Play from here seeks to the verse's own entry; Repeat opens exactly it", async () => {
        expect(await checkMainPlayerPlayback(c, env)).toEqual([]);
        expect(mockToasts).toEqual([]);
      }, 600_000);
    });
  },
);
