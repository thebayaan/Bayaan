// @ai-generated
/**
 * Builds assets/data/rasm-v<N>.db: how the mushaf's spelling of each Hafs
 * word differs from a standard (imla'i) spelling.
 *
 *   npx tsx scripts/word-study/build-rasm-db.ts --input <file> \
 *     [--out assets/data/rasm-v1.db] [--report <file>] [--check]
 *
 * The input must be the one locked in scripts/word-study/sources.lock.json
 * (by SHA-256; adapter "tanzil" for a Tanzil txt download). Gates (the build
 * fails):
 *  - the input is not the locked one;
 *  - a verse whose app words and standard tokens do not pair by the merge
 *    rules with equal skeletons, or that groupVerse pairs another way;
 *  - an app position holding two written words that is not a known one;
 *  - a reviewed word whose derived notes changed (rasm-reviewed.json);
 *  - a note letter outside the display set, a mark outside its imlaei or on
 *    no letter, or an imlaei with markup, Latin letters or U+FFFD.
 * A note that no sign, named rule or review confirms is stored but hidden
 * (docs/plans/2026-11-14-word-study/README.md); --report lists each with a
 * rasm-reviewed.json entry ready to edit, plus the wasl and fasl units.
 * --check rebuilds into a temporary file and compares it with --out.
 *
 * The input is not committed (see SOURCES.md), so CI does not run this; the
 * logic lives in tested modules.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {rasmLetters} from './arabic';
import {readAppWords, verseOrder} from './appWords';
import {compareDbs, writeRasmDb} from './db';
import {arg, hasFlag, readLock, sha256, sourceRow} from './lock';
import {
  applyReviewed,
  diffGroup,
  groupVerse,
  mapTanzilVerse,
  NOTE_LETTERS,
  readReviewed,
  readTanzil,
  readWordJson,
  reviewTemplate,
  TWO_WORD_POSITIONS,
  type RasmUnit,
  type WordGroup,
} from './rasm';

const HERE = __dirname;
const ROOT = path.resolve(HERE, '../..');

/** The verse lines of a Tanzil file, without its # copyright block. */
export function tanzilTextHash(text: string): string {
  return sha256(
    text
      .split(/\r?\n/)
      .filter(l => l.trim() && !l.startsWith('#'))
      .join('\n'),
  );
}

