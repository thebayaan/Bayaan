// @ai-generated
/**
 * Test fixtures: real verse units (services/mushaf/RewayahVerseUnits.ts) for
 * the audio tests, built from the real Release 1 word slots of a few
 * complete surahs (services/mushaf/__fixtures__/verseUnitsFixture.json,
 * surahs 1, 71, 103, 106, 107, 112 and 114 of the Hafs, Shu'bah, Warsh,
 * al-Bazzi and al-Duri words DBs).
 *
 * Cases they hold that the timing fixtures (./timings) also cover:
 *   - Warsh / al-Duri al-Fatihah: the basmala (Hafs 1:1) is in no verse, and
 *     Hafs 1:7 is split in two verses, 1:6 and 1:7 (anchors 1:7, 1:7:5);
 *   - Warsh 106: Hafs 106:4 split in 106:4 and 106:5;
 *   - Warsh 107: Hafs 107:6 + 107:7 merged in 107:6;
 *   - al-Bazzi 112: Hafs 112:3 split in 112:3 and 112:4 (5 verses).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

export type UnitFixtureDb = 'hafs' | 'shouba' | 'warsh' | 'bazzi' | 'doori';

export const UNIT_FIXTURE_REWAYAH: Readonly<Record<UnitFixtureDb, RewayahId>> =
  {
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
  texts: Record<UnitFixtureDb, string[]>;
}

let fixture: VerseUnitsFixture | null = null;
const built = new Map<UnitFixtureDb, RewayahVerseUnits>();

function load(): VerseUnitsFixture {
  if (!fixture) {
    const file = path.join(
      __dirname,
      '../../mushaf/__fixtures__/verseUnitsFixture.json',
    );
    fixture = JSON.parse(fs.readFileSync(file, 'utf8')) as VerseUnitsFixture;
  }
  return fixture;
}

/** Surahs present in the units fixture. */
export function unitFixtureSurahs(): number[] {
  return load().surahs.slice();
}

/** The verse units of one fixture words DB (built once). */
export function fixtureVerseUnits(db: UnitFixtureDb): RewayahVerseUnits {
  const cached = built.get(db);
  if (cached) return cached;
  const f = load();
  const slots = f.ids.map((id, i) => {
    const [surah, ayah, word] = f.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: f.texts[db][i]};
  });
  const units = buildRewayahVerseUnits(
    UNIT_FIXTURE_REWAYAH[db],
    slots,
    `${db}@audio-fixture`,
  );
  built.set(db, units);
  return units;
}

/** Fixture units of an app rewayah id, or null when not in the fixture. */
export function fixtureUnitsOf(rewayah: RewayahId): RewayahVerseUnits | null {
  const db = (Object.keys(UNIT_FIXTURE_REWAYAH) as UnitFixtureDb[]).find(
    d => UNIT_FIXTURE_REWAYAH[d] === rewayah,
  );
  return db ? fixtureVerseUnits(db) : null;
}

/** A fixture unit by its key in its rewayah's own numbering. */
export function fixtureUnit(db: UnitFixtureDb, key: string): VerseUnit {
  const unit = fixtureVerseUnits(db).unitByKey(key);
  if (!unit) throw new Error(`no ${db} unit ${key} in the fixture`);
  return unit;
}
