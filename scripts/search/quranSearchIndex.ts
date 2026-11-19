// @ai-generated
/**
 * Builds the Quran search index (assets/data/quran-search-v1.db) from the
 * Hafs Digital Khatt words and the i'rab morphology. Pure: the CLI
 * (build-quran-search-db.ts) and the freshness test
 * (services/search/__tests__/quranSearchDb.test.ts) feed it the rows of both
 * DBs. Every check below is a build gate: a failure throws.
 *
 * Of the i'rab DB the index reads only the morphology of each word (its
 * proclitics, definiteness, lemma, root and stated root count), and meta
 * records the sha256 of exactly that (irab_morph_sha256), so a change to the
 * i'rab prose, the books or the text ids leaves the index fresh. Of the
 * Digital Khatt DB it reads each word's location and text, and meta records
 * the sha256 of those rows (dk_words_sha256), not of the file, so a rewrite
 * with the same rows leaves it fresh too. meta also names the source of the
 * morphology and carries its licence notice (QURAN_MORPHOLOGY_META).
 *
 * buildQuranSearchIndex (gates 1-4):
 *  1. 6,236 verses in mushaf order and 77,432 words outside the markers;
 *  2. Digital Khatt and QUL (i'rab) word counts agree in every verse except
 *     2:181, 8:6 and 13:37, where the extra slot is «ما» right after «بعد»;
 *  3. every word has a spelling, and every spelling uses only the folded
 *     alphabet (also checked over the other rewayat by alphabetViolations);
 *  4. every i'rab word maps to a slot, and per-root word counts equal the
 *     counts the i'rab data states (وروده في القرآن), except ء م م, where
 *     20:94 يَبْنَؤُمَّ holds two stems and the word counts only one.
 * checkQuranSearchIndex (gate 5): the golden queries pass, and every verse is
 * found by pasting its first 12 (or fewer) words.
 */
import crypto from 'crypto';
import {decodeEntries, decodeMorph} from '@/services/irab/irabFormat';
import {
  QURAN_KIND_FIXTURES,
  QURAN_ROOT_FIXTURES,
  QURAN_ROOT_QUERY_FIXTURES,
  QURAN_TEXT_FIXTURES,
  textFixtureFailure,
} from '@/utils/search/__fixtures__/quranSearchGolden';
import {
  encodePostings,
  packPosting,
  QURAN_FLAG_RANGE,
  QURAN_SEARCH_FORMAT,
  QURAN_SLOT_STRIDE,
  QURAN_VERSE_COUNT,
  verseIndexOf,
  verseKeyAt,
  type QuranLemma,
  type QuranRoot,
} from '@/utils/search/quranIndexFormat';
import {
  searchQuranText,
  type QuranPostingSource,
} from '@/utils/search/quranSearch';
import {
  foldQuranQueryWord,
  isFoldedForm,
  isVerseMarker,
  parseQuranQuery,
  procliticOfIrabLabel,
  QURAN_TEXT_NORMALIZER_VERSION,
  quranWordForms,
  quranWordSpellings,
  rootCandidates,
  type QuranProclitic,
  type QuranWordForm,
} from '@/utils/search/quranText';
import {DK_SPLIT_SLOTS, qulToDkPositions} from '@/utils/quranWordPositions';

export const QURAN_WORD_COUNT = 77_432;
export const QURAN_QUL_WORD_COUNT = 77_429;
/** Roots whose word count may differ from the stated (stem) count. */
export const ROOT_COUNT_EXCEPTIONS: Readonly<Record<string, number>> = {
  'ء م م': 1,
};
/** Words pasted per verse by the every-verse check. */
export const VERSE_CHECK_WORDS = 12;

/**
 * The meta rows that name where the index's roots, lemmas and proclitic
 * segmentation come from: the Quranic Arabic Corpus morphology that the
 * Quranic Treebank carries, read from the i'rab database. Its terms ask
 * that its copyright notice be reproduced in works derived from it, so
 * morphology_notice holds that notice, as published at
 * https://corpus.quran.com/download. See THIRD_PARTY_LICENSES.md.
 */
