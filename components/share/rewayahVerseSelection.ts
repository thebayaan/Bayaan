// @ai-generated
/**
 * The verses a verse sheet acts on (verse actions, note, share), in the
 * shown rewayah's OWN numbering (Release 1, decision 3).
 *
 * A sheet payload names its verses in one of two ways (verse-units contract
 * 4.1):
 *  - `unitKeys` with `rewayah`: the rewayah's own verses, 'S:A' in its
 *    numbering (producers that select verse units);
 *  - `verseKey` / `verseKeys`: Hafs verse keys (Hafs, and producers that
 *    predate the units).
 * selectVerses() turns either into one VerseSelection: the rewayah verses
 * (units), their label ("2:1", "2:1-3", "2:286 - 3:2"), the Hafs verses
 * they read (translation, tafsir, word-by-word and QUL data are
 * Hafs-aligned) and the storage anchors of their bookmark / note /
 * highlight rows (contract section 3: Hafs-keyed, "S:A" or "S:A:W"). A
 * Hafs-keyed payload in another rewayah selects the rewayah verses holding
 * those Hafs verses (h2r), so a sheet never shows a Hafs number under a
 * rewayah's name.
 *
 * Hafs is the identity (its verses ARE the Hafs verses, contract invariant
 * 6): a Hafs selection is built from the payload's Hafs keys without the
 * units, exactly as the sheets built it before, so Hafs labels, copied and
 * shared text, links and stored rows stay byte-identical (including the
 * bundled Hafs text fallback when the Hafs words fail to load).
 *
 * Every other rewayah needs its verse units (useRewayahVerseUnits /
 * rewayahVerseUnitsService). While they load the selection is 'loading';
 * when they are refused (data that does not derive cleanly) or the rewayah
 * has no words DB it is 'error' / 'unavailable', and the sheets show no
 * verse number at all rather than a guessed one.
 */
