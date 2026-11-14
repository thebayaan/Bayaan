// @ai-generated
/**
 * Full-data check of the per-word readings index (dk_readings.db) against
 * the bundled words DBs, highlight maps and word-by-word data. Runs when
 * BAYAAN_OVERLAY_DB_DIR is set (CI sets 'bundled') and node:sqlite loads
 * (Node >= 22.13), and skips otherwise, like the other *.alldbs suites:
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest dkReadingsIndex.alldbs --watchAll=false
 *
 * It always reads the repo's files: the index must match exactly the words
 * DBs it was built from. It asserts:
 *  - info: the format, the member order, and inputs equal to the sha256 of
 *    the 8 words DBs and 7 diff files;
 *  - every row decodes (wordReadingsFormat);
 *  - for each of the 77,432 Hafs content slots: the groups of its readings
 *    follow the 7 diff files (Hafs's group: the untinted, non-blank rewayat;
 *    differing: the tinted ones; not read: the blank ones; a listed misprint
 *    sits with its sibling), every text is a member's stored text, and own
 *    texts, silah, verse ends, word counts and the basmala are the DBs'; a
 *    slot with no row reads alike (no tint, no silah, no blank, Hafs's word
 *    count and verse end, not 1:1, not half of a two-slot word);
 *  - the word-by-word data differs from the DK positions exactly at
 *    WBW_JOINED_WORDS, and those DK slots have no row.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  decodeReadingsRow,
  dkPositionsForWbwWord,
  parseReadingsInfo,
  READINGS_FORMAT,
  READINGS_REWAYAT,
  WBW_JOINED_WORDS,
  WHOLE_WORD_CATEGORY,
  type ReadingsRewayah,
  type WordReadings,
} from '../wordReadingsFormat';

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}
let sqlite: {
  DatabaseSync: new (file: string, opts?: object) => SqliteDb;
} | null = null;
try {
  sqlite = require('node:sqlite');
} catch {
  sqlite = null;
}

const REPO = path.resolve(__dirname, '../../..');
const DK_DIR = path.join(REPO, 'data/mushaf/digitalkhatt');
const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && sqlite ? describe : describe.skip;

const FILE_ID: Record<ReadingsRewayah, string> = {
  hafs: 'hafs',
  shubah: 'shouba',
  'al-bazzi': 'bazzi',
  qunbul: 'qumbul',
  warsh: 'warsh',
  qalun: 'qaloon',
  'al-duri-abi-amr': 'doori',
  'al-susi': 'soosi',
};
const dbFile = (r: ReadingsRewayah) =>
  r === 'hafs' ? 'digital-khatt-v2.db' : `dk_words_${FILE_ID[r]}.db`;
const SIBLING: Partial<Record<ReadingsRewayah, ReadingsRewayah>> = {
  warsh: 'qalun',
  qalun: 'warsh',
  'al-duri-abi-amr': 'al-susi',
  'al-susi': 'al-duri-abi-amr',
  'al-bazzi': 'qunbul',
  qunbul: 'al-bazzi',
};
// The declared Hafs-only words (validate_rewayah_db.PLACEMENT_EVENTS, P2).
const NOT_READ: Record<string, readonly ReadingsRewayah[]> = {
  '57:24:10': ['warsh', 'qalun'],
};
const OTHERS = READINGS_REWAYAT.filter(r => r !== 'hafs');

function query(file: string, sql: string): Record<string, unknown>[] {
  if (!sqlite) throw new Error('node:sqlite is not available');
  const db = new sqlite.DatabaseSync(file, {readOnly: true});
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

const END_OF_AYAH = String.fromCharCode(0x06dd);
const ZERO = 0x0660; // Arabic-Indic digit zero

function markerNumber(token: string): number | null {
  if (!token.startsWith(END_OF_AYAH) || token.length < 2) return null;
  let n = 0;
  for (const c of token.slice(1)) {
    const d = c.charCodeAt(0) - ZERO;
    if (d < 0 || d > 9) return null;
    n = n * 10 + d;
  }
  return n;
}

/** A stored slot text -> its words (inline marker removed) and that marker. */
function splitSlot(text: string): {words: string; inline: number | null} {
  const tokens = text ? text.split(' ') : [];
  const inline = tokens.length ? markerNumber(tokens[tokens.length - 1]) : null;
  if (inline !== null) tokens.pop();
  return {words: tokens.join(' '), inline};
}