export const QURAN_MORPHOLOGY_META: Readonly<Record<string, string>> = {
  morphology_source:
    'Quranic Arabic Corpus, version 0.4 (https://corpus.quran.com): its ' +
    'morphology as carried by the Quranic Treebank ' +
    "(https://github.com/NoorBayan/Quranic) and read from the i'rab " +
    'database: the roots, lemmas and proclitic segmentation.',
  morphology_license:
    'Quranic Arabic Corpus: GNU General Public License, with the terms of ' +
    'use in morphology_notice. Quranic Treebank: MIT License, Copyright (c) ' +
    '2025 NoorBayan.',
  morphology_notice: [
    'Quranic Arabic Corpus (Version 0.4)',
    'Copyright (C) 2011 Kais Dukes',
    'License: GNU General Public License',
    '',
    'The Quranic Arabic Corpus includes syntactic and morphological',
    'annotation of the Quran, and builds on the verified Arabic text',
    'distributed by the Tanzil project.',
    '',
    'TERMS OF USE:',
    '',
    '- Permission is granted to copy and distribute verbatim copies',
    '  of this file, but CHANGING IT IS NOT ALLOWED.',
    '',
    '- This annotation can be used in any website or application,',
    '  provided its source (the Quranic Arabic Corpus) is clearly',
    '  indicated, and a link is made to http://corpus.quran.com to enable',
    '  users to keep track of changes.',
    '',
    '- This copyright notice shall be included in all verbatim copies',
    '  of the text, and shall be reproduced appropriately in all works',
    '  derived from or containing substantial portion of this file.',
    '',
    'Please check updates at: http://corpus.quran.com/download',
  ].join('\n'),
};

/**
 * Lemmas the corpus spells with the open taa of their drawn words, none of
 * which is written with ة, whose final ت is a taa marbuta in everyday
 * writing all the same: فطرة الله, ابتغاء مرضاة الله, ابنة عمران, غيابة
 * الجب, معصية الرسول, جمالة. Reviewed by hand. The other lemmas that end in
 * ت and are never drawn with ة are plurals (صَٰلِحَٰت), verbs, or words
 * written with ت in everyday writing too (طَٰغُوت, أُخْت, مَلَكُوت,
 * عَنكَبُوت, عِفْرِيت). A build gate checks that each is a lemma of the
 * data.
 */
export const TAA_MARBUTA_LEMMAS: readonly string[] = [
  'فِطْرَت',
  'مَرْضَات',
  'ٱبْنَت',
  'غَيَٰبَت',
  'مَعْصِيَت',
  'جِمَٰلَت',
];

/**
 * Lemmas the corpus spells with the final alif of their drawn words, whose
 * alif is an alif maqsura in everyday writing: أَقْصَا (المسجد الأقصى, من
 * أقصى المدينة) and تَتْرَا (تترى). Reviewed by hand. Words of a lemma the
 * corpus writes with ى (طَغَا of طَغَىٰ, لَدَا of لَدَى) need no entry. A
 * build gate checks that each is a lemma of the data.
 */
export const ALIF_MAQSURA_LEMMAS: readonly string[] = ['أَقْصَا', 'تَتْرَا'];

/**
 * Everyday spellings no rule derives, by slot, reviewed by hand:
 * لْـَٔيْكَةِ (26:176, 38:13) is drawn without the alif of its article
 * (الأيكة, as the text draws it at 15:78 and 50:14), لَتَّخَذْتَ (18:77)
 * is لاتخذت, and بِمُصَيْطِرٍ (88:22) is spelled with س in modern writing
 * (بمسيطر). Each entry names the word's letters as drawn, which a build
 * gate checks, so a change of the text cannot move a spelling onto another
 * word.
 */
export const REVIEWED_SPELLINGS: readonly {
  location: string;
  drawn: string;
  spellings: readonly string[];
}[] = [
  {location: '18:77:22', drawn: 'لتخذت', spellings: ['لاتخذت']},
  {location: '26:176:3', drawn: 'ليكه', spellings: ['الأيكة']},
  {location: '38:13:5', drawn: 'ليكه', spellings: ['الأيكة']},
  {location: '88:22:3', drawn: 'بمصيطر', spellings: ['بمسيطر']},
];

