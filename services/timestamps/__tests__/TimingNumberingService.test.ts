/**
 * TimingNumberingService: per-(timing set, surah) numbering resolution with
 * the set-level vote, against real timing fixtures and the bundled maps.
 */

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn(async () => null)},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: jest.fn(() => true)},
}));
// @ai-start
// MMKV with storage shared by id, like the device's: a second memory is the
// same app relaunched.
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  return {
    createMMKV: ({id}: {id: string}) => {
      const store = stores.get(id) ?? new Map<string, string>();
      stores.set(id, store);
      return {
        getString: (key: string) => store.get(key),
        set: (key: string, value: string) => {
          store.set(key, value);
        },
        remove: (key: string) => store.delete(key),
        clearAll: () => store.clear(),
      };
    },
  };
});
// @ai-end

import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import type {AyahTimestamp} from '@/types/timestamps';
import {
  FIXTURE_REWAYAT_NAMES,
  loadTimings,
  type TimingFixtureSet,
} from '../__fixtures__/timingFixtures';
import {
  SET_CLASS_SAMPLE_SIZE,
  TimingNumberingService,
  createRewayahMemory, // @ai
  type RewayahMemory, // @ai
} from '../TimingNumberingService';
import {hafsVerseCount} from '@/services/mushaf/RewayahVerseMapService'; // @ai

function makeService(
  overrides: {
    getTimestampsForSurah?: (
      set: string,
      surah: number,
    ) => Promise<AyahTimestamp[] | null>;
    hasSurah?: (set: string, surah: number) => boolean;
  } = {},
) {
  const getTimestampsForSurah = jest.fn(
    overrides.getTimestampsForSurah ??
      (async (set: string, surah: number) => loadTimings(set, surah)),
  );
  const service = new TimingNumberingService({
    verseMap: rewayahVerseMapService,
    getTimestampsForSurah,
    hasSurah: overrides.hasSurah ?? (() => true),
    findRewayatName: id =>
      FIXTURE_REWAYAT_NAMES[id as TimingFixtureSet] ?? null,
  });
  return {service, getTimestampsForSurah};
}

