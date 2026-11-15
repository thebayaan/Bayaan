/**
 * Cross-check against MASAQ (Morphologically-Analyzed and Syntactically-
 * Annotated Quran, Sawalha et al., University of Jordan; CC BY 4.0;
 * https://data.mendeley.com/datasets/9yvrzxktmr/5), an i'rab annotation of
 * the whole Quran made independently of the Quranic Treebank.
 *
 * For each word the two analyses are compared on the stem's case and its
 * syntactic role. Agreement is recorded; where MASAQ reads the word another
 * way, its reading is added as "وجه آخر"; and where a noun is genitive only
 * because of an extra preposition (مِن زائدة ...), MASAQ's case by position
 * (المحل) is added.
 */
import fs from 'fs';
import type {Case, IrabEntry, TreebankToken} from './irabText';

export const MASAQ_SHA256 =
  'aac224f1b852a1a87e5a896b76c4b55df7c29369a7da836aea1b7286a9c3a931';

export interface MasaqSegment {
  segment: string;
  type: string; // Prefix | Stem | Suffix
  role: string;
  caseMood: string;
  /** Case_Mood_Marker: DHAMMA, FATHA, KASRA, WAW, YAA, ALIF, NUN, DEL_NUN,
   *  IMP_DHAMMA, IMP_FATHA, IMP_KASRA, FATHA_DIPTOTE, DEL_VOWEL, SUKUN. */
  marker: string;
}

export interface MasaqWord {
  word: string;
  segments: MasaqSegment[];
}

/** MASAQ words per verse ("s:a" → words in order). */
export function readMasaq(file: string): Map<string, MasaqWord[]> {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split('\t');
  const col = (n: string) => {
    const i = header.indexOf(n);
    if (i < 0) throw new Error(`MASAQ column missing: ${n}`);
    return i;
  };
  const [cS, cA, cW, cWord, cSeg, cType, cRole, cCase, cMark] = [
    'Sura_No',
    'Verse_No',
    'Word_No',
    'Word',
    'Segmented_Word',
    'Morph_Type',
    'Syntactic_Role',
    'Case_Mood',
    'Case_Mood_Marker',
  ].map(col);
  const verses = new Map<string, Map<number, MasaqWord>>();
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split('\t');
    const vk = `${r[cS]}:${r[cA]}`;
    const w = Number(r[cW]);
    const words = verses.get(vk) ?? new Map<number, MasaqWord>();
    const word = words.get(w) ?? {word: r[cWord], segments: []};
    word.segments.push({
      segment: r[cSeg],
      type: r[cType],
      role: r[cRole],
      caseMood: r[cCase],
      marker: r[cMark],
    });
    words.set(w, word);
    verses.set(vk, words);
  }
  const out = new Map<string, MasaqWord[]>();
  for (const [vk, words] of verses) {
    out.set(
      vk,
      [...words.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]),
    );
  }
  return out;
}

/**
 * Pairs the app's words of a verse with MASAQ's by letters. MASAQ joins a
 * few word pairs the app keeps apart (حيث ما ...): those words get no
 * MASAQ word and are simply not cross-checked.
 */
export function alignVerse(
  app: string[],
  masaq: string[],
  skeleton: (s: string) => string,
): (number | null)[] {
  // Same number of words: MASAQ numbers words like the app.
  if (app.length === masaq.length) return app.map((_, i) => i);
  // Otherwise pair by letters, ignoring long vowels (MASAQ spells صراط where
  // the Uthmani text has صِرَٰط).
  const loose = (x: string) => skeleton(x).replace(/[اىيوأإآ]/g, '');
  const a = app.map(loose);
  const b = masaq.map(loose);
  const out: (number | null)[] = new Array(app.length).fill(null);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out[i++] = j++;
      continue;
    }
    let moved = false;
    for (const n of [2, 3]) {
      if (i + n <= a.length && a.slice(i, i + n).join('') === b[j]) {
        i += n;
        j += 1;
        moved = true;
        break;
      }
      if (j + n <= b.length && b.slice(j, j + n).join('') === a[i]) {
        i += 1;
        j += n;
        moved = true;
        break;
      }
    }
    if (!moved) {
      i += 1;
      j += 1;
    }
  }
  return out;
}

