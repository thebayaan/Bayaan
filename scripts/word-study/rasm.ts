// @ai-generated
/**
 * Rasm notes: how the mushaf's spelling of a word differs from a standard
 * (imla'i) spelling, named with the classical terms. Build-time only; the
 * design is docs/plans/2026-11-14-word-study/04-gharib-rasm.md §2, with the
 * decisions of README.md in that folder.
 *
 *  1. Pair. readTanzil reads the standard text. mapTanzilVerse gives every
 *     app word its standard tokens by fixed merge rules and checks that both
 *     sides have the same skeleton (looseKey). groupVerse, a dynamic
 *     programme that knows none of the rules, must find the same pairing.
 *  2. Diff. diffGroup aligns the two spellings letter by letter, counting the
 *     mushaf's small signs (ٰ, ۥ ۦ ۧ ۨ, a hamza with no seat) as letters of
 *     their own, and names each difference: hadhf, ziyada, badal, hamz, and
 *     wasl or fasl for the word division.
 *  3. Trust. A note is shown only when the mushaf's own signs confirm it, a
 *     named pattern rule covers it, or rasm-reviewed.json lists it. Every
 *     other note is stored but hidden (basis 'unconfirmed').
 */
import {
  looseKey,
  rasmLetters,
  searchKey,
  type RasmHint,
  type Script,
} from './arabic';
import {
  RASM_KIND_CODE,
  type RasmBasis,
  type RasmKind,
  type RasmNote,
} from '../../services/wordStudy/wordStudyFormat';

// ---------------------------------------------------------------------------
// 1. Reading and pairing.

export interface TanzilText {
  /** "s:a" → the verse's tokens, verbatim, without the basmala of N:1. */
  verses: Map<string, string[]>;
  /** The copyright block (the lines starting with #), verbatim. */
  notice: string;
  /** Verses whose opening basmala was dropped. */
  basmalaDropped: number;
}

const BASMALA_KEY = looseKey('بسم الله الرحمن الرحيم');

/** Pause, sajdah and hizb signs that Tanzil can add as tokens of their own. */
const PAUSE_SIGNS = /[ۖ-ۜ۞۩]/g;

/**
 * Reads a Tanzil text download, "sura|aya|text" lines plus a # copyright
 * block. The txt formats put the basmala before verse 1 of every surah but
 * 1 (where it is the verse) and 9 (which has none): it is dropped, found by
 * its skeleton because 95 and 97 write بِّسْمِ. Pause signs are dropped (the
 * pinned download has none).
 */
export function readTanzil(text: string): TanzilText {
  const verses = new Map<string, string[]>();
  const notice: string[] = [];
  let basmalaDropped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#')) {
      notice.push(line);
      continue;
    }
    if (!line.trim()) continue;
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
    if (!m) throw new Error(`Tanzil: unreadable line "${line.slice(0, 60)}"`);
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
    let tokens = m[3].replace(PAUSE_SIGNS, '').split(/\s+/).filter(Boolean);
    if (ayah === 1 && surah !== 1 && surah !== 9) {
      if (looseKey(tokens.slice(0, 4).join(' ')) !== BASMALA_KEY) {
        throw new Error(`Tanzil ${surah}:1 does not open with the basmala`);
      }
      tokens = tokens.slice(4);
      basmalaDropped++;
    }
    const key = `${surah}:${ayah}`;
    if (verses.has(key)) throw new Error(`Tanzil: verse ${key} twice`);
    verses.set(key, tokens);
  }
  return {verses, notice: notice.join('\n'), basmalaDropped};
}

/**
 * Reads a word-level standard text, {"s:a:w": "…"}, into tokens per verse
 * in word order. A slot may hold several words («يَا أَيُّهَا»): pair such a
 * source with groupVerse, which splits slots on spaces.
 */
export function readWordJson(json: string): Map<string, string[]> {
  const data = JSON.parse(json) as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('word JSON: expected an object of "s:a:w" keys');
  }
  const byVerse = new Map<string, [number, string][]>();
  for (const [key, value] of Object.entries(data)) {
    const m = /^(\d+):(\d+):(\d+)$/.exec(key);
    if (!m || typeof value !== 'string') {
      throw new Error(`word JSON: bad entry ${key}`);
    }
    const verseKey = `${m[1]}:${m[2]}`;
    const list = byVerse.get(verseKey) ?? [];
    list.push([Number(m[3]), value]);
    byVerse.set(verseKey, list);
  }
  const out = new Map<string, string[]>();
  for (const [verseKey, list] of byVerse) {
    list.sort((a, b) => a[0] - b[0]);
    out.set(
      verseKey,
      list.map(([, text]) => text),
    );
  }
  return out;
}

