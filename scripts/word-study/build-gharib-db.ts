// @ai-generated
/**
 * Builds assets/data/gharib-v<N>.db: Arabic word meanings (gharib) from the
 * locked books, placed on the app's Hafs words.
 *
 *   npx tsx scripts/word-study/build-gharib-db.ts --input <file> \
 *     [--input <file>…] [--out assets/data/gharib-v1.db] [--report <file>] \
 *     [--check]
 *
 * Every input must be locked in scripts/word-study/sources.lock.json by its
 * SHA-256, with its adapter, version, the books to keep, their names,
 * display order and minPlaced. Gates (the build fails):
 *  - an input that is not locked, or a locked input that is not given;
 *  - a dump whose version is not the locked one;
 *  - a headword, gloss or note that still has markup, a link, Latin
 *    letters, digits, brackets or U+FFFD after cleaning, or an empty gloss;
 *  - a span outside its verse's words in data/wbw/wbw-en.db;
 *  - a book whose share of entries placed on words is below its minPlaced.
 * --report lists for review: tier-3, tier-2 and ambiguous placements (shown
 * on words), tier-4 and neighbouring-verse matches (kept at verse level),
 * and entries placed nowhere.
 * --check rebuilds into a temporary file and compares it with --out.
 *
 * The inputs are not committed (see SOURCES.md for where they come from),
 * so CI does not run this; the logic lives in tested modules.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import {cleanBookHtml} from '../irab/build-irab-db';
import {readAppWords} from './appWords';
import {compareDbs, writeGharibDb, type GharibRow} from './db';
import {
  cleanGloss,
  cleanHeadword,
  placeAll,
  readGharibReviewed,
  readJsonl,
  readQuranpediaBook,
  readQuranpediaMeanings,
  textProblem,
  type GharibInput,
  type Placement,
} from './gharib';
import {
  arg,
  argAll,
  hasFlag,
  readLock,
  sha256,
  sourceRow,
  type GharibInputLock,
} from './lock';

const HERE = __dirname;
const ROOT = path.resolve(HERE, '../..');

function readJsonFile(file: string, data: Buffer): unknown {
  const text = file.endsWith('.gz')
    ? zlib.gunzipSync(data).toString('utf8')
    : data.toString('utf8');
  return JSON.parse(text);
}

function readInput(
  file: string,
  data: Buffer,
  lock: GharibInputLock,
): GharibInput[] {
  const ids = lock.books.map(b => b.id);
  if (lock.adapter === 'quranpedia-meanings') {
    const {entries, version} = readQuranpediaMeanings(
      readJsonFile(file, data),
      ids,
    );
    if (version !== lock.version) {
      throw new Error(`${file}: version ${version}, locked ${lock.version}`);
    }
    return entries;
  }
  if (lock.adapter === 'quranpedia-book') {
    const {entries, version} = readQuranpediaBook(
      readJsonFile(file, data),
      ids[0],
      cleanBookHtml,
    );
    if (version !== lock.version) {
      throw new Error(`${file}: version ${version}, locked ${lock.version}`);
    }
    return entries;
  }
  return readJsonl(data.toString('utf8')).filter(e => ids.includes(e.sourceId));
}

export function build(
  inputs: readonly string[],
  out: string,
  reportFile: string,
): string[] {
  const lock = readLock(path.join(HERE, 'sources.lock.json'));
  if (!lock.gharib.length) {
    throw new Error('no gharib source is locked in sources.lock.json');
  }
  const problems: string[] = [];
  const meta: Record<string, string> = {};
  const used = new Set<GharibInputLock>();
  const entries: GharibInput[] = [];
  const bookOf = new Map<number, {input: GharibInputLock; index: number}>();
  for (const file of inputs) {
    const data = fs.readFileSync(file);
    const hash = sha256(data);
    const entry = lock.gharib.find(g => g.sha256 === hash);
    if (!entry) {
      throw new Error(`${file}: SHA-256 ${hash} is not a locked gharib input`);
    }
    used.add(entry);
    meta[`input_${entry.file}_sha256`] = hash;
    meta[`input_${entry.file}_url`] = entry.url;
    entry.books.forEach((b, index) => bookOf.set(b.id, {input: entry, index}));
    entries.push(...readInput(file, data, entry));
  }
  for (const g of lock.gharib) {
    if (!used.has(g)) throw new Error(`locked input ${g.file} not given`);
  }

  // Clean and gate the texts.
  for (const e of entries) {
    e.headword = cleanHeadword(e.headword);
    e.gloss = cleanGloss(e.gloss);
    e.note = cleanGloss(e.note ?? '');
    const where = `${e.sourceId} ${e.surah}:${e.ayah} #${e.ord}`;
    if (!e.gloss) problems.push(`${where}: empty gloss`);
    for (const [field, text] of [
      ['headword', e.headword],
      ['gloss', e.gloss],
      ['note', e.note],
    ] as const) {
      const problem = text ? textProblem(text) : null;
      if (problem) problems.push(`${where}: ${field} has ${problem}: ${text}`);
    }
  }

  const app = readAppWords(ROOT);
  const reviewed = readGharibReviewed(
    fs.readFileSync(path.join(HERE, 'gharib-reviewed.json'), 'utf8'),
  );
  const placed = placeAll(entries, app.verses, reviewed);

  // Spans must be real words of their verse.
  for (const p of placed) {
    if (!p.span) continue;
    const positions = new Set(
      (app.verses.get(p.verseKey) ?? []).map(w => w.position),
    );
    for (let w = p.span[0]; w <= p.span[1]; w++) {
      if (!positions.has(w)) {
        problems.push(
          `${p.verseKey}: span ${p.span.join('-')} has no word ${w}`,
        );
        break;
      }
    }
  }

  // Placed share per book.
  const summary: string[] = [];
  const sources = [];
  for (const [id, {input, index}] of bookOf) {
    const book = input.books[index];
    const all = placed.filter(p => p.input.sourceId === id);
    const onWords = all.filter(p => p.span).length;
    const share = all.length ? onWords / all.length : 0;
    const tiers = [0, 1, 2, 3, 4, 5].map(
      t => all.filter(p => p.tier === t && !p.moved).length,
    );
    const moved = all.filter(p => p.moved).length;
    summary.push(
      `book ${id}: ${all.length} entries, ${onWords} on words (${(
        share * 100
      ).toFixed(1)}%); ` +
        `tiers 1-5: ${tiers.slice(1).join('/')}, moved ${moved}, none ${
          tiers[0]
        }`,
    );
    if (share < book.minPlaced) {
      problems.push(
        `book ${id}: ${(share * 100).toFixed(1)}% on words, below minPlaced ${
          book.minPlaced
        }`,
      );
    }
    meta[`source_${id}_version`] = input.version;
    meta[`source_${id}_entries`] = String(all.length);
    meta[`source_${id}_placed`] = String(onWords);
    const credit = `${book.viaEn}, ${input.url}, version ${input.version}`;
    meta[`source_${id}_credit`] = credit;
    sources.push(sourceRow('gharib', id, book.ord, book, input.version));
  }
  if (problems.length) {
    console.error(problems.slice(0, 60).join('\n'));
    throw new Error(`gharib build: ${problems.length} problem(s)`);
  }

  meta.app_words = String(
    [...app.verses.values()].reduce((n, v) => n + v.length, 0),
  );
  meta.repaired_words = app.repaired.join(' ');
  const rows: GharibRow[] = placed.map(p => ({
    verseKey: p.verseKey,
    sourceId: p.input.sourceId,
    ord: p.input.ord,
    span: p.span,
    tier: p.tier,
    candidate: p.candidate,
    headword: p.input.headword,
    gloss: p.input.gloss,
    note: p.input.note ?? '',
    part: p.input.part ?? '',
    page: p.input.page ?? '',
  }));
  writeGharibDb(out, sources, rows, meta);
  if (reportFile) fs.writeFileSync(reportFile, report(placed, app.verses));
  return summary;
}

function report(
  placed: readonly Placement[],
  verses: ReturnType<typeof readAppWords>['verses'],
): string {
  const text = (vk: string, span: [number, number]) =>
    (verses.get(vk) ?? [])
      .filter(w => w.position >= span[0] && w.position <= span[1])
      .map(w => w.text)
      .join(' ');
  const line = (p: Placement) =>
    `${p.verseKey} [${p.input.sourceId} #${p.input.ord}] «${
      p.input.headword
    }» → ${
      p.span
        ? `${p.span.join('-')} «${text(p.verseKey, p.span)}»`
        : p.candidate || 'none'
    }`;
  const sections: [string, (p: Placement) => boolean][] = [
    [
      'Tier 3, shown on words (clitics taken off)',
      p => p.tier === 3 && !p.moved,
    ],
    [
      'Tier 2, shown on words (alif and hamza spelling)',
      p => p.tier === 2 && !p.moved,
    ],
    [
      'Ambiguous, shown on words (first candidate after the previous entry)',
      p => p.ambiguous && !!p.span,
    ],
    ['Tier 4, verse level (loose match, not shown)', p => p.tier === 4],
    ['Neighbouring verse, verse level (not shown)', p => p.moved],
    ['Placed nowhere, verse level (not shown)', p => p.tier === 0],
    ['Hand-placed (gharib-reviewed.json)', p => p.tier === 5],
  ];
  return sections
    .map(([title, keep]) => {
      const list = placed.filter(keep).map(line);
      return `## ${title}: ${list.length}\n\n${list.join('\n')}\n`;
    })
    .join('\n');
}

function main(): void {
  const out = path.resolve(
    arg('out', path.join(ROOT, 'assets/data/gharib-v1.db')),
  );
  const inputs = argAll('input');
  if (!inputs.length) throw new Error('give at least one --input');
  const check = hasFlag('check');
  const target = check
    ? path.join(os.tmpdir(), `gharib-check-${process.pid}.db`)
    : out;
  const summary = build(inputs, target, arg('report', ''));
  console.log(summary.join('\n'));
  if (!check) {
    console.log(
      `wrote ${path.relative(ROOT, out)} (${(
        fs.statSync(out).size / 1e6
      ).toFixed(2)} MB)`,
    );
    return;
  }
  const diffs = compareDbs(out, target);
  fs.unlinkSync(target);
  if (diffs.length) {
    console.error(diffs.join('\n'));
    console.error(`check: ${path.relative(ROOT, out)} differs from a rebuild`);
    process.exit(1);
  }
  console.log(`check: ${path.relative(ROOT, out)} matches a rebuild`);
}

if (require.main === module) main();