export const QURAN_SEARCH_SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE forms (
  form TEXT PRIMARY KEY,
  postings TEXT NOT NULL,
  whole INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE roots (
  id INTEGER PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  words INTEGER NOT NULL,
  ayahs INTEGER NOT NULL
);
CREATE TABLE lemmas (
  id INTEGER PRIMARY KEY,
  root_id INTEGER NOT NULL,
  lemma TEXT,
  words INTEGER NOT NULL,
  ayahs INTEGER NOT NULL,
  postings TEXT NOT NULL
);
CREATE INDEX lemmas_by_root ON lemmas (root_id, words DESC);
`;

export interface QuranSearchIndexInput {
  /** The Hafs words DB rows, in id order. */
  dkWords: readonly {location: string; text: string}[];
  /** word_irab rows (QUL numbering). */
  irabRows: readonly {
    verseKey: string;
    position: number;
    entries: string;
    morph: string;
  }[];
  /** The i'rab `texts` table, by id. */
  irabTexts: readonly string[];
  /** Optional imla'i spelling per slot ('s:a:w' → word): extra tier-3 forms. */
  imlaei?: ReadonlyMap<string, string>;
  /**
   * Recorded in meta. The Digital Khatt and i'rab parts are computed from the
   * rows (dkWordsSha256, irabMorphologySha256), not from their files.
   */
  sources: {imlaeiSha256?: string};
}

export interface QuranIndexLemma extends QuranLemma {
  /** slot * 32 for each word (flags 0), ascending. */
  codes: readonly number[];
}

export interface QuranSearchIndexContent {
  /** Folded form → ascending posting codes; forms in code-unit order. */
  forms: ReadonlyMap<string, readonly number[]>;
  /**
   * The forms only the letters as drawn give (يموسي, اليل): they match a
   * whole typed word, never the start of one (forms.whole = 1).
   */
  wholeWordForms: ReadonlySet<string>;
  roots: readonly QuranRoot[];
  lemmas: readonly QuranIndexLemma[];
  /** Every meta row except complete, which the writer adds last. */
  meta: Readonly<Record<string, string>>;
}

class GateError extends Error {}

function gate(ok: boolean, message: string): void {
  if (!ok) throw new GateError(`quran search index: ${message}`);
}

interface SlotMorph {
  proclitics: QuranProclitic[];
  definiteByArticle: boolean;
  lemma: string | null;
  root: string | null;
  statedRootCount: number | null;
}

const ARABIC_DIGIT = /[٠-٩]/g;

/** 'الجذر ٣٣٩ مرة، هذا اللفظ ...' → 339 (see scripts/irab/sarf.ts times()). */
export function statedRootCount(occurrence: string): number | null {
  const part = /الجذر ([^،]+)/.exec(occurrence)?.[1]?.trim();
  if (!part) return null;
  if (part === 'مرة واحدة') return 1;
  if (part === 'مرتين') return 2;
  const digits = /^([٠-٩]+) (مرات|مرة)$/.exec(part)?.[1];
  if (!digits) return null;
  return Number(
    digits.replace(ARABIC_DIGIT, d => String(d.charCodeAt(0) - 0x0660)),
  );
}

function morphOfRow(
  row: QuranSearchIndexInput['irabRows'][number],
  texts: readonly string[],
): SlotMorph {
  const proclitics: QuranProclitic[] = [];
  for (const entry of decodeEntries(row.entries, texts)) {
    if (entry.kind !== 'prefix') continue;
    const proclitic = procliticOfIrabLabel(entry.label);
    gate(
      proclitic !== null,
      `unknown proclitic «${entry.label}» at ${row.verseKey}:${row.position}`,
    );
    proclitics.push(proclitic as QuranProclitic);
  }
  const facts = new Map(
    decodeMorph(row.morph, texts).map(fact => [fact.label, fact.value]),
  );
  const occurrence = facts.get('وروده في القرآن');
  return {
    proclitics,
    definiteByArticle: facts.get('التعريف') === 'معرفة بأل',
    lemma: facts.get('الأصل المعجمي') ?? null,
    root: facts.get('الجذر') ?? null,
    statedRootCount: occurrence ? statedRootCount(occurrence) : null,
  };
}

/** One i'rab word (QUL numbering) and what the index reads of it. */
interface IrabWord {
  verseKey: string;
  position: number;
  morph: SlotMorph;
}

/** The morphology of every i'rab word: all the index reads of that DB. */
function irabWordsOf(
  input: Pick<QuranSearchIndexInput, 'irabRows' | 'irabTexts'>,
): IrabWord[] {
  return input.irabRows.map(row => ({
    verseKey: row.verseKey,
    position: row.position,
    morph: morphOfRow(row, input.irabTexts),
  }));
}

function morphologySha256(words: readonly IrabWord[]): string {
  const lines = words.map(({verseKey, position, morph}) => ({
    order: (verseIndexOf(verseKey) ?? -1) * QURAN_SLOT_STRIDE + position,
    line: [
      `${verseKey}:${position}`,
      morph.proclitics.join(','),
      morph.definiteByArticle ? '1' : '0',
      morph.lemma ?? '',
      morph.root ?? '',
      morph.statedRootCount ?? '',
    ].join('\t'),
  }));
  lines.sort((a, b) => a.order - b.order || codeUnitOrder(a.line, b.line));
  return sha256(lines.map(l => l.line).join('\n'));
}

/**
 * sha256 of the morphology the index reads from the i'rab DB: per word, in
 * mushaf order, its proclitics, whether the article defines it, its lemma,
 * its root and the root count the data states. It changes only when one of
 * those does: not with the i'rab prose, the books or the ids of the texts.
 */
export function irabMorphologySha256(
  input: Pick<QuranSearchIndexInput, 'irabRows' | 'irabTexts'>,
): string {
  return morphologySha256(irabWordsOf(input));
}

/**
 * sha256 of the Digital Khatt rows the index reads: each word's location and
 * text, in id order. It changes only when one of them does, not when the
 * file is rewritten with the same rows (as words.id became the primary key).
 */
export function dkWordsSha256(
  dkWords: QuranSearchIndexInput['dkWords'],
): string {
  return sha256(dkWords.map(w => `${w.location}\t${w.text}`).join('\n'));
}

function formScore(form: QuranWordForm): number {
  return form.tier * 10 - (form.rasmOnly ? 5 : 0);
}

function codeUnitOrder(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Every slot of the Hafs text, verse by verse, in mushaf order. */
function versesOf(
  dkWords: QuranSearchIndexInput['dkWords'],
): {key: string; words: Map<number, string>}[] {
  const verses: {key: string; words: Map<number, string>}[] = [];
  let words = 0;
  for (const row of dkWords) {
    if (isVerseMarker(row.text)) continue;
    const match = /^(\d+):(\d+):(\d+)$/.exec(row.location);
    gate(match !== null, `bad location ${row.location}`);
    const [, surah, ayah, position] = match as RegExpExecArray;
    const key = `${surah}:${ayah}`;
    let verse = verses[verses.length - 1];
    if (!verse || verse.key !== key) {
      verse = {key, words: new Map()};
      verses.push(verse);
    }
    const slot = Number(position);
    gate(
      slot === verse.words.size + 1 && slot < QURAN_SLOT_STRIDE,
      `slot ${row.location} out of order`,
    );
    verse.words.set(slot, row.text);
    words++;
  }
  gate(
    verses.length === QURAN_VERSE_COUNT,
    `${verses.length} verses, expected ${QURAN_VERSE_COUNT}`,
  );
  verses.forEach((verse, i) =>
    gate(verse.key === verseKeyAt(i), `verse ${verse.key} at index ${i}`),
  );
  gate(
    words === QURAN_WORD_COUNT,
    `${words} words, expected ${QURAN_WORD_COUNT}`,
  );
  return verses;
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** sha256 over every row of the three content tables, in canonical order. */
export function contentSha256(
  content: Pick<
    QuranSearchIndexContent,
    'forms' | 'wholeWordForms' | 'roots' | 'lemmas'
  >,
): string {
  const lines: string[] = ['forms'];
  for (const form of [...content.forms.keys()].sort()) {
    lines.push(
      [
        form,
        encodePostings(content.forms.get(form) ?? []),
        content.wholeWordForms.has(form) ? 1 : 0,
      ].join('\t'),
    );
  }
  lines.push('roots');
  for (const r of [...content.roots].sort((a, b) => a.id - b.id)) {
    lines.push(`${r.id}\t${r.root}\t${r.words}\t${r.ayahs}`);
  }
  lines.push('lemmas');
  for (const l of [...content.lemmas].sort((a, b) => a.id - b.id)) {
    lines.push(
      [
        l.id,
        l.rootId,
        l.lemma ?? '',
        l.words,
        l.ayahs,
        encodePostings(l.codes),
      ].join('\t'),
    );
  }
  return sha256(lines.join('\n'));
}

/** Builds the index; throws on a failed gate (1-4). */
export function buildQuranSearchIndex(
  input: QuranSearchIndexInput,
): QuranSearchIndexContent {
  const verses = versesOf(input.dkWords);
  const verseIndexByKey = new Map(verses.map((v, i) => [v.key, i]));

  // Gate 2: DK and QUL word counts.
  gate(
    input.irabRows.length === QURAN_QUL_WORD_COUNT,
    `${input.irabRows.length} i'rab words, expected ${QURAN_QUL_WORD_COUNT}`,
  );
  const qulCounts = new Map<string, number>();
  for (const row of input.irabRows) {
    qulCounts.set(row.verseKey, (qulCounts.get(row.verseKey) ?? 0) + 1);
  }
  for (const verse of verses) {
    const split = DK_SPLIT_SLOTS[verse.key];
    const qul = qulCounts.get(verse.key) ?? 0;
    if (split === undefined) {
      gate(
        verse.words.size === qul,
        `${verse.key}: DK ${verse.words.size}, QUL ${qul}`,
      );
      continue;
    }
    gate(verse.words.size === qul + 1, `${verse.key}: no split slot`);
    const before = quranWordSpellings(verse.words.get(split - 1) ?? '').imlaei;
    const extra = quranWordSpellings(verse.words.get(split) ?? '').imlaei;
    gate(
      before === 'بعد' && extra === 'ما',
      `${verse.key}: slots ${split - 1}-${split} are not «بعد ما»`,
    );
  }

  // Gate 4 (part): every i'rab word maps to a slot.
  const irabWords = irabWordsOf(input);
  const morphBySlot = new Map<number, SlotMorph>();
  for (const word of irabWords) {
    const verseIndex = verseIndexByKey.get(word.verseKey);
    gate(verseIndex !== undefined, `i'rab verse ${word.verseKey} not in DK`);
    const verse = verses[verseIndex as number];
    const position = qulToDkPositions(word.verseKey, word.position)[0];
    gate(
      verse.words.has(position),
      `i'rab word ${word.verseKey}:${word.position} has no slot`,
    );
    morphBySlot.set(
      (verseIndex as number) * QURAN_SLOT_STRIDE + position,
      word.morph,
    );
  }

  // The corpus spells some lemmas with the open taa of their drawn words:
  // ٱمْرَأَت for every امرأة. When a word of such a lemma is written with ة
  // (ٱمْرَأَةٌ), or the lemma is one of TAA_MARBUTA_LEMMAS, the lemma's ت
  // is a taa marbuta, and the forms read every word against the lemma with
  // ة, so the open-taa words (ٱمْرَأَتُ, فِطْرَتَ) get their ة spelling too.
  // The roots and lemmas tables keep the i'rab lemma.
  const lemmasOfData = new Set(
    [...morphBySlot.values()].map(morph => morph.lemma),
  );
  for (const lemma of [...TAA_MARBUTA_LEMMAS, ...ALIF_MAQSURA_LEMMAS]) {
    gate(lemmasOfData.has(lemma), `reviewed lemma ${lemma} is no lemma`);
  }
  const taaMarbutaLemmas = new Set<string>(TAA_MARBUTA_LEMMAS);
  for (const [slot, morph] of morphBySlot) {
    if (!morph.lemma || taaMarbutaLemmas.has(morph.lemma)) continue;
    const spelling = quranWordSpellings(morph.lemma).imlaei;
    if (!spelling.endsWith('ت')) continue;
    const withTaaMarbuta = `${spelling.slice(0, -1)}ه`;
    const verse = verses[Math.floor(slot / QURAN_SLOT_STRIDE)];
    const text = verse.words.get(slot % QURAN_SLOT_STRIDE) ?? '';
    if (quranWordForms(text, morph).some(f => f.form === withTaaMarbuta)) {
      taaMarbutaLemmas.add(morph.lemma);
    }
  }
  // Likewise the final alif of ALIF_MAQSURA_LEMMAS is read as ى.
  const maqsuraLemmas = new Set<string>(ALIF_MAQSURA_LEMMAS);
  const formsLemma = (morph: SlotMorph): string | null => {
    if (morph.lemma && taaMarbutaLemmas.has(morph.lemma)) {
      return morph.lemma.replace(/\u{062A}(\p{M}*)$/u, '\u{0629}$1');
    }
    if (morph.lemma && maqsuraLemmas.has(morph.lemma)) {
      return morph.lemma.replace(/\u{0627}(\p{M}*)$/u, '\u{0649}$1');
    }
    return morph.lemma;
  };

  // Forms, best code per slot (gate 3).
  const formSlots = new Map<string, Map<number, QuranWordForm>>();
  const put = (slot: number, form: QuranWordForm, where: string) => {
    gate(isFoldedForm(form.form), `${where}: bad form «${form.form}»`);
    let slots = formSlots.get(form.form);
    if (!slots) {
      slots = new Map();
      formSlots.set(form.form, slots);
    }
    const current = slots.get(slot);
    if (!current || formScore(form) > formScore(current)) slots.set(slot, form);
  };
  // An extra everyday spelling of one slot: a full-word spelling.
  const putSpelling = (slot: number, spelling: string, where: string) =>
    put(
      slot,
      {
        form: foldQuranQueryWord(spelling),
        tier: 3,
        rasmOnly: false,
        hasHamza: /[ءآأؤإئ]/.test(spelling),
      },
      where,
    );
  const reviewed = new Map(REVIEWED_SPELLINGS.map(r => [r.location, r]));
  const reviewedSeen = new Set<string>();
  verses.forEach((verse, verseIndex) => {
    for (const [position, text] of verse.words) {
      const slot = verseIndex * QURAN_SLOT_STRIDE + position;
      const where = `${verse.key}:${position}`;
      const morph = morphBySlot.get(slot);
      const forms = quranWordForms(
        text,
        morph && {...morph, lemma: formsLemma(morph)},
      );
      gate(forms.length > 0, `${where}: no spelling`);
      for (const form of forms) put(slot, form, where);
      const imlaei = input.imlaei?.get(where);
      if (imlaei !== undefined) putSpelling(slot, imlaei, `${where} (imla'i)`);
      const entry = reviewed.get(where);
      if (entry) {
        gate(
          quranWordSpellings(text).rasm === entry.drawn,
          `${where}: reviewed spelling of «${entry.drawn}» on «${text}»`,
        );
        for (const spelling of entry.spellings) {
          putSpelling(slot, spelling, `${where} (reviewed)`);
        }
        reviewedSeen.add(where);
      }
    }
  });
  gate(
    reviewedSeen.size === reviewed.size,
    `reviewed spellings without a slot: ${[...reviewed.keys()]
      .filter(location => !reviewedSeen.has(location))
      .join(' ')}`,
  );
  // The letters exactly as drawn of a vocative or a one-lam word are, as
  // often as not, another word: يَٰقَوْمِ is drawn يقوم (يَقُومُ), ٱلَّٰتِى
  // التي and ٱلَّٰٓـِٔى الي (إِلَى). Typed, those mean the other word, so a
  // form keeps them only when no other spelling gives it (يأيها, يموسى,
  // اليل). Such a form is also the start of other words a reader types
  // (اليل of الي, يقومنا of يقوم), so it matches whole words only.
  const wholeWordForms = new Set<string>();
  for (const [form, slots] of formSlots) {
    if ([...slots.values()].some(f => !f.asDrawn)) {
      for (const [slot, f] of slots) if (f.asDrawn) slots.delete(slot);
    } else {
      wholeWordForms.add(form);
    }
  }
  const forms = new Map<string, number[]>();
  let postings = 0;
  for (const form of [...formSlots.keys()].sort()) {
    const codes = [...(formSlots.get(form) ?? new Map<number, QuranWordForm>())]
      .map(([slot, f]) =>
        packPosting({
          verseIndex: Math.floor(slot / QURAN_SLOT_STRIDE),
          position: slot % QURAN_SLOT_STRIDE,
          tier: f.tier,
          hasHamza: f.hasHamza,
          rasmOnly: f.rasmOnly,
        }),
      )
      .sort((a, b) => a - b);
    forms.set(form, codes);
    postings += codes.length;
  }

  // Roots and lemmas (gate 4).
  const rootWords = new Map<string, {slots: number[]; stated: Set<number>}>();
  const lemmaSlots = new Map<string, Map<string | null, number[]>>();
  for (const slot of [...morphBySlot.keys()].sort((a, b) => a - b)) {
    const morph = morphBySlot.get(slot) as SlotMorph;
    if (!morph.root) continue;
    let root = rootWords.get(morph.root);
    if (!root) {
      root = {slots: [], stated: new Set()};
      rootWords.set(morph.root, root);
    }
    root.slots.push(slot);
    if (morph.statedRootCount !== null) root.stated.add(morph.statedRootCount);
    let lemmas = lemmaSlots.get(morph.root);
    if (!lemmas) {
      lemmas = new Map();
      lemmaSlots.set(morph.root, lemmas);
    }
    const list = lemmas.get(morph.lemma) ?? [];
    list.push(slot);
    lemmas.set(morph.lemma, list);
  }
  const ayahsOf = (slots: readonly number[]) =>
    new Set(slots.map(slot => Math.floor(slot / QURAN_SLOT_STRIDE))).size;
  const roots: QuranRoot[] = [];
  const lemmas: QuranIndexLemma[] = [];
  const rootNames = [...rootWords.keys()].sort();
  rootNames.forEach((name, i) => {
    const {slots, stated} = rootWords.get(name) as {
      slots: number[];
      stated: Set<number>;
    };
    gate(stated.size === 1, `root ${name}: stated counts ${[...stated]}`);
    const [count] = stated;
    gate(
      count - slots.length === (ROOT_COUNT_EXCEPTIONS[name] ?? 0),
      `root ${name}: ${slots.length} words, stated ${count}`,
    );
    const id = i + 1;
    roots.push({id, root: name, words: slots.length, ayahs: ayahsOf(slots)});
    const byLemma = [...(lemmaSlots.get(name) ?? new Map())] as [
      string | null,
      number[],
    ][];
    // Most words first; ties: words without a lemma last, then code units
    // (never a locale collation, so every build orders them the same).
    byLemma.sort(
      ([a, aSlots], [b, bSlots]) =>
        bSlots.length - aSlots.length ||
        (a === null ? 1 : 0) - (b === null ? 1 : 0) ||
        codeUnitOrder(a ?? '', b ?? ''),
    );
    for (const [lemma, lemmaSlotList] of byLemma) {
      lemmas.push({
        id: 0,
        rootId: id,
        lemma,
        words: lemmaSlotList.length,
        ayahs: ayahsOf(lemmaSlotList),
        codes: lemmaSlotList.map(slot => slot * QURAN_FLAG_RANGE),
      });
    }
  });
  lemmas.forEach((lemma, i) => {
    lemma.id = i + 1;
  });

  const content = {forms, wholeWordForms, roots, lemmas};
  const meta: Record<string, string> = {
    format: String(QURAN_SEARCH_FORMAT),
    normalizer: String(QURAN_TEXT_NORMALIZER_VERSION),
    dk_words_sha256: dkWordsSha256(input.dkWords),
    irab_morph_sha256: morphologySha256(irabWords),
    verses: String(verses.length),
    words: String(QURAN_WORD_COUNT),
    forms: String(forms.size),
    postings: String(postings),
    roots: String(roots.length),
    lemmas: String(lemmas.length),
    content_sha256: contentSha256(content),
    ...QURAN_MORPHOLOGY_META,
  };
  if (input.sources.imlaeiSha256) {
    meta.imlaei_sha256 = input.sources.imlaeiSha256;
  }
  return {...content, meta};
}

