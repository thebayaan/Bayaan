// @ai-generated
/**
 * Gharib (Arabic word meanings): reading gharib books and placing each
 * entry's headword on the app's words. Build-time only; the design is
 * docs/plans/2026-11-14-word-study/04-gharib-rasm.md §1, with the decisions
 * of README.md in that folder.
 *
 * A headword is compared with every run of 1 to n+2 consecutive words of its
 * verse (n: the headword's word count), spaces ignored. The first tier that
 * gives a candidate wins:
 *  1. matchKey, each word read plene or as written (ٱلصَّلَوٰةَ = الصلاة,
 *     ذَٰلِكَ = ذلك);
 *  2. hamzaKey: no alif of length, every hamza one ء (ٱلْكِتَـٰبُ = الكتاب,
 *     شَيْـًٔا = شيئا; the design's "every ا removed", with the hamza seats
 *     unified so that أثمر stays apart from ثمر);
 *  3. tier-2 keys after one proclitic and/or one enclitic, on either side
 *     (a ta marbuta is never taken off as the pronoun ه);
 *  4. looseKey, at least 3 letters, one match in the verse only.
 * Then tiers 1-3 in a verse up to 3 before or after (moved), then none.
 * Only tiers 1-3 (and hand placements) go on words. Tier 4 and moved entries
 * keep their match as an unshown candidate and stay at verse level, like
 * entries that match nothing (README: not shown in v1).
 */
import {
  ENCLITICS,
  hamzaKey,
  looseKey,
  matchKey,
  plainKey,
  plene,
  PROCLITICS,
} from './arabic';
import type {AppWord} from './rasm';

// ---------------------------------------------------------------------------
// Input.

/** One entry of a gharib book, as every adapter gives it. */
export interface GharibInput {
  surah: number;
  ayah: number;
  sourceId: number;
  /** The entry's order inside its book (file order). */
  ord: number;
  headword: string;
  gloss: string;
  note?: string;
  part?: string;
  page?: string;
}

export const MEANINGS_SCHEMA = '/v1/ayah/{surah}/{ayah}/meanings';

interface MeaningsDump {
  license?: {version?: string};
  schema?: string;
  data?: {
    surah: number;
    ayah: number;
    meanings: {
      book_info: {id: number};
      words: {text: string; meaning: string}[];
    }[];
  }[];
}

/**
 * Quranpedia's ayah-service dump «غريب القرآن — معاني كلمات كلِّ آية»
 * (meanings.json.gz): entries already split per verse. Keeps the given
 * books only and numbers `ord` per book in file order. Texts come back as
 * written; cleanGloss runs later.
 */
export function readQuranpediaMeanings(
  json: unknown,
  bookIds: readonly number[],
): {entries: GharibInput[]; version: string} {
  const dump = json as MeaningsDump;
  if (dump?.schema !== MEANINGS_SCHEMA || !Array.isArray(dump.data)) {
    throw new Error(
      `meanings dump: schema "${String(
        dump?.schema,
      )}", expected "${MEANINGS_SCHEMA}"`,
    );
  }
  const keep = new Set(bookIds);
  const ords = new Map<number, number>();
  const entries: GharibInput[] = [];
  for (const verse of dump.data) {
    for (const book of verse.meanings ?? []) {
      const id = book.book_info?.id;
      if (!keep.has(id)) continue;
      for (const word of book.words ?? []) {
        const ord = (ords.get(id) ?? 0) + 1;
        ords.set(id, ord);
        entries.push({
          surah: verse.surah,
          ayah: verse.ayah,
          sourceId: id,
          ord,
          headword: word.text,
          gloss: word.meaning,
        });
      }
    }
  }
  for (const id of bookIds) {
    if (!ords.has(id)) throw new Error(`meanings dump: book ${id} not found`);
  }
  return {entries, version: String(dump.license?.version ?? '')};
}

