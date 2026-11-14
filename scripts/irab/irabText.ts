/**
 * Traditional Arabic i'rab (إعراب) prose generated from the Quranic Treebank.
 *
 * Input: the token rows of one treebank "sentence" (a syntactic unit that can
 * span several verses), already parsed. Output: per Quran word, an ordered
 * list of i'rab entries (prefix, stem, suffix, implied element, phrase).
 *
 * The prose never quotes Quran text from the treebank. A reference to another
 * word is written as a placeholder `{{s:a:w}}` that the app resolves to its
 * own word text, and segment labels are grammar names ("الواو", "واو
 * الجماعة"), not Quran spellings.
 *
 * Source: The Quranic Treebank (NoorBayan/Quranic, MIT), built on the Quranic
 * Arabic Corpus (Dr. Kais Dukes, University of Leeds, GNU GPL).
 */

export type Case = 'NOM' | 'ACC' | 'GEN';
export type Mood = 'IND' | 'SUBJ' | 'JUS';

export interface TreebankToken {
  /** Token id within its sentence (the treebank's `token_id`). */
  id: number;
  /** Quran location; null for an implied (elided) token. */
  loc: {surah: number; ayah: number; word: number; token: number} | null;
  /** The token's vowelled text (analysis only, never displayed): the app's
   *  own word split onto the tokens, else the treebank's spelling. */
  uthmani: string;
  /** The treebank's own spelling of the token (for alignment checks). */
  treebankText: string;
  pos: string;
  segment: 'PREFIX' | 'STEM' | 'SUFFIX' | '';
  lemma: string;
  /** Root in Buckwalter (ktb, x$y); empty for particles. */
  root: string;
  /** Prefix code (`w:CONJ+`, `bi+` ...) for a prefix token. */
  prefix: string;
  /** Suffix code (`PRON`, `EMPH:n`, `VOC:m`) for a suffix token. */
  suffix: string;
  aspect: 'PERF' | 'IMPF' | 'IMPV' | '';
  mood: Mood | '';
  case: Case | '';
  special: string;
  derived: string;
  voice: 'ACT' | 'PASS' | '';
  /** Person/gender/number, e.g. `3MP`, `MS`, `F`. */
  pgn: string;
  /** Verb form "(IV)" for verbs and derived nouns; '' for form I. */
  verbForm?: string;
  /** The lemma in Arabic script (dictionary form). */
  lemmaAr?: string;
  /** Labelled indefinite (نكرة). */
  indef?: boolean;
  /** Raw feature string (`STEM|POS:N|...`, `SUFFIX|PRON:3MP`). */
  features: string;
  rel: string;
  /** Head token id (same sentence); equals `id` for root / NonRel. */
  head: number;
  isConstituent: boolean;
  constituentFrom: number | null;
  constituentTo: number | null;
  /** NS, VS, PP, SC, S, CS. */
  constituentLabel: string;
}

export type EntryKind =
  | 'prefix'
  | 'stem'
  | 'suffix'
  | 'implied'
  | 'phrase'
  /** Another reading (MASAQ) or the case by position. */
  | 'alt';

export interface IrabEntry {
  kind: EntryKind;
  /** Grammar name of the segment ("الواو", "واو الجماعة"); empty for stem. */
  label: string;
  /** The i'rab prose; `{{s:a:w}}` placeholders refer to words. */
  text: string;
  /** For a phrase: the words it spans, inclusive ("s:a:w"). */
  span?: [string, string];
}

/** Entries keyed by "s:a:w". */
export type WordEntries = Map<string, IrabEntry[]>;

/** Per word: its main stem and the stem's role key, for cross-checking. */
export type StemInfo = Map<
  string,
  {stem: TreebankToken; roleKey: string | null}
>;

// ---------------------------------------------------------------------------
// Text helpers

const FATHA = 'َ';
const DAMMA = 'ُ';
const KASRA = 'ِ';
const FATHATAN = 'ً';
const DAMMATAN = 'ٌ';
const KASRATAN = 'ٍ';
const SUKUN = 'ْ';
const SHADDA = 'ّ';

/** Quranic annotation marks that carry no grammatical vowel. */
const ANNOTATION = /[ؐ-ؚۖ-ۜ۞-۠ۢ-۪ۤۧۨ-ۭـ]/g;

/** A token's base letters, each with its marks. */
function letters(text: string): {ch: string; marks: string}[] {
  const clean = text
    // A silent alif (وا۟، أُو۟لَٰٓئِكَ) is not part of the word's ending.
    .replace(/\u0627\u06DF/g, '')
    .replace(ANNOTATION, '')
    .replace(/ۡ/g, SUKUN) // Uthmani sukun
    .replace(/ࣰ/g, FATHATAN)
    .replace(/ࣱ/g, DAMMATAN)
    .replace(/ࣲ/g, KASRATAN);
  const out: {ch: string; marks: string}[] = [];
  for (const ch of clean) {
    if (/[\u064B-\u0655\u0670\u06E5\u06E6]/.test(ch)) {
      if (out.length) out[out.length - 1].marks += ch;
    } else if (/\S/.test(ch)) {
      out.push({ch, marks: ''});
    }
  }
  return out;
}

type Ending =
  | {type: 'vowel'; vowel: 'a' | 'u' | 'i'; tanwin: boolean; shadda: boolean}
  | {type: 'sukun'}
  | {type: 'alif'} // ends in ا / ى without a vowel (maqsur / weak)
  | {type: 'ya'} // ends in ي without a vowel after a kasra (manqus)
  | {type: 'waw'} // ends in و without a vowel
  | {type: 'none'};

/** What the last letter of a token carries. */
export function ending(text: string): Ending {
  const ls = letters(text);
  if (!ls.length) return {type: 'none'};
  let last = ls[ls.length - 1];
  // Tanwin fath written on the letter before a final alif: كِتَٰبًا
  if (
    ls.length > 1 &&
    last.ch === 'ا' &&
    !/[ً-ْ]/.test(last.marks) &&
    ls[ls.length - 2].marks.includes(FATHATAN)
  ) {
    last = ls[ls.length - 2];
  }
  const m = last.marks;
  const shadda = m.includes(SHADDA);
  if (m.includes(FATHA) || m.includes(FATHATAN))
    return last.ch === 'ى' && m.includes(FATHATAN) === false && ls.length > 1
      ? {type: 'vowel', vowel: 'a', tanwin: false, shadda}
      : {type: 'vowel', vowel: 'a', tanwin: m.includes(FATHATAN), shadda};
  if (m.includes(DAMMA) || m.includes(DAMMATAN))
    return {type: 'vowel', vowel: 'u', tanwin: m.includes(DAMMATAN), shadda};
  if (m.includes(KASRA) || m.includes(KASRATAN))
    return {type: 'vowel', vowel: 'i', tanwin: m.includes(KASRATAN), shadda};
  if (m.includes(SUKUN)) return {type: 'sukun'};
  // The Uthmani text writes a final ya without dots (تَجْرِى): after a
  // kasra the ى is a ya, not an alif.
  if (last.ch === 'ى' && kasraBefore(ls)) return {type: 'ya'};
  if (last.ch === 'ا' || last.ch === 'ى') return {type: 'alif'};
  if (last.ch === 'ي') return {type: 'ya'};
  if (last.ch === 'و') return {type: 'waw'};
  // An unmarked consonant is sakin (Uthmani drops the sukun before idgham).
  return /[\u0621-\u064A]/.test(last.ch) ? {type: 'sukun'} : {type: 'none'};
}