/** Every Uthmani word of a words DB whose spellings leave the alphabet. */
export function alphabetViolations(slotTexts: Iterable<string>): string[] {
  const bad: string[] = [];
  for (const text of slotTexts) {
    if (!text || isVerseMarker(text)) continue;
    const forms = quranWordForms(text);
    if (!forms.length || forms.some(f => !isFoldedForm(f.form))) {
      bad.push(text);
    }
  }
  return bad;
}

/**
 * Postings read from the built maps (the gates and tests); a prefix never
 * gives one of `wholeWordForms`.
 */
export function memoryPostingSource(
  forms: ReadonlyMap<string, readonly number[]>,
  wholeWordForms: ReadonlySet<string> = new Set(),
): QuranPostingSource {
  const sorted = [...forms.keys()]
    .filter(form => !wholeWordForms.has(form))
    .sort();
  return {
    async exact(keys) {
      const out = new Map<string, readonly number[]>();
      for (const key of keys) {
        const codes = forms.get(key);
        if (codes) out.set(key, codes);
      }
      return out;
    },
    async prefix(prefix, limit) {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (sorted[mid] <= prefix) lo = mid + 1;
        else hi = mid;
      }
      const out = new Map<string, readonly number[]>();
      for (
        let i = lo;
        i < sorted.length && out.size < limit && sorted[i].startsWith(prefix);
        i++
      ) {
        out.set(sorted[i], forms.get(sorted[i]) ?? []);
      }
      return out;
    },
  };
}

