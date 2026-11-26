// services/widgets/buildCatalog.ts
import type {Reciter} from '@/data/reciterData';
import adhkarSeed from '@/data/adhkar.json';
import {
  WIDGET_CATALOG_VERSION,
  WidgetCatalog,
  WidgetCatalogDhikr,
  WidgetTasbeehEntry,
} from 'bayaan-widgets';
import {artworkFileName} from './buildSnapshot';
import {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';

export {tasbeehDisplayText, tasbeehTranslation} from './dhikrText';

// سُبْحَانَ اللَّهِ وَبِحَمْدِهِ (100 times); the seed has no plain SubhanAllah with a count.
export const DEFAULT_TASBEEH_DHIKR_ID = '91';
const MAX_DHIKR_CHARS = 180;
// Rows whose repeat count belongs to an instruction rather than a dhikr to
// recite (114: "spit on your left three times" after a bad dream).
const NOT_RECITED_IDS: ReadonlySet<string> = new Set(['114']);

export interface SeedDhikr {
  id: string;
  arabic: string;
  translation: string | null;
  repeat_count: number;
}

function isSeedDhikr(value: unknown): value is SeedDhikr {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'arabic' in value &&
    typeof value.arabic === 'string' &&
    'translation' in value &&
    (value.translation === null || typeof value.translation === 'string') &&
    'repeat_count' in value &&
    typeof value.repeat_count === 'number'
  );
}

export function seedAdhkar(seed: unknown): SeedDhikr[] {
  if (
    typeof seed !== 'object' ||
    seed === null ||
    !('adhkar' in seed) ||
    !Array.isArray(seed.adhkar)
  ) {
    return [];
  }
  const rows: unknown[] = seed.adhkar;
  return rows.filter(isSeedDhikr);
}

export function tasbeehAdhkar(seed: SeedDhikr[]): WidgetCatalogDhikr[] {
  const out: WidgetCatalogDhikr[] = [];
  for (const d of seed) {
    if (d.repeat_count <= 1 || NOT_RECITED_IDS.has(d.id)) continue;
    const arabic = tasbeehDisplayText(d.arabic);
    if (!arabic || arabic.length > MAX_DHIKR_CHARS) continue;
    out.push({
      id: d.id,
      arabic,
      translation: tasbeehTranslation(d.translation),
      repeatCount: d.repeat_count,
    });
  }
  return out;
}

export const TASBEEH_ADHKAR: WidgetCatalogDhikr[] = tasbeehAdhkar(
  seedAdhkar(adhkarSeed),
);

export function buildCatalog(
  reciters: Reciter[],
  adhkar: WidgetCatalogDhikr[],
): WidgetCatalog {
  return {
    version: WIDGET_CATALOG_VERSION,
    reciters: reciters
      .filter(r => r.id !== '')
      .map(r => ({id: r.id, name: r.name, artworkFile: artworkFileName(r.id)}))
      .sort((a, b) => a.name.localeCompare(b.name)),
    adhkar,
  };
}

export function buildTasbeehEntries(
  adhkar: WidgetCatalogDhikr[],
  counts: Record<string, number>,
  day: string,
): Record<string, WidgetTasbeehEntry> {
  const entries: Record<string, WidgetTasbeehEntry> = {};
  for (const d of adhkar) {
    entries[d.id] = {count: counts[d.id] ?? 0, target: d.repeatCount, day};
  }
  return entries;
}

// @ai-start
// The adhkar store holds the counts of one local day (`countsDay`). After
// midnight that can still be yesterday, until the app is next opened and
// reloads them; those are not today's counts. The day used to be guessed
// from whether a number had changed since the last snapshot, which hid a
// count that reached the same total as the day before.
export function countsOfToday(
  counts: Record<string, number>,
  countsDay: string | null,
  today: string,
): Record<string, number> {
  return countsDay === today ? counts : {};
}
// @ai-end
