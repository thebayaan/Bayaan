// @ai-generated
/**
 * What the verse actions sheet's screens show for a verse of a rewayah in
 * its OWN numbering (Release 1, decision 3; verse-units contract 4.3, 4.6).
 *
 * Translations, tafsir, word by word, themes and QUL similar verses are keyed
 * by Hafs verses. A rewayah verse is shown with every Hafs verse holding its
 * words (RewayahVerseUnits.translationParts): a verse spanning several Hafs
 * verses shows all of them in order; a Hafs verse the rewayah divides between
 * neighbouring verses is shown whole, once, with a note saying so. A Hafs
 * reference shown on purpose is prefixed "Hafs" so it is never read as the
 * rewayah's own number.
 *
 * Hafs (and any producer without verse units) keeps the screens exactly as
 * before: hafsPagerPage() is the old page of a Hafs verse, and no screen adds
 * a caption, a note or a prefix for it.
 */
import {
  formatUnitRangeLabel,
  type RewayahVerseUnits,
  type VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import type {TafseerResult} from '@/services/tafseer/TafseerDbService';
import {
  selectionTranslationParts,
  unitSelection,
} from '@/components/share/rewayahVerseSelection';

/** A rewayah verse a screen starts from, with its rewayah's units. */
export interface UnitStart {
  model: RewayahVerseUnits;
  unit: VerseUnit;
}

/** One page of the translation / tafsir pagers. */
export interface VersePagerPage {
  /** Remounts the page's scroll view. */
  key: string;
  /** Badge and counter: the verse in the shown rewayah's numbering. */
  label: string;
  /** Hafs verses whose translations (or tafsir) the page shows, in order. */
  hafsKeys: readonly string[];
  /** Notes under the content: a Hafs verse the rewayah divides. */
  notes: readonly string[];
  /** The Arabic preview: a Hafs verse key, or a rewayah verse's own text. */
  previewVerseKey: string;
  previewText?: string;
  /** Hafs references on the page are prefixed "Hafs" (another rewayah). */
  hafsReferences: boolean;
}

/** The page of a Hafs verse: exactly the page before the verse units. */
export function hafsPagerPage(verseKey: string): VersePagerPage {
  return {
    key: verseKey,
    label: verseKey,
    hafsKeys: [verseKey],
    notes: [],
    previewVerseKey: verseKey,
    hafsReferences: false,
  };
}

/**
 * The page of a rewayah verse (a single-verse surface, contract 4.6): every
 * Hafs verse holding its words, each once, with a note under a Hafs verse
 * the rewayah divides; the preview is the verse's own text (its slots, with
 * its own marker).
 */
export function unitPagerPage(
  model: RewayahVerseUnits,
  unit: VerseUnit,
  subject: 'translation' | 'tafsir',
): VersePagerPage {
  const parts = selectionTranslationParts(
    unitSelection(model, [unit]),
    subject,
  );
  return {
    key: `${unit.rewayah}:${unit.key}`,
    label: unit.key,
    hafsKeys: parts.map(part => part.hafsKey),
    notes: parts.flatMap(part => (part.note ? [part.note] : [])),
    previewVerseKey: unit.key,
    previewText: model.unitText(unit),
    hafsReferences: true,
  };
}

/** Texts of several Hafs verses' translations: one per line, empties skipped. */
export function joinPartTexts(
  texts: readonly (string | null | undefined)[],
): string {
  return texts
    .map(text => text ?? '')
    .filter(Boolean)
    .join('\n');
}

/** One entry per tafsir passage (a grouped passage can cover several parts). */
export function distinctTafseerResults(
  results: readonly (TafseerResult | null)[],
): TafseerResult[] {
  const seen = new Set<string>();
  const out: TafseerResult[] = [];
  for (const result of results) {
    if (!result) continue;
    const key = `${result.surahNumber}:${result.fromAyah}-${result.toAyah}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
  }
  return out;
}

/**
 * The badge over a tafsir passage, or null. Hafs: "VERSES 2:1 – 2:5" for a
 * grouped passage, as before. Another rewayah: a passage is keyed by Hafs
 * verses, so its reference says so ("HAFS VERSES 2:1 – 2:5", "HAFS 1:7"),
 * shown whenever it is not simply the page's own verse.
 */
export function tafseerBadge(
  result: Pick<TafseerResult, 'surahNumber' | 'fromAyah' | 'toAyah'>,
  page: Pick<VersePagerPage, 'label' | 'hafsReferences'>,
  passages: number,
): string | null {
  const {surahNumber: s, fromAyah: from, toAyah: to} = result;
  if (from !== to) {
    const range = `VERSES ${s}:${from} – ${s}:${to}`;
    return page.hafsReferences ? `HAFS ${range}` : range;
  }
  if (!page.hafsReferences) return null;
  return passages > 1 || `${s}:${from}` !== page.label
    ? `HAFS ${s}:${from}`
    : null;
}

/** A Hafs verse shown word by word, with its caption ("Hafs 2:6") if any. */
export interface WBWPart {
  verseKey: string;
  caption: string | null;
}

/**
 * The Hafs verses a word-by-word view shows (word-by-word data is
 * Hafs-aligned, with its own "shown in Hafs" notice). Hafs: the verse itself.
 * A rewayah verse: every Hafs verse holding its words, captioned with its
 * Hafs reference unless the verse is exactly that Hafs verse under the same
 * number.
 */
export function wbwParts(verseKey: string, unitStart?: UnitStart): WBWPart[] {
  if (!unitStart) return [{verseKey, caption: null}];
  const {model, unit} = unitStart;
  const parts = model.translationParts(unit);
  const plain =
    parts.length === 1 && !parts[0].shared && parts[0].hafsKey === unit.key;
  return parts.map(part => ({
    verseKey: part.hafsKey,
    caption: plain ? null : `Hafs ${part.hafsKey}`,
  }));
}

/**
 * A theme's passage (Hafs verses from..to of one surah) in the shown
 * rewayah's numbering: the rewayah verses holding its words, as
 * "S:A – S:B" and their count. Null when no verse of the rewayah holds them.
 */
export function rewayahThemePassage(
  model: RewayahVerseUnits,
  surah: number,
  ayahFrom: number,
  ayahTo: number,
): {range: string; count: number} | null {
  const hafsKeys: string[] = [];
  for (let ayah = ayahFrom; ayah <= ayahTo; ayah++) {
    hafsKeys.push(`${surah}:${ayah}`);
  }
  const units = model.unitsForHafsKeys(hafsKeys);
  if (units.length === 0) return null;
  const first = units[0];
  const last = units[units.length - 1];
  return {
    range: `${formatUnitRangeLabel(first)} – ${formatUnitRangeLabel(last)}`,
    count: units.length,
  };
}

/**
 * The reference of a QUL similar-verse result (a Hafs verse). QUL similarity
 * is computed on Hafs verses, so in another rewayah's sheet the result keeps
 * its Hafs reference, prefixed: "Hafs 2:255" (contract 4.3). Hafs: "2:255".
 */
export function similarVerseRef(
  hafsKey: string,
  hafsReferences: boolean,
): string {
  return hafsReferences ? `Hafs ${hafsKey}` : hafsKey;
}