/** Gate 5: golden queries, roots, and every verse found by its first words. */
export async function checkQuranSearchIndex(
  content: QuranSearchIndexContent,
  dkWords: QuranSearchIndexInput['dkWords'],
): Promise<void> {
  const failures: string[] = [];
  const source = memoryPostingSource(content.forms, content.wholeWordForms);
  const rootsByName = new Map(content.roots.map(r => [r.root, r]));
  const isKnownRoot = (root: string) => rootsByName.has(root);

  for (const fixture of QURAN_TEXT_FIXTURES) {
    const parsed = parseQuranQuery(fixture.query, isKnownRoot);
    if (parsed.kind !== 'text') {
      failures.push(`«${fixture.query}»: parsed as ${parsed.kind}`);
      continue;
    }
    const found = await searchQuranText(parsed.tokens, source);
    const failure = textFixtureFailure(fixture, found);
    if (failure) failures.push(failure);
  }

  for (const fixture of QURAN_ROOT_FIXTURES) {
    const root = rootsByName.get(fixture.root);
    if (!root) {
      failures.push(`root ${fixture.root}: missing`);
      continue;
    }
    const lemmas = content.lemmas.filter(l => l.rootId === root.id);
    if (root.words !== fixture.words) {
      failures.push(`root ${fixture.root}: ${root.words} words`);
    }
    if (fixture.ayahs !== undefined && root.ayahs !== fixture.ayahs) {
      failures.push(`root ${fixture.root}: ${root.ayahs} ayahs`);
    }
    if (fixture.lemmas !== undefined && lemmas.length !== fixture.lemmas) {
      failures.push(`root ${fixture.root}: ${lemmas.length} lemmas`);
    }
    if (fixture.topLemma) {
      const top = lemmas[0];
      const letters = top?.lemma ? quranWordSpellings(top.lemma).rasm : '';
      if (
        letters !== fixture.topLemma.letters ||
        top.words !== fixture.topLemma.words
      ) {
        failures.push(
          `root ${fixture.root}: top lemma ${letters} ${top?.words}`,
        );
      }
    }
  }

  for (const fixture of QURAN_ROOT_QUERY_FIXTURES) {
    const got = rootCandidates(fixture.letters, isKnownRoot);
    if (got.join('|') !== fixture.roots.join('|')) {
      failures.push(`root letters ${fixture.letters}: ${got.join(', ')}`);
    }
  }

  // What each query is, as the data service parses it (with the roots).
  for (const fixture of QURAN_KIND_FIXTURES) {
    const parsed = parseQuranQuery(fixture.query, isKnownRoot);
    let letters: string | null = null;
    if (parsed.kind === 'root') letters = parsed.letters;
    if (parsed.kind === 'text') letters = parsed.rootLetters;
    const roots = letters ? rootCandidates(letters, isKnownRoot).sort() : [];
    const want = [...fixture.roots].sort();
    if (parsed.kind !== fixture.kind || roots.join('|') !== want.join('|')) {
      failures.push(
        `«${fixture.query}»: ${parsed.kind} [${roots.join(', ')}], ` +
          `expected ${fixture.kind} [${want.join(', ')}]`,
      );
    }
  }

  // Every verse, pasted from its first words.
  const verseWords = new Map<string, string[]>();
  for (const row of dkWords) {
    if (isVerseMarker(row.text)) continue;
    const key = row.location.split(':').slice(0, 2).join(':');
    const list = verseWords.get(key) ?? [];
    if (list.length < VERSE_CHECK_WORDS) list.push(row.text);
    verseWords.set(key, list);
  }
  for (const [key, words] of verseWords) {
    const parsed = parseQuranQuery(words.join(' '), isKnownRoot);
    const found =
      parsed.kind === 'text'
        ? await searchQuranText(parsed.tokens, source)
        : null;
    if (!found?.hits.some(hit => hit.verseKey === key)) {
      failures.push(`verse ${key} not found by its first words`);
    }
  }

  gate(failures.length === 0, `golden checks failed:\n${failures.join('\n')}`);
}