/** One app word, as the build reads it (damaged text already replaced). */
export interface AppWord {
  position: number;
  text: string;
}

/** A unit: app words and the standard tokens that spell them. */
export interface WordGroup {
  verseKey: string;
  /** First and last app position of the unit. */
  from: number;
  to: number;
  /** The app's Uthmani text of the unit (words joined by a space). */
  uthmani: string;
  /** The unit's standard tokens, verbatim. */
  standard: string[];
}

/**
 * App positions whose text holds two written words, so they take two
 * standard tokens: بَعْدَ مَا (one position in the app, two words in the
 * mushaf and in Tanzil 1.1) and إِلْ يَاسِينَ.
 */
export const TWO_WORD_POSITIONS: readonly string[] = [
  '2:181:3',
  '8:6:4',
  '13:37:8',
  '37:130:3',
];

/**
 * App words with a stray space inside one written word (wbw-en.db has
 * «دَآئِرَ ةٌۭ»; the mushaf, as Digital Khatt has it, writes one word).
 */
export const STRAY_SPACE_POSITIONS: readonly string[] = ['5:52:12'];

/**
 * Token counts that the general rule (one token, two after a vocative
 * يا/ها) does not give.
 */
export const TOKEN_COUNTS: Readonly<Record<string, number>> = {
  // يَبْنَؤُمَّ = يَا ابْنَ أُمَّ
  '20:94:2': 3,
  // وَأَلَّوِ = وَأَن لَّوِ: the mushaf joins أن and لو.
  '72:16:1': 2,
  ...Object.fromEntries(TWO_WORD_POSITIONS.map(key => [key, 2])),
};

/**
 * A vocative يا (also وَيَا) or the ها of attention, written apart in the
 * standard spelling and joined to the next word in the mushaf.
 */
export function isVocativeToken(token: string): boolean {
  const key = searchKey(token);
  return key === 'يا' || key === 'ويا' || key === 'ها';
}

/** The app's text of a word as the build compares it. */
export function appWordText(key: string, text: string): string {
  return STRAY_SPACE_POSITIONS.includes(key)
    ? text.replace(/ (?=\S*[ء-ي])/, '')
    : text;
}

/**
 * Gives each app word of a verse its Tanzil tokens: a vocative يا or ها
 * joins the next token, TOKEN_COUNTS covers the rest, and every word
 * otherwise takes one token. Each pair must have the same skeleton
 * (looseKey) and every token must be used; anything else is a problem.
 */
export function mapTanzilVerse(
  verseKey: string,
  words: readonly AppWord[],
  tokens: readonly string[],
): {groups: WordGroup[]; problems: string[]} {
  const groups: WordGroup[] = [];
  const problems: string[] = [];
  let t = 0;
  for (const word of words) {
    const key = `${verseKey}:${word.position}`;
    const count =
      TOKEN_COUNTS[key] ?? (isVocativeToken(tokens[t] ?? '') ? 2 : 1);
    const standard = tokens.slice(t, t + count);
    t += count;
    const uthmani = appWordText(key, word.text);
    if (standard.length < count) {
      problems.push(`${key}: no standard token left for «${uthmani}»`);
    } else if (looseKey(uthmani) !== looseKey(standard.join(' '))) {
      problems.push(
        `${key}: «${uthmani}» ≠ «${standard.join(' ')}» (${looseKey(
          uthmani,
        )} / ${looseKey(standard.join(' '))})`,
      );
    }
    groups.push({
      verseKey,
      from: word.position,
      to: word.position,
      uthmani,
      standard,
    });
  }
  if (t < tokens.length) {
    problems.push(
      `${verseKey}: ${tokens.length - t} standard token(s) left over: ${tokens
        .slice(t)
        .join(' ')}`,
    );
  }
  return {groups, problems};
}

/** Group shapes groupVerse may use: [mushaf words, standard tokens]. */
const SHAPES: readonly [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
];

/** One group of groupVerse: index ranges, first..last, 0-based. */
export interface VerseGrouping {
  mushaf: [number, number];
  standard: [number, number];
}