/** The token's letters without any marks. */
export function bare(text: string): string {
  return letters(text)
    .map(l => l.ch)
    .join('')
    .replace(/[()*]/g, '');
}

/** The letter before the last carries a kasra (تَجْرِى، ٱلدَّاعِى). */
function kasraBefore(ls: {ch: string; marks: string}[]): boolean {
  if (ls.length < 2) return false;
  const m = ls[ls.length - 2].marks;
  return m.includes(KASRA) || m.includes(KASRATAN);
}

/** True when the noun ends in a maqsur alif after tanwin fath (هُدًى). */
function isMaqsur(text: string): boolean {
  const ls = letters(text);
  if (!ls.length) return false;
  const last = ls[ls.length - 1];
  if (last.ch !== 'ى' && last.ch !== 'ا') return false;
  if (last.ch === 'ى' && kasraBefore(ls)) return false; // dotless ya
  if (/[ً-ْ]/.test(last.marks)) return false;
  if (
    last.ch === 'ا' &&
    ls.length > 1 &&
    ls[ls.length - 2].marks.includes(FATHATAN)
  )
    return false; // كِتَٰبًا: tanwin fath, not maqsur
  return true;
}

// ---------------------------------------------------------------------------
// Vocabulary

const CASE_ADJ: Record<Case, [string, string]> = {
  NOM: ['مرفوع', 'مرفوعة'],
  ACC: ['منصوب', 'منصوبة'],
  GEN: ['مجرور', 'مجرورة'],
};
const MOOD_ADJ: Record<Mood, string> = {
  IND: 'مرفوع',
  SUBJ: 'منصوب',
  JUS: 'مجزوم',
};
const CASE_NOUN: Record<Case, string> = {NOM: 'رفع', ACC: 'نصب', GEN: 'جر'};
const MOOD_NOUN: Record<Mood, string> = {IND: 'رفع', SUBJ: 'نصب', JUS: 'جزم'};
const VOWEL_NAME = {a: 'الفتحة', u: 'الضمة', i: 'الكسرة'} as const;
const BINAA_NAME = {a: 'الفتح', u: 'الضم', i: 'الكسر'} as const;
const CASE_VOWEL: Record<Case, 'u' | 'a' | 'i'> = {
  NOM: 'u',
  ACC: 'a',
  GEN: 'i',
};

/** "وعلامة رفعه" / "وعلامة نصبها". */
function signLead(c: Case | Mood, fem: boolean): string {
  const noun =
    c === 'NOM' || c === 'ACC' || c === 'GEN'
      ? CASE_NOUN[c as Case]
      : MOOD_NOUN[c as Mood];
  return `وعلامة ${noun}${fem ? 'ها' : 'ه'}`;
}

/** Name of a particle token by POS (and lemma where it decides). */
function particleName(t: TreebankToken): string {
  const lem = t.lemma;
  switch (t.pos) {
    case 'P':
      if (t.prefix === 'w:P+') return 'واو القسم، حرف جر';
      if (t.prefix === 'ta+') return 'تاء القسم، حرف جر';
      return 'حرف جر';
    case 'CONJ':
      return 'حرف عطف';
    case 'REM':
      return 'حرف استئناف';
    case 'CIRC':
      return 'واو الحال';
    case 'COM':
      return 'واو المعية';
    case 'CAUS':
      return 'فاء السببية';
    case 'SUP':
      return 'حرف زائد';
    case 'RSLT':
      return 'رابطة لجواب الشرط';
    case 'EMPH':
      return t.segment === 'PREFIX' ? 'لام التوكيد' : 'حرف توكيد';
    case 'PRP':
      return t.segment === 'PREFIX' ? 'لام التعليل' : 'حرف تعليل';
    case 'IMPV':
      return 'لام الأمر';
    case 'PRO':
      return 'لا الناهية الجازمة';
    case 'ACC':
      if (lem === '<in~') return 'حرف توكيد ونصب';
      if (lem === '>an~') return 'حرف توكيد ونصب ومصدر';
      if (lem.startsWith('ka>an~')) return 'حرف تشبيه ونصب';
      if (lem.startsWith('la`kin~')) return 'حرف استدراك ونصب';
      if (lem.startsWith('laEal~')) return 'حرف ترجٍّ ونصب';
      if (lem.startsWith('layot')) return 'حرف تمنٍّ ونصب';
      if (lem === '>an') return 'حرف مصدري ونصب';
      return 'حرف نصب';
    case 'SUB':
      if (lem === '>an') return 'حرف مصدري ونصب';
      return 'حرف مصدري';
    case 'NEG':
      if (lem === 'lam') return 'حرف نفي وجزم وقلب';
      if (lem === 'lan') return 'حرف نفي ونصب واستقبال';
      if (lem === 'lam~aA') return 'حرف نفي وجزم';
      if (t.special === 'SP:<in~') return 'لا النافية للجنس، تعمل عمل إنّ';
      if (t.special === 'SP:kaAn')
        return lem === 'maA'
          ? 'ما النافية الحجازية، تعمل عمل ليس'
          : 'حرف نفي يعمل عمل ليس';
      return 'حرف نفي';
    case 'COND':
      if (lem === '<in') return 'حرف شرط جازم';
      if (lem === 'law') return 'حرف شرط غير جازم';
      if (lem === 'lawolaA') return 'حرف امتناع لوجود';
      if (lem === '>am~aA') return 'حرف شرط وتفصيل';
      return 'أداة شرط';
    case 'INTG':
      if (t.segment === 'PREFIX' || lem === '>a') return 'همزة الاستفهام';
      if (lem === 'hal') return 'حرف استفهام';
      return 'اسم استفهام';
    case 'FUT':
      return 'حرف استقبال';
    case 'CERT':
      return 'حرف تحقيق';
    case 'RES':
      return 'أداة حصر';
    case 'EXP':
      return 'أداة استثناء';
    case 'RET':
      return 'حرف إضراب';
    case 'AMD':
      return 'حرف استدراك';
    case 'INC':
      return 'حرف استفتاح';
    case 'INT':
      return 'حرف تفسير';
    case 'ANS':
      return 'حرف جواب';
    case 'EXH':
      return 'حرف تحضيض';
    case 'SUR':
      return 'حرف فجاءة';
    case 'AVR':
      return 'حرف ردع وزجر';
    case 'VOC':
      return 'حرف نداء';
    case 'PREV':
      return 'حرف كافّ';
    case 'EQ':
      return 'همزة التسوية';
    case 'EXL':
      return 'حرف تفصيل';
    default:
      return 'حرف';
  }
}

const PARTICLE_POS = new Set([
  'P',
  'CONJ',
  'REM',
  'CIRC',
  'COM',
  'CAUS',
  'SUP',
  'RSLT',
  'EMPH',
  'PRP',
  'IMPV',
  'PRO',
  'ACC',
  'SUB',
  'NEG',
  'COND',
  'FUT',
  'CERT',
  'RES',
  'EXP',
  'RET',
  'AMD',
  'INC',
  'INT',
  'ANS',
  'EXH',
  'SUR',
  'AVR',
  'VOC',
  'PREV',
  'EQ',
  'EXL',
  'INL',
  'DET',
]);

/** Interrogative nouns QAC tags INTG (كيف، أين، متى ...): mabni nouns. */
function isIntgNoun(t: TreebankToken): boolean {
  return (
    t.pos === 'INTG' &&
    t.segment !== 'PREFIX' &&
    t.lemma !== '>a' &&
    t.lemma !== 'hal'
  );
}

