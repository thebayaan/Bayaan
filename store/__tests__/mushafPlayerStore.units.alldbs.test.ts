// @ai-generated
/**
 * LOCAL-ONLY full-data run of the mushaf player in the rewayah's own verses
 * (skipped unless BAYAAN_OVERLAY_DB_DIR is set; needs Node >= 22.13):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest mushafPlayerStore.units.alldbs --watchAll=false
 *
 * The real store, MushafAudioService (fake expo-audio player) and timing
 * numbering service (with its set-level vote) play synthetic timing sets of
 * each non-Hafs rewayah: one numbered by the rewayah itself (entries 1..N of
 * its count) and one Hafs-numbered (entries 1..Hafs count), in a mushaf of
 * that rewayah whose verse units come from its Release 1 words DB:
 *  - every surah the rewayah numbers differently from Hafs, entry by entry:
 *    own set -> the band is exactly the entry's verse, labelled with its own
 *    number, the Hafs keys are its Hafs verses; Hafs-numbered set -> every
 *    verse holding a word of the recited Hafs verse (none for the Fatiha
 *    basmala of the Madani / Basri counts);
 *  - every verse that starts or ends inside a Hafs verse and every verse that
 *    holds several Hafs verses: with the own set, Repeat loops exactly that
 *    verse and a one-verse range plays exactly it; with the Hafs-numbered
 *    set, Repeat loops every Hafs entry holding its words, never half of one.
 */

import type {AyahTimestamp} from '@/types/timestamps';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';

interface MockPlayer {
  currentTime: number;
  seeks: number[];
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
const mockUnits = new Map<string, RewayahVerseUnits>();

/** Entries 1..count, one second each, from 1 s. */
function mockSynthetic(surah: number, count: number): AyahTimestamp[] {
  return Array.from({length: count}, (_, i) => ({
    surahNumber: surah,
    ayahNumber: i + 1,
    timestampFrom: (i + 1) * 1000,
    timestampTo: (i + 2) * 1000,
    durationMs: 1000,
  }));
}

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player: MockPlayer = {
      currentTime: 0,
      seeks: [],
      listeners: [],
      play: jest.fn(),
      pause: jest.fn(),
      seekTo(seconds: number) {
        this.currentTime = seconds;
        this.seeks.push(seconds);
        return Promise.resolve();
      },
      setPlaybackRate: jest.fn(),
      addListener(_event, cb) {
        this.listeners.push(cb);
        return {remove: jest.fn()};
      },
      remove: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));

// One set per (kind, rewayah): 'own-warsh' is numbered by Warsh,
// 'hafs-warsh' is a Hafs-numbered Warsh recitation.
// (The factory runs before this module's constants exist: names inline.)
jest.mock('@/data/reciterData', () => ({
  RECITERS: Object.entries({
    warsh: "Warsh A'n Nafi'",
    qalun: "Qalon A'n Nafi'",
    'al-bazzi': "Albizi A'n Ibn Katheer",
    qunbul: "Qunbol A'n Ibn Katheer",
    'al-duri-abi-amr': "Aldori A'n Abi Amr",
    'al-susi': "Assosi A'n Abi Amr",
  }).flatMap(([rewayah, name]) =>
    ['own', 'hafs'].map(kind => ({
      id: `reciter-${kind}-${rewayah}`,
      name: 'Test Reciter',
      date: null,
      image_url: null,
      rewayat: [
        {
          id: `${kind}-${rewayah}`,
          reciter_id: `reciter-${kind}-${rewayah}`,
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
  ),
}));

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async (set: string, surah: number) => {
      const {rewayahVerseMapService, hafsVerseCount} = jest.requireActual(
        '@/services/mushaf/RewayahVerseMapService',
      );
      const kind = set.slice(0, set.indexOf('-'));
      const rewayah = set.slice(set.indexOf('-') + 1);
      const count =
        kind === 'own'
          ? rewayahVerseMapService.verseCount(rewayah, surah)
          : hafsVerseCount(surah);
      return mockSynthetic(surah, count);
    }),
  },
}));

jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: () => [],
    getVerseSegmentsForPage: () => [],
  },
}));

jest.mock('@/store/mushafSettingsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useMushafSettingsStore: create(() => ({rewayah: 'hafs'}))};
});

jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: (rewayah: string) => mockUnits.get(rewayah) ?? null,
  canShowRewayahVerses: (rewayah: string) =>
    rewayah === 'hafs' || mockUnits.has(rewayah),
  subscribeVerseUnitsChanges: () => () => undefined,
}));

import {useMushafPlayerStore} from '../mushafPlayerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {
  hafsVerseCount,
  rewayahVerseMapService,
} from '@/services/mushaf/RewayahVerseMapService';
import {
  allDbDir,
  loadAllDbUnits,
} from '@/services/timestamps/__fixtures__/allDbVerseUnits';
import {formatUnitKeysLabel} from '@/utils/timestampNumbering';

const DB_DIR = allDbDir();
const run = DB_DIR ? describe : describe.skip;

const st = () => useMushafPlayerStore.getState();
const player = () => mockPlayers[mockPlayers.length - 1];
const ayahOf = (key: string) => Number(key.split(':')[1]);
const keysOf = (units: readonly VerseUnit[]) => units.map(u => u.key);

/** Move the playhead into entry `ayah` and let the 200 ms poll run. */
function atEntry(ayah: number) {
  player().currentTime = (ayah * 1000 + 50) / 1000;
  jest.advanceTimersByTime(200);
}

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Entries heard while the audio runs forward (see the fixture test). */
async function listen(maxSteps: number): Promise<number[]> {
  const heard: number[] = [];
  for (let i = 0; i < maxSteps && st().playbackState !== 'idle'; i++) {
    const timings = mushafAudioService.getTimestamps();
    const pos = player().currentTime * 1000;
    let idx = -1;
    for (let k = 0; k < timings.length; k++) {
      if (timings[k].timestampFrom <= pos) idx = k;
    }
    if (idx >= 0) heard.push(timings[idx].ayahNumber);
    if (idx === timings.length - 1) {
      player().listeners.forEach(l => l({didJustFinish: true}));
      await flush();
      continue;
    }
    atEntry(timings[idx + 1].ayahNumber);
    await flush();
  }
  return heard;
}

function reset() {
  st().stop();
  st().setVerseRepeatCount(1);
  st().setRangeRepeatCount(1);
  st().clearRange();
  st().setPendingStart(null);
  mockPlayers.length = 0;
}

async function play(set: string, start: VerseUnit | string) {
  st().setReciter(set, 'Test Reciter');
  await st().startPlayback(1, start);
}

