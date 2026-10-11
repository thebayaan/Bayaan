/**
 * useURLFiltersAsChips — RFC-020 URL-as-state core for the Search filter
 * composer.
 *
 * Maps the reciter-browse route's URL params to an ordered list of active
 * filter chips (declaration order of `branding.searchFilters`) and exposes
 * `setFilter` / `removeFilter` mutators that write back via
 * `router.setParams` — IN PLACE, never `push`, so chip edits don't pollute
 * the back stack and a filtered view's URL stays a shareable deeplink
 * (RFC-020 §3, Q4).
 *
 * Locked URL param schema (reuses every existing param so legacy deeplinks
 * keep working):
 *   - `country=<CountryInfo.id>` (+ `countryName` display companion)
 *   - `translation=<TranslationInfo.id>` (+ `translationName`)
 *   - `surahId=<1..114>` — the `has-surah` dimension
 *   - rewaya dim = the existing `teacher` + `student` PAIR (one RewayatInfo
 *     pick = one pair; + `rewayatName` display companion)
 *   - booleans serialize as `<name>=1`: `fullQuran=1`, and flag facets
 *     generically as `<field>=1`; absent = off
 *   - removing a chip clears its param(s) (the whole pair for rewaya) by
 *     passing `undefined` to `router.setParams` (expo-router removes the key)
 *
 * Single value per dimension (RFC-020 §3, Q1): setting a dimension always
 * replaces its param(s); nothing appends.
 */
import {useCallback} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import branding from '@/config/branding';
import type {
  SearchFilterDimension,
  SearchFilterFlagFacet,
} from '@/config/branding';
import {getAllCountries} from '@/data/countryCollections';
import {getAllRewayatWithCounts} from '@/data/rewayat';
import {getAllTranslations} from '@/data/translationCollections';
import {SURAHS} from '@/data/surahData';
import {useReciterStore} from '@/store/reciterStore';

/** An active filter rendered as a removable chip in the composer. */
export interface ActiveFilterChip {
  /**
   * Canonical dimension id — a `SearchFilterDimension` string
   * ('country', 'rewaya', 'has-surah', 'translation', 'full-quran') or a
   * flag facet's `field`.
   */
  dim: string;
  /** Display label, e.g. `Country: Algeria` (value dims) or `Featured` (toggles). */
  label: string;
  /**
   * The dimension's current value: country/translation id, surah number,
   * the resolved RewayatInfo id for the rewaya pair, or `'1'` for toggles.
   */
  value: string;
}

/** A `branding.searchFilters` entry normalized for the composer. */
export interface ComposerDimension {
  /** Canonical dimension id (see `ActiveFilterChip.dim`). */
  dim: string;
  /** Palette display label, e.g. `Country` / `Featured`. */
  label: string;
  /**
   * `picker` — the dimension needs a value picker sheet.
   * `toggle` — one-tap on/off (`<param>=1`); flag facets + full-quran.
   */
  input: 'picker' | 'toggle';
}

/** Palette labels for the shared string dimensions. */
const DIM_LABELS: Record<string, string> = {
  rewaya: 'Rewaya',
  country: 'Country',
  'has-surah': 'Surah',
  translation: 'Translation',
  'full-quran': 'Full Quran',
};

/** String dims the composer can offer a value picker for today. */
const COMPOSER_VALUE_DIMS = new Set<string>([
  'rewaya',
  'country',
  'has-surah',
  'translation',
]);

/**
 * Normalize `branding.searchFilters` into the composer's dimension list,
 * preserving declaration order (RFC-020 §3, Q2 — chip order is
 * tenant-controlled).
 *
 * Gracefully skipped when declared:
 *   - `has-photo` — already owned by BrowseReciters' bespoke RFC-012 chip;
 *     surfacing it here too would double-render the control.
 *   - `recitation-style` — has no composer value picker yet.
 * Unknown future strings are skipped silently (forward-compat, mirroring
 * `homeRowConfig`'s unknown-id behavior).
 */
export function getComposerDimensions(): ComposerDimension[] {
  const declared: Array<SearchFilterDimension | SearchFilterFlagFacet> =
    branding.searchFilters ?? [];
  const out: ComposerDimension[] = [];
  for (const entry of declared) {
    if (typeof entry === 'string') {
      if (entry === 'full-quran') {
        out.push({dim: entry, label: DIM_LABELS[entry], input: 'toggle'});
      } else if (COMPOSER_VALUE_DIMS.has(entry)) {
        out.push({dim: entry, label: DIM_LABELS[entry], input: 'picker'});
      }
      // 'has-photo' / 'recitation-style' / unknown → skipped (see docstring).
    } else {
      out.push({dim: entry.field, label: entry.label, input: 'toggle'});
    }
  }
  return out;
}

/** Normalize an expo-router param value to a single non-empty string. */
function firstParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v ? v : undefined;
}

/**
 * The composer's rewaya lookup list: every canonical rewaya with at least
 * one reciter. Deliberately `getAllRewayatWithCounts()` and NOT
 * `getAllRewayatTypes()` — the latter excludes `hafs-an-assem` by design
 * (it feeds the Listen-tab discovery carousel, where the majority narration
 * is noise), which here would make Hafs unpickable, silently no-op
 * `setFilter('rewaya', 'hafs-an-assem')`, and degrade a
 * `teacher=Asim&student=Hafs` deeplink's chip label to the raw fallback.
 */
function composerRewayatList() {
  return getAllRewayatWithCounts().filter(r => r.reciterCount > 0);
}

