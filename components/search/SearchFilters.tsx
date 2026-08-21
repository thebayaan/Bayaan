/**
 * SearchFilters — RFC-020 chip composer strip for the Search filter
 * experience.
 *
 * Renders the active filter chips inline (wrap OK — count is bounded by the
 * `branding.searchFilters` declaration, RFC-020 §3 Q5) plus an "Add a filter"
 * control that opens the dimension palette (only dims not already active).
 * Picking a value dimension opens its picker sheet; flag facets +
 * `full-quran` are one-tap toggles applied straight from the palette. All
 * state lives in the URL via `useURLFiltersAsChips` (`router.setParams`, in
 * place — RFC-020 §3 Q4), so this component keeps only the "which sheet is
 * open" bit.
 *
 * All sheets share ONE persistent `PickerSheet` Modal instance: `visible`
 * toggles and the CHILDREN swap. Never two Modal instances trading places —
 * on iOS each Modal instance dispatches its present/dismiss transition
 * independently, and dismissing one while presenting another is the
 * documented "presentation in progress" wedge class.
 *
 * Mounted on the reciter-browse destination. With `branding.searchFilters`
 * unset (stock upstream) it renders nothing.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {
  useURLFiltersAsChips,
  type ComposerDimension,
} from '@/hooks/useURLFiltersAsChips';
import {RECITERS} from '@/data/reciterData';
import {useReciterStore} from '@/store/reciterStore';
import FilterChip from './FilterChip';
import PickerSheet, {
  PickerOptionGrid,
  type PickerOption,
} from './pickers/PickerSheet';
import CountryPicker from './pickers/CountryPicker';
import RewayaPicker from './pickers/RewayaPicker';
import TranslationPicker from './pickers/TranslationPicker';
import SurahPicker from './pickers/SurahPicker';

/** Which sheet is open: the dimension palette or one dimension's picker. */
type OpenSheet = 'palette' | 'country' | 'rewaya' | 'translation' | 'surah';

/** Value-dimension id → its picker sheet. */
const SHEET_FOR_DIM: Record<string, Exclude<OpenSheet, 'palette'>> = {
  country: 'country',
  rewaya: 'rewaya',
  translation: 'translation',
  'has-surah': 'surah',
};

/** Header title per sheet. */
const SHEET_TITLES: Record<OpenSheet, string> = {
  palette: 'Add a filter',
  country: 'Country',
  rewaya: 'Rewaya',
  translation: 'Translation',
  surah: 'Surah',
};