const CASE_OF: Record<string, Case> = {
  NOMINATIVE: 'NOM',
  ACCUSATIVE: 'ACC',
  GENITIVE: 'GEN',
};

/** MASAQ nominal roles, in Arabic, with gender for agreement. */
const ROLE_AR: Record<string, [string, boolean]> = {
  AGNT: ['فاعل', false],
  OBJ: ['مفعول به', false],
  SUBJ: ['مبتدأ', false],
  SUBJ_DELA: ['مبتدأ مؤخر', false],
  PRED: ['خبر', false],
  ADJ: ['صفة', true],
  APPOS: ['بدل', false],
  CONJ_N: ['معطوف', false],
  CIRCUM: ['حال', true],
  PASS_SUBJ: ['نائب فاعل', false],
  COGN: ['مفعول مطلق', false],
  SUBS_COG_ACC: ['نائب عن المفعول المطلق', false],
  ACC_SPECIF: ['تمييز', false],
  PURP: ['مفعول لأجله', false],
  EXCP: ['مستثنى', false],
  GEN_CONS: ['مضاف إليه', false],
  SUBJ_COP_PART: ['اسم الحرف الناسخ', false],
  PART_COP_PRED: ['خبر الحرف الناسخ', false],
  SUBJ_COP_V: ['اسم الفعل الناسخ', false],
  V_COP_PRED: ['خبر الفعل الناسخ', false],
  SUBJ_NEG_CAT: ['اسم لا النافية للجنس', false],
  ADV_TIME: ['ظرف زمان', false],
  ADV_PLCE: ['ظرف مكان', false],
  INTENCIF: ['توكيد', false],
  COMIT: ['مفعول معه', false],
};

/** Roles that name the same function in the two schemes. */
const SAME: Record<string, string[]> = {
  Subj: ['AGNT'],
  Pass: ['PASS_SUBJ'],
  Obj: ['OBJ'],
  Poss: ['GEN_CONS'],
  Adj: ['ADJ'],
  conj: ['CONJ_N'],
  App: ['APPOS'],
  circ: ['CIRCUM'],
  Pred: ['PRED', 'PART_COP_PRED', 'V_COP_PRED'],
  MUBTADA: ['SUBJ', 'SUBJ_DELA'],
  cog: ['COGN', 'SUBS_COG_ACC'],
  Spec: ['ACC_SPECIF'],
  prp: ['PURP'],
  exp: ['EXCP'],
  emph: ['INTENCIF'],
  voc: ['VOC'],
  subj: ['SUBJ_COP_PART', 'SUBJ_COP_V', 'SUBJ_NEG_CAT', 'SUBJ_DELA', 'SUBJ'],
  pred: ['PART_COP_PRED', 'V_COP_PRED', 'PRED'],
  gen: ['PREP_OBJ'],
};

const CASE_ADJ: Record<Case, [string, string]> = {
  NOM: ['مرفوع', 'مرفوعة'],
  ACC: ['منصوب', 'منصوبة'],
  GEN: ['مجرور', 'مجرورة'],
};
const CASE_NOUN: Record<Case, string> = {NOM: 'رفع', ACC: 'نصب', GEN: 'جر'};

/** Our sign phrase → the MASAQ markers that say the same. */
const SIGN_MARKERS: [RegExp, string[]][] = [
  // MASAQ marks the vowel the ياء المتكلم displaces as plain or implied.
  [/على ما قبل ياء المتكلم/, ['IMP_KASRA', 'IMP_DHAMMA', 'IMP_FATHA', 'KASRA']],
  [/ثبوت النون/, ['NUN']],
  [/حذف النون/, ['DEL_NUN']],
  [/حذف حرف العلة/, ['DEL_VOWEL']],
  [/نيابة عن الكسرة/, ['FATHA_DIPTOTE', 'FATHA']],
  [/الكسرة نيابة عن الفتحة/, ['KASRA']],
  [/الضمة المقدرة/, ['IMP_DHAMMA']],
  [/الفتحة المقدرة/, ['IMP_FATHA']],
  [/الكسرة المقدرة/, ['IMP_KASRA']],
  [/وعلامة \S+ الواو/, ['WAW']],
  [/وعلامة \S+ الياء/, ['YAA']],
  [/وعلامة \S+ الألف/, ['ALIF']],
  [/وعلامة \S+ الضمة/, ['DHAMMA']],
  [/وعلامة \S+ الفتحة/, ['FATHA']],
  [/وعلامة \S+ الكسرة/, ['KASRA']],
  [/وعلامة \S+ السكون/, ['SUKUN']],
];

