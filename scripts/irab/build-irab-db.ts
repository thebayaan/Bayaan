/**
 * Builds assets/data/irab-v1.db: word-level i'rab for the whole Quran plus
 * two classical i'rab books per verse.
 *
 *   npx tsx scripts/irab/build-irab-db.ts \
 *     --treebank <Quranic.csv> --books <dir> [--out assets/data/irab-v1.db]
 *
 * --treebank  corpus/Quranic.csv extracted from corpus/Quranic.rar of
 *             github.com/NoorBayan/Quranic at TREEBANK_COMMIT (UTF-16 TSV).
 * --masaq     MASAQ.tsv (https://data.mendeley.com/datasets/9yvrzxktmr/5,
 *             SHA-256 checked) for the independent cross-check.
 * --books     a directory holding e3rab-book-309.json(.gz) (al-Ukbari,
 *             al-Tibyan) and e3rab-book-318.json(.gz) (al-Nahhas) from
 *             https://quranpedia.net/dumps.
 *
 * Gates (the build fails on any of them):
 *  - every word of data/wbw/wbw-en.db (77,429 words, 6,236 verses) has
 *    treebank tokens whose letters match the word exactly, and vice versa;
 *  - every word has at least one i'rab entry;
 *  - no book passage contains markup, links or script after cleaning.
 *
 * The app never shows treebank or book Quran spellings as Quran text: word
 * references are `{{s:a:w}}` placeholders the app fills from its own words.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import {countStems, stemFacts, type MorphFact} from './sarf';
import {applyConstraints} from './constraints';
import {
  roleCases,
  sentenceEntries,
  type IrabEntry,
  type StemInfo,
  type TreebankToken,
  type WordEntries,
} from './irabText';
import {
  alignVerse,
  crossCheck,
  MASAQ_SHA256,
  readMasaq,
  signAgrees,
  type MasaqWord,
} from './masaq';

export const TREEBANK_COMMIT = 'e791af79b8e4f853610da455b87442cedec49118';
export const DB_VERSION = 1;

/** Entry kinds as stored (see services/irab/irabFormat.ts). */
export const KIND_CODE: Record<IrabEntry['kind'], string> = {
  prefix: 'p',
  stem: 's',
  suffix: 'x',
  implied: 'i',
  phrase: 'h',
  alt: 'a',
};

const BOOKS = [
  {
    id: 309,
    nameAr: 'التبيان في إعراب القرآن',
    authorAr: 'أبو البقاء العكبري (ت ٦١٦هـ)',
  },
  {id: 318, nameAr: 'إعراب القرآن', authorAr: 'أبو جعفر النحاس (ت ٣٣٨هـ)'},
];

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

/**
 * The letters that decide a word: no harakat, Quranic marks, tatweel or
 * hamza. Hamza is left out because the two sources spell its seat
 * differently (standalone ء vs hamza above a tatweel); every other letter
 * must match in order. Alif wasla and alif with madda (NFD) count as alif.
 */
export function skeleton(text: string): string {
  return text
    .normalize('NFD')
    .replace(
      // The class lists combining marks on purpose: they are what is removed.
      // eslint-disable-next-line no-misleading-character-class
      /[\u064B-\u065F\u0670\u06D6-\u06EDـ\u08F0-\u08F2\u200C\u200D\u0621]/g,
      '',
    )
    .replace(/ٱ/g, 'ا')
    .replace(/[\s\u200E\u200F]+/g, '');
}

/**
 * Words whose letters differ between the two sources although they are the
 * same word at the same position (checked by hand). The treebank's text is
 * never displayed, so only the position matters.
 */
export const REVIEWED_SPELLING_DIFFERENCES: Record<string, string> = {
  '11:13:3': 'ىٰ in the treebank, ا in the app (افتراه)',
  '12:39:1': 'the treebank seats the dagger alif on ى (يصىحبى)',
  '12:41:1': 'the treebank seats the dagger alif on ى (يصىحبى)',
  '12:101:14':
    "the treebank's suffix token text is garbled (وليّي); split وليّ + ي",
};

/**
 * Same letters. The app's wbw-en.db has a few words with a damaged character
 * (U+FFFD); there each damaged run may stand for at most one letter, and every
 * other letter must still match in order.
 */
