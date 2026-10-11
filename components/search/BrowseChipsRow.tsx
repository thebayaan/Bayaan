/**
 * BrowseChipsRow — RFC-020 rest-state "Browse" region for the Search tab
 * landing.
 *
 * Renders one entry chip per declared `branding.searchFilters` dimension
 * (declaration order, via `getComposerDimensions`) as a horizontally-
 * scrollable strip mounted above the curated Collections tiles. A chip is
 * the on-ramp into the compose state: tapping it deeplinks into the
 * reciter-browse destination — which hosts the <SearchFilters /> composer —
 * with `?openPicker=<dim>`, so the composer opens that dimension
 * front-and-center (its value picker for value dims; an immediate apply for
 * the flag / full-quran toggles). The chips are STATELESS entry affordances
 * (never rendered "active"), so the Search landing itself holds no filter
 * state to reset on re-entry (RFC-020 §2) — popping back to it naturally
 * leaves it at rest.
 *
 * The curated Collections (system-playlist) tiles are a SEPARATE, static
 * region outside the filter model and are not touched here.
 *
 * With `branding.searchFilters` unset (stock upstream) `getComposerDimensions`
 * returns `[]` and this renders nothing — the Search landing stays
 * byte-identical to today.
 */
import React, {useCallback} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useRouter} from 'expo-router';
import {
  getComposerDimensions,
  type ComposerDimension,
} from '@/hooks/useURLFiltersAsChips';
import {RECITERS} from '@/data/reciterData';
import {useReciterStore} from '@/store/reciterStore';
import FilterChip from './FilterChip';

/**
 * Live count for a Browse chip — mirrors `SearchFilters.paletteOptions`
 * EXACTLY: a cheap single scan of RECITERS for the toggle dimensions
 * (`full-quran` + the flag facets), and no count for the value dimensions
 * (their per-option counts live inside their pickers). Undefined until the
 * catalog populates (RECITERS + any facet fields land async after mount).
 */
function toggleReciterCount(
  dim: ComposerDimension,
  catalogReady: boolean,
): number | undefined {
  if (dim.input !== 'toggle' || !catalogReady) return undefined;
  return dim.dim === 'full-quran'
    ? RECITERS.filter(reciter =>
        reciter.rewayat.some(rewayat => rewayat.surah_total === 114),
      ).length
    : RECITERS.filter(
        reciter =>
          (reciter as unknown as Record<string, unknown>)[dim.dim] === true,
      ).length;
}

export default function BrowseChipsRow() {
  const router = useRouter();
  // Scalar selector (never a whole-store subscription) — re-renders on
  // catalog load so the toggle counts upgrade from undefined to live.
  const catalogReady = useReciterStore(s => s.isInitialized);

  // Declaration-order dimension list; `[]` when branding.searchFilters is
  // unset (stock upstream).
  const dims = getComposerDimensions();

  const openDimension = useCallback(
    (dim: string) => {
      // The compose surface is the pushed reciter-browse destination (it
      // hosts the <SearchFilters /> composer). `openPicker` is a transient
      // UI intent the composer consumes once on arrival — it opens that
      // dimension, then clears the param — so the URL stays a clean,
      // shareable filter deeplink and the back-stack isn't polluted.
      router.push({
        pathname: '/(tabs)/(b.search)/reciter/browse',
        params: {openPicker: dim},
      });
    },
    [router],
  );

  // Stock upstream (no declared dims) → the Browse region does not exist.
  if (dims.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.strip}
      contentContainerStyle={styles.content}>
      {dims.map(dim => (
        <FilterChip
          key={dim.dim}
          label={dim.label}
          count={toggleReciterCount(dim, catalogReady)}
          accessibilityLabel={`Browse by ${dim.label}`}
          onPress={() => openDimension(dim.dim)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginBottom: moderateScale(12),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    paddingVertical: moderateScale(2),
  },
});
