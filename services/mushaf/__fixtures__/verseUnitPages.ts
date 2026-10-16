// @ai-generated
/**
 * Test-only: the real slots of verseUnitsFixture.json (complete surahs 1, 71,
 * 103, 106, 107, 112, 114 of five Release 1 words DBs) laid out as mushaf
 * pages for the fixture-backed DigitalKhattDataService stand-in
 * (rewayahOverlayFixture.ts), and the verse units built from them.
 *
 * Surah 1 uses the real page-1 layout (lines 2-8 hold ids 1-36), so Warsh
 * 1:6 ends inline at the start of line 7 ('... ۝٦') and Warsh 1:7 continues
 * on the same line. The other surahs get synthetic pages (one surah per
 * page, a surah-name line then ayah lines of SLOTS_PER_LINE slots), which
 * put unit boundaries both at and inside line breaks.
 *
 * Not imported by app code.
 */
import type {DKLine} from '../DigitalKhattDataService';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '../RewayahVerseUnits';
import {findPage, pageLines} from './rewayahOverlayFixture';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export type UnitsFixtureDb = 'hafs' | 'shouba' | 'warsh' | 'bazzi' | 'doori';

/** [surah, ayah, firstWordId, lastWordId, hafsKeys, anchorKey, text] */
export type ExpectedUnit = [
  number,
  number,
  number,
  number,
  string[],
  string,
  string,
];

interface VerseUnitsFixture {
  surahs: number[];
  ids: number[];
  locations: string[];
  texts: Record<UnitsFixtureDb, string[]>;
  expected: Record<UnitsFixtureDb, ExpectedUnit[]>;
  unnumbered: Record<UnitsFixtureDb, [number, number][]>;
}

export const unitsFixture =
  require('./verseUnitsFixture.json') as VerseUnitsFixture;

export const UNITS_FIXTURE_DBS: readonly UnitsFixtureDb[] = [
  'hafs',
  'shouba',
  'warsh',
  'bazzi',
  'doori',
];

export const UNITS_FIXTURE_REWAYAH: Record<UnitsFixtureDb, RewayahId> = {
  hafs: 'hafs',
  shouba: 'shubah',
  warsh: 'warsh',
  bazzi: 'al-bazzi',
  doori: 'al-duri-abi-amr',
};

export const SLOTS_PER_LINE = 6;

/** Page of a fixture surah: 1 for the Fatiha, synthetic 1000 + surah else. */
export function pageOfFixtureSurah(surah: number): number {
  return surah === 1 ? 1 : 1000 + surah;
}

export function fixtureWords(db: UnitsFixtureDb): [number, string, string][] {
  return unitsFixture.ids.map((id, i) => [
    id,
    unitsFixture.locations[i],
    unitsFixture.texts[db][i],
  ]);
}

export function fixtureSlots(db: UnitsFixtureDb): VerseUnitSlot[] {
  return unitsFixture.ids.map((id, i) => {
    const [surah, ayah, word] = unitsFixture.locations[i]
      .split(':')
      .map(Number);
    return {id, surah, ayah, word, text: unitsFixture.texts[db][i]};
  });
}

export function fixtureLines(): DKLine[] {
  const lines: DKLine[] = pageLines(findPage(1));
  for (const surah of unitsFixture.surahs) {
    if (surah === 1) continue;
    const page = pageOfFixtureSurah(surah);
    const ids = unitsFixture.ids.filter(
      (_, i) => Number(unitsFixture.locations[i].split(':')[0]) === surah,
    );
    lines.push({
      page_number: page,
      line_number: 1,
      line_type: 'surah_name',
      is_centered: 1,
      first_word_id: '' as unknown as number,
      last_word_id: '' as unknown as number,
      surah_number: surah,
    });
    for (let i = 0; i < ids.length; i += SLOTS_PER_LINE) {
      const chunk = ids.slice(i, i + SLOTS_PER_LINE);
      lines.push({
        page_number: page,
        line_number: 2 + i / SLOTS_PER_LINE,
        line_type: 'ayah',
        is_centered: 0,
        first_word_id: chunk[0],
        last_word_id: chunk[chunk.length - 1],
        surah_number: '' as unknown as number,
      });
    }
  }
  return lines;
}

/** The pages fixtureLines() lays out, in reading order. */
export function fixturePages(): number[] {
  return unitsFixture.surahs.map(pageOfFixtureSurah);
}

export function buildFixtureUnits(db: UnitsFixtureDb): RewayahVerseUnits {
  return buildRewayahVerseUnits(
    UNITS_FIXTURE_REWAYAH[db],
    fixtureSlots(db),
    `${UNITS_FIXTURE_REWAYAH[db]}@fixture`,
  );
}

/** The expected unit (independent Python walk) holding a slot, or null. */
export function expectedUnitOfSlot(
  db: UnitsFixtureDb,
  wordId: number,
): ExpectedUnit | null {
  return (
    unitsFixture.expected[db].find(u => wordId >= u[2] && wordId <= u[3]) ??
    null
  );
}