export function build(
  input: string,
  out: string,
  reportFile: string,
): string[] {
  const lock = readLock(path.join(HERE, 'sources.lock.json')).rasm;
  if (!lock) throw new Error('no rasm source is locked in sources.lock.json');
  const data = fs.readFileSync(input);
  const hash = sha256(data);
  const text = data.toString('utf8');
  if (hash !== lock.sha256) {
    const sameText =
      lock.textSha256 !== undefined && tanzilTextHash(text) === lock.textSha256;
    throw new Error(
      `${input}: SHA-256 ${hash} is not the locked ${lock.sha256}` +
        (sameText
          ? ' (the verse text is the locked one: only the copyright block changed; re-lock the file after checking it)'
          : ''),
    );
  }

  const app = readAppWords(ROOT);
  const problems: string[] = [];
  const groups: WordGroup[] = [];
  let notice = '';
  if (lock.adapter === 'tanzil') {
    const tanzil = readTanzil(text);
    notice = tanzil.notice;
    if (!notice.includes('CHANGING IT IS NOT ALLOWED')) {
      problems.push('the Tanzil copyright block is missing');
    }
    for (const vk of verseOrder(app.verses.keys())) {
      const words = app.verses.get(vk) ?? [];
      const tokens = tanzil.verses.get(vk);
      if (!tokens) {
        problems.push(`${vk}: not in the standard text`);
        continue;
      }
      const mapped = mapTanzilVerse(vk, words, tokens);
      problems.push(...mapped.problems);
      groups.push(...mapped.groups);
      // An independent pairing must agree.
      const dp = groupVerse(
        mapped.groups.map(g => g.uthmani),
        tokens,
      );
      let t = 0;
      const rules = mapped.groups.map((g, i) => {
        const r = {mushaf: [i, i], standard: [t, t + g.standard.length - 1]};
        t += g.standard.length;
        return JSON.stringify(r);
      });
      if (!dp || dp.map(g => JSON.stringify(g)).join() !== rules.join()) {
        problems.push(`${vk}: groupVerse pairs the verse differently`);
      }
    }
    if (tanzil.verses.size !== app.verses.size) {
      problems.push(
        `standard text has ${tanzil.verses.size} verses, the app ${app.verses.size}`,
      );
    }
  } else {
    // A word-level source: groupVerse alone pairs it.
    const standard = readWordJson(text);
    for (const vk of verseOrder(app.verses.keys())) {
      const words = app.verses.get(vk) ?? [];
      const grouping = groupVerse(
        words.map(w => w.text),
        standard.get(vk) ?? [],
      );
      if (!grouping) {
        problems.push(`${vk}: cannot be paired`);
        continue;
      }
      const tokens = (standard.get(vk) ?? []).flatMap(s =>
        s.split(/\s+/).filter(Boolean),
      );
      for (const g of grouping) {
        const unit = words.slice(g.mushaf[0], g.mushaf[1] + 1);
        groups.push({
          verseKey: vk,
          from: unit[0].position,
          to: unit[unit.length - 1].position,
          uthmani: unit.map(w => w.text).join(' '),
          standard: tokens.slice(g.standard[0], g.standard[1] + 1),
        });
      }
    }
  }

  // The app positions that hold two written words are the known ones.
  const twoWord = groups
    .filter(g => g.from === g.to && rasmLetters(g.uthmani).words > 1)
    .map(g => `${g.verseKey}:${g.from}`);
  if (twoWord.join() !== TWO_WORD_POSITIONS.join()) {
    problems.push(`two-word app positions: ${twoWord.join(', ')}`);
  }

  const derived: RasmUnit[] = [];
  const unpaired: string[] = [];
  for (const g of groups) {
    const {notes, unpaired: u} = diffGroup(g);
    if (u.length) unpaired.push(`${g.verseKey}:${g.from} ${u.join(', ')}`);
    if (!notes.length) continue;
    derived.push({
      verseKey: g.verseKey,
      from: g.from,
      to: g.to,
      imlaei: g.standard.join(' '),
      notes,
      reviewed: false,
    });
  }
  const reviewed = readReviewed(
    fs.readFileSync(path.join(HERE, 'rasm-reviewed.json'), 'utf8'),
  );
  const applied = applyReviewed(derived, reviewed);
  problems.push(...applied.problems);
  const units = applied.units;

  for (const u of units) {
    const key = `${u.verseKey}:${u.from}`;
    if (/[<>A-Za-z�]/.test(u.imlaei)) {
      problems.push(`${key}: imlaei «${u.imlaei}» has markup, Latin or U+FFFD`);
    }
    for (const n of u.notes) {
      for (const letter of [n.standard, n.mushaf]) {
        if (letter && !NOTE_LETTERS.has(letter)) {
          problems.push(
            `${key}: note letter «${letter}» is not a display letter`,
          );
        }
      }
      if (n.mark) {
        const [from, to] = n.mark;
        const marked = u.imlaei.slice(from, to);
        if (to > u.imlaei.length || !/[ء-ي]/.test(marked)) {
          problems.push(
            `${key}: mark ${from}-${to} is on no letter of «${u.imlaei}»`,
          );
        }
      }
    }
  }
  if (problems.length) {
    console.error(problems.slice(0, 60).join('\n'));
    throw new Error(`rasm build: ${problems.length} problem(s)`);
  }

  const count = (basis: string) =>
    units.reduce(
      (n, u) => n + u.notes.filter(x => x.basis === basis).length,
      0,
    );
  const shown = units.filter(u => u.notes.some(n => n.basis !== 'unconfirmed'));
  const meta: Record<string, string> = {
    source_id: String(lock.id),
    input_sha256: hash,
    input_url: lock.url,
    version: lock.version,
    notice,
    app_words: String(
      [...app.verses.values()].reduce((n, v) => n + v.length, 0),
    ),
    repaired_words: app.repaired.join(' '),
    rows: String(units.length),
    rows_shown: String(shown.length),
    notes_sign: String(count('sign')),
    notes_rule: String(count('rule')),
    notes_reviewed: String(count('reviewed')),
    notes_unconfirmed: String(count('unconfirmed')),
  };
  writeRasmDb(
    out,
    sourceRow('rasm', lock.id, lock.ord, lock, lock.version),
    units,
    meta,
  );
  if (reportFile) fs.writeFileSync(reportFile, report(units, groups, unpaired));
  const kinds = new Map<string, number>();
  for (const u of units) {
    for (const n of u.notes) {
      const k = `${n.kind}/${n.basis}`;
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
  }
  return [
    `${groups.length} units paired, ${units.length} with notes (${shown.length} shown)`,
    [...kinds].map(([k, n]) => `${k} ${n}`).join(', '),
  ];
}

function report(
  units: readonly RasmUnit[],
  groups: readonly WordGroup[],
  unpaired: readonly string[],
): string {
  const line = (u: RasmUnit) =>
    `${u.verseKey}:${u.from} «${u.imlaei}» ${u.notes
      .map(n => `${n.kind}:${n.standard}→${n.mushaf}:${n.basis}(${n.why})`)
      .join(' ')}`;
  const hidden = units.filter(u =>
    u.notes.some(n => n.basis === 'unconfirmed'),
  );
  const multi = groups.filter(g => g.standard.length > 1 || g.from !== g.to);
  return [
    `## Units with hidden (unconfirmed) notes: ${hidden.length}`,
    '',
    'Each line is followed by a rasm-reviewed.json entry to edit ("confirm",',
    'or "notes" to replace, or "skip"; "why" is required).',
    '',
    ...hidden.flatMap(u => [line(u), `    ${reviewTemplate(u)}`]),
    '',
    `## Units of several tokens or words (wasl, fasl, two-word positions): ${multi.length}`,
    '',
    ...multi.map(
      g =>
        `${g.verseKey}:${g.from}-${g.to} «${g.uthmani}» = «${g.standard.join(
          ' ',
        )}»`,
    ),
    '',
    `## Small signs the alignment left unpaired: ${unpaired.length}`,
    '',
    ...unpaired,
    '',
  ].join('\n');
}

function main(): void {
  const out = path.resolve(
    arg('out', path.join(ROOT, 'assets/data/rasm-v1.db')),
  );
  const check = hasFlag('check');
  const target = check
    ? path.join(os.tmpdir(), `rasm-check-${process.pid}.db`)
    : out;
  const summary = build(arg('input'), target, arg('report', ''));
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