interface Slot {
  id: number;
  location: string;
  verseKey: string;
  position: number;
  words: Record<ReadingsRewayah, string>;
  inline: Partial<Record<ReadingsRewayah, number>>;
}

run('dk_readings.db against the bundled data', () => {
  const rowsOf = {} as Record<ReadingsRewayah, Record<string, unknown>[]>;
  const slots: Slot[] = [];
  const markerText = new Map<number, Record<ReadingsRewayah, string>>();
  const tint = {} as Record<ReadingsRewayah, Set<string>>;
  const silah = {} as Record<ReadingsRewayah, Map<string, number[]>>;
  let indexRows: {
    verse_key: string;
    position: number;
    word_id: number;
    data: string;
  }[] = [];
  let info: ReturnType<typeof parseReadingsInfo>;
  let issues: {rid: string; location: string; sibling: string}[] = [];

  beforeAll(() => {
    for (const r of READINGS_REWAYAT) {
      rowsOf[r] = query(
        path.join(DK_DIR, dbFile(r)),
        'SELECT id, location, surah, ayah, word, text FROM words ORDER BY id',
      );
    }
    rowsOf.hafs.forEach((row, k) => {
      const text = (key: ReadingsRewayah) => String(rowsOf[key][k].text ?? '');
      const all = Object.fromEntries(
        READINGS_REWAYAT.map(r => [r, text(r)]),
      ) as Record<ReadingsRewayah, string>;
      if (markerNumber(text('hafs')) !== null) {
        markerText.set(Number(row.id), all);
        return;
      }
      const words = {} as Record<ReadingsRewayah, string>;
      const inline: Partial<Record<ReadingsRewayah, number>> = {};
      for (const r of READINGS_REWAYAT) {
        const split = splitSlot(all[r]);
        words[r] = split.words;
        if (split.inline !== null) inline[r] = split.inline;
      }
      slots.push({
        id: Number(row.id),
        location: String(row.location),
        verseKey: `${row.surah}:${row.ayah}`,
        position: Number(row.word),
        words,
        inline,
      });
    });
    for (const r of OTHERS) {
      const doc = JSON.parse(
        fs.readFileSync(path.join(DK_DIR, `${FILE_ID[r]}-diff.json`), 'utf8'),
      ) as Record<string, unknown>;
      const t = new Set<string>();
      const s = new Map<string, number[]>();
      for (const [key, cats] of Object.entries(doc)) {
        if (key === '__format') continue;
        for (const [cat, entries] of Object.entries(
          cats as Record<string, [number, number[]][]>,
        )) {
          for (const [pos, chars] of entries) {
            if (cat === 'silah') s.set(`${key}:${pos}`, chars);
            else t.add(`${key}:${pos}`);
          }
        }
      }
      tint[r] = t;
      silah[r] = s;
    }
    const index = path.join(DK_DIR, 'dk_readings.db');
    info = parseReadingsInfo(
      query(index, 'SELECT key, value FROM info') as {
        key: string;
        value: string;
      }[],
    );
    indexRows = query(
      index,
      'SELECT verse_key, position, word_id, data FROM slots ORDER BY word_id',
    ) as typeof indexRows;
    issues = JSON.parse(
      fs.readFileSync(
        path.join(REPO, 'scripts/rewayah/reading_upstream_issues.json'),
        'utf8',
      ),
    ).issues;
  });

  it('was built from these words DBs and diffs, in this format and member order', () => {
    expect(info.format).toBe(READINGS_FORMAT);
    expect(info.rewayat).toEqual([...READINGS_REWAYAT]);
    const files = [
      ...READINGS_REWAYAT.map(dbFile),
      ...OTHERS.map(r => `${FILE_ID[r]}-diff.json`),
    ];
    const sha = (file: string) =>
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(DK_DIR, file)))
        .digest('hex');
    expect(info.inputs).toEqual(
      Object.fromEntries(files.map(f => [f, sha(f)])),
    );
  });

  it('every row decodes', () => {
    expect(indexRows.length).toBeGreaterThan(0);
    for (const row of indexRows) {
      expect(() =>
        decodeReadingsRow(row.verse_key, row.position, row.word_id, row.data),
      ).not.toThrow();
    }
  });

  it('every Hafs content slot reads as the words DBs and diff files say', () => {
    expect(slots).toHaveLength(77432);
    const rowById = new Map(indexRows.map(r => [r.word_id, r]));
    const errors: string[] = [];
    const fail = (where: string, message: string) => {
      if (errors.length < 30) errors.push(`${where}: ${message}`);
    };
    const folded = new Map<string, ReadingsRewayah>(); // "loc|rewayah" -> sibling
    for (const i of issues) {
      const r = READINGS_REWAYAT.find(x => FILE_ID[x] === i.rid);
      const s = READINGS_REWAYAT.find(x => FILE_ID[x] === i.sibling);
      if (!r || !s || SIBLING[r] !== s) throw new Error(`bad issue ${i.rid}`);
      folded.set(`${i.location}|${r}`, s);
    }
    const fatihaMarker = markerText.get(5); // the Hafs marker slot of 1:1
    if (!fatihaMarker) throw new Error('no marker slot at 1:1:5');
    let used = 0;

    for (let k = 0; k < slots.length; k++) {
      // a span: two slots one rewayah writes as one word (its second blank)
      const next = slots[k + 1];
      const twoSlots =
        next !== undefined &&
        next.verseKey === slots[k].verseKey &&
        next.id === slots[k].id + 1 &&
        OTHERS.some(
          r =>
            slots[k].words[r] !== '' &&
            next.words[r] === '' &&
            !NOT_READ[next.location]?.includes(r),
        );
      const span = twoSlots ? [slots[k], next] : [slots[k]];
      const where = span.map(s => s.location).join('+');
      const last = span[span.length - 1];
      const after = last.id + 1;
      const hafsEnds = markerText.has(after);
      const member = (r: ReadingsRewayah) => {
        const parts: string[] = [];
        const chars: number[] = [];
        let offset = 0;
        let inline: number | null = null;
        let tinted = false;
        for (const s of span) {
          if (r !== 'hafs' && tint[r].has(s.location)) tinted = true;
          inline = s.inline[r] ?? inline;
          if (!s.words[r]) continue;
          const silahHere = r === 'hafs' ? undefined : silah[r].get(s.location);
          for (const c of silahHere ?? []) chars.push(offset + c);
          parts.push(s.words[r]);
          offset += s.words[r].length + 1;
        }
        const text = parts.join(' ');
        let verseEnd: number | null = null;
        if (r !== 'hafs' && text) {
          const marker = markerText.get(after)?.[r] ?? '';
          const ends = inline !== null || (hafsEnds && marker !== '');
          if (ends && !hafsEnds) verseEnd = inline;
          else if (hafsEnds && !ends) verseEnd = 0;
        }
        const foldedInto =
          span.map(s => folded.get(`${s.location}|${r}`)).find(Boolean) ?? null;
        return {text, chars, tinted, verseEnd, foldedInto};
      };
      const m = Object.fromEntries(
        READINGS_REWAYAT.map(r => [r, member(r)]),
      ) as Record<ReadingsRewayah, ReturnType<typeof member>>;
      const hafsWords = m.hafs.text.split(' ').length;

      const row = rowById.get(span[0].id);
      if (twoSlots && rowById.get(span[1].id)?.data !== row?.data) {
        fail(where, 'the two slots of a span have different rows');
      }
      if (!row) {
        for (const r of OTHERS) {
          const x = m[r];
          if (x.tinted || x.chars.length || !x.text || x.verseEnd !== null) {
            fail(where, `${r}: no row, but tinted / silah / blank / verse end`);
          }
          if (x.text && x.text.split(' ').length !== hafsWords) {
            fail(where, `${r}: no row, but another word count`);
          }
        }
        if (span[0].verseKey === '1:1' || twoSlots) {
          fail(where, 'no row for the basmala or a two-slot word');
        }
        k += span.length - 1;
        continue;
      }
      used += span.length;
      const readings: WordReadings = decodeReadingsRow(
        row.verse_key,
        row.position,
        row.word_id,
        row.data,
      );
      if (
        readings.positions.join() !== span.map(s => s.position).join() ||
        readings.verseKey !== span[0].verseKey
      ) {
        fail(where, `positions ${readings.positions}`);
      }
      const kindOf = new Map(
        readings.groups.flatMap(g => g.members.map(x => [x.rewayah, g.kind])),
      );
      const expectedKind = (r: ReadingsRewayah) => {
        const e = m[r];
        if (r === 'hafs') return 'asHafs';
        if (!e.text) return 'notRead';
        if (e.foldedInto) return kindOf.get(e.foldedInto);
        return e.tinted ? 'differs' : 'asHafs';
      };
      for (const g of readings.groups) {
        const firstOwn = g.members.find(x => !x.questioned);
        if (g.kind === 'asHafs' && g.text !== m.hafs.text) {
          fail(where, "Hafs's group text is not Hafs's");
        }
        if (
          g.kind === 'differs' &&
          (!firstOwn || g.text !== m[firstOwn.rewayah].text)
        ) {
          fail(where, "a differing text is not its first member's");
        }
        if (g.kind === 'notRead' && g.text !== '') {
          fail(where, 'a not-read group with text');
        }
        for (const x of g.members) {
          const e = m[x.rewayah];
          const want = expectedKind(x.rewayah);
          if (g.kind !== want) {
            fail(where, `${x.rewayah} in ${g.kind}, not ${want}`);
          }
          if (
            e.text === '' &&
            !NOT_READ[span[0].location]?.includes(x.rewayah)
          ) {
            fail(
              where,
              `${x.rewayah}: blank but not a declared Hafs-only word`,
            );
          }
          if (
            e.foldedInto &&
            !g.members.some(y => y.rewayah === e.foldedInto)
          ) {
            fail(where, `${x.rewayah}: a misprint not read with its sibling`);
          }
          if (x.questioned !== Boolean(e.foldedInto)) {
            fail(where, `${x.rewayah}: questioned ${x.questioned}`);
          }
          const shows =
            x.rewayah !== 'hafs' &&
            g.kind !== 'notRead' &&
            !e.foldedInto &&
            (e.chars.length > 0 || (g.kind === 'differs' && e.text !== g.text));
          if (x.ownText !== (shows ? e.text : null)) {
            fail(where, `${x.rewayah}: own text ${x.ownText}`);
          }
          if (x.silahChars.join() !== (shows ? e.chars : []).join()) {
            fail(where, `${x.rewayah}: silah ${x.silahChars}`);
          }
          if (e.foldedInto && e.chars.length) {
            fail(where, `${x.rewayah}: a misprint with silah`);
          }
          if (x.verseEnd !== e.verseEnd) {
            fail(
              where,
              `${x.rewayah}: verse end ${x.verseEnd}, not ${e.verseEnd}`,
            );
          }
          const count = e.text ? e.text.split(' ').length : 0;
          const wantCount =
            g.kind === 'asHafs' && x.rewayah !== 'hafs' && count !== hafsWords
              ? count
              : null;
          if (x.wordCount !== wantCount) {
            fail(where, `${x.rewayah}: word count ${x.wordCount}`);
          }
          const category =
            g.kind === 'differs' && x.rewayah !== 'hafs'
              ? WHOLE_WORD_CATEGORY[x.rewayah]
              : null;
          if (x.category !== category) fail(where, `${x.rewayah}: category`);
        }
      }
      const basmala =
        span[0].verseKey === '1:1'
          ? OTHERS.filter(r => fatihaMarker[r] === '')
          : [];
      if (readings.basmalaUnnumberedIn.join() !== basmala.join()) {
        fail(where, `basmala ${readings.basmalaUnnumberedIn}`);
      }
      k += span.length - 1;
    }
    expect(errors).toEqual([]);
    expect(used).toBe(indexRows.length); // every row belongs to a slot read here
  });

  it('word-by-word positions differ from the DK positions exactly at WBW_JOINED_WORDS, which have no rows', () => {
    const wbw = query(
      path.join(REPO, 'data/wbw/wbw-en.db'),
      'SELECT verse_key, position, text_uthmani FROM words ORDER BY verse_key, position',
    );
    const byVerse = (
      entries: readonly [string, number, string][],
    ): Map<string, Map<number, string>> => {
      const out = new Map<string, Map<number, string>>();
      for (const [verseKey, position, text] of entries) {
        const verse = out.get(verseKey) ?? new Map<number, string>();
        verse.set(position, text);
        out.set(verseKey, verse);
      }
      return out;
    };
    const wbwByVerse = byVerse(
      wbw.map(w => [
        String(w.verse_key),
        Number(w.position),
        String(w.text_uthmani ?? ''),
      ]),
    );
    const dkByVerse = byVerse(
      slots.map(s => [s.verseKey, s.position, s.words.hafs]),
    );
    // letters only (tatweel, marks and a few seat / alef forms aside), so
    // the two encodings of the same word compare equal
    const CANON: Record<number, string> = {
      0x0671: 'ا',
      0x0622: 'ا',
      0x0623: 'ا',
      0x0625: 'ا',
      0x0649: 'ي',
      0x0626: 'ي',
      0x0624: 'و',
      0x0670: '',
    };
    const letters = (t: string) =>
      [...t]
        .map(c => {
          const code = c.charCodeAt(0);
          if (code in CANON) return CANON[code];
          return code >= 0x0621 && code <= 0x064a && code !== 0x0640 ? c : '';
        })
        .join('');

    const joined: string[] = [];
    let compared = 0;
    let mismatched = 0;
    for (const [verseKey, dk] of dkByVerse) {
      const w = wbwByVerse.get(verseKey) ?? new Map();
      const extra = dk.size - w.size;
      if (extra !== 0) joined.push(`${verseKey}:${extra}`);
      const covered: number[] = [];
      let verseMismatches = 0;
      for (const [position, text] of w) {
        const dkPositions = dkPositionsForWbwWord(verseKey, position);
        covered.push(...dkPositions);
        const dkText = dkPositions.map(p => dk.get(p) ?? '').join('');
        compared += 1;
        if (letters(dkText) !== letters(text)) {
          mismatched += 1;
          verseMismatches += 1;
        }
      }
      // a shifted position would mismatch every later word of the verse
      expect(verseMismatches).toBeLessThanOrEqual(2);
      expect(covered).toEqual([...dk.keys()].sort((a, b) => a - b));
    }
    expect(joined.sort()).toEqual(
      Object.keys(WBW_JOINED_WORDS)
        .map(k => `${k}:1`)
        .sort(),
    );
    // a few words differ in spelling or carry damaged characters in wbw-en.db
    expect(mismatched / compared).toBeLessThan(0.001);

    const rowIds = new Set(indexRows.map(r => r.word_id));
    for (const [verseKey, position] of Object.entries(WBW_JOINED_WORDS)) {
      for (const p of dkPositionsForWbwWord(verseKey, position)) {
        const slot = slots.find(
          s => s.verseKey === verseKey && s.position === p,
        );
        expect(slot).toBeDefined();
        expect(rowIds.has(slot?.id ?? -1)).toBe(false);
      }
    }
  });
});