/** Splits one book passage (HTML) into its headwords and glosses (HTML). */
export type GharibSplitter = (
  html: string,
) => {headword: string; gloss: string}[];

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Per-book splitters of Quranpedia book passages, keyed by book id. Each
 * reads the book's own headword marker:
 *  - 27760 al-Sijistani, Nuzhat al-Qulub: <span class="book-ayah …">﴿…﴾</span>
 *  - 341 Ibn Qutaybah, Gharib al-Qur'an: «12- (headword) gloss»
 *  - 27784 Ibn al-Ha'im: "headword" gloss
 *  - 2013: «headword: gloss<br>»
 * No book passages are locked yet (README: one book, from the meanings
 * dump); these are ready for a later source.
 */
export const GHARIB_SPLITTERS: Readonly<Record<number, GharibSplitter>> = {
  27760: html =>
    splitAt(
      html,
      /<span[^>]*class="[^"]*book-ayah[^"]*"[^>]*>\s*﴿([^﴾]*)﴾\s*<\/span>/g,
    ),
  341: html => splitAt(html, /(?:^|<br\s*\/?>|\s)\d+\s*-\s*\(([^)]*)\)/g),
  27784: html => splitAt(html, /"([^"]+)"/g),
  2013: html =>
    html
      .split(/<br\s*\/?>/i)
      .map(line => /^([^:]{1,80}):\s*(.+)$/s.exec(stripTags(line)))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => ({headword: m[1].trim(), gloss: m[2].trim()})),
};

/** Entries from headword markers: each gloss runs to the next marker. */
function splitAt(
  html: string,
  marker: RegExp,
): {headword: string; gloss: string}[] {
  const found = [...html.matchAll(marker)];
  return found
    .map((m, i) => {
      const from = (m.index ?? 0) + m[0].length;
      const next = found[i + 1];
      const to = next?.index ?? html.length;
      return {headword: stripTags(m[1]), gloss: html.slice(from, to).trim()};
    })
    .filter(e => e.headword && stripTags(e.gloss));
}

interface BookDump {
  book?: {id?: number};
  license?: {version?: string};
  ayahs?: {
    surah: number;
    ayah: number;
    content: {text: string; part?: string; page?: string}[];
  }[];
}

/**
 * A Quranpedia book dump (tafsir-book-<id>.json.gz, the shape
 * scripts/irab/build-irab-db.ts reads): passages split by the book's
 * splitter on the HTML, then each gloss cleaned to plain text by `clean`
 * (cleanBookHtml of the i'rab build).
 */
export function readQuranpediaBook(
  json: unknown,
  bookId: number,
  clean: (html: string) => string,
): {entries: GharibInput[]; version: string} {
  const dump = json as BookDump;
  if (dump?.book?.id !== bookId || !Array.isArray(dump.ayahs)) {
    throw new Error(`book dump: not book ${bookId}`);
  }
  const split = GHARIB_SPLITTERS[bookId];
  if (!split) throw new Error(`book ${bookId}: no splitter`);
  const entries: GharibInput[] = [];
  for (const verse of dump.ayahs) {
    for (const passage of verse.content) {
      for (const {headword, gloss} of split(passage.text)) {
        entries.push({
          surah: verse.surah,
          ayah: verse.ayah,
          sourceId: bookId,
          ord: entries.length + 1,
          headword,
          gloss: clean(gloss),
          part: String(passage.part ?? ''),
          page: String(passage.page ?? ''),
        });
      }
    }
  }
  return {entries, version: String(dump.license?.version ?? '')};
}

/**
 * One entry per line: {"s":2,"a":2,"source":<id>,"headword":"…","gloss":"…",
 * "note":"","part":"","page":""}. For sources converted by a one-off script.
 */
