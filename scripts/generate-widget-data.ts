// scripts/generate-widget-data.ts
// Writes the static data bundled into both widget targets:
//   surahs.json  names, surah glyph code points, card file names
//   ayat.json    Ayah of the Day list with Digital Khatt text and The Clear Quran
//   adhkar-periods.json  morning and evening adhkar with a curated featured list
//   occasions.json       Hijri month names and occasion ayat (Digital Khatt + The Clear Quran)
// Run after editing data/widgets/ayah-of-the-day.json: npm run generate:widget-data
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {SURAHS} from '../data/surahData';
import {surahGlyphMap} from '../utils/surahGlyphMap';
import {
  buildAdhkarPeriods,
  buildOccasionData,
  buildStaticAyat,
  buildStaticSurahs,
  buildSurahCatalogSwift,
  isAdhkarPeriodSources,
  isOccasionsSource,
  parseAdhkarSeed,
} from '../services/widgets/widgetStaticData';

const root = path.resolve(__dirname, '..');
const OUTPUT_DIRS = [
  'targets/widgets',
  'modules/bayaan-widgets/android/src/main/assets/widgets',
];

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function textOf(row: unknown): string {
  return typeof row === 'object' &&
    row !== null &&
    'text' in row &&
    typeof row.text === 'string'
    ? row.text
    : '';
}

// data/clear-quran-translation.json: {translations: [{text}]}, indexed by the
// verse's global id (1:1 is 1) minus one.
function clearQuranTexts(data: unknown): string[] {
  if (typeof data !== 'object' || data === null || !('translations' in data))
    throw new Error('clear-quran-translation.json is malformed');
  const rows: unknown = Reflect.get(data, 'translations');
  if (!Array.isArray(rows))
    throw new Error('clear-quran-translation.json is malformed');
  return rows.map(textOf);
}

function verseIndexByKey(): Map<string, number> {
  const index = new Map<string, number>();
  let offset = 0;
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      index.set(`${surah.id}:${ayah}`, offset + ayah - 1);
    }
    offset += surah.verses_count;
  }
  return index;
}

function main(): void {
  const keys = readJson('data/widgets/ayah-of-the-day.json');
  if (!isStringArray(keys)) {
    throw new Error('ayah-of-the-day.json must be an array of verse keys');
  }
  const clearQuran = clearQuranTexts(
    readJson('data/clear-quran-translation.json'),
  );
  const verseIndex = verseIndexByKey();
  const db = new Database(
    path.join(root, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
    {readonly: true},
  );
  const wordsStmt = db.prepare(
    'SELECT text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
  );

  const ayahSources = {
    words: (surahId: number, ayah: number) =>
      wordsStmt.all(surahId, ayah).map(textOf).filter(Boolean),
    translation: (key: string) => {
      const index = verseIndex.get(key);
      return index === undefined ? undefined : clearQuran[index];
    },
    surahName: (surahId: number) => SURAHS[surahId - 1]?.name,
  };
  const ayat = buildStaticAyat(keys, ayahSources);
  const surahs = buildStaticSurahs(SURAHS, surahGlyphMap);
  const periodSource = readJson('data/widgets/adhkar-periods.json');
  if (!isAdhkarPeriodSources(periodSource)) {
    throw new Error('data/widgets/adhkar-periods.json is malformed');
  }
  const adhkarPeriods = buildAdhkarPeriods(
    periodSource,
    parseAdhkarSeed(readJson('data/adhkar.json')),
  );
  const occasionSource = readJson('data/widgets/occasions.json');
  if (!isOccasionsSource(occasionSource)) {
    throw new Error('data/widgets/occasions.json is malformed');
  }
  const occasions = buildOccasionData(occasionSource, ayahSources);
  db.close();

  for (const dir of OUTPUT_DIRS) {
    const abs = path.join(root, dir);
    fs.mkdirSync(abs, {recursive: true});
    fs.writeFileSync(path.join(abs, 'ayat.json'), `${JSON.stringify(ayat)}\n`);
    fs.writeFileSync(
      path.join(abs, 'surahs.json'),
      `${JSON.stringify(surahs)}\n`,
    );
    fs.writeFileSync(
      path.join(abs, 'adhkar-periods.json'),
      `${JSON.stringify(adhkarPeriods)}\n`,
    );
    fs.writeFileSync(
      path.join(abs, 'occasions.json'),
      `${JSON.stringify(occasions)}\n`,
    );
  }
  fs.writeFileSync(
    path.join(root, 'targets/widgets/_shared/SurahCatalog.swift'),
    buildSurahCatalogSwift(surahs),
  );
  console.log(
    `[generate-widget-data] ${ayat.length} ayat, ${surahs.length} surahs, ${occasions.occasions.length} occasions, 2 adhkar periods`,
  );
}

main();
