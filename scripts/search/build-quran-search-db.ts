// @ai-generated
/**
 * Builds assets/data/quran-search-v1.db, the Quran word search index, from
 * the Hafs Digital Khatt words and the i'rab morphology:
 *
 *   npx tsx scripts/search/build-quran-search-db.ts            # write the DB
 *   npx tsx scripts/search/build-quran-search-db.ts --check    # verify it
 *   npx tsx scripts/search/build-quran-search-db.ts --imlaei words.tsv --out x.db
 *
 * --check rebuilds in memory and fails when the committed DB is stale (its
 * content hash or a source hash differs). --imlaei adds one imla'i word per
 * slot ('s:a:w<TAB>word' lines) as extra spellings; v1 ships without it, and
 * a text fed in must have its licence checked first (see THIRD_PARTY_LICENSES
 * .md). Every gate is in scripts/search/quranSearchIndex.ts.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  alphabetViolations,
  buildQuranSearchIndex,
  checkQuranSearchIndex,
  QURAN_SEARCH_SCHEMA,
  type QuranSearchIndexContent,
  type QuranSearchIndexInput,
} from './quranSearchIndex';
import {encodePostings} from '@/utils/search/quranIndexFormat';

const ROOT = path.join(__dirname, '../..');
const DK_DIR = path.join(ROOT, 'data/mushaf/digitalkhatt');
const DK_DB = path.join(DK_DIR, 'digital-khatt-v2.db');
const IRAB_DB = path.join(ROOT, 'assets/data/irab-v1.db');
const OUT_DB = path.join(ROOT, 'assets/data/quran-search-v1.db');
/** The other rewayat's words DBs: their spellings must fold cleanly too. */
const OTHER_WORDS_DBS = [
  'dk_words_shouba.db',
  'dk_words_warsh.db',
  'dk_words_qaloon.db',
  'dk_words_bazzi.db',
  'dk_words_qumbul.db',
  'dk_words_doori.db',
  'dk_words_soosi.db',
];
export const REBUILD_COMMAND =
  'npx tsx scripts/search/build-quran-search-db.ts';

function fileSha256(file: string): string {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
}