/**
 * Whether the sign in our stem line ("وعلامة رفعه الضمة") is what MASAQ
 * gives. null: nothing to compare (no sign, or no MASAQ marker).
 */
export function signAgrees(
  stemText: string,
  word: MasaqWord | undefined,
): boolean | null {
  if (!word) return null;
  const markers = word.segments.map(s => s.marker).filter(Boolean);
  if (!markers.length) return null;
  for (const [re, ok] of SIGN_MARKERS) {
    if (re.test(stemText)) return markers.some(m => ok.includes(m));
  }
  return null;
}

export interface CrossCheck {
  /** Both analyses agree on the stem's case and role (when both give them). */
  agree: boolean;
  /** Both gave something comparable. */
  compared: boolean;
  extra: IrabEntry[];
}

/**
 * Compares the treebank's main stem of a word with MASAQ's stem.
 * `tbRole` is the treebank role key of the stem (Subj, Obj, MUBTADA,
 * subj, pred ...), or null when the stem has no nominal role.
 */
export function crossCheck(
  stem: TreebankToken | undefined,
  tbRole: string | null,
  word: MasaqWord | undefined,
  skeleton: (s: string) => string,
): CrossCheck {
  const none: CrossCheck = {agree: false, compared: false, extra: []};
  if (!stem || !word) return none;
  // MASAQ's segment with the stem's letters (else its first stem).
  const target = skeleton(stem.uthmani);
  const seg =
    word.segments.find(
      s => s.type === 'Stem' && skeleton(s.segment) === target,
    ) ?? word.segments.find(s => s.type === 'Stem');
  if (!seg) return none;

  const tbCase = stem.case || null;
  const mCase = CASE_OF[seg.caseMood] ?? null;
  const caseCompared = !!tbCase && !!mCase;
  const caseAgree = !caseCompared || tbCase === mCase;

  const mRole = seg.role;
  const roleCompared = !!tbRole && !!ROLE_AR[mRole] && !!SAME[tbRole];
  const roleAgree = !roleCompared || SAME[tbRole!].includes(mRole);

  const extra: IrabEntry[] = [];
  // Genitive by an extra preposition, nominative/accusative by position.
  if (
    tbRole === 'gen' &&
    tbCase === 'GEN' &&
    mCase &&
    mCase !== 'GEN' &&
    ROLE_AR[mRole]
  ) {
    extra.push({
      kind: 'alt',
      label: 'المحل',
      text: `مجرور لفظًا، في محل ${CASE_NOUN[mCase]} ${ROLE_AR[mRole][0]}`,
    });
  } else if (roleCompared && !roleAgree) {
    const [name, fem] = ROLE_AR[mRole];
    const c = mCase ?? tbCase;
    extra.push({
      kind: 'alt',
      label: 'وجه آخر',
      text: c ? `${name} ${CASE_ADJ[c][fem ? 1 : 0]}` : name,
    });
  } else if (caseCompared && !caseAgree && mCase) {
    extra.push({
      kind: 'alt',
      label: 'وجه آخر',
      text: ROLE_AR[mRole]
        ? `${ROLE_AR[mRole][0]} ${CASE_ADJ[mCase][ROLE_AR[mRole][1] ? 1 : 0]}`
        : CASE_ADJ[mCase][0],
    });
  }
  return {
    agree: caseAgree && roleAgree && (caseCompared || roleCompared),
    compared: caseCompared || roleCompared,
    extra,
  };
}
