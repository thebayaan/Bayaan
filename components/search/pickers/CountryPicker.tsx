/**
 * CountryPicker — RFC-020 value picker for the `country` dimension.
 *
 * Content-only single-select body: lists `getAllCountries()` (name + live
 * reciterCount comes free from the helper) in a flex-wrap option grid and
 * reports the pick as `(CountryInfo.id, CountryInfo.name)` — the URL value
 * + its display companion. Rendered inside `SearchFilters`' single
 * persistent `PickerSheet` Modal (one instance, content swaps), and only
 * while its sheet is open (lazy mounting).
 */
import React, {useMemo} from 'react';
import {getAllCountries} from '@/data/countryCollections';
import {useReciterStore} from '@/store/reciterStore';
import {PickerOptionGrid, type PickerOption} from './PickerSheet';

export interface CountryPickerProps {
  onSelect: (value: string, displayName: string) => void;
}

export default function CountryPicker({onSelect}: CountryPickerProps) {
  // getAllCountries() reads the async-populated RECITERS array; subscribe so
  // the options fill in if the picker somehow mounts before catalog init.
  const catalogReady = useReciterStore(s => s.isInitialized);

  const options = useMemo<PickerOption[]>(
    () =>
      catalogReady
        ? getAllCountries().map(country => ({
            value: country.id,
            label: country.name,
            count: country.reciterCount,
          }))
        : [],
    [catalogReady],
  );

  return <PickerOptionGrid options={options} onSelect={onSelect} />;
}
