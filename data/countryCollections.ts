/**
 * Country registry — RFC-020 `country` filter dimension.
 *
 * Derives the list of countries from the active catalog: each distinct
 * `Reciter.country` value becomes a `CountryInfo` entry with a live reciter
 * count. Reciters with no `country` value are dropped, so the list is empty
 * until a fork populates `Reciter.country` from its catalog (RFC-020 §1
 * field prerequisite) — at which point the `country` composer chip fills in
 * automatically with no further wiring.
 */
import {RECITERS, type Reciter} from './reciterData';

export interface CountryInfo {
  /** Kebab-case slug — e.g. "saudi-arabia". Matches the URL param. */
  id: string;
  /** Display name — e.g. "Saudi Arabia". */
  name: string;
  /** Optional emoji flag (from the curated map; absent otherwise). */
  flag?: string;
  /** Reciters whose `country` field matches this entry, computed live. */
  reciterCount: number;
}

/**
 * Display metadata for curated countries, keyed by the kebab-case slug of
 * `Reciter.country` (lowercase + spaces → hyphens). A slug present here
 * picks up a friendly name + flag; an uncurated slug renders the raw
 * country string with no flag (still functional). Empty by default — forks
 * populate it as country values land in their catalog.
 */
const CURATED_COUNTRIES: Record<string, {name: string; flag?: string}> = {};

function slugify(country: string): string {
  return country.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
}

/**
 * Aggregate `RECITERS` by `country`, returning one entry per distinct
 * country with the reciter count. Reciters with no `country` value are
 * dropped silently, so this returns `[]` until the field is populated.
 */
export function getAllCountries(): CountryInfo[] {
  const counts = new Map<string, {name: string; count: number}>();
  for (const reciter of RECITERS as Reciter[]) {
    if (!reciter.country) continue;
    const id = slugify(reciter.country);
    const existing = counts.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      const curated = CURATED_COUNTRIES[id];
      counts.set(id, {name: curated?.name ?? reciter.country, count: 1});
    }
  }

  return Array.from(counts.entries())
    .map(([id, {name, count}]) => ({
      id,
      name,
      flag: CURATED_COUNTRIES[id]?.flag,
      reciterCount: count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