export function sameLetters(treebank: string, app: string): boolean {
  const a = skeleton(treebank);
  const b = skeleton(app);
  if (!b.includes('\uFFFD')) return a === b;
  const pattern = b
    .split(/\uFFFD+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.?');
  return new RegExp(`^${pattern}$`, 'u').test(a);
}

function parseTreebank(file: string): Map<number, TreebankToken[]> {
  const buf = fs.readFileSync(file);
  const text =
    buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString('utf16le').slice(1)
      : buf.toString('utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split('\t');
  const col = (n: string) => {
    const i = header.indexOf(n);
    if (i < 0) throw new Error(`treebank column missing: ${n}`);
    return i;
  };
  const C = Object.fromEntries(
    [
      'sentence_id',
      'token_id',
      'location',
      'uthmani_token',
      'pos',
      'segment',
      'lemma',
      'prefix',
      'suffix',
      'verb_aspect',
      'verb_mood',
      'nominal_case',
      'special_group',
      'derived_nouns',
      'verb_voice',
      'pgn',
      'features',
      'rel_label',
      'ref_token_id',
      'is_constituent',
      'constituents_loc',
      'constituent_label',
      'verb_form',
      'lemma_ar',
      'nominal_state',
    ].map(n => [n, col(n)]),
  ) as Record<string, number>;
  const v = (row: string[], n: string) => {
    const s = (row[C[n]] ?? '').trim();
    return s === '_' ? '' : s;
  };

  const sentences = new Map<number, TreebankToken[]>();
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split('\t');
    if (row.length !== header.length) {
      throw new Error(
        `treebank row ${i + 1}: ${row.length} columns, expected ${header.length}`,
      );
    }
    const locM = /^\((\d+):(\d+):(\d+):(\d+)\)$/.exec(v(row, 'location'));
    const consM = /^\[(\d+)-(\d+)\]$/.exec(v(row, 'constituents_loc'));
    const mood = v(row, 'verb_mood').replace('MOOD:', '');
    const tok: TreebankToken = {
      id: Number(v(row, 'token_id')),
      loc: locM
        ? {surah: +locM[1], ayah: +locM[2], word: +locM[3], token: +locM[4]}
        : null,
      uthmani: v(row, 'uthmani_token'),
      treebankText: v(row, 'uthmani_token'),
      pos: v(row, 'pos'),
      segment: (v(row, 'segment') as TreebankToken['segment']) || '',
      lemma: v(row, 'lemma'),
      root: /ROOT:([^|]+)/.exec(v(row, 'features'))?.[1] ?? '',
      prefix: v(row, 'prefix'),
      suffix: v(row, 'suffix'),
      aspect: (v(row, 'verb_aspect') as TreebankToken['aspect']) || '',
      mood: (['IND', 'SUBJ', 'JUS'].includes(mood)
        ? mood
        : '') as TreebankToken['mood'],
      case: (v(row, 'nominal_case') as TreebankToken['case']) || '',
      special: v(row, 'special_group'),
      derived: v(row, 'derived_nouns'),
      voice: (v(row, 'verb_voice') as TreebankToken['voice']) || '',
      pgn: v(row, 'pgn'),
      verbForm: v(row, 'verb_form'),
      lemmaAr: v(row, 'lemma_ar').replace(/^ـ$/, ''),
      indef: v(row, 'nominal_state') === 'INDEF',
      features: v(row, 'features'),
      rel: v(row, 'rel_label'),
      head: Number(v(row, 'ref_token_id')),
      isConstituent: v(row, 'is_constituent') === '1',
      constituentFrom: consM ? +consM[1] : null,
      constituentTo: consM ? +consM[2] : null,
      constituentLabel: v(row, 'constituent_label').replace('-', ''),
    };
    const sid = Number(v(row, 'sentence_id'));
    const list = sentences.get(sid) ?? [];
    list.push(tok);
    sentences.set(sid, list);
  }
  return sentences;
}

/**
 * Narrow, rule-based corrections of treebank relations that cannot be right.
 * A verb (clause) can never be joined by a conjunction to a relative pronoun
 * itself: such a verb is the relative clause (صلة). Example: 1:7 أَنْعَمْتَ,
 * labelled conj → ٱلَّذِينَ. Returns the fixed locations.
 */
/**
 * Words where the treebank leaves out the ياء المتكلم that it splits off
 * everywhere else (12:93 أَبِى، 19:42 لِأَبِيهِ). Each is checked to have the
 * expected shape, so a changed treebank stops the build instead of being
 * silently patched.
 */
export const MISSING_YA_MUTAKALLIM = ['26:86:2'];

export function fixSegmentation(
  sentences: Map<number, TreebankToken[]>,
): string[] {
  const fixed: string[] = [];
  const wanted = new Set(MISSING_YA_MUTAKALLIM);
  for (const tokens of sentences.values()) {
    for (const t of [...tokens]) {
      if (!t.loc || t.segment !== 'STEM') continue;
      const k = `${t.loc.surah}:${t.loc.ayah}:${t.loc.word}`;
      if (!wanted.has(k)) continue;
      const word = tokens.filter(
        x => x.loc && `${x.loc.surah}:${x.loc.ayah}:${x.loc.word}` === k,
      );
      const m = /^(.*?)(ى[\u0653\u0670]?)$/.exec(t.uthmani);
      if (
        t.pos !== 'N' ||
        word.some(x => x.pos === 'PRON') ||
        !m ||
        !/ى$/.test(t.treebankText)
      ) {
        throw new Error(`${k}: unexpected shape for the ياء المتكلم fix`);
      }
      const ya: TreebankToken = {
        ...t,
        id: Math.max(...tokens.map(x => x.id)) + 1,
        loc: {...t.loc, token: t.loc.token + 1},
        uthmani: m[2],
        treebankText: 'ى',
        pos: 'PRON',
        segment: 'SUFFIX',
        lemma: '',
        root: '',
        suffix: 'PRON',
        case: 'GEN',
        derived: '',
        pgn: '1S',
        features: 'SUFFIX|PRON:1S',
        rel: 'Poss',
        head: t.id,
        isConstituent: false,
        constituentFrom: null,
        constituentTo: null,
        constituentLabel: '',
        verbForm: '',
        lemmaAr: '',
        indef: false,
      };
      t.uthmani = m[1];
      t.treebankText = t.treebankText.replace(/ى$/, '');
      tokens.splice(tokens.indexOf(t) + 1, 0, ya);
      fixed.push(k);
      wanted.delete(k);
    }
  }
  if (wanted.size)
    throw new Error(`segmentation fix not applied: ${[...wanted].join(', ')}`);
  return fixed;
}

export function fixRelations(
  sentences: Map<number, TreebankToken[]>,
): string[] {
  const fixed: string[] = [];
  for (const tokens of sentences.values()) {
    const byId = new Map(tokens.map(t => [t.id, t]));
    for (const t of tokens) {
      const head = byId.get(t.head);
      if (
        t.pos === 'V' &&
        t.rel.replace(/\s+/g, '') === 'conj' &&
        head?.pos === 'REL'
      ) {
        t.rel = 'sub';
        if (t.loc) fixed.push(`${t.loc.surah}:${t.loc.ayah}:${t.loc.word}`);
      }
    }
  }
  return fixed;
}

/** Letters counted by skeleton(): what is left after it strips. */
function counted(ch: string): number {
  return skeleton(ch).length;
}

/**
 * The treebank's token text drops vowels on many words (يخْش for يَخْشَ),
 * so endings are read from the app's own fully vowelled word instead: the
 * word's letters are dealt to the word's tokens by each token's letter
 * count, every mark staying with the letter before it. Analysis only: this
 * text is never displayed. Words whose letters do not split cleanly keep the
 * treebank's text.
 */
export function projectVowels(
  sentences: Map<number, TreebankToken[]>,
  appText: Map<string, string>,
): {done: number; kept: number} {
  const byWord = new Map<string, TreebankToken[]>();
  for (const tokens of sentences.values()) {
    for (const t of tokens) {
      if (!t.loc) continue;
      const k = `${t.loc.surah}:${t.loc.ayah}:${t.loc.word}`;
      byWord.set(k, [...(byWord.get(k) ?? []), t]);
    }
  }
  let done = 0;
  let kept = 0;
  for (const [k, toks] of byWord) {
    const text = appText.get(k);
    toks.sort((a, b) => a.loc!.token - b.loc!.token);
    const need = toks.map(t => skeleton(t.treebankText).length);
    const chars = [
      ...(text ?? '').normalize('NFC').replace(/[\s\u200E\u200F]+/g, ''),
    ];
    const total = chars.reduce((n, ch) => n + counted(ch), 0);
    if (
      !text ||
      text.includes('\uFFFD') ||
      total !== need.reduce((a, b) => a + b, 0)
    ) {
      kept++;
      continue;
    }
    const parts: string[] = toks.map(() => '');
    let ti = 0;
    let have = 0;
    for (const ch of chars) {
      const n = counted(ch);
      // Move on once this token has its letters and a new letter starts.
      while (n > 0 && ti < toks.length - 1 && have >= need[ti]) {
        ti++;
        have = 0;
      }
      parts[ti] += ch;
      have += n;
    }
    toks.forEach((t, i) => {
      if (parts[i]) t.uthmani = parts[i];
    });
    done++;
  }
  return {done, kept};
}

function readJson(dir: string, base: string): any {
  const gz = path.join(dir, `${base}.json.gz`);
  const plain = path.join(dir, `${base}.json`);
  if (fs.existsSync(plain)) return JSON.parse(fs.readFileSync(plain, 'utf8'));
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(gz)).toString('utf8'));
}

