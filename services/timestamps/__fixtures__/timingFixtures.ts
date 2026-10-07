/**
 * Test fixtures: real ayah timing files from the R2 timestamp mirror
 * (verbatim copies, `timings/<set>/<surah>.json`), for a few surahs of:
 *
 *   warsh-14     Warsh, rewayah-numbered (Madani count)
 *   warsh-134    Warsh, Hafs-numbered
 *   bazzi-296    al-Bazzi, rewayah-numbered (Makki count)
 *   doori-269    al-Duri; surah 67 follows the Madani split (31 entries
 *                where both the source and Hafs count 30)
 *   shubah-305   Shu'bah, Hafs-numbered (Kufi count)
 *   hafs-clean   Hafs, entries 1..n
 *   hafs-preroll Hafs with an ayah-0 pre-roll entry
 *
 * The set names double as rewayat ids in the fake catalog below.
 *
 * hafs-coverage-oracle.json lists, for each reciter verse, the Hafs verses
 * it covers. It was derived independently of the bundled verse maps, by
 * aligning the KFGQPC source text of the rewayah against the Hafs words.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {AyahTimestamp} from '@/types/timestamps';
import type {Reciter} from '@/data/reciterData';

export type TimingFixtureSet =
  | 'warsh-14'
  | 'warsh-134'
  | 'bazzi-296'
  | 'doori-269'
  | 'shubah-305'
  | 'hafs-clean'
  | 'hafs-preroll';

/** Catalog rewayat names (as served by the API) for each fixture set. */
export const FIXTURE_REWAYAT_NAMES: Record<TimingFixtureSet, string> = {
  'warsh-14': "Warsh A'n Nafi'",
  'warsh-134': "Warsh A'n Nafi'",
  'bazzi-296': "Albizi A'n Ibn Katheer",
  'doori-269': "Aldori A'n Abi Amr",
  'shubah-305': "Shu'bah A'n Assem",
  'hafs-clean': "Hafs A'n Assem",
  'hafs-preroll': "Hafs A'n Assem",
};

const TIMINGS_DIR = path.join(__dirname, 'timings');

/** Surahs available for a fixture set. */
export function fixtureSurahs(set: TimingFixtureSet): number[] {
  return fs
    .readdirSync(path.join(TIMINGS_DIR, set))
    .filter(f => f.endsWith('.json'))
    .map(f => parseInt(f, 10))
    .sort((a, b) => a - b);
}

/** Timing entries of one surah, or null when the fixture has no such file. */
export function loadTimings(
  set: string,
  surah: number,
): AyahTimestamp[] | null {
  const file = path.join(
    TIMINGS_DIR,
    set,
    `${String(surah).padStart(3, '0')}.json`,
  );
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as AyahTimestamp[];
}

/** One generic reciter per fixture set; rewayat id == set name. */
export function fixtureCatalog(): Reciter[] {
  return (Object.keys(FIXTURE_REWAYAT_NAMES) as TimingFixtureSet[]).map(
    (set, i) => ({
      id: `reciter-${i + 1}`,
      name: `Test Reciter ${i + 1}`,
      date: null,
      image_url: null,
      rewayat: [
        {
          id: set,
          reciter_id: `reciter-${i + 1}`,
          name: FIXTURE_REWAYAT_NAMES[set],
          style: 'murattal',
          server: `https://audio.example.com/${set}`,
          surah_total: 114,
          surah_list: [],
          source_type: 'test',
          created_at: '2026-01-01',
          has_timestamps: true,
        },
      ],
    }),
  );
}

type Oracle = Record<string, Record<string, number[][]>>;

let oracle: Oracle | null = null;

/**
 * Hafs ayahs covered by reciter verse `verse` of `surah` in `system`
 * ('warsh' = Madani count, 'bazzi' = Makki count, 'doori'), from the
 * independent alignment.
 */
export function oracleHafsAyahs(
  system: 'warsh' | 'bazzi' | 'doori',
  surah: number,
  verse: number,
): number[] {
  if (!oracle) {
    oracle = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'hafs-coverage-oracle.json'),
        'utf8',
      ),
    ) as Oracle;
  }
  const verses = oracle[system]?.[String(surah)];
  if (!verses) throw new Error(`no oracle for ${system} ${surah}`);
  return verses[verse - 1] ?? [];
}
