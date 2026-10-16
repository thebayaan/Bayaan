// @ai-generated
/**
 * Verse units for the player list tests.
 *
 * fixtureUnits(): real slots of complete surahs (1, 71, 103, 106, 107, 112,
 * 114) from the Release 1 words DBs of Hafs, Shu'bah, Warsh, al-Bazzi and
 * al-Duri: the core's services/mushaf/__fixtures__/verseUnitsFixture.json.
 * It holds the unnumbered Fatiha basmala (Warsh, al-Duri), a split Hafs
 * verse (Warsh 1:6 / 1:7), a merged one (Warsh 103:1 = Hafs 103:1-2) and a
 * verse that starts and ends inside Hafs verses (al-Bazzi 71:24).
 *
 * syntheticUnits(): a small surah written slot by slot, for list tests that
 * need a surah the fixture does not hold.
 */
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export type FixtureDb = 'hafs' | 'shouba' | 'warsh' | 'bazzi' | 'doori';

export const FIXTURE_REWAYAH: Record<FixtureDb, RewayahId> = {
  hafs: 'hafs',
  shouba: 'shubah',
  warsh: 'warsh',
  bazzi: 'al-bazzi',
  doori: 'al-duri-abi-amr',
};

interface VerseUnitsFixture {
  surahs: number[];
  ids: number[];
  locations: string[];
  texts: Record<FixtureDb, string[]>;
}

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as VerseUnitsFixture;

export const FIXTURE_SURAHS: readonly number[] = fixture.surahs;

/** The fixture's slots of one DB, in id order. */
export function fixtureSlots(db: FixtureDb): VerseUnitSlot[] {
  return fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts[db][i]};
  });
}

const cache = new Map<FixtureDb, RewayahVerseUnits>();

/** Units of one fixture DB (built once per test file). */
export function fixtureUnits(db: FixtureDb): RewayahVerseUnits {
  let units = cache.get(db);
  if (!units) {
    units = buildRewayahVerseUnits(
      FIXTURE_REWAYAH[db],
      fixtureSlots(db),
      `${db}@fixture`,
    );
    cache.set(db, units);
  }
  return units;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** '۝N' as the words DBs write it (Arabic-Indic digits). */
export function marker(n: number): string {
  return `۝${String(n)
    .split('')
    .map(d => ARABIC_DIGITS[Number(d)])
    .join('')}`;
}

/**
 * Units of a one-surah words DB written slot by slot: `verses[a - 1]` holds
 * the rewayah texts of the slots of Hafs verse a (its words, then its Hafs
 * marker slot; '' for a blank slot). Word ids start at `firstId`.
 */
export function syntheticUnits(
  rewayah: RewayahId,
  surah: number,
  verses: string[][],
  firstId = 1,
): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = [];
  let id = firstId;
  verses.forEach((texts, i) => {
    texts.forEach((text, w) => {
      slots.push({id: id++, surah, ayah: i + 1, word: w + 1, text});
    });
  });
  return buildRewayahVerseUnits(rewayah, slots, `${rewayah}@synthetic`);
}

/**
 * Surah 2 cut to 8 Hafs verses, as a rewayah that merges Hafs 2:1 and 2:2
 * into its verse 2:1 (like Warsh) and numbers the rest one lower: rewayah
 * 2:N = Hafs 2:N+1 for N >= 2. Hafs words are 'w<ayah>.<word>'.
 */
export function mergedOpeningUnits(rewayah: RewayahId): RewayahVerseUnits {
  const verses: string[][] = [['w1.1', '']];
  for (let a = 2; a <= 8; a++) {
    verses.push([`w${a}.1`, `w${a}.2`, marker(a - 1)]);
  }
  return syntheticUnits(rewayah, 2, verses);
}