export function useURLFiltersAsChips() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // The RECITERS-backed registries below (getAllCountries /
  // getAllRewayatWithCounts / getAllTranslations) are empty until the
  // catalog populates. Subscribing to `isInitialized` re-renders us the
  // moment it lands so chip labels upgrade from the URL display companions
  // to registry-resolved names.
  const catalogReady = useReciterStore(s => s.isInitialized);

  const declaredDims = getComposerDimensions();

  // Computed per render, deliberately un-memoized: `useLocalSearchParams`
  // returns a fresh object every render, so a memo keyed on it would never
  // cache; the work is bounded by the ≤7-entry declaration + small
  // registry scans.
  const activeChips: ActiveFilterChip[] = [];
  for (const d of declaredDims) {
    switch (d.dim) {
      case 'country': {
        const id = firstParam(params.country);
        if (!id) break;
        const resolved = catalogReady
          ? getAllCountries().find(c => c.id === id)?.name
          : undefined;
        const name = resolved ?? firstParam(params.countryName) ?? id;
        activeChips.push({
          dim: d.dim,
          label: `${d.label}: ${name}`,
          value: id,
        });
        break;
      }
      case 'rewaya': {
        const teacher = firstParam(params.teacher);
        const student = firstParam(params.student);
        if (!teacher && !student) break;
        const info = catalogReady
          ? composerRewayatList().find(
              r => r.teacher === teacher && r.student === student,
            )
          : undefined;
        const name =
          info?.displayName ??
          firstParam(params.rewayatName) ??
          student ??
          teacher ??
          '';
        activeChips.push({
          dim: d.dim,
          label: `${d.label}: ${name}`,
          value: info?.id ?? name,
        });
        break;
      }
      case 'has-surah': {
        const surahId = firstParam(params.surahId);
        if (!surahId) break;
        const surah = SURAHS[parseInt(surahId, 10) - 1];
        activeChips.push({
          dim: d.dim,
          label: `${d.label}: ${surah?.name ?? surahId}`,
          value: surahId,
        });
        break;
      }
      case 'translation': {
        const id = firstParam(params.translation);
        if (!id) break;
        const resolved = catalogReady
          ? getAllTranslations().find(t => t.id === id)?.name
          : undefined;
        const name = resolved ?? firstParam(params.translationName) ?? id;
        activeChips.push({
          dim: d.dim,
          label: `${d.label}: ${name}`,
          value: id,
        });
        break;
      }
      case 'full-quran': {
        if (firstParam(params.fullQuran) !== '1') break;
        activeChips.push({dim: d.dim, label: d.label, value: '1'});
        break;
      }
      default: {
        // Flag facet — generic `<field>=1` serialization.
        if (d.input === 'toggle' && firstParam(params[d.dim]) === '1') {
          activeChips.push({dim: d.dim, label: d.label, value: '1'});
        }
        break;
      }
    }
  }

  /**
   * Apply a dimension's value IN PLACE (single value per dimension —
   * setting always replaces). For value dims pass the picker's
   * `(value, displayName)`; for the rewaya dim `value` is the picked
   * RewayatInfo id (resolved here to the `teacher`+`student` param pair);
   * toggles ignore `value` and serialize as `<param>=1`.
   */
  const setFilter = useCallback(
    (dim: string, value: string, displayName?: string) => {
      switch (dim) {
        case 'country':
          router.setParams({country: value, countryName: displayName});
          break;
        case 'translation':
          router.setParams({translation: value, translationName: displayName});
          break;
        case 'has-surah':
          router.setParams({surahId: value});
          break;
        case 'rewaya': {
          const info = composerRewayatList().find(r => r.id === value);
          if (!info) {
            if (__DEV__) {
              console.warn(
                `[useURLFiltersAsChips] setFilter('rewaya', '${value}') — unknown RewayatInfo id; ignoring`,
              );
            }
            return;
          }
          router.setParams({
            teacher: info.teacher,
            student: info.student,
            rewayatName: displayName ?? info.displayName,
          });
          break;
        }
        case 'full-quran':
          router.setParams({fullQuran: '1'});
          break;
        default: {
          const entry = getComposerDimensions().find(d => d.dim === dim);
          if (entry?.input === 'toggle') {
            router.setParams({[dim]: '1'});
          } else if (__DEV__) {
            console.warn(
              `[useURLFiltersAsChips] setFilter('${dim}') — dimension is not declared in branding.searchFilters; ignoring`,
            );
          }
          break;
        }
      }
    },
    [router],
  );

  /**
   * Clear a dimension IN PLACE. Clears the display companion alongside the
   * value, and the whole `teacher`+`student` pair for the rewaya dim.
   * Passing `undefined` removes the key (expo-router `setParams` contract).
   */
  const removeFilter = useCallback(
    (dim: string) => {
      switch (dim) {
        case 'country':
          router.setParams({country: undefined, countryName: undefined});
          break;
        case 'translation':
          router.setParams({
            translation: undefined,
            translationName: undefined,
          });
          break;
        case 'has-surah':
          router.setParams({surahId: undefined});
          break;
        case 'rewaya':
          router.setParams({
            teacher: undefined,
            student: undefined,
            rewayatName: undefined,
          });
          break;
        case 'full-quran':
          router.setParams({fullQuran: undefined});
          break;
        default:
          // Flag facets (and any future generic boolean param).
          router.setParams({[dim]: undefined});
          break;
      }
    },
    [router],
  );

  return {activeChips, declaredDims, setFilter, removeFilter};
}
