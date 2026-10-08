// @ai-generated
/**
 * RewayahVerseUnitsService: verse units read from the data service's caches
 * (main cache or side cache), cached per rewayah + data identity (C5), and
 * refused (fail closed) when they cannot be derived or disagree with the
 * bundled verse map.
 */
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: (rewayah: string) => `${rewayah}@test`,
}));

import type {
  DKWordInfo,
  RewayahLoadState,
} from '@/services/mushaf/DigitalKhattDataService';
import {buildRewayahVerseUnits, type VerseUnitSlot} from '../RewayahVerseUnits';
import {
  readRewayahSlots,
  RewayahVerseUnitsService,
  type VerseUnitsDataReader,
} from '../RewayahVerseUnitsService';
import {rewayahVerseMapService} from '../RewayahVerseMapService';
import {SURAHS} from '@/data/surahData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

type FixtureDb = 'hafs' | 'warsh';
const fixture = require('../__fixtures__/verseUnitsFixture.json') as {
  locations: string[];
  texts: Record<FixtureDb, string[]>;
};

/** Slots with ids renumbered 1..n (the data service's ids are contiguous). */
function contiguousSlots(
  locations: string[],
  texts: string[],
): VerseUnitSlot[] {
  return locations.map((location, i) => {
    const [surah, ayah, word] = location.split(':').map(Number);
    return {id: i + 1, surah, ayah, word, text: texts[i]};
  });
}

const ARABIC_DIGITS =
  '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const marker = (n: number) =>
  '\u06DD' + [...String(n)].map(d => ARABIC_DIGITS[Number(d)]).join('');

/**
 * A synthetic words DB shaped like Hafs (every surah, every Hafs verse: two
 * placeholder words and its marker slot). Not Quran text.
 */
function syntheticHafsSlots(): VerseUnitSlot[] {
  const slots: VerseUnitSlot[] = [];
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      const texts = ['w', 'w', marker(ayah)];
      texts.forEach((text, i) =>
        slots.push({
          id: slots.length + 1,
          surah: surah.id,
          ayah,
          word: i + 1,
          text,
        }),
      );
    }
  }
  return slots;
}

/** Fake data service: one main cache plus side caches, like the real one. */
class FakeDataReader implements VerseUnitsDataReader {
  rewayah: RewayahId = 'hafs';
  initialized = true;
  readonly states = new Map<RewayahId, RewayahLoadState>();
  private readonly verses = new Map<RewayahId, Map<string, DKWordInfo[]>>();
  private infos: DKWordInfo[] = [];
  private texts: string[] = [];

  /** Make `rewayah` the main cache (its slots give the ids / locations). */
  setMain(rewayah: RewayahId, slots: VerseUnitSlot[]): void {
    this.rewayah = rewayah;
    this.infos = [];
    this.texts = [];
    for (const s of slots) {
      this.infos[s.id] = {
        text: s.text,
        verseKey: `${s.surah}:${s.ayah}`,
        wordPositionInVerse: s.word,
      };
      this.texts[s.id] = s.text;
    }
    this.setSide(rewayah, slots);
  }

  /** Put `rewayah` in a side cache (verse lists with blank slots). */
  setSide(rewayah: RewayahId, slots: VerseUnitSlot[]): void {
    const byVerse = new Map<string, DKWordInfo[]>();
    for (const s of slots) {
      const key = `${s.surah}:${s.ayah}`;
      const info = {text: s.text, verseKey: key, wordPositionInVerse: s.word};
      const list = byVerse.get(key);
      if (list) list.push(info);
      else byVerse.set(key, [info]);
    }
    this.verses.set(rewayah, byVerse);
    this.states.set(rewayah, 'ready');
  }

  isRewayahReady(rewayah: RewayahId): boolean {
    return this.states.get(rewayah) === 'ready';
  }
  getRewayahLoadState(rewayah: RewayahId): RewayahLoadState {
    return this.states.get(rewayah) ?? 'idle';
  }
  getWordInfo(wordId: number): DKWordInfo | undefined {
    return this.infos[wordId];
  }
  getWordText(wordId: number): string {
    return this.texts[wordId] ?? '';
  }
  getVerseWords(verseKey: string, rewayah?: RewayahId): DKWordInfo[] {
    // Like the real service: blank slots are omitted.
    const list = this.verses.get(rewayah ?? this.rewayah)?.get(verseKey) ?? [];
    return list.filter(w => w.text !== '');
  }
}

/** The adapter reuses one slot object: copy each slot while iterating. */
function copySlots(dk: VerseUnitsDataReader, rewayah: RewayahId) {
  return Array.from(readRewayahSlots(dk, rewayah)!, s => ({...s}));
}