/** Conditional nouns QAC tags COND (مَن، ما، مهما ...). */
function isCondNoun(t: TreebankToken): boolean {
  return (
    t.pos === 'COND' &&
    !['<in', 'law', 'lawolaA', '>am~aA', '<i*aA'].includes(t.lemma)
  );
}

/** Prefix letter name ("الواو", "الباء"). */
function prefixLabel(t: TreebankToken): string {
  const p = t.prefix;
  if (p.startsWith('w:')) return 'الواو';
  if (p.startsWith('f:')) return 'الفاء';
  if (p === 'bi+') return 'الباء';
  if (p.startsWith('l:')) return 'اللام';
  if (p === 'ka+') return 'الكاف';
  if (p === 'sa+') return 'السين';
  if (p.startsWith('A:')) return 'الهمزة';
  if (p === 'ya+') return 'يا';
  if (p === 'ha+') return 'ها';
  if (p === 'ta+') return 'التاء';
  return 'السابقة';
}

/** Pronoun person/gender/number from a suffix's features (`PRON:3MP`). */
function pronPgn(t: TreebankToken): string {
  const m = /PRON:([123][MF]?[SDP])/.exec(t.features);
  return m ? m[1] : t.pgn;
}

const LETTER_NAME: Record<string, string> = {
  ه: 'الهاء',
  ك: 'الكاف',
  ي: 'الياء',
  ى: 'الياء',
  ت: 'التاء',
  و: 'الواو',
  ا: 'الألف',
  ن: 'النون',
};

/** A subject pronoun suffix on a verb, by person/gender/number. */
function subjectSuffixName(pgn: string, aspect: string, text: string): string {
  if (pgn === '3MP' || (pgn === '2MP' && aspect !== 'PERF'))
    return 'واو الجماعة';
  if (/^[23][MF]?D$/.test(pgn) && !(aspect === 'PERF' && pgn.startsWith('2')))
    return 'ألف الاثنين';
  if (pgn === '2FS' && aspect !== 'PERF') return 'ياء المخاطبة';
  if (pgn === '3FP' || (pgn === '2FP' && aspect !== 'PERF'))
    return 'نون النسوة';
  if (pgn === '1P') return '«نا»';
  const b = bare(text);
  return LETTER_NAME[b] ?? `«${b}»`;
}

// ---------------------------------------------------------------------------
// Sentence model

interface Ctx {
  byId: Map<number, TreebankToken>;
  children: Map<number, TreebankToken[]>;
  /** Tokens that are the head of a Pred (the مبتدأ). */
  predHeads: Set<number>;
}

function wordKey(t: TreebankToken): string | null {
  return t.loc ? `${t.loc.surah}:${t.loc.ayah}:${t.loc.word}` : null;
}

function sameWord(a: TreebankToken, b: TreebankToken | undefined): boolean {
  return !!b && !!a.loc && !!b.loc && wordKey(a) === wordKey(b);
}

function ref(t: TreebankToken): string {
  return `{{${wordKey(t)}}}`;
}

const CLAUSE_ROLES = new Set([
  'sub',
  'root',
  'NonRel',
  'cond',
  'rslt',
  'imrs',
  'int',
]);

/** Particle-relation labels: they name the particle, not the dependent. */
const PARTICLE_RELS = new Set([
  'neg',
  'intg',
  'fut',
  'cert',
  'res',
  'sup',
  'prev',
  'ret',
  'amd',
  'impv',
  'Pro',
  'eq',
  'exh',
  'inc',
  'sur',
  'avr',
  'ans',
  'exl',
  'caus',
  'state',
  'Cpnd',
]);

function normRel(rel: string): string {
  return rel.replace(/\s+/g, '');
}

interface Role {
  /** Role phrase ("فاعل", "صفة لـ{{2:2:7}}"). */
  text: string;
  /** Grammatical case the role imposes, 'FOLLOW' when it follows its head. */
  case: Case | 'FOLLOW' | null;
  fem: boolean;
}

/** The role a token (or the phrase it heads) plays through `rel`. */
function roleFor(t: TreebankToken, rel: string, ctx: Ctx): Role | null {
  const r = normRel(rel);
  const head = ctx.byId.get(t.head);
  const cross = head && !sameWord(t, head) && head.loc ? ref(head) : null;
  const withRef = (base: string, joiner: string) =>
    cross ? `${base} ${joiner}${cross}` : base;

  const fam = /^(subj|pred)<<(.+)>>$/.exec(r);
  if (fam) {
    const isSubj = fam[1] === 'subj';
    // إنّ and its sisters, and لا النافية للجنس: noun accusative, predicate
    // nominative. كان, ليس, كاد and ما الحجازية: the reverse.
    const innaLike =
      !!head && (head.pos === 'ACC' || head.special === 'SP:<in~');
    const c: Case = isSubj === innaLike ? 'ACC' : 'NOM';
    const name = isSubj ? 'اسم' : 'خبر';
    return {text: cross ? `${name} ${cross}` : name, case: c, fem: false};
  }
  switch (r) {
    case 'Subj':
      return {text: 'فاعل', case: 'NOM', fem: false};
    case 'Pass':
      return {text: 'نائب فاعل', case: 'NOM', fem: false};
    case 'Obj':
      return {text: 'مفعول به', case: 'ACC', fem: false};
    case 'Pred':
      return {text: 'خبر', case: 'NOM', fem: false};
    case 'Poss':
      return {text: 'مضاف إليه', case: 'GEN', fem: false};
    case 'gen':
      return {text: 'GEN', case: 'GEN', fem: false};
    case 'Adj':
      return {text: withRef('صفة', 'لـ'), case: 'FOLLOW', fem: true};
    case 'conj':
      return {text: withRef('معطوف', 'على '), case: 'FOLLOW', fem: false};
    case 'App':
      return {text: withRef('بدل', 'من '), case: 'FOLLOW', fem: false};
    case 'emph':
      return {text: withRef('توكيد', 'لـ'), case: 'FOLLOW', fem: false};
    case 'circ':
      return {text: 'حال', case: 'ACC', fem: true};
    case 'Spec':
      return {text: 'تمييز', case: 'ACC', fem: false};
    case 'cog':
      return {text: 'مفعول مطلق', case: 'ACC', fem: false};
    case 'prp':
      return {text: 'مفعول لأجله', case: 'ACC', fem: false};
    case 'exp':
      return {text: 'مستثنى', case: null, fem: false};
    case 'voc':
      return {text: 'منادى', case: null, fem: false};
    case 'link':
      return {text: withRef('متعلق', 'بـ'), case: null, fem: false};
    default:
      return null;
  }
}

/** A token's case: its own, else what its role imposes (following heads). */
function caseOf(t: TreebankToken, ctx: Ctx, depth = 0): Case | null {
  if (t.case) return t.case;
  if (depth > 8) return null;
  if (ctx.predHeads.has(t.id) && (t.rel === 'root' || t.isConstituent))
    return 'NOM';
  if (t.isConstituent) return null;
  const role = roleFor(t, t.rel, ctx);
  if (!role) return null;
  if (role.case === 'FOLLOW') {
    const head = ctx.byId.get(t.head);
    return head && head !== t ? caseOf(head, ctx, depth + 1) : null;
  }
  return role.case;
}