import {
  formatUnitRangeLabel,
  hafsKeysOfUnits,
  parseAnchorKey,
  rewayahVerseLabel,
  sharedTranslationNote,
  unitsForStoredVerse,
  type RewayahVerseUnits,
  type UnitTranslationPart,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {
  formatQuranCitation,
  formatVerseRange,
  REWAYAH_TEXT_TIMEOUT_MS,
  resolveVerseTexts,
  waitForRewayahText,
  type VerseTextsResult,
} from './rewayahVerseText';

// ── Types ───────────────────────────────────────────────────────────────────

/** The verse fields of a verse sheet payload (contract 4.1). */
export interface VerseSelectionRequest {
  /** Numbering of `unitKeys`, and the rewayah the sheet shows. */
  rewayah: RewayahId;
  /** Hafs key of the first selected verse (Hafs meaning, as before). */
  verseKey: string;
  /** Hafs surah / ayah of the first selected verse. */
  surahNumber: number;
  ayahNumber: number;
  /** Hafs keys of a multi-verse selection (Hafs meaning, as before). */
  verseKeys?: readonly string[];
  /** The selected verses in `rewayah`'s own numbering, reading order. */
  unitKeys?: readonly string[];
}

/** Where a selected verse is stored (a bookmarks / notes / highlights row). */
export interface SelectionAnchor {
  /** verse_key: the Hafs location of the verse's first word, "S:A" or "S:A:W". */
  key: string;
  /** surah_number / ayah_number: the Hafs verse of that first word. */
  surah: number;
  ayah: number;
}

export interface ReadyVerseSelection {
  status: 'ready';
  rewayah: RewayahId;
  /** The selected verses, `rewayah` numbering ('S:A'), reading order. */
  keys: readonly string[];
  /** "2:1", "2:1-3" or "2:286 - 3:2", `rewayah` numbering. */
  label: string;
  /** Surah of the first selected verse (surah numbers are shared). */
  surahNumber: number;
  /** More than one verse is selected. */
  isRange: boolean;
  /** Hafs verses holding the selection's words, reading order, no repeats. */
  hafsKeys: readonly string[];
  /** One storage anchor per selected verse. */
  anchors: readonly SelectionAnchor[];
  /**
   * The Hafs verse a share link names: the Hafs verse holding the first
   * selected verse's first word. The web reader behind verseShareUrl
   * resolves Hafs verses only (it checks the ayah against the Hafs verse
   * count and does not renumber for ?rewayah=), so a link can only name a
   * Hafs verse. Hafs: the payload's verse, as before.
   */
  linkVerse: {surah: number; ayah: number};
  /**
   * The first selected verse in `rewayah`'s numbering ("1:7"): what a
   * message sent with a share link cites (a link opens one verse).
   */
  linkLabel: string;
  /** The selected units and their rewayah's units; null for Hafs. */
  units: readonly VerseUnit[] | null;
  model: RewayahVerseUnits | null;
}

/**
 * No verse can be named yet:
 *  - 'loading': the rewayah's verse units are loading;
 *  - 'error': they were refused, or its words failed to load;
 *  - 'unavailable': the rewayah has no words DB;
 *  - 'invalid': the payload names no verse of the rewayah (a stale unit key,
 *    or only the unnumbered Fatiha basmala of the Madani / Basri counts).
 */
export interface PendingVerseSelection {
  status: 'loading' | 'error' | 'unavailable' | 'invalid';
  rewayah: RewayahId;
  /** Surah of the request (shared numbering), for the sheet header. */
  surahNumber: number;
}

export type VerseSelection = ReadyVerseSelection | PendingVerseSelection;

/** Status of the units a selection is built from (useRewayahVerseUnits). */
export type VerseUnitsLoadStatus =
  | 'ready'
  | 'loading'
  | 'error'
  | 'unavailable';

// ── Building a selection ───────────────────────────────────────────────────

/**
 * The Hafs keys a payload names: `verseKeys` for a range, else `verseKey`
 * (none without a verse key, like the sheets before).
 */
export function requestHafsKeys(request: VerseSelectionRequest): string[] {
  const {verseKeys, verseKey} = request;
  if (verseKeys && verseKeys.length > 1) return [...verseKeys];
  return verseKey ? [verseKey] : [];
}

function requestSurah(request: VerseSelectionRequest): number {
  const first = request.unitKeys?.[0] ?? request.verseKey;
  const surah = parseInt(first?.split(':')[0] ?? '', 10);
  return Number.isFinite(surah) ? surah : request.surahNumber;
}

/**
 * Hafs: the payload's Hafs keys are the verses. Built exactly as the sheets
 * built their Hafs selection before the units (labels via formatVerseRange,
 * rows keyed by the Hafs keys, links on the payload's surah / ayah).
 */
function hafsSelection(request: VerseSelectionRequest): ReadyVerseSelection {
  const keys =
    request.unitKeys && request.unitKeys.length > 0
      ? [...request.unitKeys]
      : requestHafsKeys(request);
  const anchors = keys.map(key => {
    const [s, a] = key.split(':');
    return {key, surah: parseInt(s, 10), ayah: parseInt(a, 10)};
  });
  return {
    status: 'ready',
    rewayah: 'hafs',
    keys,
    label: formatVerseRange(keys),
    surahNumber: request.surahNumber,
    isRange: keys.length > 1,
    hafsKeys: keys,
    anchors,
    linkVerse: {surah: request.surahNumber, ayah: request.ayahNumber},
    linkLabel: `${request.surahNumber}:${request.ayahNumber}`,
    units: null,
    model: null,
  };
}

/** A selection of consecutive units of one rewayah. */
export function unitSelection(
  model: RewayahVerseUnits,
  units: readonly VerseUnit[],
): ReadyVerseSelection {
  const first = units[0];
  const last = units[units.length - 1];
  const anchors = units.map(unit => {
    const anchor = model.hafsAnchor(unit);
    return {key: anchor.key, surah: anchor.surah, ayah: anchor.ayah};
  });
  return {
    status: 'ready',
    rewayah: model.rewayah,
    keys: units.map(unit => unit.key),
    label: formatUnitRangeLabel(first, last),
    surahNumber: first.surah,
    isRange: units.length > 1,
    hafsKeys: hafsKeysOfUnits(units),
    anchors,
    linkVerse: {surah: anchors[0].surah, ayah: anchors[0].ayah},
    linkLabel: rewayahVerseLabel(first),
    units,
    model,
  };
}

/**
 * The selection a payload names, in its rewayah's numbering.
 *  - Hafs: the payload's Hafs keys (no units needed).
 *  - Other rewayat, with `unitKeys`: exactly those verses, which must exist
 *    and be consecutive.
 *  - Other rewayat, Hafs keys only: the verses holding words of those Hafs
 *    verses (h2r; Warsh: Hafs 1:7 -> 1:6 and 1:7, Hafs 2:2 -> 2:1).
 * `model` and `status` come from useRewayahVerseUnits(request.rewayah).
 */
export function selectVerses(
  request: VerseSelectionRequest,
  model: RewayahVerseUnits | null,
  status: VerseUnitsLoadStatus,
): VerseSelection {
  const {rewayah} = request;
  if (rewayah === 'hafs') return hafsSelection(request);
  const pending = (
    pendingStatus: PendingVerseSelection['status'],
  ): PendingVerseSelection => ({
    status: pendingStatus,
    rewayah,
    surahNumber: requestSurah(request),
  });
  if (!model) return pending(status === 'ready' ? 'error' : status);
  if (model.rewayah !== rewayah) return pending('error');

  let units: VerseUnit[];
  if (request.unitKeys && request.unitKeys.length > 0) {
    units = [];
    for (const key of request.unitKeys) {
      const unit = model.unitByKey(key);
      if (!unit) return pending('invalid');
      units.push(unit);
    }
  } else {
    units = model.unitsForHafsKeys(requestHafsKeys(request));
  }
  if (units.length === 0) return pending('invalid');
  for (let i = 1; i < units.length; i++) {
    // A selection is a run of consecutive verses (a range label says so).
    if (units[i].index !== units[0].index + i) return pending('invalid');
  }
  return unitSelection(model, units);
}

/**
 * The verses that rows saved in `model`'s rewayah name (a bookmark / note /
 * highlight shown in the rewayah it was saved in): each stored anchor
 * ("S:A" or "S:A:W") resolved with unitsForStoredVerse, in reading order,
 * each once. Null when an anchor names no verse (the unnumbered Fatiha
 * basmala of the Madani / Basri counts, a malformed key) or the verses are
 * not consecutive.
 */
export function storedVerseSelection(
  model: RewayahVerseUnits,
  anchorKeys: readonly string[],
): ReadyVerseSelection | null {
  const picked = new Map<number, VerseUnit>();
  for (const verseKey of anchorKeys) {
    const {units} = unitsForStoredVerse(model, {
      verseKey,
      rewayahId: model.rewayah,
    });
    if (units.length === 0) return null;
    for (const unit of units) picked.set(unit.index, unit);
  }
  const units = [...picked.values()].sort((a, b) => a.index - b.index);
  if (units.length === 0) return null;
  for (let i = 1; i < units.length; i++) {
    if (units[i].index !== units[0].index + i) return null;
  }
  return unitSelection(model, units);
}

/**
 * "Hafs 1:7" / "Hafs 2:3-5": the Hafs verses stored anchors start in
 * ("S:A" or "S:A:W"), for a row whose rewayah verses cannot be named. The
 * "Hafs" prefix keeps it from being read as the rewayah's own number.
 */
export function hafsReferenceLabel(anchorKeys: readonly string[]): string {
  const keys: string[] = [];
  for (const anchorKey of anchorKeys) {
    const loc = parseAnchorKey(anchorKey);
    if (!loc) continue;
    const key = `${loc.surah}:${loc.ayah}`;
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys.length > 0 ? `Hafs ${formatVerseRange(keys)}` : '';
}

/** How a saved row names its verses in the (non-Hafs) rewayah it belongs to. */
export type StoredVersesDescription =
  | {status: 'ready'; selection: ReadyVerseSelection}
  | {status: 'loading'}
  /** No verse of the rewayah can be named: a prefixed Hafs reference. */
  | {status: 'unnumbered'; label: string};

/**
 * The verses of a row saved in `model`'s rewayah (its stored anchors), in
 * that rewayah's numbering: 'loading' while its units load; 'unnumbered'
 * with "Hafs S:A" when its units were refused, it has no words DB, or the
 * anchors name no run of numbered verses (the unnumbered Fatiha basmala of
 * the Madani / Basri counts). Hafs rows keep their Hafs label (callers do
 * not ask).
 */
export function describeStoredVerses(
  model: RewayahVerseUnits | null,
  status: VerseUnitsLoadStatus,
  anchorKeys: readonly string[],
): StoredVersesDescription {
  if (model) {
    const selection = storedVerseSelection(model, anchorKeys);
    if (selection) return {status: 'ready', selection};
  } else if (status === 'loading' || status === 'ready') {
    return {status: 'loading'};
  }
  return {status: 'unnumbered', label: hafsReferenceLabel(anchorKeys)};
}

// ── Text, translation, citation ────────────────────────────────────────────

/**
 * The selected verses' texts, one per verse: each unit's text exactly as the
 * mushaf shows it (its slots, ending with its own marker). Null for a Hafs
 * selection, whose text comes from the Hafs-keyed readers (rewayahVerseText).
 */
export function readUnitTexts(selection: ReadyVerseSelection): string[] | null {
  const {units, model} = selection;
  if (!units || !model) return null;
  return units.map(unit => model.unitText(unit));
}

/** A Hafs verse whose translation (or tafsir) the selection shows. */
export interface SelectionTranslationPart {
  hafsKey: string;
  /**
   * Set when the selection holds only part of this Hafs verse (it is
   * divided between rewayah verses and not all of them are selected): its
   * WHOLE translation is shown once, followed by this note.
   */
  note: string | null;
}

/** "1:6 and 1:7", "22:19, 22:20 and 22:21" (as sharedTranslationNote lists). */
function listKeys(keys: readonly string[]): string {
  return keys.length <= 2
    ? keys.join(' and ')
    : `${keys.slice(0, -1).join(', ')} and ${keys[keys.length - 1]}`;
}

/**
 * The note under a shared Hafs verse: sharedTranslationNote() for a
 * translation ("Translation of all of Hafs 1:7, which Warsh divides between
 * verses 1:6 and 1:7."), the same sentence for a tafsir.
 */
export function sharedHafsVerseNote(
  part: UnitTranslationPart,
  rewayah: RewayahId,
  subject: 'translation' | 'tafsir' = 'translation',
): string {
  if (subject === 'translation') return sharedTranslationNote(part, rewayah);
  return `Tafsir of all of Hafs ${part.hafsKey}, which ${getShortLabel(rewayah)} divides between verses ${listKeys(part.sharedWith)}.`;
}

/**
 * The Hafs verses whose translations a selection shows, in reading order,
 * each once (contract 4.6): a verse spanning several Hafs verses shows all of
 * them; a Hafs verse divided between rewayah verses shows its whole
 * translation once, with a note unless every verse sharing it is selected.
 * Hafs: the selected verses, no notes.
 */
export function selectionTranslationParts(
  selection: ReadyVerseSelection,
  subject: 'translation' | 'tafsir' = 'translation',
): SelectionTranslationPart[] {
  const {units, model, rewayah} = selection;
  if (!units || !model) {
    return selection.hafsKeys.map(hafsKey => ({hafsKey, note: null}));
  }
  const selected = new Set(selection.keys);
  const seen = new Set<string>();
  const parts: SelectionTranslationPart[] = [];
  for (const unit of units) {
    for (const part of model.translationParts(unit)) {
      if (seen.has(part.hafsKey)) continue;
      seen.add(part.hafsKey);
      const partial = part.sharedWith.some(key => !selected.has(key));
      parts.push({
        hafsKey: part.hafsKey,
        note: partial ? sharedHafsVerseNote(part, rewayah, subject) : null,
      });
    }
  }
  return parts;
}

/**
 * Translation text of the parts: each translation on its own line, a part's
 * note on the line after it (a missing translation and its note are
 * skipped). For Hafs this is the selected verses' translations joined by
 * line breaks, as before.
 */
export function joinTranslationParts(
  parts: readonly SelectionTranslationPart[],
  translationOf: (hafsKey: string) => string,
): string {
  const lines: string[] = [];
  for (const part of parts) {
    const text = translationOf(part.hafsKey);
    if (!text) continue;
    lines.push(text);
    if (part.note) lines.push(part.note);
  }
  return lines.join('\n');
}

/** "Quran 2:1 · Warsh" (Warsh's verse 2:1); Hafs: "Quran 2:255". */
export function selectionCitation(selection: ReadyVerseSelection): string {
  return formatQuranCitation(selection.label, selection.rewayah);
}

/**
 * Copied text: verse text, translation, citation (blank lines between), the
 * verse actions sheet's copy layout from before the verse units.
 */
export function formatVerseCopyText(
  arabic: string,
  translation: string,
  citation: string,
): string {
  const parts: string[] = [];
  if (arabic) parts.push(arabic);
  if (translation) parts.push(translation);
  parts.push(citation);
  return parts.join('\n\n');
}

/**
 * SkiaVersePreview props for a selection: another rewayah's verses are drawn
 * from their unit texts (exactly their slots, each with its own marker); a
 * Hafs selection is read by its Hafs keys, exactly as before.
 */
export function selectionPreviewProps(selection: ReadyVerseSelection): {
  verseKey: string;
  verseKeys?: string[];
  text?: string;
} {
  const texts = readUnitTexts(selection);
  if (texts) return {verseKey: selection.keys[0], text: texts.join(' ')};
  return {
    verseKey: selection.keys[0],
    verseKeys: selection.keys.length > 1 ? [...selection.keys] : undefined,
  };
}

/**
 * The Hafs verse a QUL lookup (similar verses, shared phrases) may use for
 * this selection, or null. QUL data is per Hafs verse, so it applies only to
 * a single verse that is exactly one whole Hafs verse. Hafs: the payload's
 * verse, as before.
 */
export function qulVerseKey(
  selection: VerseSelection,
  request: Pick<VerseSelectionRequest, 'surahNumber' | 'ayahNumber'>,
): string | null {
  if (selection.status !== 'ready' || selection.isRange) return null;
  if (!selection.units) {
    return request.surahNumber && request.ayahNumber
      ? `${request.surahNumber}:${request.ayahNumber}`
      : null;
  }
  const parts = selectionTranslationParts(selection);
  return parts.length === 1 && parts[0].note === null ? parts[0].hafsKey : null;
}

/**
 * The Hafs verses holding a selection: the Hafs verse holding the first
 * selected verse's first word and the last Hafs verse holding the last
 * selected verse's words. Hafs: the first and last selected verses, which a
 * Hafs selection plays as before. A non-Hafs selection plays its own verse
 * units (the verse actions sheet passes `units` to the players); these keys
 * then serve its page lookups and Hafs fields only.
 */
export function selectionPlaybackKeys(selection: ReadyVerseSelection): {
  firstHafsKey: string;
  lastHafsKey: string;
} {
  const {units, model} = selection;
  if (!units || !model) {
    return {
      firstHafsKey: selection.keys[0],
      lastHafsKey: selection.keys[selection.keys.length - 1],
    };
  }
  const last = units[units.length - 1];
  return {
    firstHafsKey: model.hafsAnchor(units[0]).hafsKey,
    lastHafsKey: last.hafsKeys[last.hafsKeys.length - 1],
  };
}

// ── Async (copy / share actions) ───────────────────────────────────────────

/**
 * The selection once the rewayah's verse units are in memory: waits
 * (bounded, like copy / share waits for text) for the rewayah's words, then
 * builds the selection. Hafs: at once.
 */
export async function resolveVerseSelection(
  request: VerseSelectionRequest,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): Promise<VerseSelection> {
  if (request.rewayah === 'hafs') return selectVerses(request, null, 'ready');
  const loaded = await waitForRewayahText(request.rewayah, timeoutMs);
  const model = loaded ? rewayahVerseUnitsService.get(request.rewayah) : null;
  if (model) return selectVerses(request, model, 'ready');
  const status = rewayahVerseUnitsService.getStatus(request.rewayah);
  return selectVerses(
    request,
    null,
    status === 'unavailable' ? 'unavailable' : 'error',
  );
}

/**
 * The selection's verse texts for copy / share: unit texts (in memory once
 * the selection is ready), or for Hafs the Hafs-keyed resolveVerseTexts
 * (waits for the Hafs words, falls back to the bundled Hafs text).
 */
export async function resolveSelectionTexts(
  selection: ReadyVerseSelection,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): Promise<VerseTextsResult> {
  const texts = readUnitTexts(selection);
  if (texts) return {status: 'ready', rewayah: selection.rewayah, texts};
  return resolveVerseTexts(selection.keys, selection.rewayah, timeoutMs);
}

/**
 * Why nothing could be done with a selection that is not ready, as a toast
 * (title, message). `action` completes "Nothing was ...".
 */
export function selectionFailureMessage(
  selection: PendingVerseSelection,
  action: 'copied' | 'shared' | 'saved' | 'played',
): {title: string; message: string} {
  const label = getShortLabel(selection.rewayah);
  if (selection.status === 'invalid') {
    return {
      title: `Not a numbered verse in ${label}`,
      message: `Nothing was ${action}.`,
    };
  }
  return {
    title: `Couldn't load the ${label} text`,
    message: `Nothing was ${action}. Please try again.`,
  };
}
