// @ai-generated
/**
 * RewayahVerseUnits: a rewayah's OWN verses, as runs of word slots.
 *
 * Decision 3 (Release 1): when a surface shows a non-Hafs rewayah, the unit
 * of interaction and every verse label is the rewayah's own verse in its own
 * numbering (Warsh 1:6 is "صِرَٰطَ ... عَلَي۟هِم۟ ۝٦", the first part of Hafs
 * 1:7). Every words DB keeps the Hafs rows (word ids, 's:a:w' locations, the
 * shared Hafs 15-line layout) and changes only the slot texts (contract C1),
 * so a rewayah verse is a run of consecutive Hafs word slots. This module
 * derives those runs from the slots themselves, never from hand data:
 *
 *   Per surah, walk the slots in id order. A rewayah verse ends
 *     - at a non-blank Hafs marker slot (it holds the rewayah's own '۝N'), or
 *     - at a content slot ending with an inline marker ('word ۝N'): a rewayah
 *       verse end that has no Hafs marker slot.
 *   A blank slot ('': a Hafs-only word, the second half of a merged word, or
 *   a Hafs verse end the rewayah does not have) belongs to the verse being
 *   walked. A multi-token slot is one unit and never straddles two verses.
 *   P10: the Madani and Basri counts (Warsh, Qalun, al-Duri, al-Susi) do not
 *   count the Fatiha basmala. Their DBs keep the basmala (the rewayah's own
 *   spelling), unnumbered, in the Hafs 1:1 slots (the 1:1 marker slot is
 *   blank). Those slots belong to NO unit: the basmala is shown but is not a
 *   verse there.
 *
 * Every other slot belongs to exactly one unit; the units of a surah are
 * numbered 1..N exactly as the verse markers number them. For Hafs (and for
 * Shu'bah, and for the identity surahs of every rewayah) the units are
 * exactly the Hafs verses: same key, same slots, same text. Consumers can
 * therefore use one code path for every rewayah with unchanged Hafs output.
 *
 * Storage stays Hafs-keyed (bookmarks / notes / highlights keep Hafs verse
 * keys plus rewayah_id): hafsAnchor() names a unit by the Hafs location of
 * its first slot, and unitForAnchor() / unitsForStoredVerse() are the inverse.
 * See the consumer contract (CONTRACT.md of the verse-units work) for the
 * rules every surface follows.
 *
 * This module is pure (no data-service import). The cached, data-service
 * backed instances live in RewayahVerseUnitsService.ts.
 */

import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

// ── Slot grammar (contract C1) ─────────────────────────────────────────────

const SEPARATOR = ' ';
const TOTAL_SURAHS = 114;

// One verse-end marker token: U+06DD + Arabic-Indic (or Extended
// Arabic-Indic) digits, as the words DBs store it ('۝١٢').
const MARKER_TOKEN = /^\u06DD([\u0660-\u0669]+|[\u06F0-\u06F9]+)$/;

