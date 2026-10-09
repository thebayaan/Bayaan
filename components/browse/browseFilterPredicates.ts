/**
 * browseFilterPredicates — RFC-020 pure, RN-free reciter-level predicates
 * for the composable Search filter dimensions.
 *
 * Extracted so the destination (`BrowseReciters`) and the unit suite
 * (`browseFilterPredicates.test.ts`) share the SAME predicate code — the
 * composition test then exercises the real filter logic rather than a copy.
 * Deliberately holds no React / react-native imports so the tests never
 * touch the heavy BrowseReciters dependency graph.
 *
 * These cover the seam dimensions whose value maps to a `Reciter` field:
 * `full-quran` (derived from `rewayat[].surah_total`), `country`, and
 * `translation`. The `rewaya` (teacher/student) dimension keeps its existing
 * bespoke predicate inline in `BrowseReciters`, and generic flag facets
 * (`SearchFilterFlagFacet`) are applied generically at the call site, so
 * neither is mirrored here.
 */
import {Reciter} from '@/data/reciterData';

/**
 * `full-quran` dimension — a reciter with at least one rewaya covering the
 * complete mushaf (`surah_total === 114`). Derived, no dedicated field.
 */
export function reciterHasFullQuran(reciter: Reciter): boolean {
  return reciter.rewayat.some(rewaya => rewaya.surah_total === 114);
}

/**
 * `country` dimension — slug-compares `Reciter.country` to the param slug.
 * The slugify shape mirrors `data/countryCollections.ts`'s `slugify` so the
 * predicate and the picker's option list agree. Empty / null / unset
 * countries never match (so this is a no-op until a fork populates the
 * field — RFC-020 §1).
 */
export function reciterMatchesCountry(
  reciter: Reciter,
  countrySlug: string,
): boolean {
  if (!reciter.country) return false;
  const slug = reciter.country
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug === countrySlug;
}

/**
 * `translation` dimension — slug-compares `Reciter.translation` to the param
 * slug (lowercase + dash-separated), matching `slugifyLanguage` in
 * `data/translationCollections.ts`. Empty / null / unset translations never
 * match (no-op until a fork populates the field — RFC-020 §1).
 */
export function reciterMatchesTranslation(
  reciter: Reciter,
  translationSlug: string,
): boolean {
  if (!reciter.translation) return false;
  const slug = reciter.translation.toLowerCase().trim().replace(/\s+/g, '-');
  return slug === translationSlug;
}