/**
 * Pairs a verse's mushaf words with standard tokens, knowing none of the
 * merge rules: 1:1, 1:2, 1:3, 2:1 and 2:2 groups whose skeletons (looseKey)
 * are equal, with as few groups other than 1:1 as possible. Standard slots
 * are split on spaces first (a word-level source may hold «يَا أَيُّهَا» in
 * one slot); the standard ranges index the split tokens. null: the verse
 * cannot be paired.
 */
export function groupVerse(
  uthmani: readonly string[],
  standard: readonly string[],
): VerseGrouping[] | null {
  const tokens = standard.flatMap(s => s.split(/\s+/).filter(Boolean));
  const n = uthmani.length;
  const m = tokens.length;
  const best: number[][] = Array.from({length: n + 1}, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  const back: ([number, number] | null)[][] = Array.from({length: n + 1}, () =>
    new Array<[number, number] | null>(m + 1).fill(null),
  );
  best[0][0] = 0;
  const keyCache = new Map<string, string>();
  const key = (list: readonly string[], from: number, count: number) => {
    const text = list.slice(from, from + count).join(' ');
    let k = keyCache.get(text);
    if (k === undefined) {
      k = looseKey(text);
      keyCache.set(text, k);
    }
    return k;
  };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (best[i][j] === Infinity) continue;
      for (const [a, b] of SHAPES) {
        if (i + a > n || j + b > m) continue;
        const cost = best[i][j] + (a === 1 && b === 1 ? 0 : 1);
        if (cost >= best[i + a][j + b]) continue;
        if (key(uthmani, i, a) !== key(tokens, j, b)) continue;
        best[i + a][j + b] = cost;
        back[i + a][j + b] = [a, b];
      }
    }
  }
  if (best[n][m] === Infinity) return null;
  const groups: VerseGrouping[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const shape = back[i][j];
    if (!shape) throw new Error('groupVerse: no path');
    const [a, b] = shape;
    groups.push({mushaf: [i - a, i - 1], standard: [j - b, j - 1]});
    i -= a;
    j -= b;
  }
  return groups.reverse();
}

// ---------------------------------------------------------------------------
// 2. Diff.

/** A derived note, with the reason for its basis (for the report). */
export interface DerivedNote extends RasmNote {
  /** The rule that confirms it, or what makes it worth a look. */
  why: string;
}

/** Display letters a note may hold, so the UI never draws a kashida form. */
export const NOTE_LETTERS = new Set([
  'ا',
  'و',
  'ى',
  'ي',
  'ء',
  'أ',
  'إ',
  'آ',
  'ؤ',
  'ئ',
  'ة',
  'ت',
  'س',
  'ص',
  'ن',
  'ل',
]);

/** The named pattern rules (see RasmBasis 'rule'). */
export const PATTERN_RULES = [
  // ٱلَّيْل, ٱلَّـٰتِى, ٱلَّذَانِ: the article's ل merges into the next ل.
  'lamAssimilated',
  // فَآءُو, جَآءُو, سَعَوْ: no alif after the plural و.
  'alifAfterWawJama',
  // يُحْىِ, يَسْتَحْىِ: one ي written for two.
  'doubleYa',
  // يَـٰٓأَيُّهَا, يَـٰقَوْمِ, هَـٰٓأَنتُمْ: a vocative يا or the ها of
  // attention is joined to the next word and loses its alif.
  'vocativeJoined',
] as const;
export type PatternRule = (typeof PATTERN_RULES)[number];

/** A letter or a sign standing for one, on one side of the comparison. */
interface Item {
  /** The letter compared (ا و ي ن ل …), or ء for a hamza with no seat. */
  base: string;
  raw: string;
  /** A small sign (ٰ, ۥ ۦ ۧ ۨ) or a hamza with no seat, not a letter. */
  virtual: boolean;
  /** A seat letter carrying a hamza. */
  hamza: boolean;
  zaid: boolean;
  hint: RasmHint | null;
  start: number;
  end: number;
  word: number;
}