/** The case a phrase headed by `t` takes through its role. */
function phraseCase(t: TreebankToken, ctx: Ctx): Case | null {
  const role = roleFor(t, t.rel, ctx);
  if (!role) return null;
  if (role.case === 'FOLLOW') {
    const head = ctx.byId.get(t.head);
    return head && head !== t ? caseOf(head, ctx) : null;
  }
  return role.case;
}

// ---------------------------------------------------------------------------
// Noun i'rab

/** Buckwalter consonants → Arabic letters (root letters). */
const BUCKWALTER: Record<string, string> = {
  b: 'ب',
  t: 'ت',
  v: 'ث',
  j: 'ج',
  H: 'ح',
  x: 'خ',
  d: 'د',
  '*': 'ذ',
  r: 'ر',
  z: 'ز',
  s: 'س',
  $: 'ش',
  S: 'ص',
  D: 'ض',
  T: 'ط',
  Z: 'ظ',
  E: 'ع',
  g: 'غ',
  f: 'ف',
  q: 'ق',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  h: 'ه',
  w: 'و',
  y: 'ي',
};

// The corpus' lemmas of the five nouns (أب is `>abN`).
const FIVE_NOUNS = new Set(['>abN', '>ab', '>ax', '*uw', '*aA', 'Ham', 'fuw']);

/** Plurals attached to the sound masculine plural (ملحق بجمع المذكر السالم). */
export const MULHAQ_LEMMAS = new Set([
  'Ea`lamiyn',
  '>uwliY',
  '>uwlu',
  'bunaY~',
  'siniyn',
  '>ajomaEiyn',
  'Eil~iy~uwn',
  '>aholuwn',
  'Ei$oruwn',
  'valaAvuwn',
  '>arobaEuwn',
  'xamosuwn',
  'sit~uwn',
  'saboEuwn',
  'vamaAnuwn',
  'tisoEuwn',
]);
/** The tens (عشرون ... تسعون), عِلِّيُّون and عِضِين, by their letters. */
export const MULHAQ_WORD =
  /^(عشر|ثلث|ثلاث|أربع|خمس|ست|سبع|ثمن|ثمان|تسع|عض|عليي?)(ون|ين)$/;

/** Sign clause for a declinable noun: "وعلامة رفعه الضمة", or ''. */
function nounSign(
  t: TreebankToken,
  c: Case,
  fem: boolean,
  wordSuffixes: TreebankToken[],
): string {
  const lead = signLead(c, fem);
  // An alif of iṭlāq (ٱلرَّسُولَا۠) or of the pause (عِوَجَاۜ) after a fatha
  // is not the noun's own: the fatha is its sign, not a maqsur alif.
  const text = t.uthmani.replace(/\u0627[\u06E0\u06DC]/g, '');
  const b = bare(text);
  const end = ending(text);
  const num = t.pgn.replace(/^[123]/, '');
  const hasYaMutakallim = wordSuffixes.some(
    s => s.pos === 'PRON' && pronPgn(s) === '1S',
  );
  if (hasYaMutakallim) {
    return `${lead} ${VOWEL_NAME[CASE_VOWEL[c]]} المقدرة على ما قبل ياء المتكلم، منع من ظهورها اشتغال المحل بالحركة المناسبة`;
  }
  if (/D$/.test(num)) {
    return c === 'NOM' ? `${lead} الألف لأنه مثنى` : `${lead} الياء لأنه مثنى`;
  }
  // Attached to the sound masculine plural: العالمين، بنو/بني، أولو/أولي،
  // the tens.
  const mulhaq =
    /MP$/.test(num) && (MULHAQ_LEMMAS.has(t.lemma) || MULHAQ_WORD.test(b));
  if (mulhaq && /(ون|ين|[وىي])$/.test(b)) {
    return c === 'NOM'
      ? `${lead} الواو لأنه ملحق بجمع المذكر السالم`
      : `${lead} الياء لأنه ملحق بجمع المذكر السالم`;
  }
  // Sound masculine plural: nun with fatha (or dropped in idafa).
  if (/MP$/.test(num)) {
    // A root ending in ن keeps it before the suffix (مُؤْمِنُونَ); otherwise
    // the ن is the root's own and the plural is broken (قُرُون، شَيَاطِين).
    const suffixed =
      !/n$/.test(t.root) || (/ن(ون|ين)$/.test(b) && !/nn$/.test(t.root));
    const nunEnding =
      /(ون|ين)$/.test(b) &&
      suffixed &&
      (end.type === 'vowel' ? end.vowel === 'a' : true);
    const droppedNun =
      /[وىي]$/.test(b) &&
      (t.derived === 'ACT_PCPL' ||
        t.derived === 'PASS_PCPL' ||
        t.pos === 'ADJ') &&
      end.type !== 'vowel';
    if (nunEnding || droppedNun) {
      return c === 'NOM'
        ? `${lead} الواو لأنه جمع مذكر سالم`
        : `${lead} الياء لأنه جمع مذكر سالم`;
    }
  }
  if (
    FIVE_NOUNS.has(t.lemma) &&
    (end.type === 'waw' || end.type === 'alif' || end.type === 'ya')
  ) {
    const letter = c === 'NOM' ? 'الواو' : c === 'ACC' ? 'الألف' : 'الياء';
    return `${lead} ${letter} لأنه من الأسماء الخمسة`;
  }
  if (isMaqsur(text)) {
    return `${lead} ${VOWEL_NAME[CASE_VOWEL[c]]} المقدرة على الألف للتعذر`;
  }
  // Manqus with its ya dropped (بَاغٍ، ٱلدَّاعِ): the vowel is on that ya.
  if (
    c !== 'ACC' &&
    /[wy]$/.test(t.root) &&
    end.type === 'vowel' &&
    end.vowel === 'i' &&
    !end.shadda &&
    // Only the فاعِل / مَفَاعِل shapes (داعٍ، باغٍ، ليالٍ) and participles;
    // not ٱسْم، ٱبْن، يَد، دَم whose weak letter is simply gone.
    (t.derived === 'ACT_PCPL' || b[b.length - 2] === 'ا') &&
    // The word ends on the root's middle letter: its last root letter, the
    // ya, has dropped (بَاغٍ from بغي، ٱلدَّاعِ from دعو).
    t.root.length === 3 &&
    b.endsWith(BUCKWALTER[t.root[1]] ?? '\u0000')
  ) {
    return `${lead} ${VOWEL_NAME[CASE_VOWEL[c]]} المقدرة على الياء المحذوفة، منع من ظهورها الثقل`;
  }
  if (end.type === 'ya' && c !== 'ACC') {
    return `${lead} ${VOWEL_NAME[CASE_VOWEL[c]]} المقدرة على الياء للثقل`;
  }
  if (end.type !== 'vowel') return '';
  // Dagger alif read as alif: ٱلصَّٰلِحَٰتِ ends in ات.
  const withAlif = bare(text.replace(/\u0670/g, 'ا'));
  if (
    /FP$/.test(num) &&
    /ات$/.test(withAlif) &&
    c === 'ACC' &&
    end.vowel === 'i'
  ) {
    return `${lead} الكسرة نيابة عن الفتحة لأنه جمع مؤنث سالم`;
  }
  if (c === 'GEN' && end.vowel === 'a' && !end.tanwin) {
    return `${lead} الفتحة نيابة عن الكسرة لأنه ممنوع من الصرف`;
  }
  if (end.vowel === CASE_VOWEL[c]) {
    return `${lead} ${VOWEL_NAME[end.vowel]}`;
  }
  return '';
}