/** The build input, read from the bundled DBs. */
export function readQuranSearchInput(
  imlaeiFile?: string,
): QuranSearchIndexInput {
  const dk = new Database(DK_DB, {readonly: true});
  const irab = new Database(IRAB_DB, {readonly: true});
  try {
    const dkWords = dk
      .prepare('SELECT location, text FROM words ORDER BY id')
      .all() as {location: string; text: string}[];
    const irabRows = (
      irab
        .prepare(
          'SELECT verse_key, position, entries, morph FROM word_irab ORDER BY verse_key, position',
        )
        .all() as {
        verse_key: string;
        position: number;
        entries: string;
        morph: string;
      }[]
    ).map(row => ({
      verseKey: row.verse_key,
      position: row.position,
      entries: row.entries,
      morph: row.morph,
    }));
    const irabTexts: string[] = [];
    for (const row of irab.prepare('SELECT id, text FROM texts').all() as {
      id: number;
      text: string;
    }[]) {
      irabTexts[row.id] = row.text;
    }
    let imlaei: Map<string, string> | undefined;
    if (imlaeiFile) {
      imlaei = new Map();
      for (const line of fs.readFileSync(imlaeiFile, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const [location, word] = line.split('\t');
        if (!/^\d+:\d+:\d+$/.test(location) || !word) {
          throw new Error(`bad --imlaei line: ${line}`);
        }
        imlaei.set(location, word.trim());
      }
    }
    return {
      dkWords,
      irabRows,
      irabTexts,
      imlaei,
      sources: {
        dkSha256: fileSha256(DK_DB),
        irabSha256: fileSha256(IRAB_DB),
        imlaeiSha256: imlaeiFile ? fileSha256(imlaeiFile) : undefined,
      },
    };
  } finally {
    dk.close();
    irab.close();
  }
}

/** Gate 3 over the other rewayat: every word folds into the alphabet. */
function checkOtherRewayat(): void {
  const failures: string[] = [];
  for (const name of OTHER_WORDS_DBS) {
    const db = new Database(path.join(DK_DIR, name), {readonly: true});
    try {
      const texts = (
        db.prepare('SELECT text FROM words').all() as {text: string | null}[]
      ).map(row => row.text ?? '');
      // A slot may hold several words and end with an inline verse marker.
      const bad = alphabetViolations(texts.flatMap(text => text.split(' ')));
      if (bad.length) failures.push(`${name}: ${bad.slice(0, 5).join(' ')}`);
    } finally {
      db.close();
    }
  }
  if (failures.length) {
    throw new Error(`spellings outside the alphabet:\n${failures.join('\n')}`);
  }
}

function writeDb(content: QuranSearchIndexContent, out: string): void {
  const tmp = `${out}.tmp-${process.pid}`;
  fs.rmSync(tmp, {force: true});
  const db = new Database(tmp);
  try {
    db.pragma('page_size = 4096');
    db.exec(QURAN_SEARCH_SCHEMA);
    db.transaction(() => {
      const form = db.prepare(
        'INSERT INTO forms (form, postings) VALUES (?, ?)',
      );
      for (const [key, codes] of content.forms)
        form.run(key, encodePostings(codes));
      const root = db.prepare(
        'INSERT INTO roots (id, root, words, ayahs) VALUES (?, ?, ?, ?)',
      );
      for (const r of content.roots) root.run(r.id, r.root, r.words, r.ayahs);
      const lemma = db.prepare(
        'INSERT INTO lemmas (id, root_id, lemma, words, ayahs, postings) VALUES (?, ?, ?, ?, ?, ?)',
      );
      for (const l of content.lemmas) {
        lemma.run(
          l.id,
          l.rootId,
          l.lemma,
          l.words,
          l.ayahs,
          encodePostings(l.codes),
        );
      }
      const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(content.meta))
        meta.run(key, value);
    })();
    // Written last: an app that finds no complete='1' re-imports the asset.
    db.prepare("INSERT INTO meta (key, value) VALUES ('complete', '1')").run();
    db.exec('VACUUM');
  } finally {
    db.close();
  }
  fs.renameSync(tmp, out);
}

function readMeta(file: string): Record<string, string> {
  const db = new Database(file, {readonly: true});
  try {
    return Object.fromEntries(
      (
        db.prepare('SELECT key, value FROM meta').all() as {
          key: string;
          value: string;
        }[]
      ).map(row => [row.key, row.value]),
    );
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const imlaeiAt = args.indexOf('--imlaei');
  const outAt = args.indexOf('--out');
  const imlaeiFile = imlaeiAt >= 0 ? args[imlaeiAt + 1] : undefined;
  const out = outAt >= 0 ? path.resolve(args[outAt + 1]) : OUT_DB;

  const started = Date.now();
  const input = readQuranSearchInput(imlaeiFile);
  const content = buildQuranSearchIndex(input);
  await checkQuranSearchIndex(content, input.dkWords);
  checkOtherRewayat();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (check) {
    if (!fs.existsSync(out))
      throw new Error(`${out} is missing: run ${REBUILD_COMMAND}`);
    const committed = readMeta(out);
    const stale = Object.entries(content.meta).filter(
      ([key, value]) => committed[key] !== value,
    );
    if (committed.complete !== '1') stale.push(['complete', '1']);
    if (stale.length) {
      const keys = stale.map(([key]) => key).join(', ');
      throw new Error(
        `${path.relative(
          ROOT,
          out,
        )} is stale (${keys}): run ${REBUILD_COMMAND}`,
      );
    }
    console.log(`${path.relative(ROOT, out)} is up to date (${seconds} s)`);
    return;
  }
  writeDb(content, out);
  const size = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
  console.log(
    `wrote ${path.relative(ROOT, out)}: ${content.meta.forms} forms, ` +
      `${content.meta.postings} postings, ${content.meta.roots} roots, ` +
      `${content.meta.lemmas} lemmas, ${size} MB (${seconds} s)`,
  );
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