function items(text: string, script: Script): Item[] {
  const {letters, gaps} = rasmLetters(text, script);
  const out: Item[] = [];
  for (let i = 0; i <= letters.length; i++) {
    for (const g of gaps[i]) {
      out.push({
        base: g.kind === 'hamza' ? 'ء' : g.letter,
        raw: g.letter,
        virtual: true,
        hamza: false,
        zaid: false,
        hint: null,
        start: g.start,
        end: g.end,
        word: g.word,
      });
    }
    if (i === letters.length) break;
    const l = letters[i];
    const item: Item = {
      base: l.base,
      raw: l.raw,
      virtual: false,
      hamza: l.hamza,
      zaid: l.zaid,
      hint: l.hint,
      start: l.start,
      end: l.end,
      word: l.word,
    };
    if (script === 'imlaei' && l.raw === 'آ') {
      // The standard آ is a hamza followed by an alif (ءا in the mushaf).
      out.push({...item, base: 'ء', virtual: true, hamza: false});
      out.push({...item, hamza: false});
    } else {
      out.push(item);
    }
  }
  return out;
}

/** Badal pairs [standard, mushaf] with the sign that confirms them. */
const BADAL: readonly [string, string, RasmHint | null][] = [
  ['ا', 'و', 'wawAlif'],
  ['ا', 'ي', 'yaAlif'],
  ['س', 'ص', 'seen'],
  ['ة', 'ت', null],
  ['ن', 'ا', null],
];

function badalSign(s: Item, m: Item): RasmHint | null | undefined {
  for (const [std, mus, hint] of BADAL) {
    if (s.base === std && m.base === mus) return hint;
    if (s.base === mus && m.base === std) return null;
  }
  return undefined;
}

/** How a standard letter reads in a note: its base, ى/ي as written. */
function stdLetter(s: Item): string {
  return s.base === 'ي' ? (s.raw === 'ى' ? 'ى' : 'ي') : s.base;
}
function musLetter(m: Item): string {
  return m.base === 'ي' ? (m.raw === 'ى' || m.raw === 'ئ' ? 'ى' : 'ي') : m.base;
}

interface Draft {
  kind: RasmKind;
  standard: string;
  mushaf: string;
  basis: RasmBasis;
  /** The standard item to highlight. */
  mark: Item | null;
  why: string;
}

interface Edit {
  /** Cost in tenths. */
  cost: number;
  draft: Draft | null;
}

const NO_EDIT: Edit = {cost: Infinity, draft: null};

/**
 * The cost and the note of one alignment step. m: the mushaf item (null:
 * the standard item is missing from the mushaf); s: the standard item
 * (null: the mushaf item is missing from the standard spelling). Costs are
 * in tenths; a step the mushaf's own signs explain is cheap, so the
 * alignment follows them.
 */
