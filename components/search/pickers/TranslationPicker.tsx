/**
 * TranslationPicker — RFC-020 value picker for the `translation` dimension.
 *
 * Content-only single-select body: lists `getAllTranslations()` (language +
 * live itemCount) in a flex-wrap option grid and reports the pick as
 * `(TranslationInfo.id, TranslationInfo.name)` — the URL value + its display
 * companion. Rendered inside `SearchFilters`' single persistent `PickerSheet`
 * Modal (one instance, content swaps), and only while its sheet is open
 * (lazy mounting).
 */
import React, {useMemo} from 'react';
import {getAllTranslations} from '@/data/translationCollections';
import {useReciterStore} from '@/store/reciterStore';
import {PickerOptionGrid, type PickerOption} from './PickerSheet';

export interface TranslationPickerProps {
  onSelect: (value: string, displayName: string) => void;
}

export default function TranslationPicker({onSelect}: TranslationPickerProps) {
  // getAllTranslations() reads the async-populated RECITERS array; subscribe
  // to catalog init.
  const catalogReady = useReciterStore(s => s.isInitialized);

  const options = useMemo<PickerOption[]>(
    () =>
      catalogReady
        ? getAllTranslations().map(translation => ({
            value: translation.id,
            label: translation.name,
            count: translation.itemCount,
          }))
        : [],
    [catalogReady],
  );

  return <PickerOptionGrid options={options} onSelect={onSelect} />;
}
