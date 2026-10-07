// @ai-generated
/**
 * Color legend for the mushaf settings' "Show Differences" card (rendered by
 * MushafSettingsContent inside the mushaf layout sheet).
 *
 * The legend is derived from the bundled diff file, so it cannot advertise a
 * highlight the data does not carry. The old hand-written legend listed
 * tashil, madd al-badal, ibdal, taghliz and vowel-shift colors that the data
 * never or almost never produced.
 *
 * Release 1 diff files ("__format": 2) mark two things:
 *   - whole words that read differently from Hafs ('major' for the close
 *     rewayat, 'mukhtalif' for the far ones), drawn as a background tint;
 *   - silah marks that differ from Hafs ('silah'), drawn in the silah color.
 * Letter-level categories (tashil, madd, ibdal, taghliz, minor) are not
 * emitted in Release 1 and never appear in the legend. Older files without
 * "__format" color silah by scanning the text for LEGACY_SILAH_REWAYAT
 * (RewayahDiffService.hasSilahColoring).
 */
import {
  REWAYAH_DIFF_BACKGROUND,
  tajweedColors,
} from '@/constants/tajweedColors';
import type {RewayahWithDiffs} from '@/services/rewayah/RewayahIdentity';

export interface LegendEntry {
  color: string;
  isBackground?: boolean;
  label: string;
  description: string;
}

export interface RewayahLegend {
  summary: string;
  entries: LegendEntry[];
}

export interface DiffLegendCategories {
  wordVariants: boolean;
  silah: boolean;
  /** True for Release 1 data, whose silah entries are differences only. */
  silahDiffersFromHafs: boolean;
}

// Same files RewayahDiffService loads (data/mushaf/digitalkhatt/<id>-diff.json).
const DIFF_ASSETS: Record<RewayahWithDiffs, () => unknown> = {
  shubah: () => require('@/data/mushaf/digitalkhatt/shouba-diff.json'),
  'al-bazzi': () => require('@/data/mushaf/digitalkhatt/bazzi-diff.json'),
  qunbul: () => require('@/data/mushaf/digitalkhatt/qumbul-diff.json'),
  warsh: () => require('@/data/mushaf/digitalkhatt/warsh-diff.json'),
  qalun: () => require('@/data/mushaf/digitalkhatt/qaloon-diff.json'),
  'al-duri-abi-amr': () =>
    require('@/data/mushaf/digitalkhatt/doori-diff.json'),
  'al-susi': () => require('@/data/mushaf/digitalkhatt/soosi-diff.json'),
};

const LEGACY_SILAH_REWAYAT: ReadonlySet<RewayahWithDiffs> = new Set([
  'al-bazzi',
  'qunbul',
  'warsh',
  'qalun',
]);

const hasEntries = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

/** Which legend entries a diff file supports. */
export function getDiffLegendCategories(
  raw: unknown,
  legacySilah: boolean,
): DiffLegendCategories {
  const data =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const isFormat2 = data.__format === 2;
  let wordVariants = false;
  let silah = false;
  for (const [verseKey, value] of Object.entries(data)) {
    if (verseKey === '__format') continue;
    if (Array.isArray(value)) {
      // Legacy flat list (old Shu'bah file): whole-word variants.
      if (value.length > 0) wordVariants = true;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const categories = value as Record<string, unknown>;
    if (hasEntries(categories.major) || hasEntries(categories.mukhtalif)) {
      wordVariants = true;
    }
    if (isFormat2 && hasEntries(categories.silah)) silah = true;
  }
  return {
    wordVariants,
    silah: isFormat2 ? silah : legacySilah,
    silahDiffersFromHafs: isFormat2,
  };
}

/** Legend copy for the categories a rewayah's data carries. */
export function buildRewayahLegend(
  categories: DiffLegendCategories,
): RewayahLegend {
  const entries: LegendEntry[] = [];
  if (categories.wordVariants) {
    entries.push({
      color: REWAYAH_DIFF_BACKGROUND,
      isBackground: true,
      label: 'Word variant',
      description: 'Word that reads differently from Hafs',
    });
  }
  if (categories.silah) {
    entries.push({
      color: tajweedColors.silah,
      label: 'Silah',
      description: categories.silahDiffersFromHafs
        ? 'Pronoun-lengthening mark (ۥ / ۦ) that differs from Hafs'
        : 'Pronoun-lengthening mark (ۥ / ۦ)',
    });
  }
  const highlighted = categories.silah
    ? 'Tints words that read differently from Hafs and colors silah marks.'
    : 'Tints words that read differently from Hafs.';
  return {
    summary: `${highlighted} Pronunciation rules such as tashil, imalah and taqlil are not highlighted.`,
    entries,
  };
}

const legendCache = new Map<RewayahWithDiffs, RewayahLegend>();

/** Legend for a rewayah's bundled diff data (computed once per rewayah). */
export function getRewayahDiffLegend(rewayah: RewayahWithDiffs): RewayahLegend {
  let legend = legendCache.get(rewayah);
  if (!legend) {
    legend = buildRewayahLegend(
      getDiffLegendCategories(
        DIFF_ASSETS[rewayah](),
        LEGACY_SILAH_REWAYAT.has(rewayah),
      ),
    );
    legendCache.set(rewayah, legend);
  }
  return legend;
}