function edit(m: Item | null, s: Item | null): Edit {
  if (m && s) {
    if (m.virtual && s.virtual) {
      return m.base === s.base ? {cost: 0, draft: null} : NO_EDIT;
    }
    if (m.virtual) {
      // A small sign or a seatless hamza in the mushaf for a letter.
      if (m.base === 'ء') {
        return s.hamza
          ? {cost: 3, draft: hamz(s.raw, 'ء', 'sign', s, 'hamza')}
          : NO_EDIT;
      }
      if (m.base !== s.base) return NO_EDIT;
      if (s.hamza) {
        return {
          cost: 6,
          draft: hamz(
            s.raw,
            '',
            'unconfirmed',
            s,
            'small sign for a hamza seat',
          ),
        };
      }
      return {
        cost: 1,
        draft: {
          kind: 'hadhf',
          standard: stdLetter(s),
          mushaf: '',
          basis: 'sign',
          mark: s,
          why: 'small letter',
        },
      };
    }
    if (s.virtual) {
      if (s.base === 'ء') {
        return m.hamza
          ? {cost: 3, draft: hamz(stdHamza(s), m.raw, 'sign', s, 'hamza')}
          : NO_EDIT;
      }
      // The standard writes small (ٰ) what the mushaf writes in full.
      return m.base === s.base ? {cost: 1, draft: null} : NO_EDIT;
    }
    if (m.base === s.base) {
      if (m.hamza === s.hamza) return {cost: 0, draft: null};
      return {
        cost: 5,
        draft: hamz(s.raw, m.raw, 'unconfirmed', s, 'hamza on one side only'),
      };
    }
    if (m.hamza && s.hamza) {
      return {cost: 3, draft: hamz(s.raw, m.raw, 'sign', s, 'hamza seat')};
    }
    if (m.hamza || s.hamza) {
      return {
        cost: 9,
        draft: hamz(s.raw, m.raw, 'unconfirmed', s, 'hamza on one side only'),
      };
    }
    const sign = badalSign(s, m);
    const draft: Draft = {
      kind: 'badal',
      standard: stdLetter(s),
      mushaf: musLetter(m),
      basis: 'unconfirmed',
      mark: s,
      why: sign === undefined ? 'unknown substitution' : 'no sign',
    };
    if (sign && m.hint === sign) {
      return {cost: 1, draft: {...draft, basis: 'sign', why: 'sign'}};
    }
    return {cost: sign === undefined ? 12 : 6, draft};
  }
  if (s) {
    // In the standard spelling, not in the mushaf.
    if (s.virtual) {
      return s.base === 'ء'
        ? {
            cost: 8,
            draft: hamz(stdHamza(s), '', 'unconfirmed', s, 'hamza missing'),
          }
        : {cost: 5, draft: null};
    }
    if (s.hamza) {
      return {
        cost: 8,
        draft: hamz(s.raw, '', 'unconfirmed', s, 'hamza missing'),
      };
    }
    return {
      cost: 10,
      draft: {
        kind: 'hadhf',
        standard: stdLetter(s),
        mushaf: '',
        basis: 'unconfirmed',
        mark: s,
        why: 'no small letter',
      },
    };
  }
  if (m) {
    // In the mushaf, not in the standard spelling.
    if (m.virtual) {
      return m.base === 'ء'
        ? {cost: 8, draft: hamz('', 'ء', 'unconfirmed', null, 'extra hamza')}
        : {cost: 5, draft: null};
    }
    if (m.hamza) {
      return {
        cost: 8,
        draft: hamz('', m.raw, 'unconfirmed', null, 'extra hamza seat'),
      };
    }
    return {
      cost: m.zaid ? 7 : 10,
      draft: {
        kind: 'ziyada',
        standard: '',
        mushaf: musLetter(m),
        basis: m.zaid ? 'sign' : 'unconfirmed',
        mark: null,
        why: m.zaid ? 'sign' : 'no ۟',
      },
    };
  }
  return NO_EDIT;
}

/** A standard hamza with no seat as a note shows it: ء, or آ when it is one. */
function stdHamza(s: Item): string {
  return s.raw === 'آ' ? 'آ' : 'ء';
}

function hamz(
  standard: string,
  mushaf: string,
  basis: RasmBasis,
  mark: Item | null,
  why: string,
): Draft {
  return {kind: 'hamz', standard, mushaf, basis, mark, why};
}

type Op = 'sub' | 'del' | 'ins';

/** One step of the alignment: m and s index the items (-1 for none). */
interface Step {
  op: Op;
  m: number;
  s: number;
  draft: Draft | null;
}

function align(mus: Item[], std: Item[]): Step[] {
  const n = mus.length;
  const k = std.length;
  const best: number[][] = Array.from({length: n + 1}, () =>
    new Array<number>(k + 1).fill(Infinity),
  );
  const back: (Op | null)[][] = Array.from({length: n + 1}, () =>
    new Array<Op | null>(k + 1).fill(null),
  );
  best[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= k; j++) {
      if (i === 0 && j === 0) continue;
      // On a tie the diagonal wins, then a deletion: walking back from the
      // end this keeps the later letters paired (ٱلَّيْلِ loses the
      // article's ل, not the first letter of ليل).
      let cost = Infinity;
      let op: Op | null = null;
      if (i > 0 && j > 0) {
        const c = best[i - 1][j - 1] + edit(mus[i - 1], std[j - 1]).cost;
        if (c < cost) [cost, op] = [c, 'sub'];
      }
      if (j > 0) {
        const c = best[i][j - 1] + edit(null, std[j - 1]).cost;
        if (c < cost) [cost, op] = [c, 'del'];
      }
      if (i > 0) {
        const c = best[i - 1][j] + edit(mus[i - 1], null).cost;
        if (c < cost) [cost, op] = [c, 'ins'];
      }
      best[i][j] = cost;
      back[i][j] = op;
    }
  }
  const steps: Step[] = [];
  let i = n;
  let j = k;
  while (i > 0 || j > 0) {
    const op = back[i][j];
    if (op === 'sub') {
      steps.push({
        op,
        m: i - 1,
        s: j - 1,
        draft: edit(mus[i - 1], std[j - 1]).draft,
      });
      i--;
      j--;
    } else if (op === 'del') {
      steps.push({op, m: -1, s: j - 1, draft: edit(null, std[j - 1]).draft});
      j--;
    } else if (op === 'ins') {
      steps.push({op, m: i - 1, s: -1, draft: edit(mus[i - 1], null).draft});
      i--;
    } else {
      throw new Error('rasm alignment: no path');
    }
  }
  return steps.reverse();
}

