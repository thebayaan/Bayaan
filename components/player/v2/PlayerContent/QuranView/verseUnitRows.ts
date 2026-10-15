// @ai-generated
/**
 * Verse rows of a rewayah for verse lists (decision 3 of Release 1).
 *
 * The player's verse list (QuranView) shows a non-Hafs track as that
 * rewayah's OWN verses, numbered as the rewayah numbers them: Warsh 1:6 is
 * "صِرَٰطَ ... عَلَي۟هِم۟ ۝٦", the first part of Hafs 1:7, and Warsh 2:1 holds
 * Hafs 2:1 and 2:2. Rows are never Hafs verses relabelled. The mushaf list
 * and reading views can build their rows the same way.
 *
 * buildVerseUnitRows() turns the verse units of one surah
 * (services/mushaf/RewayahVerseUnits.ts) into VerseItem rows:
 *  - one row per rewayah verse: key and label in the rewayah's numbering,
 *    its words exactly its own slots (the row draws unitText()), its storage
 *    anchor (Hafs-keyed, see the verse-units contract, section 3);
 *  - the unnumbered Fatiha basmala of the Madani / Basri counts (Warsh,
 *    Qalun, al-Duri, al-Susi) as a row without a number: it is recited and
 *    written, but it is no verse there, so nothing can select it;
 *  - the Hafs-aligned content of every Hafs verse the row holds (contract
 *    4.6, list rule): a Hafs verse's translation is shown once, under the
 *    first row holding it; a Hafs verse split between rows carries the
 *    shared-translation note under each of them; word by word shows, per
 *    Hafs verse, exactly the Hafs words of the row's own slots, disclosed as
 *    Hafs (wordByWordNotice). The Hafs transliteration spells the Hafs
 *    reading, so it is never shown under another rewayah's verse.
 *
 * playbackBandUnits() is the follow-along band (contract 4.2) and
 * unitVerseActionsPayload() the verse-actions payload (contract 4.1).
 *
 * The player keeps Hafs rows for a Hafs track (Hafs output stays
 * byte-identical and never waits for the verse units); for Hafs these rows
 * would be exactly the Hafs verses.
 */