/** The verse number of a marker token ('۝١٢' -> 12); null for any other token. */
export function parseVerseMarker(token: string): number | null {
  const match = MARKER_TOKEN.exec(token);
  if (!match) return null;
  let n = 0;
  for (const ch of match[1]) {
    const code = ch.charCodeAt(0);
    n = n * 10 + (code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }
  return n;
}

// ── Types ───────────────────────────────────────────────────────────────────

/** One row of a words DB, as the builder reads it (blank text = ''). */
export interface VerseUnitSlot {
  /** words.id: the same in every words DB. */
  id: number;
  /** Hafs location of the slot (words.surah / ayah / word). */
  surah: number;
  ayah: number;
  word: number;
  /** This rewayah's words.text ('' for a blank slot). */
  text: string;
}

/** One verse of a rewayah, in the rewayah's own numbering. Immutable. */
export interface VerseUnit {
  readonly rewayah: RewayahId;
  readonly surah: number;
  /** The rewayah's own verse number (what its marker shows). */
  readonly ayah: number;
  /** `${surah}:${ayah}` in the rewayah's numbering (the Hafs key for Hafs). */
  readonly key: string;
  /** Position in reading order over the whole mushaf, 0-based. */
  readonly index: number;
  /**
   * First and last word slot ids, inclusive. Blank slots inside the run and
   * the verse's own marker (marker slot or inline marker) are included.
   */
  readonly firstWordId: number;
  readonly lastWordId: number;
  /**
   * Hafs verse keys whose slots hold this verse's words, in reading order
   * (equals the contract-C3 r2h entry; [key] for an identity verse).
   */
  readonly hafsKeys: readonly string[];
}

/**
 * Storage identity of a unit: the Hafs location of its first slot.
 *
 * `key` is what a bookmarks / notes / highlights row stores in verse_key:
 *  - "S:A" when the unit starts at the first slot of Hafs verse S:A. That is
 *    every Hafs verse (so Hafs rows are unchanged), every identity verse,
 *    the first part of a split Hafs verse and every merged verse that starts
 *    with a whole Hafs verse (Warsh 2:1 = Hafs 2:1-2 is "2:1");
 *  - "S:A:W" (Hafs word position W > 1) when the unit starts inside Hafs
 *    verse S:A: the later part of a split Hafs verse (Warsh 1:7 starts at
 *    Hafs 1:7:5, so it is stored as "1:7:5"; Warsh 11:82, the rest of Hafs
 *    11:82 plus Hafs 11:83, is "11:82:12").
 * Distinct for every unit of one rewayah, so the two parts of a split Hafs
 * verse are two rows, and bookmarks / highlights keep their UNIQUE(verse_key)
 * without a schema change.
 */
export interface HafsAnchor {
  /** verse_key to store: "S:A" or "S:A:W". */
  readonly key: string;
  /** Hafs verse key of the unit's first slot, "S:A". */
  readonly hafsKey: string;
  /** Hafs surah / ayah of the unit's first slot (surah_number / ayah_number). */
  readonly surah: number;
  readonly ayah: number;
  /** Hafs word position of the unit's first slot (1 = the Hafs verse start). */
  readonly wordPosition: number;
}

/** Inclusive word slot id range. */
export interface WordIdRange {
  readonly first: number;
  readonly last: number;
}

/**
 * How one Hafs verse's translation pairs with a rewayah verse (translations,
 * tafsir and word-by-word are Hafs-aligned).
 */
export interface UnitTranslationPart {
  readonly hafsKey: string;
  /**
   * True when the Hafs verse is split between this rewayah verse and a
   * neighbouring one: its WHOLE translation is shown, with a short note
   * (sharedTranslationNote).
   */
  readonly shared: boolean;
  /** Keys of every rewayah verse holding words of this Hafs verse, in order. */
  readonly sharedWith: readonly string[];
  /**
   * True for the first rewayah verse holding words of this Hafs verse. A list
   * of consecutive verses shows each Hafs translation once, under the verse
   * that owns it, so a shared translation is not repeated.
   */
  readonly ownedHere: boolean;
}

/** The slots of a words DB violate the slot model; nothing may be labelled. */
export class VerseUnitsBuildError extends Error {
  readonly rewayah: RewayahId;

  constructor(rewayah: RewayahId, message: string) {
    super(`[RewayahVerseUnits] ${rewayah}: ${message}`);
    this.name = 'VerseUnitsBuildError';
    this.rewayah = rewayah;
    Object.setPrototypeOf(this, VerseUnitsBuildError.prototype);
  }
}

// ── Labels and keys ─────────────────────────────────────────────────────────

/** "S:A" label of a unit, in its rewayah's numbering. */
export function rewayahVerseLabel(
  unit: Pick<VerseUnit, 'surah' | 'ayah'>,
): string {
  return `${unit.surah}:${unit.ayah}`;
}

/**
 * Reference for consecutive units: "2:255", "2:255-257" or "2:286 - 3:2"
 * (the format of the existing Hafs citations, so Hafs output is unchanged).
 */
export function formatUnitRangeLabel(
  first: Pick<VerseUnit, 'surah' | 'ayah'>,
  last: Pick<VerseUnit, 'surah' | 'ayah'> = first,
): string {
  if (first.surah === last.surah) {
    return first.ayah === last.ayah
      ? `${first.surah}:${first.ayah}`
      : `${first.surah}:${first.ayah}-${last.ayah}`;
  }
  return `${first.surah}:${first.ayah} - ${last.surah}:${last.ayah}`;
}

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;
const ANCHOR_KEY = /^(\d{1,3}):(\d{1,3})(?::(\d{1,3}))?$/;

/** {surah, ayah} of an "S:A" key; null for anything else. */
export function parseUnitKey(
  key: string,
): {surah: number; ayah: number} | null {
  const m = VERSE_KEY.exec(key);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (surah < 1 || surah > TOTAL_SURAHS || ayah < 1) return null;
  return {surah, ayah};
}

/**
 * Hafs location of a stored verse_key: "S:A" (word 1, also every legacy row)
 * or "S:A:W". Null for anything else.
 */
export function parseAnchorKey(
  key: string,
): {surah: number; ayah: number; word: number} | null {
  const m = ANCHOR_KEY.exec(key);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  const word = m[3] === undefined ? 1 : Number(m[3]);
  if (surah < 1 || surah > TOTAL_SURAHS || ayah < 1 || word < 1) return null;
  return {surah, ayah, word};
}

/** The verse_key form of a Hafs location: "S:A" for word 1, else "S:A:W". */
export function formatAnchorKey(hafsKey: string, wordPosition: number): string {
  return wordPosition === 1 ? hafsKey : `${hafsKey}:${wordPosition}`;
}

/** Union of the units' Hafs verse keys, in reading order, without repeats. */
export function hafsKeysOfUnits(units: readonly VerseUnit[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    for (const key of unit.hafsKeys) {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

/**
 * Short note shown with a shared Hafs translation (see UnitTranslationPart):
 * "Translation of all of Hafs 1:7, which Warsh divides between verses 1:6
 * and 1:7."
 */
export function sharedTranslationNote(
  part: UnitTranslationPart,
  rewayah: RewayahId,
): string {
  const keys = part.sharedWith;
  const list =
    keys.length <= 2
      ? keys.join(' and ')
      : `${keys.slice(0, -1).join(', ')} and ${keys[keys.length - 1]}`;
  return `Translation of all of Hafs ${part.hafsKey}, which ${getShortLabel(rewayah)} divides between verses ${list}.`;
}

// ── The units of one rewayah ────────────────────────────────────────────────

interface UnitsInit {
  rewayah: RewayahId;
  dataKey: string;
  units: VerseUnit[];
  anchors: HafsAnchor[];
  texts: string[];
  hafsRanges: ReadonlyMap<string, WordIdRange>;
  unnumbered: WordIdRange[];
}

const NO_UNITS: readonly VerseUnit[] = Object.freeze([]);

/**
 * The verse units of one rewayah's words (one data version). Built by
 * buildRewayahVerseUnits(); every query is synchronous and side-effect free.
 */
export class RewayahVerseUnits {
  readonly rewayah: RewayahId;
  /** Identity of the words this was built from (contract C5 cache key). */
  readonly dataKey: string;
  /** Every unit in reading order (units[i].index === i). */
  readonly units: readonly VerseUnit[];

  private readonly anchors: readonly HafsAnchor[];
  private readonly texts: readonly string[];
  private readonly firstIds: readonly number[];
  private readonly bySurah = new Map<number, readonly VerseUnit[]>();
  private readonly byHafsKey = new Map<string, readonly VerseUnit[]>();
  private readonly hafsRanges: ReadonlyMap<string, WordIdRange>;
  private readonly unnumbered: readonly WordIdRange[];
  private readonly textCache: (string | undefined)[] = [];

  /** Use buildRewayahVerseUnits(). */
  constructor(init: UnitsInit) {
    this.rewayah = init.rewayah;
    this.dataKey = init.dataKey;
    this.units = Object.freeze(init.units);
    this.anchors = Object.freeze(init.anchors);
    this.texts = init.texts;
    this.hafsRanges = init.hafsRanges;
    this.unnumbered = Object.freeze(init.unnumbered);
    this.firstIds = init.units.map(u => u.firstWordId);

    const surahLists = new Map<number, VerseUnit[]>();
    const hafsLists = new Map<string, VerseUnit[]>();
    for (const unit of init.units) {
      const list = surahLists.get(unit.surah);
      if (list) list.push(unit);
      else surahLists.set(unit.surah, [unit]);
      for (const key of unit.hafsKeys) {
        const covering = hafsLists.get(key);
        if (covering) covering.push(unit);
        else hafsLists.set(key, [unit]);
      }
    }
    for (const [surah, list] of surahLists) {
      this.bySurah.set(surah, Object.freeze(list));
    }
    for (const [key, list] of hafsLists) {
      this.byHafsKey.set(key, Object.freeze(list));
    }
  }

  /** Surah numbers present, ascending (all 114 for a bundled words DB). */
  surahs(): number[] {
    return [...this.bySurah.keys()];
  }

  /** The rewayah's verse count for a surah; 0 when the surah is absent. */
  verseCount(surah: number): number {
    return this.bySurah.get(surah)?.length ?? 0;
  }

  /** The units of a surah, verse 1 first. */
  unitsOfSurah(surah: number): readonly VerseUnit[] {
    return this.bySurah.get(surah) ?? NO_UNITS;
  }

  /** Rewayah verse `surah`:`ayah` (the rewayah's numbering), or null. */
  unitByRef(surah: number, ayah: number): VerseUnit | null {
    return this.bySurah.get(surah)?.[ayah - 1] ?? null;
  }

  /** Rewayah verse by its "S:A" key (the rewayah's numbering), or null. */
  unitByKey(key: string): VerseUnit | null {
    const ref = parseUnitKey(key);
    return ref ? this.unitByRef(ref.surah, ref.ayah) : null;
  }

  /**
   * The unit holding word slot `wordId` (tap / long-press / drag hit-tests
   * map a slot to its unit). Null for an unknown id and for the unnumbered
   * Fatiha basmala slots of the Madani / Basri counts.
   */
  unitForWordId(wordId: number): VerseUnit | null {
    const index = this.lastUnitStartingAtOrBefore(wordId);
    if (index < 0) return null;
    const unit = this.units[index];
    return wordId <= unit.lastWordId ? unit : null;
  }

  /**
   * The unit holding `wordId`, else the first unit after it (e.g. the first
   * verse after the unnumbered Fatiha basmala). Null past the last unit.
   */
  unitAtOrAfterWordId(wordId: number): VerseUnit | null {
    const index = this.firstUnitEndingAtOrAfter(wordId);
    return index < this.units.length ? this.units[index] : null;
  }

  /** Every unit sharing at least one slot id with [firstId, lastId], in order. */
  unitsForWordRange(firstId: number, lastId: number): VerseUnit[] {
    if (!(lastId >= firstId)) return [];
    const from = this.firstUnitEndingAtOrAfter(firstId);
    const to = this.lastUnitStartingAtOrBefore(lastId);
    return from <= to ? this.units.slice(from, to + 1) : [];
  }

  /**
   * Units holding words of Hafs verse `hafsKey`, in order: one for an
   * identity or merged verse, two for a split Hafs verse, none for the
   * unnumbered Fatiha basmala (Hafs 1:1) of the Madani / Basri counts.
   * Equals the contract-C3 h2r entry.
   */
  unitsForHafsKey(hafsKey: string): readonly VerseUnit[] {
    return this.byHafsKey.get(hafsKey) ?? NO_UNITS;
  }

  /** Union of unitsForHafsKey over `hafsKeys`, in reading order, no repeats. */
  unitsForHafsKeys(hafsKeys: readonly string[]): VerseUnit[] {
    const picked = new Map<number, VerseUnit>();
    for (const key of hafsKeys) {
      for (const unit of this.unitsForHafsKey(key)) {
        picked.set(unit.index, unit);
      }
    }
    return [...picked.values()].sort((a, b) => a.index - b.index);
  }

  /**
   * Units from `first` to `last` inclusive, in reading order (may cross
   * surahs). Empty when `last` comes before `first`.
   */
  unitsInRange(first: VerseUnit, last: VerseUnit): VerseUnit[] {
    const from = this.indexOf(first);
    const to = this.indexOf(last);
    return from <= to ? this.units.slice(from, to + 1) : [];
  }

  /** The next / previous unit in reading order (across surahs), or null. */
  next(unit: VerseUnit): VerseUnit | null {
    return this.units[this.indexOf(unit) + 1] ?? null;
  }

  previous(unit: VerseUnit): VerseUnit | null {
    return this.units[this.indexOf(unit) - 1] ?? null;
  }

  /**
   * The verse's text exactly as the mushaf shows it: its non-blank slots in
   * id order joined by single spaces (contract C1), ending with its own
   * marker ('... ۝N'). For Hafs this equals getVerseText(key).
   */
  unitText(unit: VerseUnit): string {
    const index = this.indexOf(unit);
    const cached = this.textCache[index];
    if (cached !== undefined) return cached;
    const parts: string[] = [];
    for (let id = unit.firstWordId; id <= unit.lastWordId; id++) {
      const text = this.texts[id];
      if (text) parts.push(text);
    }
    const joined = parts.join(SEPARATOR);
    this.textCache[index] = joined;
    return joined;
  }

  /** Storage identity of a unit (see HafsAnchor). */
  hafsAnchor(unit: VerseUnit): HafsAnchor {
    return this.anchors[this.indexOf(unit)];
  }

  /**
   * Inverse of hafsAnchor(): the unit holding the slot a stored verse_key
   * names ("S:A" = the Hafs verse's first slot, "S:A:W" = word W). A legacy
   * Hafs-keyed row therefore resolves to the rewayah verse holding the start
   * of that Hafs verse. Null for an invalid key, a slot outside this data,
   * or the unnumbered Fatiha basmala.
   */
  unitForAnchor(key: string): VerseUnit | null {
    const id = this.wordIdForAnchor(key);
    return id === null ? null : this.unitForWordId(id);
  }

  /** Slot id a stored verse_key names, or null when it names no slot. */
  wordIdForAnchor(key: string): number | null {
    const loc = parseAnchorKey(key);
    if (!loc) return null;
    const range = this.hafsRanges.get(`${loc.surah}:${loc.ayah}`);
    if (!range) return null;
    const id = range.first + loc.word - 1;
    return id <= range.last ? id : null;
  }

  /** Slot ids of Hafs verse `hafsKey` (its words and its marker slot). */
  hafsVerseWordRange(hafsKey: string): WordIdRange | null {
    return this.hafsRanges.get(hafsKey) ?? null;
  }

  /** This rewayah's text of one slot ('' for a blank or unknown slot). */
  slotText(wordId: number): string {
    return this.texts[wordId] ?? '';
  }

  /** Slots that belong to no unit (the P10 Fatiha basmala), if any. */
  unnumberedWordRanges(): readonly WordIdRange[] {
    return this.unnumbered;
  }

  isUnnumberedWordId(wordId: number): boolean {
    return this.unnumbered.some(r => wordId >= r.first && wordId <= r.last);
  }

  /**
   * Hafs translations of a unit, in order (translations, tafsir and
   * word-by-word are keyed by Hafs verses). Single-verse surfaces show every
   * part joined, with sharedTranslationNote() under a shared part; list
   * surfaces show a part only where ownedHere is true and the note elsewhere.
   */
  translationParts(unit: VerseUnit): UnitTranslationPart[] {
    const index = this.indexOf(unit);
    return unit.hafsKeys.map(hafsKey => {
      const covering = this.unitsForHafsKey(hafsKey);
      return {
        hafsKey,
        shared: covering.length > 1,
        sharedWith: covering.map(u => u.key),
        ownedHere: covering.length === 0 || covering[0].index === index,
      };
    });
  }

  /** Throws when `unit` is not a unit of this rewayah's data. */
  indexOf(unit: VerseUnit): number {
    const own = this.units[unit.index];
    if (
      own &&
      (own === unit ||
        (unit.rewayah === this.rewayah &&
          own.key === unit.key &&
          own.firstWordId === unit.firstWordId &&
          own.lastWordId === unit.lastWordId))
    ) {
      return unit.index;
    }
    throw new Error(
      `[RewayahVerseUnits] ${unit.rewayah} ${unit.key} is not a unit of this ${this.rewayah} data`,
    );
  }

  // Index of the last unit whose firstWordId <= id (-1 if none).
  private lastUnitStartingAtOrBefore(id: number): number {
    const ids = this.firstIds;
    let lo = 0;
    let hi = ids.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (ids[mid] <= id) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  }

  // Index of the first unit whose lastWordId >= id (units.length if none).
  private firstUnitEndingAtOrAfter(id: number): number {
    let lo = 0;
    let hi = this.units.length - 1;
    let found = this.units.length;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this.units[mid].lastWordId >= id) {
        found = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return found;
  }
}

// ── Builder ────────────────────────────────────────────────────────────────

const SPACE = 0x20;
const END_OF_AYAH = '\u06DD';

/**
 * Derive the verse units of a words DB from its slots, read in id order.
 * Accepts any set of COMPLETE surahs (the whole DB at runtime, a few surahs
 * in fixtures) and fails closed (VerseUnitsBuildError) on anything the slot
 * model does not allow: a verse marker that is not the last token of its
 * slot (or two in one slot), a verse number before any word of its verse,
 * numbers that are not 1..N per surah, a surah that ends inside a verse,
 * ids or Hafs locations out of order. Pre-Release-1 data (no inline
 * markers) fails here instead of producing wrong verse labels.
 *
 * One pass, no per-slot allocation: the builder keeps no reference to the
 * slot objects, so a source may reuse one object for every slot.
 */
export function buildRewayahVerseUnits(
  rewayah: RewayahId,
  slots: Iterable<VerseUnitSlot>,
  dataKey: string,
): RewayahVerseUnits {
  const fail = (message: string): never => {
    throw new VerseUnitsBuildError(rewayah, message);
  };
  const units: VerseUnit[] = [];
  const anchors: HafsAnchor[] = [];
  const texts: string[] = [];
  const hafsRanges = new Map<string, {first: number; last: number}>();
  const unnumbered: WordIdRange[] = [];

  // The surah and Hafs verse being read, and the previous slot.
  let surah = 0;
  let verseKey = '';
  let verseRange = {first: 0, last: 0};
  let prevId = 0;
  let prevAyah = 0;
  let prevWord = 0;

  // The unit being walked (startId < 0: none yet).
  let startId = -1;
  let startAyah = 0;
  let startWord = 0;
  let hafsKeys: string[] = [];
  let hasWords = false;
  let count = 0; // units numbered so far in this surah

  // P10: the Hafs 1:1 slots wait until it is known whether 1:1 ends a verse.
  let basmala: {id: number; ayah: number; word: number; text: string}[] = [];
  let basmalaIsVerse = false;

  // Location text for error messages (built only when failing: hot loop).
  const loc = (s: number, a: number, w: number, id: number) =>
    `${s}:${a}:${w} (id ${id})`;

  const walk = (id: number, ayah: number, word: number, text: string) => {
    if (startId < 0) {
      startId = id;
      startAyah = ayah;
      startWord = word;
    }
    if (!text) return; // blank slot: part of the unit, nothing else
    // C1: tokens joined by single spaces; a verse marker only as the last
    // token. Checked without splitting the text.
    if (
      text.charCodeAt(0) === SPACE ||
      text.charCodeAt(text.length - 1) === SPACE ||
      text.includes('  ')
    ) {
      fail(`${loc(surah, ayah, word, id)}: malformed spacing in "${text}"`);
    }
    const lastSpace = text.lastIndexOf(' ');
    const markerAt = text.indexOf(END_OF_AYAH);
    let marker: number | null = null;
    if (markerAt >= 0) {
      if (markerAt === lastSpace + 1) {
        marker = parseVerseMarker(text.slice(markerAt));
      }
      if (marker === null) {
        fail(
          `${loc(surah, ayah, word, id)}: verse marker is not the last token of "${text}"`,
        );
      }
    }
    if (marker === null || lastSpace >= 0) {
      hasWords = true;
      if (hafsKeys[hafsKeys.length - 1] !== verseKey) hafsKeys.push(verseKey);
    }
    if (marker === null) return;
    if (!hasWords) {
      fail(
        `${loc(surah, ayah, word, id)}: verse number ${marker} before any word`,
      );
    }
    if (marker !== count + 1) {
      fail(
        `${loc(surah, ayah, word, id)}: verse number ${marker}, expected ${count + 1}`,
      );
    }
    count += 1;
    const anchorVerse = `${surah}:${startAyah}`;
    anchors.push(
      Object.freeze({
        key: formatAnchorKey(anchorVerse, startWord),
        hafsKey: anchorVerse,
        surah,
        ayah: startAyah,
        wordPosition: startWord,
      }),
    );
    units.push(
      Object.freeze({
        rewayah,
        surah,
        ayah: marker,
        key: `${surah}:${marker}`,
        index: units.length,
        firstWordId: startId,
        lastWordId: id,
        hafsKeys: Object.freeze(hafsKeys),
      }),
    );
    startId = -1;
    hafsKeys = [];
    hasWords = false;
  };

  const flushBasmala = () => {
    if (basmala.length === 0) return;
    // Hafs 1:1 ended no verse: the unnumbered Fatiha basmala (P10).
    unnumbered.push({
      first: basmala[0].id,
      last: basmala[basmala.length - 1].id,
    });
    basmala = [];
  };

  const closeSurah = () => {
    flushBasmala();
    if (surah === 0) return;
    if (startId >= 0) {
      fail(
        `surah ${surah} ends inside a verse (no verse number after ${surah}:${startAyah}:${startWord})`,
      );
    }
    if (count === 0) fail(`surah ${surah} has no verse`);
  };

  for (const slot of slots) {
    const {id, ayah, word} = slot;
    const text = slot.text ?? '';
    if (
      !Number.isInteger(id) ||
      !Number.isInteger(slot.surah) ||
      !Number.isInteger(ayah) ||
      !Number.isInteger(word) ||
      id < 1 ||
      slot.surah < 1 ||
      slot.surah > TOTAL_SURAHS ||
      typeof text !== 'string'
    ) {
      fail(`${loc(slot.surah, ayah, word, id)}: malformed slot`);
    }
    const newSurah = slot.surah !== surah;
    if (newSurah) {
      // A new surah starts at its first verse's first word.
      if (slot.surah < surah) {
        fail(`${loc(slot.surah, ayah, word, id)}: surah after surah ${surah}`);
      }
      if (id <= prevId) {
        fail(`${loc(slot.surah, ayah, word, id)}: word ids out of order`);
      }
      if (ayah !== 1 || word !== 1) {
        fail(
          `${loc(slot.surah, ayah, word, id)}: surah ${slot.surah} does not start at its first word`,
        );
      }
      closeSurah();
      surah = slot.surah;
      count = 0;
    } else if (
      id !== prevId + 1 ||
      (ayah === prevAyah
        ? word !== prevWord + 1
        : ayah !== prevAyah + 1 || word !== 1)
    ) {
      // Inside a surah: consecutive ids, Hafs words in order.
      fail(
        `${loc(slot.surah, ayah, word, id)}: slot out of order after id ${prevId}`,
      );
    }
    if (newSurah || ayah !== prevAyah) {
      verseKey = `${surah}:${ayah}`;
      verseRange = {first: id, last: id};
      hafsRanges.set(verseKey, verseRange);
    } else {
      verseRange.last = id;
    }
    texts[id] = text;
    prevId = id;
    prevAyah = ayah;
    prevWord = word;

    if (surah === 1 && ayah === 1 && !basmalaIsVerse) {
      basmala.push({id, ayah, word, text});
      if (text.includes(END_OF_AYAH)) {
        // Hafs 1:1 ends a verse: the basmala is verse 1 (Kufi, Makki).
        basmalaIsVerse = true;
        for (const b of basmala) walk(b.id, b.ayah, b.word, b.text);
        basmala = [];
      }
      continue;
    }
    flushBasmala();
    walk(id, ayah, word, text);
  }
  closeSurah();
  if (surah === 0) fail('no word slots');

  return new RewayahVerseUnits({
    rewayah,
    dataKey,
    units,
    anchors,
    texts,
    hafsRanges,
    unnumbered,
  });
}

// ── Stored rows (bookmarks / notes / highlights) ───────────────────────────

/** What a bookmarks / notes / highlights row identifies a verse by. */
export interface StoredVerseRef {
  /** verse_key: a Hafs anchor key ("S:A" or "S:A:W"). */
  verseKey: string;
  /** rewayah_id the row was saved in; null (legacy) counts as Hafs. */
  rewayahId: RewayahId | null | undefined;
}

export interface StoredVerseUnits {
  /** The display rewayah's units the row marks, in reading order. */
  units: VerseUnit[];
  /**
   * False when the row was saved in another rewayah whose units were not
   * supplied: the units are then those holding the anchored Hafs verse from
   * the anchored word on (correct for every identity, split-part and Hafs
   * row; a merged verse saved in another rewayah marks only its first Hafs
   * verse).
   */
  exact: boolean;
}

/**
 * Inverse of the storage rule: the units of `display` a stored row marks.
 *  - Saved in the display rewayah: exactly the unit its anchor names.
 *  - Saved in Hafs: the display units holding words of that Hafs verse
 *    (unitsForHafsKey; exact, Hafs verses are the Hafs rows).
 *  - Saved in another rewayah with its units supplied: the display units
 *    holding a word of the saved verse.
 *  - Otherwise: approximate (see StoredVerseUnits.exact).
 */
export function unitsForStoredVerse(
  display: RewayahVerseUnits,
  row: StoredVerseRef,
  saved?: RewayahVerseUnits | null,
): StoredVerseUnits {
  const savedRewayah: RewayahId = row.rewayahId ?? 'hafs';
  if (savedRewayah === display.rewayah) {
    const unit = display.unitForAnchor(row.verseKey);
    return {units: unit ? [unit] : [], exact: true};
  }
  const loc = parseAnchorKey(row.verseKey);
  if (!loc) return {units: [], exact: true};
  const hafsKey = `${loc.surah}:${loc.ayah}`;
  if (savedRewayah === 'hafs') {
    return {units: [...display.unitsForHafsKey(hafsKey)], exact: true};
  }
  if (saved && saved.rewayah === savedRewayah) {
    const unit = saved.unitForAnchor(row.verseKey);
    if (!unit) return {units: [], exact: true};
    const picked = new Map<number, VerseUnit>();
    for (let id = unit.firstWordId; id <= unit.lastWordId; id++) {
      // Words of the saved verse only (not its blank slots or marker slot).
      const text = saved.slotText(id);
      if (!text || parseVerseMarker(text) !== null) continue;
      const shown = display.unitForWordId(id);
      if (shown) picked.set(shown.index, shown);
    }
    return {
      units: [...picked.values()].sort((a, b) => a.index - b.index),
      exact: true,
    };
  }
  const id = display.wordIdForAnchor(row.verseKey);
  const range = display.hafsVerseWordRange(hafsKey);
  if (id === null || !range) return {units: [], exact: false};
  const covering = new Set(display.unitsForHafsKey(hafsKey));
  return {
    units: display
      .unitsForWordRange(id, range.last)
      .filter(u => covering.has(u)),
    exact: false,
  };
}

// ── Cross-check against the bundled verse map (contract C3) ────────────────

/** The read API of RewayahVerseMapService the cross-check needs. */
export interface VerseMapReader {
  hasVerseMap(rewayah: RewayahId): boolean;
  verseCount(rewayah: RewayahId, surah: number): number | null;
  toHafsKeys(rewayah: RewayahId, riwayahKey: string): string[];
  toRiwayahKeys(rewayah: RewayahId, hafsKey: string): string[];
}

/**
 * Differences between the units (derived from the words DB) and the bundled
 * verse map of the same rewayah (Hafs: the identity map), over the surahs the
 * units hold. [] when they agree on every verse count, every r2h entry and
 * every h2r entry. Both come from one build of the data, so any difference
 * means the words DB and the verse map do not belong together.
 */
export function crossCheckVerseUnits(
  units: RewayahVerseUnits,
  map: VerseMapReader,
  maxReported = 20,
): string[] {
  const out: string[] = [];
  let total = 0;
  const report = (msg: string) => {
    total += 1;
    if (out.length < maxReported) out.push(msg);
  };
  const rewayah = units.rewayah;
  if (!map.hasVerseMap(rewayah)) {
    return [`${rewayah}: no verse map to check against`];
  }
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((k, i) => k === b[i]);
  for (const surah of units.surahs()) {
    const expected = map.verseCount(rewayah, surah);
    const actual = units.verseCount(surah);
    if (expected !== actual) {
      report(`surah ${surah}: ${actual} verses, verse map says ${expected}`);
    }
    for (const unit of units.unitsOfSurah(surah)) {
      const mapped = map.toHafsKeys(rewayah, unit.key);
      if (!same(unit.hafsKeys, mapped)) {
        report(`r2h ${unit.key}: [${unit.hafsKeys}] vs map [${mapped}]`);
      }
    }
    for (let ayah = 1; ; ayah++) {
      const hafsKey = `${surah}:${ayah}`;
      if (!units.hafsVerseWordRange(hafsKey)) break;
      const keys = units.unitsForHafsKey(hafsKey).map(u => u.key);
      const mapped = map.toRiwayahKeys(rewayah, hafsKey);
      if (!same(keys, mapped)) {
        report(`h2r ${hafsKey}: [${keys}] vs map [${mapped}]`);
      }
    }
  }
  if (total > out.length) out.push(`... ${total - out.length} more`);
  return out;
}