/** "مبني على الفتح" from a token's last letter. */
function binaa(text: string): string {
  const e = ending(text);
  if (e.type === 'vowel') return `مبني على ${BINAA_NAME[e.vowel]}`;
  if (
    e.type === 'sukun' ||
    e.type === 'alif' ||
    e.type === 'ya' ||
    e.type === 'waw'
  )
    return 'مبني على السكون';
  return 'مبني';
}

/** Demonstratives: [the built noun, what follows the role]. */
const DEM_BINAA: Record<string, [string, string]> = {
  '*a`lik': ['اسم إشارة مبني على السكون', 'واللام للبعد، والكاف للخطاب'],
  tilka: ['اسم إشارة مبني على السكون', 'واللام للبعد، والكاف للخطاب'],
  '*a`likum': ['اسم إشارة مبني على السكون', 'واللام للبعد، و«كم» للخطاب'],
  '>uwla`^}ik': ['اسم إشارة مبني على الكسر', 'والكاف للخطاب'],
  'ha`*aA': ['اسم إشارة مبني على السكون', ''],
  'ha`*ihi': ['اسم إشارة مبني على الكسر', ''],
  "ha`^&ulaA^'": ['اسم إشارة مبني على الكسر', ''],
};

/** A pronoun written onto a preposition prefix (لَهُۥ، بِهِ) is attached. */
function attachedAfterPrefix(t: TreebankToken, ctx: Ctx): boolean {
  if (t.segment !== 'STEM' || !t.loc) return false;
  for (const o of ctx.byId.values()) {
    if (
      o.loc &&
      sameWord(o, t) &&
      o.id < t.id &&
      o.segment === 'PREFIX' &&
      o.pos === 'P'
    )
      return true;
  }
  return false;
}

function pronounKind(t: TreebankToken, ctx: Ctx): string {
  if (t.segment === 'SUFFIX' || attachedAfterPrefix(t, ctx)) return 'ضمير متصل';
  return 'ضمير منفصل';
}

/** "في محل رفع فاعل" for a built noun with a role. */
function mahall(c: Case | null, roleText: string): string {
  if (!c) return roleText;
  if (roleText === 'GEN') return `في محل جر`;
  return `في محل ${CASE_NOUN[c]} ${roleText}`.trim();
}

/** Prepositions named in "مجرور بالباء" when the head is a prefix. */
function prepPhrase(head: TreebankToken | undefined, t: TreebankToken): string {
  if (!head) return 'بحرف الجر';
  if (head.segment === 'PREFIX') {
    switch (head.prefix) {
      case 'bi+':
        return 'بالباء';
      case 'l:P+':
        return 'باللام';
      case 'ka+':
        return 'بالكاف';
      case 'w:P+':
        return 'بواو القسم';
      case 'ta+':
        return 'بتاء القسم';
    }
  }
  if (head.loc && !sameWord(t, head)) return `بـ${ref(head)}`;
  return 'بحرف الجر';
}

function nounLine(
  t: TreebankToken,
  ctx: Ctx,
  wordSuffixes: TreebankToken[],
): string {
  const isMubtada =
    ctx.predHeads.has(t.id) && (t.rel === 'root' || t.isConstituent);
  const role: Role | null = isMubtada
    ? {text: 'مبتدأ', case: 'NOM', fem: false}
    : t.isConstituent
      ? null
      : roleFor(t, t.rel, ctx);
  let c = caseOf(t, ctx);
  const head = ctx.byId.get(t.head);

  // Built nouns: pronouns, demonstratives, relatives, interrogatives.
  const built =
    t.pos === 'PRON' ||
    t.pos === 'DEM' ||
    t.pos === 'REL' ||
    isIntgNoun(t) ||
    isCondNoun(t) ||
    t.pos === 'IMPN' ||
    (!t.case && (t.pos === 'T' || t.pos === 'LOC'));

  if (built) {
    let kind: string;
    let tail = '';
    if (t.pos === 'PRON') kind = `${pronounKind(t, ctx)} ${pronBinaa(t)}`;
    else if (t.pos === 'DEM') {
      const dem = DEM_BINAA[t.lemma];
      kind = dem ? dem[0] : `اسم إشارة ${binaa(t.uthmani)}`;
      tail = dem ? dem[1] : '';
    } else if (t.pos === 'REL') kind = `اسم موصول ${binaa(t.uthmani)}`;
    else if (isIntgNoun(t)) kind = `اسم استفهام ${binaa(t.uthmani)}`;
    else if (isCondNoun(t)) kind = `اسم شرط ${binaa(t.uthmani)}`;
    else if (t.pos === 'IMPN') kind = `اسم فعل أمر ${binaa(t.uthmani)}`;
    else
      kind = `${t.pos === 'T' ? 'ظرف زمان' : 'ظرف مكان'} ${binaa(t.uthmani)}`;

    const withTail = (x: string) => (tail ? `${x}، ${tail}` : x);
    if (!role) return withTail(kind);
    if (role.text === 'GEN')
      return withTail(`${kind} في محل جر ${prepPhrase(head, t)}`);
    if (normRel(t.rel) === 'link') return withTail(`${kind}، ${role.text}`);
    if (normRel(t.rel) === 'voc') return withTail(`${kind} في محل نصب منادى`);
    if (!c) return withTail(`${kind}، ${role.text}`);
    return withTail(`${kind} ${mahall(c, role.text)}`);
  }

  // Declinable nouns.
  let lead = '';
  if (t.pos === 'PN' && t.lemma === '{ll~ah') lead = 'لفظ الجلالة';
  else if (t.pos === 'T') lead = 'ظرف زمان';
  else if (t.pos === 'LOC') lead = 'ظرف مكان';

  // لا النافية للجنس: her noun (single, not in idafa) is built on fath.
  if (
    role &&
    head?.special === 'SP:<in~' &&
    head.pos === 'NEG' &&
    /^subj<</.test(normRel(t.rel))
  ) {
    const e = ending(t.uthmani);
    if (
      e.type === 'vowel' &&
      e.vowel === 'a' &&
      !e.tanwin &&
      !wordSuffixes.length
    ) {
      return `${lead ? lead + ' ' : ''}${role.text} مبني على الفتح في محل نصب`;
    }
  }

  // Vocative: a single (مفرد) definite منادى — a name or a نكرة مقصودة —
  // is built on damm in the place of nasb (يَٰمُوسَىٰ، يَٰٓأَيُّهَا); one in
  // idafa (رَبِّ، يَٰقَوْمِ) or indefinite is accusative.
  if (normRel(t.rel) === 'voc') {
    const mudaf =
      wordSuffixes.some(s => s.pos === 'PRON') ||
      (ctx.children.get(t.id) ?? []).some(x => normRel(x.rel) === 'Poss');
    if (/^>ay~(u|atu)haA$/.test(t.lemma) || /^>ay~/.test(t.lemma)) {
      return 'منادى نكرة مقصودة مبني على الضم في محل نصب، و«ها» حرف تنبيه';
    }
    // يَٰوَيْلَتَىٰٓ، يَٰٓأَسَفَىٰ، يَٰحَسْرَتَىٰ: the final alif is the ياء
    // المتكلم turned alif (the root has no weak last letter).
    if (
      !mudaf &&
      t.pos !== 'PN' &&
      ending(t.uthmani).type === 'alif' &&
      /ى$/.test(bare(t.treebankText)) &&
      !/[wy]$/.test(t.root)
    ) {
      return (
        'منادى منصوب وعلامة نصبه الفتحة المقدرة على ما قبل ياء المتكلم المنقلبة ألفًا، ' +
        'والألف ضمير متصل في محل جر مضاف إليه'
      );
    }
    if (!mudaf && !t.indef) {
      const damm =
        ending(t.uthmani).type === 'alif'
          ? 'مبني على الضم المقدر على الألف للتعذر'
          : 'مبني على الضم';
      return `${lead ? lead + ' ' : ''}منادى ${damm} في محل نصب`;
    }
    c = 'ACC';
  }

  if (!c) {
    const name = lead || (role ? '' : 'اسم');
    return [name, role?.text].filter(Boolean).join(' ');
  }
  const fem = role?.fem ?? false;
  const adj = CASE_ADJ[c][fem ? 1 : 0];
  const sign = nounSign(t, c, fem, wordSuffixes);
  let main: string;
  if (!role) main = `${lead || 'اسم'} ${adj}`;
  else if (role.text === 'GEN')
    main = `${lead || 'اسم'} ${adj} ${prepPhrase(head, t)}`;
  else if (normRel(t.rel) === 'link') {
    main = `${lead || 'اسم'} ${adj}، ${role.text}`;
    return sign ? `${lead || 'اسم'} ${adj} ${sign}، ${role.text}` : main;
  } else main = `${lead ? lead + ' ' : ''}${role.text} ${adj}`;
  return sign ? `${main} ${sign}` : main;
}

