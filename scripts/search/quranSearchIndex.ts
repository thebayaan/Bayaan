// @ai-generated
/**
 * Builds the Quran search index (assets/data/quran-search-v1.db) from the
 * Hafs Digital Khatt words and the i'rab morphology. Pure: the CLI
 * (build-quran-search-db.ts) and the freshness test
 * (services/search/__tests__/quranSearchDb.test.ts) feed it the rows of both
 * DBs. Every check below is a build gate: a failure throws.
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

export const QURAN_SEARCH_SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE forms (
  form TEXT PRIMARY KEY,
  postings TEXT NOT NULL
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
  /** Recorded in meta. */
  sources: {dkSha256: string; irabSha256: string; imlaeiSha256?: string};
}

export interface QuranIndexLemma extends QuranLemma {
  /** slot * 32 for each word (flags 0), ascending. */
  codes: readonly number[];
}

export interface QuranSearchIndexContent {
  /** Folded form → ascending posting codes; forms in code-unit order. */
  forms: ReadonlyMap<string, readonly number[]>;
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
  content: Pick<QuranSearchIndexContent, 'forms' | 'roots' | 'lemmas'>,
): string {
  const lines: string[] = ['forms'];
  for (const form of [...content.forms.keys()].sort()) {
    lines.push(`${form}\t${encodePostings(content.forms.get(form) ?? [])}`);
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
  const morphBySlot = new Map<number, SlotMorph>();
  for (const row of input.irabRows) {
    const verseIndex = verseIndexByKey.get(row.verseKey);
    gate(verseIndex !== undefined, `i'rab verse ${row.verseKey} not in DK`);
    const verse = verses[verseIndex as number];
    const position = qulToDkPositions(row.verseKey, row.position)[0];
    gate(
      verse.words.has(position),
      `i'rab word ${row.verseKey}:${row.position} has no slot`,
    );
    morphBySlot.set(
      (verseIndex as number) * QURAN_SLOT_STRIDE + position,
      morphOfRow(row, input.irabTexts),
    );
  }

  // The corpus spells some lemmas with the open taa of their drawn words:
  // ٱمْرَأَت for every امرأة. When a word of such a lemma is written with ة
  // (ٱمْرَأَةٌ), the lemma's ت is a taa marbuta, and the forms read every
  // word against the lemma with ة, so the open-taa words (ٱمْرَأَتُ) get
  // their ة spelling too. The roots and lemmas tables keep the i'rab lemma.
  const taaMarbutaLemmas = new Set<string>();
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
  const formsLemma = (morph: SlotMorph): string | null =>
    morph.lemma && taaMarbutaLemmas.has(morph.lemma)
      ? morph.lemma.replace(/\u{062A}(\p{M}*)$/u, '\u{0629}$1')
      : morph.lemma;

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
      if (imlaei !== undefined) {
        put(
          slot,
          {
            form: foldQuranQueryWord(imlaei),
            tier: 3,
            rasmOnly: false,
            hasHamza: /[ءآأؤإئ]/.test(imlaei),
          },
          `${where} (imla'i)`,
        );
      }
    }
  });
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

  const content = {forms, roots, lemmas};
  const meta: Record<string, string> = {
    format: String(QURAN_SEARCH_FORMAT),
    normalizer: String(QURAN_TEXT_NORMALIZER_VERSION),
    dk_sha256: input.sources.dkSha256,
    irab_sha256: input.sources.irabSha256,
    verses: String(verses.length),
    words: String(QURAN_WORD_COUNT),
    forms: String(forms.size),
    postings: String(postings),
    roots: String(roots.length),
    lemmas: String(lemmas.length),
    content_sha256: contentSha256(content),
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

/** Postings read from the built maps (the gates and tests). */
export function memoryPostingSource(
  forms: ReadonlyMap<string, readonly number[]>,
): QuranPostingSource {
  const sorted = [...forms.keys()].sort();
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
  const source = memoryPostingSource(content.forms);
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
