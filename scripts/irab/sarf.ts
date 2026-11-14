/**
 * Morphology (الصرف) of each word, from the Quranic Treebank's morphological
 * columns (taken from the Quranic Arabic Corpus): part of speech, root and
 * its soundness, lemma, verb tense / voice / pattern / person, derived-noun
 * type, gender, number and plural type, definiteness, transitivity, and how
 * often the root and lemma occur in the Quran.
 *
 * Every fact is read from a labelled column or from the root's letters; none
 * is guessed from the word's spelling except the sound-plural ending (ون/ين,
 * ات), which the noun's own number label must confirm.
 */
import {
  bare,
  MULHAQ_LEMMAS as MULHAQ,
  MULHAQ_WORD,
  type TreebankToken,
} from './irabText';

/** [label, value]; values may hold word references ({{s:a:w}}). */
export type MorphFact = [string, string];

/** Buckwalter root letters → Arabic. `A` is hamza in the corpus' roots. */
const ROOT_LETTER: Record<string, string> = {
  A: 'ء',
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

export function rootLetters(root: string): string[] | null {
  const out = [...root].map(c => ROOT_LETTER[c]);
  return out.every(Boolean) ? out : null;
}

/**
 * The root's soundness (الصحيح والمعتل): "صحيح سالم", "مهموز الفاء",
 * "مضعف", "مثال واوي", "أجوف يائي", "ناقص واوي", "لفيف مفروق" ...
 */
export function rootType(root: string): string | null {
  const ls = rootLetters(root);
  if (!ls) return null;
  if (ls.length === 4) {
    const weak = ls.some(l => l === 'و' || l === 'ي');
    const hamz = ls.includes('ء');
    if (ls[0] === ls[2] && ls[1] === ls[3]) return 'رباعي مضعف';
    return weak ? 'رباعي معتل' : hamz ? 'رباعي مهموز' : 'رباعي صحيح';
  }
  if (ls.length !== 3) return null;
  const [f, e, l] = ls;
  const isWeak = (c: string) => c === 'و' || c === 'ي';
  const kind = (c: string) => (c === 'و' ? 'واوي' : 'يائي');
  const parts: string[] = [];
  if (isWeak(f) && isWeak(l)) parts.push('لفيف مفروق');
  else if (isWeak(e) && isWeak(l)) parts.push('لفيف مقرون');
  else if (isWeak(f)) parts.push(`مثال ${kind(f)}`);
  else if (isWeak(e)) parts.push(`أجوف ${kind(e)}`);
  else if (isWeak(l)) parts.push(`ناقص ${kind(l)}`);
  if (parts.length) {
    const hamza = [f, e, l].indexOf('ء');
    if (hamza >= 0) parts.push(`مهموز ${['الفاء', 'العين', 'اللام'][hamza]}`);
    return `معتل ${parts.join('، ')}`;
  }
  const hamza = [f, e, l].indexOf('ء');
  if (hamza >= 0) return `صحيح مهموز ${['الفاء', 'العين', 'اللام'][hamza]}`;
  if (e === l) return 'صحيح مضعف';
  return 'صحيح سالم';
}

/** Verb forms (الأوزان): the past-tense pattern of each derived form. */
const FORM: Record<string, [string, string]> = {
  II: ['فَعَّلَ', 'مزيد بحرف'],
  III: ['فَاعَلَ', 'مزيد بحرف'],
  IV: ['أَفْعَلَ', 'مزيد بحرف'],
  V: ['تَفَعَّلَ', 'مزيد بحرفين'],
  VI: ['تَفَاعَلَ', 'مزيد بحرفين'],
  VII: ['اِنْفَعَلَ', 'مزيد بحرفين'],
  VIII: ['اِفْتَعَلَ', 'مزيد بحرفين'],
  IX: ['اِفْعَلَّ', 'مزيد بحرفين'],
  X: ['اِسْتَفْعَلَ', 'مزيد بثلاثة أحرف'],
  XI: ['اِفْعَالَّ', 'مزيد بثلاثة أحرف'],
  XII: ['اِفْعَوْعَلَ', 'مزيد بثلاثة أحرف'],
};

/** "(IV)" → "IV"; '' for form I. */
function formOf(t: TreebankToken): string {
  return (t.verbForm ?? '').replace(/[()]/g, '');
}

function pattern(t: TreebankToken): string {
  const form = formOf(t);
  const rootLen = rootLetters(t.root)?.length ?? 0;
  if (!form || form === 'I') {
    return rootLen === 4 ? 'رباعي مجرد' : 'ثلاثي مجرد';
  }
  if (rootLen === 4) {
    // Quadriliteral forms: II تَفَعْلَلَ (the only one in the Quran).
    return form === 'II'
      ? 'رباعي مزيد بحرف على وزن «تَفَعْلَلَ»'
      : 'رباعي مزيد';
  }
  const f = FORM[form];
  return f ? `ثلاثي ${f[1]} على وزن «${f[0]}»` : 'ثلاثي مزيد';
}

const TENSE: Record<string, string> = {
  PERF: 'فعل ماضٍ',
  IMPF: 'فعل مضارع',
  IMPV: 'فعل أمر',
};

const PERSON: Record<string, string> = {
  '1': 'للمتكلم',
  '2': 'للمخاطب',
  '3': 'للغائب',
};

/** "3MP" → "مسند للغائب، جمع مذكر" */
function verbPerson(pgn: string): string | null {
  const m = /^([123])([MF]?)([SDP]?)$/.exec(pgn);
  if (!m) return null;
  const [, p, g, n] = m;
  const parts = [PERSON[p]];
  if (p === '1') {
    parts.push(n === 'S' ? 'وحده' : 'ومعه غيره أو المعظم نفسه');
    return parts.join(' ');
  }
  const num = n === 'D' ? 'مثنى' : n === 'P' ? 'جمع' : 'مفرد';
  const gen = g === 'F' ? 'مؤنث' : g === 'M' ? 'مذكر' : '';
  return `${parts[0]}، ${[num, gen].filter(Boolean).join(' ')}`;
}

const SPECIAL: Record<string, string> = {
  'SP:kaAn': 'فعل ناقص من أخوات كان، يرفع الاسم وينصب الخبر',
  'SP:kaAd': 'فعل ناقص من أفعال المقاربة (كاد وأخواتها)',
  'SP:<in~': 'حرف ناسخ من أخوات إنّ، ينصب الاسم ويرفع الخبر',
};

const POS_NAME: Record<string, string> = {
  N: 'اسم',
  PN: 'اسم علم',
  ADJ: 'صفة',
  PRON: 'ضمير',
  DEM: 'اسم إشارة',
  REL: 'اسم موصول',
  T: 'ظرف زمان',
  LOC: 'ظرف مكان',
  IMPN: 'اسم فعل أمر',
};

const PARTICLE_NAME: Record<string, string> = {
  P: 'حرف جر',
  CONJ: 'حرف عطف',
  REM: 'حرف استئناف',
  NEG: 'حرف نفي',
  ACC: 'حرف نصب',
  EMPH: 'لام التوكيد',
  COND: 'أداة شرط',
  INTG: 'أداة استفهام',
  SUB: 'حرف مصدري',
  RES: 'أداة حصر',
  VOC: 'حرف نداء',
  CERT: 'حرف تحقيق',
  RSLT: 'حرف واقع في جواب الشرط',
  PRO: 'حرف نهي',
  PRP: 'لام التعليل',
  CIRC: 'واو الحال',
  SUP: 'حرف زائد',
  PREV: 'حرف كافّ',
  FUT: 'حرف استقبال',
  RET: 'حرف إضراب',
  EXP: 'أداة استثناء',
  CAUS: 'فاء السببية',
  INC: 'حرف ابتداء',
  IMPV: 'لام الأمر',
  EXL: 'حرف تفصيل',
  AMD: 'حرف استدراك',
  INT: 'حرف تفسير',
  EXH: 'حرف تحضيض',
  ANS: 'حرف جواب',
  SUR: 'حرف فجاءة',
  AVR: 'حرف ردع',
  COM: 'واو المعية',
  EQ: 'حرف تسوية',
  INL: 'حروف مقطعة',
};

const DERIVED: Record<string, string> = {
  ACT_PCPL: 'اسم فاعل',
  PASS_PCPL: 'اسم مفعول',
  VN: 'مصدر',
};

/** Collective nouns (اسم جمع) labelled plural. */
const COLLECTIVE = new Set(['n~aAs', '>unaAs', 'qawom', 'n~aEam']);

/** Gender and number: "مفرد مذكر", "جمع مذكر سالم", "جمع تكسير" ... */
function nounNumber(t: TreebankToken): string | null {
  const m = /^[123]?([MF]?)([SDP]?)$/.exec(t.pgn);
  if (!m || (!m[1] && !m[2])) return null;
  const [, g, n] = m;
  const gender = g === 'F' ? 'مؤنث' : g === 'M' ? 'مذكر' : '';
  if (!n || n === 'S') return ['مفرد', gender].filter(Boolean).join(' ');
  if (n === 'D') return ['مثنى', gender].filter(Boolean).join(' ');
  if (COLLECTIVE.has(t.lemma)) return 'اسم جمع';
  // Letters with the dagger alif read as alif (ٱلصَّٰلِحَٰت → الصالحات).
  const b = bare(t.uthmani.replace(/\u0670/g, 'ا')).replace(/ا+/g, 'ا');
  if (g === 'M' && /(ون|ين)$/.test(b)) {
    if (MULHAQ.has(t.lemma) || MULHAQ_WORD.test(b))
      return 'ملحق بجمع المذكر السالم';
    // A root ending in ن keeps it before the suffix (مُؤْمِنُون); without
    // that the ن is the root's own and the plural is broken (قُرُون، عُيُون).
    const rootN = /n$/.test(t.root);
    const doubledN = /nn$/.test(t.root);
    const suffixed = !rootN || (/ن(ون|ين)$/.test(b) && !doubledN);
    if (suffixed) return 'جمع مذكر سالم';
  }
  if (g === 'M' && /[ويى]$/.test(b) && MULHAQ.has(t.lemma)) {
    return 'ملحق بجمع المذكر السالم (حذفت نونه للإضافة)';
  }
  if (
    g === 'M' &&
    /[وي]$/.test(b) &&
    (t.derived === 'ACT_PCPL' || t.derived === 'PASS_PCPL' || t.pos === 'ADJ')
  ) {
    return 'جمع مذكر سالم (حذفت نونه للإضافة)';
  }
  if (g === 'F' && /ات$/.test(b) && !/t$/.test(t.root)) return 'جمع مؤنث سالم';
  return 'جمع تكسير';
}

export interface SentenceContext {
  tokens: TreebankToken[];
  /** Word tokens of the stem's own word (prefixes, stem, suffixes). */
  word: TreebankToken[];
}

function wordRef(t: TreebankToken): string | null {
  return t.loc ? `{{${t.loc.surah}:${t.loc.ayah}:${t.loc.word}}}` : null;
}

function sameWordTokens(
  t: TreebankToken,
  tokens: TreebankToken[],
): TreebankToken[] {
  if (!t.loc) return [t];
  const {surah, ayah, word} = t.loc;
  return tokens.filter(
    x =>
      x.loc &&
      x.loc.surah === surah &&
      x.loc.ayah === ayah &&
      x.loc.word === word,
  );
}

const OWN_DEFINITE: Record<string, string> = {
  PN: 'معرفة (علم)',
  PRON: 'معرفة (ضمير)',
  DEM: 'معرفة (اسم إشارة)',
  REL: 'معرفة (اسم موصول)',
};

/**
 * "نكرة", "معرفة بأل", "معرفة بالإضافة" ...; an idafa chain is followed to
 * its end (مَٰلِكِ يَوْمِ ٱلدِّينِ: يوم is made definite by ٱلدِّين).
 */
function definiteness(
  t: TreebankToken,
  tokens: TreebankToken[],
  depth = 0,
): string | null {
  if (t.indef) return 'نكرة';
  if (sameWordTokens(t, tokens).some(x => x.pos === 'DET')) return 'معرفة بأل';
  if (OWN_DEFINITE[t.pos]) return OWN_DEFINITE[t.pos];
  const poss = tokens.find(
    x => x.head === t.id && x.rel === 'Poss' && x.id !== t.id,
  );
  if (poss && depth < 8) {
    const d = definiteness(poss, tokens, depth + 1);
    if (d === null) return null;
    return d.startsWith('معرفة') ? 'معرفة بالإضافة' : 'نكرة مخصصة بالإضافة';
  }
  return null;
}

/** "هم: ضمير متصل للغائب، جمع مذكر" for a word's attached pronouns. */
function attachedPronouns(
  ctx: SentenceContext,
  stem: TreebankToken,
): string | null {
  const prons = ctx.word.filter(
    x => x !== stem && x.segment === 'SUFFIX' && x.pos === 'PRON',
  );
  if (!prons.length) return null;
  return prons
    .map(p => {
      const pgn = /PRON:([123][MF]?[SDP])/.exec(p.features)?.[1] ?? p.pgn;
      const person = verbPerson(pgn);
      return person ? `ضمير متصل ${person}` : 'ضمير متصل';
    })
    .join('؛ ');
}

export interface Counts {
  root: Map<string, number>;
  lemma: Map<string, number>;
}

/** Root and lemma occurrence counts over all stems of the Quran. */
export function countStems(sentences: Iterable<TreebankToken[]>): Counts {
  const root = new Map<string, number>();
  const lemma = new Map<string, number>();
  for (const tokens of sentences) {
    for (const t of tokens) {
      if (!t.loc || t.segment !== 'STEM') continue;
      if (t.root) root.set(t.root, (root.get(t.root) ?? 0) + 1);
      if (t.lemma)
        lemma.set(
          `${t.pos}|${t.lemma}`,
          (lemma.get(`${t.pos}|${t.lemma}`) ?? 0) + 1,
        );
    }
  }
  return {root, lemma};
}

/** Arabic-Indic digits (the facts are Arabic prose). */
function arabicDigits(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

export function times(n: number): string {
  if (n === 1) return 'مرة واحدة';
  if (n === 2) return 'مرتين';
  if (n <= 10) return `${arabicDigits(n)} مرات`;
  return `${arabicDigits(n)} مرة`;
}

/** The morphology facts of a word's main stem. */
export function stemFacts(
  t: TreebankToken,
  ctx: SentenceContext,
  counts: Counts,
): MorphFact[] {
  const facts: MorphFact[] = [];
  const isVerb = t.pos === 'V';
  const nominal = !!POS_NAME[t.pos];

  // Kind of word.
  if (isVerb) {
    facts.push(['نوع الكلمة', TENSE[t.aspect] ?? 'فعل']);
  } else if (nominal) {
    const derived = DERIVED[t.derived];
    facts.push(['نوع الكلمة', derived ?? POS_NAME[t.pos]]);
  } else if (PARTICLE_NAME[t.pos]) {
    facts.push(['نوع الكلمة', PARTICLE_NAME[t.pos]]);
  }
  if (t.pos === 'NEG' && t.special === 'SP:<in~') {
    facts.push([
      'ملاحظة',
      'لا النافية للجنس، تعمل عمل إنّ فتنصب الاسم وترفع الخبر',
    ]);
  } else if (SPECIAL[t.special]) {
    facts.push(['ملاحظة', SPECIAL[t.special]]);
  }

  // Root and lemma.
  const letters = t.root ? rootLetters(t.root) : null;
  if (letters) {
    facts.push(['الجذر', letters.join(' ')]);
    const type = rootType(t.root);
    if (type) facts.push([isVerb ? 'نوع الفعل' : 'بنية الجذر', type]);
  }
  if (t.lemmaAr && (isVerb || nominal)) {
    facts.push(['الأصل المعجمي', t.lemmaAr]);
  }

  if (isVerb) {
    facts.push([
      'البناء',
      t.voice === 'PASS' ? 'مبني للمجهول' : 'مبني للمعلوم',
    ]);
    facts.push(['الوزن', pattern(t)]);
    const person = verbPerson(t.pgn);
    if (person) facts.push(['الإسناد', person]);
    if (t.aspect === 'IMPF') {
      const mood =
        t.mood === 'SUBJ' ? 'منصوب' : t.mood === 'JUS' ? 'مجزوم' : 'مرفوع';
      facts.push(['حالته', `معرب، ${mood}`]);
    } else {
      facts.push(['حالته', 'مبني']);
    }
    // Transitivity, only when an object is present in the verse.
    const objects = ctx.tokens.filter(
      x => x.head === t.id && x.id !== t.id && x.rel === 'Obj',
    );
    if (objects.length) {
      // Each object: the word (a reference), the attached pronoun, or an
      // implied (مقدَّر) one.
      const named = objects.map(o =>
        !o.loc
          ? 'مقدَّر'
          : ctx.word.includes(o)
            ? 'الضمير المتصل به'
            : wordRef(o)!,
      );
      const list = [...new Set(named)];
      facts.push([
        'التعدي',
        objects.length > 1
          ? `متعدٍّ إلى مفعولين: ${list.join(' و')}`
          : `متعدٍّ، ومفعوله ${list[0]}`,
      ]);
    } else if (t.voice === 'PASS') {
      facts.push([
        'التعدي',
        'متعدٍّ في الأصل، بُني للمجهول فرُفع مفعوله نائبًا عن الفاعل',
      ]);
    }
  } else if (nominal) {
    if (t.derived) {
      const form = formOf(t);
      const name = DERIVED[t.derived];
      const f = FORM[form];
      facts.push([
        'الاشتقاق',
        !form || form === 'I'
          ? `${name} من الفعل الثلاثي المجرد`
          : f
            ? `${name} من الفعل المزيد على وزن «${f[0]}»`
            : `${name} من الفعل المزيد`,
      ]);
    }
    if (t.pos === 'N' || t.pos === 'ADJ') {
      const num = nounNumber(t);
      if (num) facts.push(['العدد والجنس', num]);
    }
    const def = definiteness(t, ctx.tokens);
    if (def) facts.push(['التعريف', def]);
  }
  const pron = attachedPronouns(ctx, t);
  if (pron) facts.push(['الضمير المتصل', pron]);

  // How often it occurs.
  const occ: string[] = [];
  if (t.root && counts.root.get(t.root)) {
    occ.push(`الجذر ${times(counts.root.get(t.root)!)}`);
  }
  const lemmaCount = t.lemma
    ? counts.lemma.get(`${t.pos}|${t.lemma}`)
    : undefined;
  if (lemmaCount && (isVerb || nominal))
    occ.push(`هذا اللفظ ${times(lemmaCount)}`);
  if (occ.length) facts.push(['وروده في القرآن', occ.join('، ')]);

  return facts;
}