/** Built ending of a pronoun, with the conventional ones fixed. */
function pronBinaa(t: TreebankToken): string {
  if (t.segment === 'SUFFIX') {
    const name = subjectSuffixName(pronPgn(t), 'IMPF', t.uthmani);
    if (
      name === 'واو الجماعة' ||
      name === 'ألف الاثنين' ||
      name === 'ياء المخاطبة'
    )
      return 'مبني على السكون';
    if (name === 'نون النسوة') return 'مبني على الفتح';
  }
  return binaa(t.uthmani);
}

// ---------------------------------------------------------------------------
// Verb i'rab

/** A verb whose last root letter is و or ي (ناقص: دعا، رمى، خشي). */
function isWeakFinal(t: TreebankToken): boolean {
  return /[wy]$/.test(t.root);
}

/** The subject pronoun suffix of a verb word, if any. */
function subjectSuffix(
  wordSuffixes: TreebankToken[],
): TreebankToken | undefined {
  return (
    wordSuffixes.find(
      s => s.pos === 'PRON' && ['Subj', 'Pass'].includes(normRel(s.rel)),
    ) ??
    wordSuffixes.find(s => s.pos === 'PRON' && /subj<</.test(normRel(s.rel)))
  );
}

function verbLine(
  t: TreebankToken,
  ctx: Ctx,
  wordSuffixes: TreebankToken[],
): string {
  const subj = subjectSuffix(wordSuffixes);
  const spgn = subj ? pronPgn(subj) : '';
  const emphN = wordSuffixes.some(
    s => s.suffix === 'EMPH:n' || (s.pos === 'EMPH' && s.segment === 'SUFFIX'),
  );
  const naqis =
    t.special === 'SP:kaAn'
      ? ' ناقص'
      : t.special === 'SP:kaAd'
        ? ' من أفعال المقاربة'
        : '';
  const passive = t.voice === 'PASS' ? ' مبني للمجهول' : '';
  const e = ending(t.uthmani);
  const parts: string[] = [];

  if (t.aspect === 'PERF') {
    let b: string;
    if (spgn === '3MP') b = 'مبني على الضم لاتصاله بواو الجماعة';
    else if (/^(1S|1P|2MS|2FS|2MP|2FP|2D|3FP)$/.test(spgn))
      b = 'مبني على السكون لاتصاله بضمير رفع متحرك';
    else if (/^3[MF]?D$/.test(spgn)) b = 'مبني على الفتح';
    else if (
      t.pgn === '3FS' &&
      /ت$/.test(bare(t.uthmani)) &&
      (e.type === 'sukun' || (e.type === 'vowel' && e.vowel === 'i'))
    ) {
      b =
        isWeakFinal(t) && !/ات$/.test(bare(t.uthmani))
          ? 'مبني على الفتح المقدر على الألف المحذوفة لالتقاء الساكنين، والتاء تاء التأنيث الساكنة لا محل لها من الإعراب'
          : 'مبني على الفتح، والتاء تاء التأنيث الساكنة لا محل لها من الإعراب';
    } else if (e.type === 'vowel' && e.vowel === 'a') b = 'مبني على الفتح';
    else if (e.type === 'alif') b = 'مبني على الفتح المقدر على الألف للتعذر';
    else if (e.type === 'vowel' && e.vowel === 'u') b = 'مبني على الضم';
    else b = 'مبني';
    parts.push(`فعل ماض${naqis}${passive} ${b}`);
  } else if (t.aspect === 'IMPF') {
    const mood: Mood = (t.mood || 'IND') as Mood;
    const five = /^(3MP|2MP|3MD|3FD|2D|3D|2FS)$/.test(spgn);
    let s: string;
    if (five) {
      s =
        mood === 'IND'
          ? `مرفوع ${signLead('IND', false)} ثبوت النون لأنه من الأفعال الخمسة`
          : `${MOOD_ADJ[mood]} ${signLead(mood, false)} حذف النون لأنه من الأفعال الخمسة`;
    } else if (/^(3FP|2FP)$/.test(spgn)) {
      s = `مبني على السكون لاتصاله بنون النسوة${mood !== 'IND' ? ` في محل ${MOOD_NOUN[mood]}` : ''}`;
    } else if (emphN) {
      s = `مبني على الفتح لاتصاله بنون التوكيد${mood !== 'IND' ? ` في محل ${MOOD_NOUN[mood]}` : ''}`;
    } else {
      const lead = `${MOOD_ADJ[mood]} ${signLead(mood, false)}`;
      if (mood === 'IND') {
        if (e.type === 'vowel' && e.vowel === 'u') s = `${lead} الضمة`;
        else if (e.type === 'alif')
          s = `${lead} الضمة المقدرة على الألف للتعذر`;
        else if (e.type === 'waw') s = `${lead} الضمة المقدرة على الواو للثقل`;
        else if (e.type === 'ya') s = `${lead} الضمة المقدرة على الياء للثقل`;
        else s = MOOD_ADJ[mood];
      } else if (mood === 'SUBJ') {
        if (e.type === 'vowel' && e.vowel === 'a') s = `${lead} الفتحة`;
        else if (e.type === 'alif')
          s = `${lead} الفتحة المقدرة على الألف للتعذر`;
        else s = MOOD_ADJ[mood];
      } else {
        if (e.type === 'sukun') s = `${lead} السكون`;
        else if (e.type === 'vowel' && isWeakFinal(t) && !e.shadda)
          s = `${lead} حذف حرف العلة`;
        else if (e.type === 'vowel' && e.vowel === 'i' && !e.shadda)
          s = `${lead} السكون، وحُرّك بالكسر لالتقاء الساكنين`;
        else s = MOOD_ADJ[mood];
      }
    }
    parts.push(`فعل مضارع${naqis}${passive} ${s}`);
  } else if (t.aspect === 'IMPV') {
    let b: string;
    if (/^(2MP|2FS|2D|2MD|2FD)$/.test(spgn)) b = 'مبني على حذف النون';
    else if (spgn === '2FP') b = 'مبني على السكون لاتصاله بنون النسوة';
    else if (emphN) b = 'مبني على الفتح لاتصاله بنون التوكيد';
    else if (e.type === 'sukun') b = 'مبني على السكون';
    else if (e.type === 'vowel' && isWeakFinal(t) && !e.shadda)
      b = 'مبني على حذف حرف العلة';
    else if (e.type === 'vowel' && e.vowel === 'i' && !e.shadda)
      b = 'مبني على السكون، وحُرّك بالكسر لالتقاء الساكنين';
    else b = 'مبني';
    parts.push(`فعل أمر${naqis} ${b}`);
  } else {
    parts.push('فعل');
  }

  const r = normRel(t.rel);
  if (!t.isConstituent) {
    if (r === 'cond') parts.push('وهو فعل الشرط');
    if (r === 'rslt') parts.push('وهو جواب الشرط');
    if (r === 'imrs') parts.push('وهو جواب الطلب');
  }
  return parts.join('، ');
}