run('the mushaf player on every words DB (local only)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [rewayah, units] of loadAllDbUnits(DB_DIR!)) {
      mockUnits.set(rewayah, units);
    }
  });

  /** Failures are collected so one report lists them (at most 20). */
  function checker() {
    const failures: string[] = [];
    let count = 0;
    return {
      fail(msg: string) {
        count += 1;
        if (failures.length < 20) failures.push(msg);
      },
      done() {
        expect({count, failures}).toEqual({count: 0, failures: []});
      },
    };
  }

  const REWAYAT: RewayahId[] = [
    'warsh',
    'qalun',
    'al-bazzi',
    'qunbul',
    'al-duri-abi-amr',
    'al-susi',
  ];

  it.each(REWAYAT)(
    '%s: the band, entry by entry, of every surah not numbered like Hafs',
    async rewayah => {
      const units = mockUnits.get(rewayah)!;
      (
        useMushafSettingsStore as unknown as {setState: (s: object) => void}
      ).setState({rewayah});
      const c = checker();
      let surahs = 0;
      for (const surah of units.surahs()) {
        if (rewayahVerseMapService.isIdentitySurah(rewayah, surah)) continue;
        surahs += 1;
        // A set numbered by the rewayah: exactly the entry's verse.
        reset();
        await play(`own-${rewayah}`, units.unitsOfSurah(surah)[0]);
        if (st().numberingMode !== 'riwayah') {
          c.fail(`${surah}: own set numbered ${st().numberingMode}`);
          continue;
        }
        for (const u of units.unitsOfSurah(surah)) {
          atEntry(u.ayah);
          const s = st();
          if (s.currentUnitKeys.join() !== u.key) {
            c.fail(`own ${u.key}: band [${s.currentUnitKeys}]`);
          }
          if (s.currentVerseLabel !== u.key) {
            c.fail(`own ${u.key}: label ${s.currentVerseLabel}`);
          }
          if (s.currentVerseKeys.join() !== u.hafsKeys.join()) {
            c.fail(`own ${u.key}: Hafs keys [${s.currentVerseKeys}]`);
          }
        }
        // A Hafs-numbered set: every verse holding the recited Hafs verse.
        reset();
        await play(`hafs-${rewayah}`, `${surah}:1`);
        if (st().numberingMode !== 'hafs') {
          c.fail(`${surah}: Hafs-numbered set numbered ${st().numberingMode}`);
          continue;
        }
        for (let e = 1; e <= hafsVerseCount(surah); e++) {
          atEntry(e);
          const expected = keysOf(units.unitsForHafsKey(`${surah}:${e}`));
          const s = st();
          if (s.currentUnitKeys.join() !== expected.join()) {
            c.fail(`hafs ${surah}:${e}: band [${s.currentUnitKeys}]`);
          }
          if (s.currentVerseLabel !== formatUnitKeysLabel(expected)) {
            c.fail(`hafs ${surah}:${e}: label ${s.currentVerseLabel}`);
          }
        }
      }
      reset();
      expect(surahs).toBeGreaterThan(0);
      c.done();
    },
  );

  it.each(REWAYAT)(
    '%s: Repeat and one-verse ranges of every split or merged verse',
    async rewayah => {
      const units = mockUnits.get(rewayah)!;
      (
        useMushafSettingsStore as unknown as {setState: (s: object) => void}
      ).setState({rewayah});
      const c = checker();
      // Verses that start inside a Hafs verse, the verses before them, and
      // verses holding several Hafs verses.
      const picked = new Set<VerseUnit>();
      for (const u of units.units) {
        if (units.hafsAnchor(u).wordPosition > 1) {
          picked.add(u);
          const before = units.previous(u);
          if (before && before.surah === u.surah) picked.add(before);
        }
        if (u.hafsKeys.length > 1) picked.add(u);
      }
      for (const u of picked) {
        // own set: Repeat loops exactly this verse
        reset();
        st().setUnitRange(u, u);
        st().setVerseRepeatCount(0);
        st().setRangeRepeatCount(0);
        await play(`own-${rewayah}`, u);
        const looped = await listen(3);
        if (looped.join() !== [u.ayah, u.ayah, u.ayah].join()) {
          c.fail(`own Repeat ${u.key}: heard [${looped}]`);
        }
        // own set: a one-verse range plays exactly this verse
        reset();
        st().setUnitRange(u, u);
        await play(`own-${rewayah}`, u);
        const ranged = await listen(5);
        if (ranged.join() !== String(u.ayah) || st().playbackState !== 'idle') {
          c.fail(`own range ${u.key}: heard [${ranged}]`);
        }
        // Hafs-numbered set: Repeat loops every Hafs entry holding its words
        reset();
        st().setUnitRange(u, u);
        st().setVerseRepeatCount(0);
        st().setRangeRepeatCount(0);
        await play(`hafs-${rewayah}`, u);
        const first = ayahOf(u.hafsKeys[0]);
        const last = ayahOf(u.hafsKeys[u.hafsKeys.length - 1]);
        const span = Array.from(
          {length: last - first + 1},
          (_, i) => first + i,
        );
        const hafsLooped = await listen(span.length * 2);
        if (hafsLooped.join() !== [...span, ...span].join()) {
          c.fail(`hafs Repeat ${u.key}: heard [${hafsLooped}]`);
        }
      }
      reset();
      expect(picked.size).toBeGreaterThan(0);
      c.done();
    },
  );
});