export function readJsonl(text: string): GharibInput[] {
  const ords = new Map<number, number>();
  return text
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map((line, i) => {
      const r = JSON.parse(line) as Record<string, unknown>;
      const surah = Number(r.s);
      const ayah = Number(r.a);
      const sourceId = Number(r.source);
      if (
        !Number.isInteger(surah) ||
        !Number.isInteger(ayah) ||
        !Number.isInteger(sourceId) ||
        typeof r.headword !== 'string' ||
        typeof r.gloss !== 'string'
      ) {
        throw new Error(
          `jsonl line ${i + 1}: needs s, a, source, headword, gloss`,
        );
      }
      const ord = (ords.get(sourceId) ?? 0) + 1;
      ords.set(sourceId, ord);
      return {
        surah,
        ayah,
        sourceId,
        ord,
        headword: r.headword,
        gloss: r.gloss,
        note: typeof r.note === 'string' ? r.note : '',
        part: typeof r.part === 'string' ? r.part : '',
        page: typeof r.page === 'string' ? r.page : '',
      };
    });
}

/**
 * A gloss as the app shows it: the editor's bracketed insertions ([…],
 * README) and footnote markers («7», a trailing «.27،») removed, spaces
 * collapsed, no space before punctuation, one after it. The book's own
 * words are not changed.
 */