// ---------------------------------------------------------------------------
// Particle i'rab

const FEMININE_PARTICLE = /^(همزة|لام|واو|فاء|تاء|لا |ما |رابطة|نون|السين)/;

function particleLine(t: TreebankToken): string {
  if (t.pos === 'INL') return 'حروف مقطعة لا محل لها من الإعراب';
  const [name, tail] = particleName(t).split('، ');
  const fem = FEMININE_PARTICLE.test(name);
  const b = binaa(t.uthmani).replace(/^مبني/, fem ? 'مبنية' : 'مبني');
  const line = `${name} ${b} لا محل ${fem ? 'لها' : 'له'} من الإعراب`;
  return tail ? `${line}، ${tail}` : line;
}

// ---------------------------------------------------------------------------
// Implied tokens and phrases

function impliedLine(t: TreebankToken, ctx: Ctx): string {
  const r = normRel(t.rel);
  const role = roleFor(t, t.rel, ctx);
  const word = bare(t.uthmani);
  if (t.pos === 'PRON') {
    const est = word ? ` تقديره «${word}»` : '';
    const name =
      r === 'Subj'
        ? 'الفاعل'
        : r === 'Pass'
          ? 'نائب الفاعل'
          : role
            ? role.text
            : 'ضمير';
    return `${name} ضمير مستتر${est}`;
  }
  if (t.pos === 'VOC') return 'حرف نداء محذوف';
  if (t.pos === 'V') return 'فعل محذوف';
  if (t.pos === 'P') return 'حرف جر محذوف';
  if (ctx.predHeads.has(t.id)) return 'مبتدأ محذوف';
  if (role && role.text !== 'GEN') {
    return `${role.text} محذوف${role.fem ? 'ة' : ''}`;
  }
  return 'محذوف';
}

/** Description of an implied token used as a head ("بمحذوف خبر"). */
function impliedHeadPhrase(h: TreebankToken, ctx: Ctx): string {
  if (h.pos === 'V') return 'بفعل محذوف';
  if (ctx.predHeads.has(h.id)) return 'بمحذوف مبتدأ';
  const role = roleFor(h, h.rel, ctx);
  if (!role || role.text === 'GEN') return 'بمحذوف';
  return `بمحذوف ${role.text}`;
}

function buildCtx(tokens: TreebankToken[]): Ctx {
  const byId = new Map(tokens.map(t => [t.id, t]));
  const children = new Map<number, TreebankToken[]>();
  const predHeads = new Set<number>();
  for (const t of tokens) {
    const r = normRel(t.rel);
    if (r === 'root' || r === 'NonRel' || t.head === t.id) continue;
    const list = children.get(t.head) ?? [];
    list.push(t);
    children.set(t.head, list);
    if (r === 'Pred') predHeads.add(t.head);
  }
  return {byId, children, predHeads};
}

/**
 * The case each token's role fixes (فاعل → رفع, مفعول به → نصب, مضاف إليه
 * → جر ...), for tokens whose role decides it alone. Used to settle a
 * treebank case label that contradicts the token's own role.
 */
export function roleCases(tokens: TreebankToken[]): Map<number, Case> {
  const ctx = buildCtx(tokens);
  const out = new Map<number, Case>();
  for (const t of tokens) {
    if (!t.loc) continue;
    if (ctx.predHeads.has(t.id) && (t.rel === 'root' || t.isConstituent)) {
      out.set(t.id, 'NOM');
      continue;
    }
    if (t.isConstituent) continue;
    const role = roleFor(t, t.rel, ctx);
    if (role && role.case && role.case !== 'FOLLOW') out.set(t.id, role.case);
  }
  return out;
}

/** Role key of a stem for cross-checking (see masaq.ts SAME). */
function stemRoleKey(t: TreebankToken, ctx: Ctx): string | null {
  const r = normRel(t.rel);
  if (ctx.predHeads.has(t.id) && (r === 'root' || t.isConstituent))
    return 'MUBTADA';
  if (t.isConstituent || t.pos === 'V') return null;
  const fam = /^(subj|pred)<</.exec(r);
  return fam ? fam[1] : r;
}

/** The word naming a clause: its verb when the head is a particle. */
function clauseWord(h: TreebankToken, ctx: Ctx): TreebankToken {
  if (h.pos === 'V' || !h.isConstituent || h.constituentFrom === null) return h;
  for (const t of ctx.byId.values()) {
    if (
      t.loc &&
      t.pos === 'V' &&
      t.id >= h.constituentFrom &&
      t.id <= (h.constituentTo ?? -1)
    )
      return t;
  }
  return h;
}

const PHRASE_NAME: Record<string, string> = {
  NS: 'والجملة الاسمية',
  VS: 'والجملة الفعلية',
  CS: 'وجملة الشرط',
  S: 'والجملة',
  SC: 'والمصدر المؤول',
};

function phraseLine(
  headTok: TreebankToken,
  label: string,
  ctx: Ctx,
): string | null {
  const r = normRel(headTok.rel);
  const head = ctx.byId.get(headTok.head);
  const headIsSelf = !head || head.id === headTok.id;

  if (label === 'PP') {
    const target =
      r !== 'link'
        ? null
        : headIsSelf
          ? null
          : head!.loc
            ? `بـ${ref(head!)}`
            : impliedHeadPhrase(head!, ctx);
    if (r === 'link') {
      return target
        ? `والجار والمجرور متعلقان ${target}`
        : 'والجار والمجرور متعلقان';
    }
    const role = roleFor(headTok, headTok.rel, ctx);
    const c = phraseCase(headTok, ctx);
    if (role && role.text !== 'GEN') {
      return c
        ? `وشبه الجملة في محل ${CASE_NOUN[c]} ${role.text}`
        : `وشبه الجملة ${role.text}`;
    }
    return null;
  }

  const name = PHRASE_NAME[label] ?? 'والجملة';
  const isSC = label === 'SC';
  // A phrase that is the subject of a predicate (ءَأَنذَرْتَهُمْ in 2:6: the
  // hamza and its verb stand for a verbal noun, the مبتدأ).
  if ((r === 'root' || r === 'NonRel') && ctx.predHeads.has(headTok.id)) {
    return isSC || headTok.pos === 'EQ'
      ? 'والمصدر المؤول في محل رفع مبتدأ'
      : `${name} في محل رفع مبتدأ`;
  }
  switch (r) {
    case 'sub':
      return isSC ? null : `${name} صلة الموصول لا محل لها من الإعراب`;
    case 'root':
    case 'NonRel':
      return isSC ? null : `${name} لا محل لها من الإعراب`;
    case 'int':
      return `${name} تفسيرية لا محل لها من الإعراب`;
    case 'cond':
      return `${name} فعل الشرط`;
    case 'rslt':
      return `${name} جواب الشرط`;
    case 'imrs':
      return `${name} جواب الطلب`;
    case 'conj': {
      const target = head ? clauseWord(head, ctx) : undefined;
      return target?.loc
        ? `${name} معطوفة على جملة ${ref(target)}`
        : `${name} معطوفة على ما قبلها`;
    }
  }
  if (PARTICLE_RELS.has(r)) return null;
  const role = roleFor(headTok, headTok.rel, ctx);
  if (!role) return null;
  const c = phraseCase(headTok, ctx);
  if (role.text === 'GEN') {
    return `${name} في محل جر ${prepPhrase(head, headTok)}`;
  }
  return c
    ? `${name} في محل ${CASE_NOUN[c]} ${role.text}`
    : `${name} ${role.text}`;
}