describe('readRewayahSlots', () => {
  const hafs = contiguousSlots(fixture.locations, fixture.texts.hafs);
  const warsh = contiguousSlots(fixture.locations, fixture.texts.warsh);

  it('reads the main cache slot by slot', () => {
    const dk = new FakeDataReader();
    dk.setMain('warsh', warsh);
    expect(copySlots(dk, 'warsh')).toEqual(warsh);
  });

  it('rebuilds a side-cache rewayah with its blank slots', () => {
    const dk = new FakeDataReader();
    dk.setMain('hafs', hafs);
    dk.setSide('warsh', warsh);
    const read = copySlots(dk, 'warsh');
    expect(read).toEqual(warsh);
    expect(read.filter(s => s.text === '').length).toBeGreaterThan(0);
    const fromSide = buildRewayahVerseUnits('warsh', read, 'k');
    const direct = buildRewayahVerseUnits('warsh', warsh, 'k');
    expect(fromSide.units).toEqual(direct.units);
  });

  it('is null while the words are not in memory', () => {
    const dk = new FakeDataReader();
    dk.setMain('hafs', hafs);
    expect(readRewayahSlots(dk, 'warsh')).toBeNull();
    dk.initialized = false;
    expect(readRewayahSlots(dk, 'hafs')).toBeNull();
  });
});

describe('RewayahVerseUnitsService', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  const synthetic = syntheticHafsSlots();

  function setup() {
    const dk = new FakeDataReader();
    dk.setMain('hafs', synthetic);
    let version = 1;
    const service = new RewayahVerseUnitsService(
      dk,
      rewayahVerseMapService,
      rewayah =>
        rewayah === 'hisham' || rewayah === 'ishaq'
          ? null
          : `${rewayah}@v${version}`,
    );
    return {dk, service, bump: () => (version += 1)};
  }

  it('derives and caches the units of a loaded rewayah', () => {
    const {service, bump} = setup();
    const units = service.get('hafs')!;
    expect(units.units.length).toBe(6236);
    expect(units.dataKey).toBe('hafs@v1');
    expect(service.getStatus('hafs')).toBe('ready');
    expect(service.getError('hafs')).toBeNull();
    expect(service.get('hafs')).toBe(units);
    // A new data identity (another words DB) means new units.
    bump();
    const rebuilt = service.get('hafs')!;
    expect(rebuilt).not.toBe(units);
    expect(rebuilt.dataKey).toBe('hafs@v2');
  });

  it('follows the data service while the words are not in memory', () => {
    const {dk, service} = setup();
    for (const state of ['idle', 'loading', 'error'] as RewayahLoadState[]) {
      dk.states.set('warsh', state);
      expect(service.get('warsh')).toBeNull();
      expect(service.getStatus('warsh')).toBe(state);
    }
    dk.states.set('hisham', 'unavailable');
    expect(service.get('hisham')).toBeNull();
    expect(service.getStatus('hisham')).toBe('unavailable');
    // Words in memory but no data identity (a broken build): never ready.
    dk.setSide('ishaq', synthetic);
    expect(service.get('ishaq')).toBeNull();
    expect(service.getStatus('ishaq')).toBe('error');
  });

  it('drops the units when the data service drops the words', () => {
    const {dk, service} = setup();
    const units = service.get('hafs');
    dk.states.set('hafs', 'idle');
    expect(service.get('hafs')).toBeNull();
    dk.states.set('hafs', 'ready');
    expect(service.get('hafs')).not.toBe(units);
  });

  it('refuses units that disagree with the verse map, once', () => {
    const {dk, service} = setup();
    // Hafs-numbered slots under the Warsh name: the Warsh map disagrees.
    dk.setSide('warsh', synthetic);
    expect(service.get('warsh')).toBeNull();
    expect(service.getStatus('warsh')).toBe('error');
    expect(String(service.getError('warsh'))).toMatch(
      /warsh words DB and verse map disagree: r2h 1:1: \[1:1\] vs map \[1:2\]/,
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses data outside the slot model and incomplete data', () => {
    const {dk, service} = setup();
    const broken = synthetic.map(s =>
      s.surah === 2 && s.ayah === 5 && s.word === 3 ? {...s, text: ''} : s,
    );
    dk.setSide('shubah', broken);
    expect(service.get('shubah')).toBeNull();
    expect(String(service.getError('shubah'))).toMatch(
      /verse number 6, expected 5/,
    );
    const partial = synthetic.filter(s => s.surah === 1);
    dk.setSide('al-bazzi', partial);
    expect(service.getStatus('al-bazzi')).toBe('error');
    dk.setMain('hafs', partial);
    service.clearCache();
    expect(String(service.getError('hafs'))).toMatch(/1 of 114 surahs/);
  });
});
