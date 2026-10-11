/**
 * RewayaPicker — RFC-020 value picker for the `rewaya` dimension.
 *
 * Content-only single-select body: lists every canonical rewaya with at
 * least one reciter in a flex-wrap option grid and reports the pick as
 * `(RewayatInfo.id, RewayatInfo.displayName)`. The hook resolves the id to
 * the locked `teacher` + `student` URL param pair (one RewayatInfo pick =
 * one pair). Rendered inside `SearchFilters`' single persistent `PickerSheet`
 * Modal (one instance, content swaps), and only while its sheet is open.
 */
import React, {useMemo} from 'react';
import {getAllRewayatWithCounts} from '@/data/rewayat';
import {useReciterStore} from '@/store/reciterStore';
import {PickerOptionGrid, type PickerOption} from './PickerSheet';

export interface RewayaPickerProps {
  onSelect: (value: string, displayName: string) => void;
}

export default function RewayaPicker({onSelect}: RewayaPickerProps) {
  // reciterCount derives from the async-populated RECITERS array (zero-count
  // entries are dropped), so subscribe to catalog init.
  const catalogReady = useReciterStore(s => s.isInitialized);

  const options = useMemo<PickerOption[]>(
    () =>
      catalogReady
        ? // getAllRewayatWithCounts, NOT getAllRewayatTypes — the latter
          // excludes `hafs-an-assem` by design (Listen-tab discovery
          // carousel diversity), which would make the majority narration
          // unpickable here. Zero-count rewayat still drop out.
          getAllRewayatWithCounts()
            .filter(rewayat => rewayat.reciterCount > 0)
            .map(rewayat => ({
              value: rewayat.id,
              label: rewayat.displayName,
              count: rewayat.reciterCount,
            }))
        : [],
    [catalogReady],
  );

  return <PickerOptionGrid options={options} onSelect={onSelect} />;
}