// ---------------------------------------------------------------------------
// Sentence → word entries

/** Descendants of a token (inclusive) within the sentence. */
function subtree(
  t: TreebankToken,
  ctx: Ctx,
  seen = new Set<number>(),
): TreebankToken[] {
  if (seen.has(t.id)) return [];
  seen.add(t.id);
  const out = [t];
  for (const c of ctx.children.get(t.id) ?? [])
    out.push(...subtree(c, ctx, seen));
  return out;
}

/**
 * The i'rab entries of one treebank sentence, added to `out` per word.
 * Words are visited in token order, so entries keep reading order.
 */
export function sentenceEntries(
  tokens: TreebankToken[],
  out: WordEntries,
  stems?: StemInfo,
): void {
  const ctx = buildCtx(tokens);

  if (stems) {
    for (const t of tokens) {
      if (!t.loc || t.segment !== 'STEM') continue;
      const k = wordKey(t)!;
      const prev = stems.get(k);
      const content =
        !PARTICLE_POS.has(t.pos) || isIntgNoun(t) || isCondNoun(t);
      if (prev && (!content || !PARTICLE_POS.has(prev.stem.pos))) continue;
      stems.set(k, {stem: t, roleKey: content ? stemRoleKey(t, ctx) : null});
    }
  }

  const real = tokens.filter(t => t.loc);
  const push = (key: string, e: IrabEntry) => {
    const list = out.get(key) ?? [];
    list.push(e);
    out.set(key, list);
  };

  // Suffixes per word, for signs that depend on them.
  const suffixesOf = new Map<string, TreebankToken[]>();
  for (const t of real) {
    if (t.segment !== 'SUFFIX') continue;
    const k = wordKey(t)!;
    suffixesOf.set(k, [...(suffixesOf.get(k) ?? []), t]);
  }

  // Phrase lines: attached to the word of the phrase's last real token.
  const phrases: {
    key: string;
    size: number;
    entry: IrabEntry;
    after: number;
  }[] = [];
  const addPhrase = (
    headTok: TreebankToken,
    label: string,
    span: TreebankToken[],
  ) => {
    const words = span.filter(s => s.loc).sort((a, b) => a.id - b.id);
    if (!words.length) return;
    const text = phraseLine(headTok, label, ctx);
    if (!text) return;
    const first = words[0];
    const last = words[words.length - 1];
    phrases.push({
      key: wordKey(last)!,
      size: words.length,
      // After the span's last token, implied ones included.
      after: Math.max(...span.map(x => x.id)),
      entry: {
        kind: 'phrase',
        label: '',
        text,
        span: [wordKey(first)!, wordKey(last)!],
      },
    });
  };
  for (const t of tokens) {
    if (
      t.isConstituent &&
      t.constituentFrom !== null &&
      t.constituentTo !== null
    ) {
      const span = tokens.filter(
        s => s.id >= t.constituentFrom! && s.id <= t.constituentTo!,
      );
      addPhrase(t, t.constituentLabel, span);
    } else if (t.pos === 'V' && t.loc) {
      const r = normRel(t.rel);
      if (!CLAUSE_ROLES.has(r) && !PARTICLE_RELS.has(r) && r !== 'root') {
        addPhrase(t, 'VS', subtree(t, ctx));
      }
    }
  }

  // Token lines in order; implied tokens join the previous real word.
  let lastKey: string | null = null;
  const pendingImplied: IrabEntry[] = [];
  const sorted = [...tokens].sort((a, b) => a.id - b.id);
  for (const t of sorted) {
    if (!t.loc) {
      const e: IrabEntry = {
        kind: 'implied',
        label: 'مقدَّر',
        text: impliedLine(t, ctx),
      };
      if (lastKey) push(lastKey, e);
      else pendingImplied.push(e);
      closePhrases(t.id);
      continue;
    }
    const key = wordKey(t)!;
    if (pendingImplied.length) {
      for (const e of pendingImplied.splice(0)) push(key, e);
    }
    lastKey = key;
    if (t.pos !== 'DET') pushTokenLine(t, key); // أل التعريف: no line

    closePhrases(t.id);
  }
  for (const e of pendingImplied) if (lastKey) push(lastKey, e);

  /** Phrases ending at token `id`, innermost first. */
  function closePhrases(id: number): void {
    const closing = phrases
      .filter(p => p.after === id)
      .sort((a, b) => a.size - b.size);
    for (const p of closing) push(p.key, p.entry);
  }

  function pushTokenLine(t: TreebankToken, key: string): void {
    const suffixes = suffixesOf.get(key) ?? [];
    let text: string;
    if (t.pos === 'V') text = verbLine(t, ctx, suffixes);
    else if (PARTICLE_POS.has(t.pos) && !isIntgNoun(t) && !isCondNoun(t))
      text = particleLine(t);
    else text = nounLine(t, ctx, t.segment === 'STEM' ? suffixes : []);

    if (t.segment === 'PREFIX') {
      push(key, {kind: 'prefix', label: prefixLabel(t), text});
    } else if (t.segment === 'SUFFIX') {
      let label: string;
      if (t.suffix === 'EMPH:n') {
        label = 'نون التوكيد';
        text = 'حرف توكيد مبني على الفتح لا محل له من الإعراب';
      } else if (t.suffix === 'VOC:m') {
        label = 'الميم';
        text = 'عوض عن حرف النداء المحذوف، مبني على الفتح لا محل له من الإعراب';
      } else {
        const stem = real.find(s => wordKey(s) === key && s.segment === 'STEM');
        label = subjectSuffixName(
          pronPgn(t),
          stem?.aspect || 'IMPF',
          t.uthmani,
        );
        if (
          !['Subj', 'Pass'].includes(normRel(t.rel)) &&
          !/^subj<</.test(normRel(t.rel))
        ) {
          const b = bare(t.uthmani);
          label = LETTER_NAME[b] ?? `«${b}»`;
        }
      }
      push(key, {kind: 'suffix', label, text});
    } else {
      // A word with two stems (مِمَّا = مِن + مَا): name each.
      const stems = real.filter(
        s => wordKey(s) === key && s.segment === 'STEM',
      );
      const label = stems.length > 1 ? `«${bare(t.uthmani)}»` : '';
      push(key, {kind: 'stem', label, text});
    }
  }
}