export default function SearchFilters() {
  const styles = stylesStatic;
  const {activeChips, declaredDims, setFilter, removeFilter} =
    useURLFiltersAsChips();
  const catalogReady = useReciterStore(s => s.isInitialized);
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null);
  // Kept as its own state (set only when a sheet opens/switches) so the
  // header doesn't flash a different title during the close animation.
  const [sheetTitle, setSheetTitle] = useState<string>(SHEET_TITLES.palette);

  const availableDims = useMemo<ComposerDimension[]>(
    () =>
      declaredDims.filter(
        dim => !activeChips.some(chip => chip.dim === dim.dim),
      ),
    [declaredDims, activeChips],
  );

  // Live counts for the palette's one-tap toggles (flag facets +
  // full-quran) — cheap single scans of RECITERS, no predicate engine
  // (result counts are the destination's job). Value dims get per-option
  // counts inside their pickers instead.
  const paletteOptions = useMemo<PickerOption[]>(
    () =>
      availableDims.map(dim => {
        let count: number | undefined;
        if (dim.input === 'toggle' && catalogReady) {
          count =
            dim.dim === 'full-quran'
              ? RECITERS.filter(reciter =>
                  reciter.rewayat.some(rewayat => rewayat.surah_total === 114),
                ).length
              : RECITERS.filter(
                  reciter =>
                    (reciter as unknown as Record<string, unknown>)[dim.dim] ===
                    true,
                ).length;
        }
        return {value: dim.dim, label: dim.label, count};
      }),
    [availableDims, catalogReady],
  );

  // RFC-020 (Browse chip) — compose-entry from a rest-state Browse chip.
  // The Search landing's <BrowseChipsRow /> deeplinks here with
  // `?openPicker=<dim>`; consume that transient intent ONCE on arrival to
  // put the tapped dimension front-and-center: open its value picker
  // (value dims) or apply the flag / full-quran toggle straight away
  // (reusing the hook's serialization). Then clear the param so a re-render
  // or a shared URL never re-fires it — the filter itself lives in the real
  // filter params, not in `openPicker`. A pushed deeplink carrying a filter
  // param instead (no `openPicker`) lands pre-applied + removable, unchanged.
  const router = useRouter();
  const openPickerParams = useLocalSearchParams<{
    openPicker?: string | string[];
  }>();
  const openPicker =
    typeof openPickerParams.openPicker === 'string' &&
    openPickerParams.openPicker
      ? openPickerParams.openPicker
      : undefined;
  const consumedOpenPicker = useRef<string | null>(null);
  useEffect(() => {
    if (!openPicker) return;
    // Ref-guard so it fires once even before the param clear propagates
    // (and idempotently in tests, where the mocked setParams is a no-op).
    if (consumedOpenPicker.current === openPicker) return;
    consumedOpenPicker.current = openPicker;
    router.setParams({openPicker: undefined});
    const entry = declaredDims.find(d => d.dim === openPicker);
    if (!entry) return;
    if (entry.input === 'toggle') {
      // Router dispatches are sequential, so this merges cleanly with the
      // openPicker clear above (no setParams race).
      setFilter(entry.dim, '1');
    } else {
      const sheet = SHEET_FOR_DIM[entry.dim];
      if (sheet) {
        setSheetTitle(SHEET_TITLES[sheet]);
        setOpenSheet(sheet);
      }
    }
  }, [openPicker, declaredDims, setFilter, router]);

  // Upstream default (`searchFilters` unset) → the composer does not exist.
  if (declaredDims.length === 0) {
    return null;
  }

  const showSheet = (sheet: OpenSheet) => {
    setSheetTitle(SHEET_TITLES[sheet]);
    setOpenSheet(sheet);
  };

  const closeSheet = () => setOpenSheet(null);

  const openDimension = (dim: string) => {
    const entry = declaredDims.find(d => d.dim === dim);
    if (!entry) return;
    if (entry.input === 'toggle') {
      // One-tap facets apply immediately — no picker (RFC-020 §3 Q5).
      setFilter(dim, '1');
      setOpenSheet(null);
    } else {
      const sheet = SHEET_FOR_DIM[dim];
      if (sheet) {
        showSheet(sheet);
      }
    }
  };

  const handlePicked =
    (dim: string) => (value: string, displayName: string) => {
      setFilter(dim, value, displayName);
      setOpenSheet(null);
    };

  return (
    <View style={styles.container}>
      {activeChips.map(chip => {
        const entry = declaredDims.find(d => d.dim === chip.dim);
        const editable = entry?.input === 'picker';
        return (
          <FilterChip
            key={chip.dim}
            label={chip.label}
            selected
            onPress={editable ? () => openDimension(chip.dim) : undefined}
            onRemove={() => removeFilter(chip.dim)}
          />
        );
      })}

      {availableDims.length > 0 ? (
        <FilterChip
          label="Add a filter"
          icon="plus"
          onPress={() => showSheet('palette')}
        />
      ) : null}

      {/* ONE persistent Modal for every sheet: `visible` toggles, content
       * swaps. A palette→picker transition changes only the children of
       * the already-presented Modal — no dismiss/present pair, so the
       * iOS Modal-presentation race can't wedge. Content stays lazy:
       * only the active sheet's children mount (none while closed). */}
      <PickerSheet
        visible={openSheet !== null}
        title={sheetTitle}
        onClose={closeSheet}>
        {openSheet === 'palette' ? (
          <PickerOptionGrid options={paletteOptions} onSelect={openDimension} />
        ) : null}
        {openSheet === 'country' ? (
          <CountryPicker onSelect={handlePicked('country')} />
        ) : null}
        {openSheet === 'rewaya' ? (
          <RewayaPicker onSelect={handlePicked('rewaya')} />
        ) : null}
        {openSheet === 'translation' ? (
          <TranslationPicker onSelect={handlePicked('translation')} />
        ) : null}
        {openSheet === 'surah' ? (
          <SurahPicker onSelect={handlePicked('has-surah')} />
        ) : null}
      </PickerSheet>
    </View>
  );
}

// Theme-independent layout (mirrors BrowseReciters' filterBarContainer
// metrics, but wrapping instead of horizontal-scrolling — RFC-020 §3 Q5:
// active chips render inline, wrap is fine).
const stylesStatic = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(6),
  },
});