export function cleanGloss(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/«\s*\d+\s*»/g, ' ')
    .replace(/([.،])\s*\d+\s*،?\s*$/, '$1')
    .replace(/\s+/g, ' ')
    .replace(/ +([.،:؛؟!»)])/g, '$1')
    .replace(/([«(]) +/g, '$1')
    .replace(/([.،:؛؟!])(?=[ء-ي])/g, '$1 ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** A headword as stored: spaces collapsed. */
export function cleanHeadword(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Why a cleaned text cannot be stored, or null: markup, a link, Latin
 * letters, digits (a footnote marker left over) or U+FFFD.
 */
export function textProblem(text: string): string | null {
  if (/[<>]/.test(text)) return 'markup';
  if (/https?:|www\./i.test(text)) return 'link';
  if (/[A-Za-z]/.test(text)) return 'Latin letters';
  if (/[0-9٠-٩۰-۹]/.test(text)) return 'digits';
  if (text.includes('�')) return 'U+FFFD';
  if (/[[\]]/.test(text)) return 'a bracket';
  return null;
}

// ---------------------------------------------------------------------------
// Placement.

export type GharibTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface Placement {
  input: GharibInput;
  /** Where the entry is stored: its own verse, or a hand placement's. */
  verseKey: string;
  /** Words the entry is shown on; null: verse level. */
  span: [number, number] | null;
  /** 0 none, 1-3 matched, 4 loose, 5 hand-placed (gharib-reviewed.json). */
  tier: GharibTier;
  /** Matched (tiers 1-3) only in a neighbouring verse. */
  moved: boolean;
  /** An unshown match, "s:a:w1-w2" (tier 4 or moved); '' when none. */
  candidate: string;
  /** The winning tier gave more than one span. */
  ambiguous: boolean;
}

export interface GharibReviewed {
  __format: 1;
  /**
   * "<sourceId> <s:a> <matchKey(headword)>" → a span "s:a:w1-w2" (tier 5),
   * or verseLevel.
   */
  entries: Record<string, {span: string} | {verseLevel: true}>;
}

export function readGharibReviewed(json: string): GharibReviewed {
  const data = JSON.parse(json) as Partial<GharibReviewed>;
  if (
    data.__format !== 1 ||
    !data.entries ||
    typeof data.entries !== 'object'
  ) {
    throw new Error(
      'gharib-reviewed.json: expected {"__format":1,"entries":{…}}',
    );
  }
  for (const [key, value] of Object.entries(data.entries)) {
    if (!/^\d+ \d+:\d+ \S+$/.test(key)) {
      throw new Error(`gharib-reviewed.json: bad key "${key}"`);
    }
    const ok =
      ('span' in value && /^\d+:\d+:\d+-\d+$/.test(value.span)) ||
      ('verseLevel' in value && value.verseLevel === true);
    if (!ok) throw new Error(`gharib-reviewed.json: bad value for "${key}"`);
  }
  return data as GharibReviewed;
}

export function reviewedKey(input: GharibInput): string {
  return `${input.sourceId} ${input.surah}:${input.ayah} ${matchKey(
    input.headword,
  )}`;
}

const PRO3 = [...new Set(PROCLITICS.map(p => hamzaKey(p)))];
const ENC3 = [...new Set(ENCLITICS.map(e => hamzaKey(e)))];

/**
 * A tier-3 key's variants with one proclitic and/or one enclitic off (stems
 * of 2+ letters), each with the number of clitics taken off.
 */
function cliticVariants(key: string): Map<string, number> {
  const out = new Map<string, number>([[key, 0]]);
  const add = (v: string, n: number) => {
    if (v.length >= 2 && (out.get(v) ?? Infinity) > n) out.set(v, n);
  };
  const starts: [string, number][] = [
    [key, 0],
    ...PRO3.filter(p => key.startsWith(p)).map(
      p => [key.slice(p.length), 1] as [string, number],
    ),
  ];
  for (const [s, n] of starts) {
    add(s, n);
    for (const e of ENC3) {
      if (s.endsWith(e)) add(s.slice(0, s.length - e.length), n + 1);
    }
  }
  return out;
}

/** Keys of one app word per tier, read plene and as written. */
interface WordKeys {
  /** Tier 1: matchKey and plainKey. */
  t1: [string, string];
  /** Tier 2: hamzaKey. */
  t2: [string, string];
  /**
   * Tier 3: hamzaKey with ة read as ت, so that a ta marbuta is never taken
   * off as the pronoun ه.
   */
  t3: [string, string];
}

/** A tier-3 key: hamzaKey with ة read as ت. */
function tier3Key(text: string, script: 'uthmani' | 'imlaei'): string {
  return hamzaKey(text.replace(/ة/g, 'ت'), script);
}

/** Can `target` be spelled by the words, each read plene or as written? */
function spells(target: string, keys: readonly [string, string][]): boolean {
  let at = new Set<number>([0]);
  for (const pair of keys) {
    const next = new Set<number>();
    for (const p of at) {
      for (const v of pair) {
        if (target.startsWith(v, p)) next.add(p + v.length);
      }
    }
    if (!next.size) return false;
    at = next;
  }
  return at.has(target.length);
}

/**
 * Candidate spans (1-based positions) of a headword in a verse at one tier:
 * the best-scored ones. Fewer clitics taken off (tier 3) score better, then
 * a word count closer to the headword's (لا تَسْقِي ٱلْحَرْثَ keeps its لا).
 */
function candidates(
  headword: string,
  words: readonly AppWord[],
  keys: readonly WordKeys[],
  tier: 1 | 2 | 3 | 4,
): [number, number][] {
  const n = headword.split(' ').filter(Boolean).length;
  const head1 = matchKey(headword);
  const head2 = hamzaKey(headword);
  const head3 = cliticVariants(tier3Key(headword, 'imlaei'));
  const head4 = looseKey(headword);
  if (!head1 || (tier === 4 && head4.length < 3)) return [];
  const found: {span: [number, number]; score: number}[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= n + 2 && i + len <= words.length; len++) {
      const run = keys.slice(i, i + len);
      let strips = Infinity;
      if (tier === 1) {
        if (
          spells(
            head1,
            run.map(w => w.t1),
          )
        )
          strips = 0;
      } else if (tier === 2) {
        if (
          head2 &&
          spells(
            head2,
            run.map(w => w.t2),
          )
        )
          strips = 0;
      } else if (tier === 3) {
        for (const pick of [0, 1]) {
          const spell = run.map(w => w.t3[pick]).join('');
          for (const [v, s] of cliticVariants(spell)) {
            const h = head3.get(v);
            if (h !== undefined) strips = Math.min(strips, h + s);
          }
        }
      } else {
        const text = words
          .slice(i, i + len)
          .map(w => w.text)
          .join(' ');
        if (looseKey(text) === head4) strips = 0;
      }
      if (strips === Infinity) continue;
      found.push({
        span: [words[i].position, words[i + len - 1].position],
        score: strips * 100 + Math.abs(len - n),
      });
    }
  }
  const best = Math.min(...found.map(f => f.score));
  return found.filter(f => f.score === best).map(f => f.span);
}

function wordKeys(words: readonly AppWord[]): WordKeys[] {
  return words.map(w => {
    const full = plene(w.text);
    return {
      t1: [matchKey(w.text), plainKey(w.text)],
      t2: [hamzaKey(full, 'uthmani'), hamzaKey(w.text, 'uthmani')],
      t3: [tier3Key(full, 'uthmani'), tier3Key(w.text, 'uthmani')],
    };
  });
}

/**
 * Places every entry on the app's words (see the file comment). Entries
 * are processed per verse in book order; when the winning tier gives
 * several spans, the first one starting after the previous placed entry of
 * the same source in that verse wins, else the first.
 */
export function placeAll(
  entries: readonly GharibInput[],
  verses: ReadonlyMap<string, readonly AppWord[]>,
  reviewed: GharibReviewed,
): Placement[] {
  const keyCache = new Map<string, WordKeys[]>();
  const keysOf = (vk: string) => {
    let k = keyCache.get(vk);
    if (!k) {
      k = wordKeys(verses.get(vk) ?? []);
      keyCache.set(vk, k);
    }
    return k;
  };
  const lastStart = new Map<string, number>();
  const sorted = [...entries].sort(
    (a, b) =>
      a.surah - b.surah ||
      a.ayah - b.ayah ||
      a.sourceId - b.sourceId ||
      a.ord - b.ord,
  );
  const out: Placement[] = [];
  for (const input of sorted) {
    const verseKey = `${input.surah}:${input.ayah}`;
    const words = verses.get(verseKey);
    if (!words) throw new Error(`gharib: no verse ${verseKey} in the app`);
    const placement: Placement = {
      input,
      verseKey,
      span: null,
      tier: 0,
      moved: false,
      candidate: '',
      ambiguous: false,
    };
    const hand = reviewed.entries[reviewedKey(input)];
    const prevKey = `${verseKey} ${input.sourceId}`;
    if (hand) {
      placement.tier = 5;
      const m =
        'span' in hand ? /^(\d+:\d+):(\d+)-(\d+)$/.exec(hand.span) : null;
      if (m) {
        placement.verseKey = m[1];
        placement.span = [Number(m[2]), Number(m[3])];
      }
    } else {
      placeInVerse(placement, words, keysOf(verseKey), lastStart.get(prevKey));
      if (!placement.span && !placement.candidate) {
        placeNearby(placement, verses, keysOf);
      }
    }
    if (placement.span && placement.verseKey === verseKey) {
      lastStart.set(prevKey, placement.span[0]);
    }
    out.push(placement);
  }
  return out;
}

function placeInVerse(
  p: Placement,
  words: readonly AppWord[],
  keys: readonly WordKeys[],
  prevStart: number | undefined,
): void {
  for (const tier of [1, 2, 3, 4] as const) {
    const found = candidates(p.input.headword, words, keys, tier);
    if (tier === 4 && found.length !== 1) continue;
    if (!found.length) continue;
    const after =
      prevStart === undefined ? undefined : found.find(([a]) => a > prevStart);
    const span = after ?? found[0];
    p.tier = tier;
    p.ambiguous = found.length > 1;
    if (tier === 4) p.candidate = `${p.verseKey}:${span[0]}-${span[1]}`;
    else p.span = span;
    return;
  }
}

function placeNearby(
  p: Placement,
  verses: ReadonlyMap<string, readonly AppWord[]>,
  keysOf: (verseKey: string) => WordKeys[],
): void {
  const {surah, ayah} = p.input;
  for (let d = 1; d <= 3; d++) {
    for (const a of [ayah - d, ayah + d]) {
      const vk = `${surah}:${a}`;
      const words = verses.get(vk);
      if (!words) continue;
      for (const tier of [1, 2, 3] as const) {
        const found = candidates(p.input.headword, words, keysOf(vk), tier);
        if (!found.length) continue;
        p.tier = tier;
        p.moved = true;
        p.ambiguous = found.length > 1;
        p.candidate = `${vk}:${found[0][0]}-${found[0][1]}`;
        return;
      }
    }
  }
}