/** Book HTML → plain paragraphs (the app renders text, never HTML). */
export function cleanBookHtml(html: string): string {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|tr|table|h\d)\s*>/gi, '\n')
    .replace(/<\/\s*td\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '‹')
    .replace(/&gt;/g, '›')
    .replace(/&amp;/g, '&')
    .replace(/[ \t\u00A0]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
  if (/[<>]|https?:|javascript:|www\./i.test(text)) {
    throw new Error(
      `book passage still has markup or a link: ${text.slice(0, 120)}`,
    );
  }
  return text;
}

function main(): void {
  const root = path.resolve(__dirname, '../..');
  const treebankFile = arg('treebank');
  const booksDir = arg('books');
  const masaqFile = arg('masaq');
  const out = path.resolve(
    arg('out', path.join(root, 'assets/data/irab-v1.db')),
  );
  const wbwFile = path.join(root, 'data/wbw/wbw-en.db');

  const wbw = new Database(wbwFile, {readonly: true});
  const appWords = wbw
    .prepare('SELECT verse_key, position, text_uthmani FROM words ORDER BY id')
    .all() as {verse_key: string; position: number; text_uthmani: string}[];
  wbw.close();
  const appText = new Map(
    appWords.map(w => [`${w.verse_key}:${w.position}`, w.text_uthmani]),
  );

  // 1. Treebank → entries per word.
  const sentences = parseTreebank(treebankFile);
  const vowelled = projectVowels(sentences, appText);
  console.log(
    `vowels read from the app's words for ${vowelled.done} words (${vowelled.kept} kept the treebank's)`,
  );
  const fixed = fixRelations(sentences);
  console.log(`relation fixes: ${fixed.join(', ') || 'none'}`);
  const segFixed = fixSegmentation(sentences);
  console.log(`ياء المتكلم split off: ${segFixed.join(', ')}`);

  // MASAQ, read up front: it settles contradictory case labels below and
  // cross-checks the result after.
  const masaqHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(masaqFile))
    .digest('hex');
  if (masaqHash !== MASAQ_SHA256)
    throw new Error(`MASAQ.tsv SHA-256 ${masaqHash} is not the reviewed file`);
  const masaq = readMasaq(masaqFile);
  const byVerse = new Map<string, typeof appWords>();
  for (const w of appWords)
    byVerse.set(w.verse_key, [...(byVerse.get(w.verse_key) ?? []), w]);
  const masaqWord = new Map<string, MasaqWord>();
  let unaligned = 0;
  for (const [vk, words] of byVerse) {
    const mWords = masaq.get(vk) ?? [];
    const pairs = alignVerse(
      words.map(w => w.text_uthmani),
      mWords.map(m => m.word),
      skeleton,
    );
    words.forEach((w, i) => {
      const mi = pairs[i];
      if (mi === null) unaligned++;
      else masaqWord.set(`${vk}:${w.position}`, mWords[mi]);
    });
  }

  // Labels that break a hard rule of grammar, settled with MASAQ.
  const constraintFixes = applyConstraints(sentences, k =>
    masaqWord.get(k)?.segments.find(x => x.type === 'Stem'),
  );
  for (const [name, list] of Object.entries(constraintFixes)) {
    console.log(`constraint ${name}: ${list.length} fixed`);
  }

  // A treebank case label that contradicts the token's own role (مضاف إليه
  // labelled nominative ...) is replaced by the role's case when MASAQ,
  // independently, gives that case too.
  const caseFixes: string[] = [];
  const CASE_OF: Record<string, string> = {
    NOMINATIVE: 'NOM',
    ACCUSATIVE: 'ACC',
    GENITIVE: 'GEN',
  };
  for (const tokens of sentences.values()) {
    const rc = roleCases(tokens);
    for (const t of tokens) {
      const want = rc.get(t.id);
      if (!t.loc || !t.case || !want || t.case === want) continue;
      const k = `${t.loc.surah}:${t.loc.ayah}:${t.loc.word}`;
      const m = masaqWord
        .get(k)
        ?.segments.find(x => x.type === 'Stem' && CASE_OF[x.caseMood]);
      if (m && CASE_OF[m.caseMood] === want) {
        caseFixes.push(`${k} ${t.case}→${want}`);
        t.case = want;
      }
    }
  }
  console.log(`case labels settled by role + MASAQ: ${caseFixes.length}`);
  const entries: WordEntries = new Map();
  const stems: StemInfo = new Map();
  const tbWords = new Map<string, string>(); // s:a:w → concatenated tokens
  for (const tokens of sentences.values()) {
    for (const t of tokens) {
      if (!t.loc) continue;
      const k = `${t.loc.surah}:${t.loc.ayah}:${t.loc.word}`;
      tbWords.set(k, (tbWords.get(k) ?? '') + t.treebankText);
    }
    sentenceEntries(tokens, entries, stems);
  }

  // Morphology (الصرف) of each word's main stem.
  const counts = countStems(sentences.values());
  const morph = new Map<string, MorphFact[]>();
  for (const tokens of sentences.values()) {
    const byWord = new Map<string, TreebankToken[]>();
    for (const t of tokens) {
      if (!t.loc) continue;
      const k = `${t.loc.surah}:${t.loc.ayah}:${t.loc.word}`;
      byWord.set(k, [...(byWord.get(k) ?? []), t]);
    }
    for (const [k, word] of byWord) {
      const own = stems.get(k)?.stem;
      const stem =
        own && word.includes(own) ? own : word.find(t => t.segment === 'STEM');
      if (stem) morph.set(k, stemFacts(stem, {tokens, word}, counts));
    }
  }
  console.log(`morphology for ${morph.size} words`);

  // 2. Alignment gate against the app's own word list.
  const problems: string[] = [];
  const corrupted: string[] = [];
  const appKeys = new Set<string>();
  for (const w of appWords) {
    const k = `${w.verse_key}:${w.position}`;
    appKeys.add(k);
    const tb = tbWords.get(k);
    if (tb === undefined) problems.push(`${k}: no treebank tokens`);
    else if (
      !sameLetters(tb, w.text_uthmani) &&
      !(k in REVIEWED_SPELLING_DIFFERENCES)
    )
      problems.push(
        `${k}: treebank "${skeleton(tb)}" ≠ app "${skeleton(w.text_uthmani)}"`,
      );
    if (w.text_uthmani.includes('\uFFFD')) corrupted.push(k);
    if (!entries.get(k)?.length) problems.push(`${k}: no i'rab entry`);
    if (!morph.get(k)?.length) problems.push(`${k}: no morphology`);
  }
  for (const k of tbWords.keys()) {
    if (!appKeys.has(k)) problems.push(`${k}: treebank word not in the app`);
  }
  if (appWords.length !== 77429)
    problems.push(`app has ${appWords.length} words, expected 77429`);
  if (problems.length) {
    console.error(problems.slice(0, 50).join('\n'));
    throw new Error(`alignment gate failed: ${problems.length} problem(s)`);
  }
  console.log(`alignment gate: ${appWords.length} words match the treebank`);
  if (corrupted.length) {
    console.warn(
      `note: ${corrupted.length} app words have U+FFFD in wbw-en.db text_uthmani ` +
        `(matched letter-for-letter around the damage): ${corrupted.join(', ')}`,
    );
  }

  // 3. Independent cross-check against MASAQ.
  const agreed = new Set<string>();
  let compared = 0;
  let alternatives = 0;
  let signCompared = 0;
  const signDiffers: string[] = [];
  for (const [vk, words] of byVerse) {
    words.forEach(w => {
      const k = `${vk}:${w.position}`;
      const mw = masaqWord.get(k);
      if (!mw) return;
      const info = stems.get(k);
      const res = crossCheck(info?.stem, info?.roleKey ?? null, mw, skeleton);
      // A case sign MASAQ does not confirm is left out: the line keeps the
      // case both agree on ("منصوب") without naming its sign.
      const signed = entries
        .get(k)!
        .find(e => e.kind === 'stem' && /وعلامة/.test(e.text));
      if (signed) {
        const ok = signAgrees(signed.text, mw);
        if (ok !== null) signCompared++;
        if (ok === false) {
          signDiffers.push(
            `${k}\t${w.text_uthmani}\t${signed.text}\t${mw.segments
              .map(x => x.marker)
              .filter(Boolean)
              .join(',')}`,
          );
          // The whole sign clause, with its «منع من ظهورها ...» tail.
          signed.text = signed.text.replace(
            / وعلامة [^،]*(، منع من ظهورها[^،]*)?/,
            '',
          );
        }
      }
      if (res.compared) compared++;
      if (res.agree) agreed.add(k);
      if (res.extra.length) {
        alternatives += res.extra.length;
        const list = entries.get(k)!;
        const at = list.findIndex(e => e.kind === 'stem');
        list.splice(at < 0 ? list.length : at + 1, 0, ...res.extra);
      }
    });
  }
  console.log(
    `MASAQ sign check: ${signCompared} compared, ${signDiffers.length} differ`,
  );
  if (process.env.IRAB_REPORT)
    fs.writeFileSync(process.env.IRAB_REPORT, signDiffers.join('\n'));
  console.log(
    `MASAQ cross-check: ${compared} words compared, ${agreed.size} agree ` +
      `(${((agreed.size / compared) * 100).toFixed(1)}%), ${alternatives} other readings added, ` +
      `${unaligned} words not aligned`,
  );

  // 4. Write the database.
  if (fs.existsSync(out)) fs.unlinkSync(out);
  const db = new Database(out);
  db.pragma('journal_mode = DELETE');
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE texts (id INTEGER PRIMARY KEY, text TEXT NOT NULL);
    CREATE TABLE word_irab (
      verse_key TEXT NOT NULL,
      position INTEGER NOT NULL,
      entries TEXT NOT NULL,
      agreed INTEGER NOT NULL,
      morph TEXT NOT NULL,
      PRIMARY KEY (verse_key, position)
    ) WITHOUT ROWID;
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      name_ar TEXT NOT NULL,
      author_ar TEXT NOT NULL
    );
    CREATE TABLE passages (
      id INTEGER PRIMARY KEY,
      book_id INTEGER NOT NULL,
      part TEXT,
      page TEXT,
      text TEXT NOT NULL
    );
    CREATE TABLE verse_passages (
      book_id INTEGER NOT NULL,
      verse_key TEXT NOT NULL,
      ord INTEGER NOT NULL,
      passage_id INTEGER NOT NULL,
      PRIMARY KEY (book_id, verse_key, ord)
    ) WITHOUT ROWID;
  `);
  const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
  meta.run('version', String(DB_VERSION));
  meta.run(
    'treebank',
    `https://github.com/NoorBayan/Quranic@${TREEBANK_COMMIT}`,
  );
  meta.run(
    'treebank_license',
    'MIT; morphology from the Quranic Arabic Corpus (GNU GPL), https://corpus.quran.com',
  );
  meta.run('books_source', 'https://quranpedia.net/dumps');
  meta.run(
    'masaq',
    `https://data.mendeley.com/datasets/9yvrzxktmr/5 (CC BY 4.0) sha256:${MASAQ_SHA256}`,
  );
  meta.run('relation_fixes', fixed.join(', '));
  meta.run('segmentation_fixes', segFixed.join(', '));
  meta.run('case_fixes', String(caseFixes.length));
  for (const [name, list] of Object.entries(constraintFixes)) {
    meta.run(`constraint_${name}`, list.join(', '));
  }

  // Entries are stored as [kind, label id, text id, span from, span to] with
  // the ~5k distinct texts in one table; a reference to a word of the same
  // verse is written {{w}} (its position) so the texts repeat.
  const insText = db.prepare('INSERT INTO texts VALUES (?, ?)');
  const textIds = new Map<string, number>();
  const textId = (text: string) => {
    // Output gate: Arabic prose and word references only.
    if (/[A-Za-z<>\uFFFD]/.test(text.replace(/\{\{[\d:]+\}\}/g, ''))) {
      throw new Error(`non-Arabic text in output: ${text}`);
    }
    let id = textIds.get(text);
    if (id === undefined) {
      id = textIds.size;
      textIds.set(text, id);
      insText.run(id, text);
    }
    return id;
  };
  const insWord = db.prepare('INSERT INTO word_irab VALUES (?, ?, ?, ?, ?)');
  db.transaction(() => {
    textId('');
    for (const w of appWords) {
      const k = `${w.verse_key}:${w.position}`;
      const own = `${w.verse_key}:`;
      const local = (text: string) =>
        text.replace(/\{\{(\d+:\d+):(\d+)\}\}/g, (m, vk, pos) =>
          `${vk}:` === own ? `{{${pos}}}` : m,
        );
      const encoded = entries.get(k)!.map(e => {
        const row: (string | number)[] = [
          KIND_CODE[e.kind],
          textId(e.label),
          textId(local(e.text)),
        ];
        if (e.span) row.push(e.span[0], e.span[1]);
        return row;
      });
      const facts = morph
        .get(k)!
        .map(([label, value]) => [textId(label), textId(local(value))]);
      insWord.run(
        w.verse_key,
        w.position,
        JSON.stringify(encoded),
        agreed.has(k) ? 1 : 0,
        JSON.stringify(facts),
      );
    }
  })();
  console.log(`${textIds.size} distinct i'rab texts`);

  const insBook = db.prepare('INSERT INTO books VALUES (?, ?, ?)');
  const insPassage = db.prepare('INSERT INTO passages VALUES (?, ?, ?, ?, ?)');
  const insVerse = db.prepare('INSERT INTO verse_passages VALUES (?, ?, ?, ?)');
  let passageId = 0;
  db.transaction(() => {
    for (const book of BOOKS) {
      const json = readJson(booksDir, `e3rab-book-${book.id}`);
      if (json.book?.id !== book.id)
        throw new Error(`book ${book.id}: unexpected file`);
      insBook.run(book.id, book.nameAr, book.authorAr);
      meta.run(`book_${book.id}_version`, String(json.license?.version ?? ''));
      const ids = new Map<string, number>();
      let verses = 0;
      for (const a of json.ayahs as {
        surah: number;
        ayah: number;
        content: {text: string; part: string; page: string}[];
      }[]) {
        const vk = `${a.surah}:${a.ayah}`;
        let ord = 0;
        for (const c of a.content) {
          const text = cleanBookHtml(c.text);
          if (!text) continue;
          let id = ids.get(text);
          if (id === undefined) {
            id = ++passageId;
            ids.set(text, id);
            insPassage.run(
              id,
              book.id,
              String(c.part ?? ''),
              String(c.page ?? ''),
              text,
            );
          }
          insVerse.run(book.id, vk, ord++, id);
        }
        if (ord) verses++;
      }
      console.log(`book ${book.id}: ${verses} verses, ${ids.size} passages`);
    }
  })();
  db.exec('VACUUM');
  db.close();
  const size = fs.statSync(out).size;
  console.log(
    `wrote ${path.relative(root, out)} (${(size / 1e6).toFixed(1)} MB)`,
  );
}

if (require.main === module) main();