/** The result of comparing one unit. */
export interface UnitDiff {
  notes: DerivedNote[];
  /** Small signs the alignment could not pair (report only). */
  unpaired: string[];
}

/**
 * Compares a unit's mushaf spelling with its standard spelling and names
 * every difference (design §2.3 B and C). Marks are UTF-16 ranges of the
 * standard tokens joined by one space, the unit's stored `imlaei`.
 */
export function diffGroup(group: WordGroup): UnitDiff {
  const imlaei = group.standard.join(' ');
  const mus = items(group.uthmani, 'uthmani');
  const std = items(imlaei, 'imlaei');
  const steps = align(mus, std);

  // Which standard items the mushaf has (same letter, paired).
  const paired = new Array<boolean>(std.length).fill(false);
  for (const step of steps) {
    if (step.op === 'sub' && mus[step.m].base === std[step.s].base) {
      paired[step.s] = true;
    }
  }
  const mushafWords = rasmLetters(group.uthmani).words;
  const standardWords = group.standard.length;
  const vocative =
    mushafWords === 1 &&
    standardWords > 1 &&
    isVocativeToken(group.standard[0]);

  const notes: DerivedNote[] = [];
  const unpaired: string[] = [];
  for (const step of steps) {
    if (!step.draft) {
      if (step.op === 'ins' && mus[step.m].virtual) {
        unpaired.push(`mushaf small ${mus[step.m].raw}`);
      } else if (step.op === 'del' && std[step.s].virtual) {
        unpaired.push(`standard small ${std[step.s].raw}`);
      }
      continue;
    }
    const d = {...step.draft};
    if (d.basis === 'unconfirmed' && d.kind === 'hadhf' && step.s >= 0) {
      const rule = hadhfRule(std, paired, step.s, vocative);
      if (rule) {
        d.basis = 'rule';
        d.why = rule;
      }
    }
    notes.push(toNote(d));
  }
  if (mushafWords !== standardWords) {
    const wasl = mushafWords < standardWords;
    notes.push({
      kind: wasl ? 'wasl' : 'fasl',
      standard: '',
      mushaf: '',
      mark: null,
      basis: wasl && vocative ? 'rule' : 'unconfirmed',
      why: wasl && vocative ? 'vocativeJoined' : 'word division',
    });
  }
  return {notes, unpaired};
}

function toNote(d: Draft): DerivedNote {
  return {
    kind: d.kind,
    standard: d.standard,
    mushaf: d.mushaf,
    mark: d.mark ? [d.mark.start, d.mark.end] : null,
    basis: d.basis,
    why: d.why,
  };
}