function entries(set: TimingFixtureSet, surah: number): AyahTimestamp[] {
  const t = loadTimings(set, surah);
  if (!t) throw new Error(`missing fixture ${set}/${surah}`);
  return t;
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('resolveReciterRewayah', () => {
  it('resolves the catalog rewayat name through the canonical resolver', () => {
    const {service} = makeService();
    expect(service.resolveReciterRewayah('warsh-14')).toBe('warsh');
    expect(service.resolveReciterRewayah('bazzi-296')).toBe('al-bazzi');
    expect(service.resolveReciterRewayah('doori-269')).toBe('al-duri-abi-amr');
    expect(service.resolveReciterRewayah('shubah-305')).toBe('shubah');
    expect(service.resolveReciterRewayah('hafs-clean')).toBe('hafs');
    expect(service.resolveReciterRewayah('not-in-catalog')).toBeNull();
  });
});

describe('set-level vote', () => {
  it('classifies the rewayah-numbered Warsh set from its smallest discriminating surahs', async () => {
    const {service, getTimestampsForSurah} = makeService();
    await expect(service.getSetClass('warsh-14', 'warsh')).resolves.toBe(
      'riwayah',
    );
    const fetched = getTimestampsForSurah.mock.calls
      .map(c => c[1])
      .sort((a, b) => a - b);
    expect(fetched).toEqual([96, 99, 101, 106, 107]);
    expect(fetched).toHaveLength(SET_CLASS_SAMPLE_SIZE);
  });

  it('classifies the Hafs-numbered Warsh set', async () => {
    const {service} = makeService();
    await expect(service.getSetClass('warsh-134', 'warsh')).resolves.toBe(
      'hafs',
    );
  });

  it('caches verdicts and shares an in-flight vote', async () => {
    const {service, getTimestampsForSurah} = makeService();
    const [a, b] = await Promise.all([
      service.getSetClass('warsh-14', 'warsh'),
      service.getSetClass('warsh-14', 'warsh'),
    ]);
    expect([a, b]).toEqual(['riwayah', 'riwayah']);
    await service.getSetClass('warsh-14', 'warsh');
    expect(getTimestampsForSurah).toHaveBeenCalledTimes(SET_CLASS_SAMPLE_SIZE);
  });

  it('stays unknown (and retries later) when too few surahs could be fetched', async () => {
    let online = false;
    const {service} = makeService({
      getTimestampsForSurah: async (set, surah) =>
        online ? loadTimings(set, surah) : null,
    });
    await expect(service.getSetClass('warsh-14', 'warsh')).resolves.toBe(
      'unknown',
    );
    online = true;
    await expect(service.getSetClass('warsh-14', 'warsh')).resolves.toBe(
      'riwayah',
    );
  });

  it('only samples surahs the set covers', async () => {
    const {service, getTimestampsForSurah} = makeService({
      hasSurah: (_set, surah) => surah !== 106,
    });
    await service.getSetClass('warsh-14', 'warsh');
    expect(getTimestampsForSurah.mock.calls.map(c => c[1])).not.toContain(106);
  });

  it('a mixed sample is inconclusive', async () => {
    const {service} = makeService({
      // two surahs Hafs-numbered, three rewayah-numbered
      getTimestampsForSurah: async (_set, surah) =>
        loadTimings(
          surah === 96 || surah === 99 ? 'warsh-134' : 'warsh-14',
          surah,
        ),
    });
    await expect(service.getSetClass('mixed', 'warsh')).resolves.toBe(
      'unknown',
    );
  });
});

describe('resolve', () => {
  const cases: [TimingFixtureSet, number, string][] = [
    ['warsh-14', 1, 'riwayah'], // equal counts, set vote
    ['warsh-14', 2, 'riwayah'],
    ['warsh-14', 112, 'hafs'], // identical numbering in both counts
    ['warsh-134', 1, 'hafs'], // equal counts, set vote
    ['warsh-134', 2, 'hafs'],
    ['bazzi-296', 112, 'riwayah'],
    ['doori-269', 67, 'disabled'],
    ['shubah-305', 2, 'hafs'],
    ['hafs-clean', 2, 'hafs'],
    ['hafs-preroll', 112, 'hafs'],
  ];

  it.each(cases)('%s surah %d -> %s', async (set, surah, mode) => {
    const {service} = makeService();
    const n = await service.resolve(set, surah, entries(set, surah));
    expect(n.mode).toBe(mode);
  });

  it('resolveSync answers without network unless the set class is needed', async () => {
    const {service, getTimestampsForSurah} = makeService();
    expect(
      service.resolveSync('warsh-14', 2, entries('warsh-14', 2))?.mode,
    ).toBe('riwayah');
    expect(
      service.resolveSync('doori-269', 67, entries('doori-269', 67))?.mode,
    ).toBe('disabled');
    expect(
      service.resolveSync('warsh-14', 1, entries('warsh-14', 1)),
    ).toBeNull();
    expect(getTimestampsForSurah).not.toHaveBeenCalled();
    await service.resolve('warsh-14', 1, entries('warsh-14', 1));
    expect(
      service.resolveSync('warsh-14', 1, entries('warsh-14', 1))?.mode,
    ).toBe('riwayah');
  });

  it('an explicit reciter rewayah overrides the catalog', async () => {
    const {service} = makeService();
    const n = await service.resolve(
      'warsh-14',
      2,
      entries('warsh-14', 2),
      null,
    );
    // unknown rewayah and 285 entries (not the Hafs count): refuse to guess
    expect(n.mode).toBe('disabled');
  });

  it('falls back to disabled when the vote is inconclusive', async () => {
    const {service} = makeService({getTimestampsForSurah: async () => null});
    const n = await service.resolve('warsh-14', 1, entries('warsh-14', 1));
    expect(n.mode).toBe('disabled');
  });
});

// @ai-start
describe('a timing set the catalog no longer lists', () => {
  // A real Hafs set's shape: an ayah-0 pre-roll, then verses 1..n-1 (its last
  // verse has no entry), so the entry count is not the Hafs count.
  const hafsShortOfLastVerse = (surah: number): AyahTimestamp[] =>
    [
      0,
      ...Array.from({length: hafsVerseCount(surah) - 1}, (_, i) => i + 1),
    ].map((ayahNumber, i) => ({
      surahNumber: surah,
      ayahNumber,
      timestampFrom: i * 1000,
      timestampTo: (i + 1) * 1000,
      durationMs: 1000,
    }));

  function serviceWith(
    catalog: Record<string, string>,
    memory: RewayahMemory,
    catalogLoaded = true,
  ) {
    return new TimingNumberingService({
      verseMap: rewayahVerseMapService,
      getTimestampsForSurah: async () => null,
      hasSurah: () => true,
      findRewayatName: id => catalog[id] ?? null,
      catalogLoaded: () => catalogLoaded,
      rewayahMemory: memory,
    });
  }

  beforeEach(() => createRewayahMemory().clear());

  it('keeps the rewayah it was last listed with: a Hafs set stays on identity', async () => {
    const catalog: Record<string, string> = {'hafs-set': "Hafs A'n Assem"};
    const service = serviceWith(catalog, createRewayahMemory());
    expect(
      (await service.resolve('hafs-set', 2, hafsShortOfLastVerse(2))).mode,
    ).toBe('hafs');
    delete catalog['hafs-set']; // dropped upstream, or the fallback catalog
    expect(service.resolveReciterRewayah('hafs-set')).toBe('hafs');
    for (const surah of [1, 2, 67, 112, 114]) {
      const n = await service.resolve(
        'hafs-set',
        surah,
        hafsShortOfLastVerse(surah),
      );
      expect(n.mode).toBe('hafs');
      expect(n.hafsKeysForEntry(3)).toEqual([`${surah}:3`]);
    }
  });

  it('remembers it across app launches', () => {
    serviceWith(
      {'hafs-set': "Hafs A'n Assem"},
      createRewayahMemory(),
    ).resolveReciterRewayah('hafs-set');
    const relaunched = serviceWith({}, createRewayahMemory());
    expect(relaunched.resolveReciterRewayah('hafs-set')).toBe('hafs');
  });

  it('a rewayah set keeps its verse map', async () => {
    const catalog: Record<string, string> = {'warsh-14': "Warsh A'n Nafi'"};
    const service = serviceWith(catalog, createRewayahMemory());
    service.resolveReciterRewayah('warsh-14');
    delete catalog['warsh-14'];
    const n = await service.resolve('warsh-14', 2, entries('warsh-14', 2));
    expect(n.mode).toBe('riwayah');
    expect(n.hafsKeysForEntry(4)).toEqual(['2:5']);
  });

  it('a set it never listed stays unknown: no highlight rather than a guess', async () => {
    const service = serviceWith({}, createRewayahMemory());
    expect(service.resolveReciterRewayah('never-listed')).toBeNull();
    expect(
      (await service.resolve('never-listed', 2, hafsShortOfLastVerse(2))).mode,
    ).toBe('disabled');
  });

  it('nothing is assumed before the catalog has loaded', () => {
    const memory = createRewayahMemory();
    serviceWith({'hafs-set': "Hafs A'n Assem"}, memory).resolveReciterRewayah(
      'hafs-set',
    );
    expect(
      serviceWith({}, memory, false).resolveReciterRewayah('hafs-set'),
    ).toBeNull();
  });

  it('while the catalog lists the set, its name decides', () => {
    const catalog: Record<string, string> = {'set-x': "Hafs A'n Assem"};
    const service = serviceWith(catalog, createRewayahMemory());
    expect(service.resolveReciterRewayah('set-x')).toBe('hafs');
    catalog['set-x'] = 'Unrecognised rewayah name';
    expect(service.resolveReciterRewayah('set-x')).toBeNull();
    // last listed with no known rewayah: nothing to keep
    delete catalog['set-x'];
    expect(service.resolveReciterRewayah('set-x')).toBeNull();
  });
});
// @ai-end