import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import {
  rewayahVerseLabel,
  sharedTranslationNote,
  type HafsAnchor,
  type RewayahVerseUnits,
  type VerseUnit,
  type WordIdRange,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {AyahTrackingState} from '@/types/timestamps';
import type {EnhancedVerse} from '@/utils/enhancedVerseData';
import {
  getTrackedVerseKeys,
  verseKeyListId,
  type MappedAyahTrackingState,
  type RegisteredTimingNumbering,
} from '@/utils/timestampNumbering';

/** Row key of the unnumbered Fatiha basmala (Madani / Basri counts). */
export const UNNUMBERED_BASMALA_ROW_KEY = 'basmala';

/** Hafs-aligned content of one Hafs verse (translation, transliteration). */
export interface HafsVerseContent {
  translation?: string;
  transliteration?: string;
}

/** One Hafs verse a row holds words of, with its Hafs-aligned content. */
export interface VerseRowPart {
  readonly hafsKey: string;
  readonly hafsSurah: number;
  readonly hafsAyah: number;
  /**
   * The row shows this Hafs verse's translation: it is the first row
   * holding the verse (contract 4.6, list rule), so no translation repeats.
   */
  readonly owned: boolean;
  /**
   * sharedTranslationNote() when the rewayah divides this Hafs verse between
   * rows (shown under every row holding it); null otherwise.
   */
  readonly note: string | null;
  /** Hafs word positions of the row's slots in this verse (inclusive). */
  readonly firstWord: number;
  readonly lastWord: number;
  /** The row holds every slot of the Hafs verse, its marker included. */
  readonly wholeVerse: boolean;
  /** The Hafs verse's translation / transliteration ('' when none). */
  readonly translation: string;
  readonly transliteration: string;
}

/**
 * A verse row of a rewayah. It is also the `verse` VerseItem receives: its
 * verse_key, surah_number and ayah_number are the ROW's, in the rewayah's
 * numbering (ayah 0 for the unnumbered basmala), and its text, translation
 * and transliteration are empty, because the row's words and its Hafs
 * content live in `words` and `parts`.
 */
export interface VerseUnitRow extends EnhancedVerse {
  /** The unit key ('1:6'), or UNNUMBERED_BASMALA_ROW_KEY. */
  readonly verse_key: string;
  readonly rewayah: RewayahId;
  /** The verse units the row was built from (one rewayah, one data version). */
  readonly units: RewayahVerseUnits;
  /** The rewayah verse, or null for the unnumbered Fatiha basmala. */
  readonly unit: VerseUnit | null;
  /** Verse label ('1:6'); null for the unnumbered basmala. */
  readonly label: string | null;
  /** The rendered words: the row's non-blank slots, Hafs locations kept. */
  readonly words: readonly DKWordInfo[];
  /** Every Hafs verse the row holds words of, in reading order. */
  readonly parts: readonly VerseRowPart[];
  /** Storage identity (contract section 3); null for the basmala row. */
  readonly anchor: HafsAnchor | null;
}

interface HafsSlice {
  hafsKey: string;
  ayah: number;
  range: WordIdRange;
  /** The row's slots in this Hafs verse. */
  from: number;
  to: number;
}

/** Hafs verses holding slots first..last of `surah`, from Hafs `ayah` on. */
function hafsSlices(
  units: RewayahVerseUnits,
  surah: number,
  ayah: number,
  first: number,
  last: number,
): HafsSlice[] {
  const out: HafsSlice[] = [];
  for (let a = ayah; ; a++) {
    const hafsKey = `${surah}:${a}`;
    const range = units.hafsVerseWordRange(hafsKey);
    if (!range || range.first > last) break;
    if (range.last < first) continue;
    out.push({
      hafsKey,
      ayah: a,
      range,
      from: Math.max(range.first, first),
      to: Math.min(range.last, last),
    });
  }
  return out;
}

/** Hafs ayah of `surah` whose slots hold slot `wordId` (0 if none). */
function hafsAyahOfSlot(
  units: RewayahVerseUnits,
  surah: number,
  wordId: number,
): number {
  for (let a = 1; ; a++) {
    const range = units.hafsVerseWordRange(`${surah}:${a}`);
    if (!range || range.first > wordId) return 0;
    if (wordId <= range.last) return a;
  }
}

function sliceWords(units: RewayahVerseUnits, slices: HafsSlice[]) {
  const words: DKWordInfo[] = [];
  for (const s of slices) {
    for (let id = s.from; id <= s.to; id++) {
      const text = units.slotText(id);
      if (!text) continue; // blank slot: no word, no separator
      words.push({
        text,
        verseKey: s.hafsKey,
        wordPositionInVerse: id - s.range.first + 1,
      });
    }
  }
  return words;
}

function partOf(
  s: HafsSlice,
  surah: number,
  owned: boolean,
  note: string | null,
  content: HafsVerseContent | undefined,
): VerseRowPart {
  return {
    hafsKey: s.hafsKey,
    hafsSurah: surah,
    hafsAyah: s.ayah,
    owned,
    note,
    firstWord: s.from - s.range.first + 1,
    lastWord: s.to - s.range.first + 1,
    wholeVerse: s.from === s.range.first && s.to === s.range.last,
    translation: content?.translation ?? '',
    transliteration: content?.transliteration ?? '',
  };
}

function unitRow(
  units: RewayahVerseUnits,
  unit: VerseUnit,
  content: (hafsKey: string) => HafsVerseContent | undefined,
): VerseUnitRow {
  const anchor = units.hafsAnchor(unit);
  const slices = hafsSlices(
    units,
    unit.surah,
    anchor.ayah,
    unit.firstWordId,
    unit.lastWordId,
  );
  const byKey = new Map(slices.map(s => [s.hafsKey, s]));
  // Hafs content follows translationParts(): the Hafs verses whose WORDS the
  // unit holds (a slot that is blank in this rewayah brings no content).
  // Every such verse is among the slices (the unit's slots start in the
  // anchor's Hafs verse); the whole verse is only a defensive fallback for
  // the word-by-word slice.
  const parts: VerseRowPart[] = [];
  for (const p of units.translationParts(unit)) {
    const range = units.hafsVerseWordRange(p.hafsKey);
    const slice =
      byKey.get(p.hafsKey) ??
      (range && {
        hafsKey: p.hafsKey,
        ayah: Number(p.hafsKey.split(':')[1]),
        range,
        from: range.first,
        to: range.last,
      });
    if (!slice) continue;
    parts.push(
      partOf(
        slice,
        unit.surah,
        p.ownedHere,
        p.shared ? sharedTranslationNote(p, unit.rewayah) : null,
        content(p.hafsKey),
      ),
    );
  }
  return {
    id: unit.index + 1,
    verse_key: unit.key,
    surah_number: unit.surah,
    ayah_number: unit.ayah,
    text: '',
    translation: '',
    transliteration: '',
    rewayah: unit.rewayah,
    units,
    unit,
    label: rewayahVerseLabel(unit),
    words: sliceWords(units, slices),
    parts,
    anchor,
  };
}

function unnumberedRow(
  units: RewayahVerseUnits,
  surah: number,
  range: WordIdRange,
  content: (hafsKey: string) => HafsVerseContent | undefined,
): VerseUnitRow | null {
  const ayah = hafsAyahOfSlot(units, surah, range.first);
  if (ayah === 0) return null;
  const slices = hafsSlices(units, surah, ayah, range.first, range.last);
  // No verse holds these Hafs verses (unitsForHafsKey is empty), so this row
  // owns their translation.
  const parts = slices
    .filter(s => units.unitsForHafsKey(s.hafsKey).length === 0)
    .map(s => partOf(s, surah, true, null, content(s.hafsKey)));
  return {
    id: 0,
    verse_key: UNNUMBERED_BASMALA_ROW_KEY,
    surah_number: surah,
    ayah_number: 0,
    text: '',
    translation: '',
    transliteration: '',
    rewayah: units.rewayah,
    units,
    unit: null,
    label: null,
    words: sliceWords(units, slices),
    parts,
    anchor: null,
  };
}

/**
 * The rows of `surah` in the rewayah of `units`, in reading order: the
 * unnumbered Fatiha basmala first when the rewayah has one, then one row per
 * rewayah verse. `content(hafsKey)` gives a Hafs verse's translation and
 * transliteration (the player: the EnhancedVerse of the selected
 * translation). [] for a surah the units do not hold.
 */
export function buildVerseUnitRows(
  units: RewayahVerseUnits,
  surah: number,
  content: (hafsKey: string) => HafsVerseContent | undefined = () => undefined,
): VerseUnitRow[] {
  const list = units.unitsOfSurah(surah);
  if (list.length === 0) return [];
  const rows = list.map(unit => unitRow(units, unit, content));
  const surahFirst = units.hafsVerseWordRange(`${surah}:1`)?.first;
  const surahLast = list[list.length - 1].lastWordId;
  // Unnumbered slots of this surah, in reading order (unnumberedWordRanges
  // is in id order).
  const unnumbered: {first: number; row: VerseUnitRow}[] = [];
  if (surahFirst !== undefined) {
    for (const range of units.unnumberedWordRanges()) {
      if (range.first < surahFirst || range.last > surahLast) continue;
      const row = unnumberedRow(units, surah, range, content);
      if (row) unnumbered.push({first: range.first, row});
    }
  }
  if (unnumbered.length === 0) return rows;
  // Each unnumbered row goes where its slots are (the Fatiha basmala:
  // before verse 1).
  const merged: VerseUnitRow[] = [];
  let next = 0;
  for (const row of rows) {
    const start = row.unit ? row.unit.firstWordId : 0;
    while (next < unnumbered.length && unnumbered[next].first < start) {
      merged.push(unnumbered[next++].row);
    }
    merged.push(row);
  }
  while (next < unnumbered.length) merged.push(unnumbered[next++].row);
  return merged;
}

/** True for a row built by buildVerseUnitRows (not a Hafs EnhancedVerse). */
export function isVerseUnitRow(verse: EnhancedVerse): verse is VerseUnitRow {
  return 'parts' in verse && 'anchor' in verse && 'units' in verse;
}

/**
 * Units the follow-along band covers for the verse being recited (contract
 * 4.2), in the rewayah of `units`:
 *  - a timing set numbered in that same rewayah: exactly the reciter's own
 *    verse (Warsh entry 6 lights Warsh 1:6 only, not the rest of Hafs 1:7);
 *  - otherwise every unit holding a Hafs verse the entry recites (a
 *    Hafs-numbered entry of a split Hafs verse lights both parts: both are
 *    being recited).
 * Nothing for a state that recites no verse of the rewayah (the unnumbered
 * Fatiha basmala).
 */
export function playbackBandUnits(
  units: RewayahVerseUnits,
  state: AyahTrackingState | null | undefined,
  numbering?: RegisteredTimingNumbering | null,
): VerseUnit[] {
  if (!state) return [];
  const reciterVerseKey = (state as Partial<MappedAyahTrackingState>)
    .reciterVerseKey;
  if (
    numbering &&
    numbering !== 'pending' &&
    numbering.mode === 'riwayah' &&
    numbering.reciterRewayah === units.rewayah &&
    reciterVerseKey
  ) {
    const own = units.unitByKey(reciterVerseKey);
    if (own) return [own];
  }
  return units.unitsForHafsKeys(getTrackedVerseKeys(state));
}

/** playbackBandUnits() as a value-comparable id for store selectors. */
export function playbackBandKeysId(
  units: RewayahVerseUnits,
  state: AyahTrackingState | null | undefined,
  numbering?: RegisteredTimingNumbering | null,
): string {
  return verseKeyListId(
    playbackBandUnits(units, state, numbering).map(u => u.key),
  );
}

/**
 * Index of the row a Hafs-keyed reference lands on ('S:A' or 'S:A:W', e.g.
 * branding.initialPlayerVerseKey): the row holding that Hafs location,
 * where stored references open (unitForAnchor). Undefined when no verse
 * holds it (the unnumbered basmala) or the row is not in `rows`.
 */
export function rowIndexForHafsReference(
  rows: readonly VerseUnitRow[],
  units: RewayahVerseUnits,
  reference: string,
): number | undefined {
  const unit = units.unitForAnchor(reference);
  if (!unit) return undefined;
  const index = rows.findIndex(row => row.unit?.key === unit.key);
  return index >= 0 ? index : undefined;
}

/**
 * verse-actions payload of a rewayah verse row (contract 4.1): the unit
 * itself in `unitKeys` + `rewayah`; the Hafs fields keep their Hafs meaning
 * (the anchor's Hafs verse, and every Hafs verse of the unit when it holds
 * more than one), so a sheet that does not read `unitKeys` yet stays
 * Hafs-consistent instead of mislabelling. No translation / transliteration:
 * the sheet reads them from the keys. Null for the unnumbered basmala.
 */
export interface UnitVerseActionsPayload {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  verseKeys?: string[];
  source: 'player' | 'mushaf';
  rewayah: RewayahId;
  unitKeys: string[];
}

export function unitVerseActionsPayload(
  row: VerseUnitRow,
  source: 'player' | 'mushaf',
): UnitVerseActionsPayload | null {
  if (!row.unit || !row.anchor) return null;
  const hafsKeys = [...row.unit.hafsKeys];
  return {
    verseKey: row.anchor.hafsKey,
    surahNumber: row.anchor.surah,
    ayahNumber: row.anchor.ayah,
    ...(hafsKeys.length > 1 ? {verseKeys: hafsKeys} : {}),
    source,
    rewayah: row.rewayah,
    unitKeys: [row.unit.key],
  };
}

/**
 * Disclosure over a row's word-by-word grid of one Hafs verse (word by word
 * is Hafs data): undefined keeps the grid's own "Word-by-word shown in Hafs"
 * when the row is exactly that Hafs verse with the same number; otherwise
 * the Hafs verse is named, so a Hafs number in the grid (its end marker)
 * never passes for the rewayah's.
 */
export function wordByWordNotice(
  row: VerseUnitRow,
  part: VerseRowPart,
): string | undefined {
  const sameVerse =
    row.unit !== null &&
    part.wholeVerse &&
    row.parts.length === 1 &&
    row.unit.key === part.hafsKey;
  return sameVerse ? undefined : `Word-by-word shown in Hafs ${part.hafsKey}`;
}