/** The pattern rule that explains a missing standard letter, if any. */
function hadhfRule(
  std: readonly Item[],
  paired: readonly boolean[],
  j: number,
  vocative: boolean,
): PatternRule | null {
  const s = std[j];
  const twin = (base: string) =>
    [j - 1, j + 1].some(
      x =>
        x >= 0 &&
        x < std.length &&
        std[x].base === base &&
        !std[x].virtual &&
        std[x].word === s.word &&
        paired[x],
    );
  if (s.base === 'ل' && twin('ل')) return 'lamAssimilated';
  if (s.base === 'ي' && twin('ي')) return 'doubleYa';
  if (s.base === 'ا') {
    if (vocative && s.word === 0) return 'vocativeJoined';
    const last = !std.some((x, i) => i > j && x.word === s.word && !x.virtual);
    const prev = std[j - 1];
    if (last && prev && prev.base === 'و' && !prev.virtual && paired[j - 1]) {
      return 'alifAfterWawJama';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. The reviewed list.

/** A note as the reviewed list writes it: [code, standard, mushaf, from, to]. */
export type ReviewedNote = [string, string, string, number, number];

export interface ReviewedWord {
  /** The notes the build derived when the word was reviewed. */
  derived: ReviewedNote[];
  /** Store no row for the unit. */
  skip?: boolean;
  /** Store these notes instead of the derived ones. */
  notes?: ReviewedNote[];
  /** Show the derived notes as they are. */
  confirm?: boolean;
  why: string;
}

export interface ReviewedFile {
  __format: 1;
  words: Record<string, ReviewedWord>;
}

/** A derived unit, ready to write. */
export interface RasmUnit {
  verseKey: string;
  from: number;
  to: number;
  imlaei: string;
  notes: DerivedNote[];
  reviewed: boolean;
}

export function readReviewed(json: string): ReviewedFile {
  const data = JSON.parse(json) as Partial<ReviewedFile>;
  if (data.__format !== 1 || !data.words || typeof data.words !== 'object') {
    throw new Error('rasm-reviewed.json: expected {"__format":1,"words":{…}}');
  }
  for (const [key, word] of Object.entries(data.words)) {
    if (!/^\d+:\d+:\d+$/.test(key)) {
      throw new Error(`rasm-reviewed.json: bad key ${key}`);
    }
    const actions = [word.skip, word.notes, word.confirm].filter(
      x => x !== undefined,
    );
    if (!Array.isArray(word.derived) || actions.length !== 1 || !word.why) {
      throw new Error(
        `rasm-reviewed.json ${key}: needs "derived", "why" and one of "skip", "notes", "confirm"`,
      );
    }
  }
  return data as ReviewedFile;
}

/** A unit's notes as the reviewed list compares them (no basis). */
export function reviewedForm(notes: readonly RasmNote[]): ReviewedNote[] {
  return notes.map(n => [
    RASM_KIND_CODE[n.kind],
    n.standard,
    n.mushaf,
    n.mark ? n.mark[0] : -1,
    n.mark ? n.mark[1] : -1,
  ]);
}

const KIND_OF_CODE = new Map(
  (Object.entries(RASM_KIND_CODE) as [RasmKind, string][]).map(([k, c]) => [
    c,
    k,
  ]),
);

/**
 * Applies rasm-reviewed.json. A reviewed unit is skipped, given replacement
 * notes, or confirmed, and is marked reviewed. The build fails (problems)
 * when a reviewed word's derived notes are no longer the ones that were
 * reviewed, or when a reviewed word has no derived unit.
 */
export function applyReviewed(
  units: readonly RasmUnit[],
  reviewed: ReviewedFile,
): {units: RasmUnit[]; problems: string[]} {
  const problems: string[] = [];
  const seen = new Set<string>();
  const out: RasmUnit[] = [];
  for (const unit of units) {
    const key = `${unit.verseKey}:${unit.from}`;
    const entry = reviewed.words[key];
    if (!entry) {
      out.push(unit);
      continue;
    }
    seen.add(key);
    const now = JSON.stringify(reviewedForm(unit.notes));
    if (now !== JSON.stringify(entry.derived)) {
      problems.push(
        `${key}: derived notes changed since review: was ${JSON.stringify(
          entry.derived,
        )}, now ${now}`,
      );
      out.push(unit);
      continue;
    }
    if (entry.skip) continue;
    if (entry.notes) {
      const notes: DerivedNote[] = [];
      for (const [code, standard, mushaf, from, to] of entry.notes) {
        const kind = KIND_OF_CODE.get(code);
        if (!kind) {
          problems.push(`${key}: unknown kind code ${code}`);
          continue;
        }
        notes.push({
          kind,
          standard,
          mushaf,
          mark: from >= 0 && to > from ? [from, to] : null,
          basis: 'reviewed',
          why: entry.why,
        });
      }
      out.push({...unit, notes, reviewed: true});
      continue;
    }
    out.push({
      ...unit,
      notes: unit.notes.map(n =>
        n.basis === 'unconfirmed'
          ? {...n, basis: 'reviewed', why: entry.why}
          : n,
      ),
      reviewed: true,
    });
  }
  for (const key of Object.keys(reviewed.words)) {
    if (!seen.has(key)) problems.push(`${key}: reviewed but no derived unit`);
  }
  return {units: out, problems};
}

/** For the report: a reviewed-list entry a reviewer can paste and edit. */
export function reviewTemplate(unit: RasmUnit): string {
  return JSON.stringify({
    [`${unit.verseKey}:${unit.from}`]: {
      derived: reviewedForm(unit.notes),
      confirm: true,
      why: '',
    },
  });
}
