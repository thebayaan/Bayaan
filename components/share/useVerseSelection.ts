// @ai-generated
/**
 * React side of rewayahVerseSelection.ts: the selection a sheet acts on, and
 * the texts of the selected verses, in the shown rewayah's own numbering.
 *
 * Hafs never touches the verse units: its selection is built from the Hafs
 * keys and its texts come from useRewayahVerseTexts, as before.
 */
import {useCallback, useMemo} from 'react';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {showToast} from '@/utils/toastUtils';
import {
  readUnitTexts,
  resolveVerseSelection,
  selectionFailureMessage,
  selectVerses,
  type ReadyVerseSelection,
  type VerseSelection,
  type VerseSelectionRequest,
} from './rewayahVerseSelection';
import {
  useRewayahVerseTexts,
  type UseRewayahVerseTextsResult,
} from './useRewayahVerseTexts';

const NO_KEYS: readonly string[] = [];

/**
 * The verses `request` names, in `request.rewayah`'s numbering. Loads that
 * rewayah's verse units on demand (never for Hafs) and re-renders when they
 * arrive or are refused.
 */
export function useVerseSelection(
  request: VerseSelectionRequest,
): VerseSelection {
  const {rewayah, verseKey, surahNumber, ayahNumber} = request;
  const {units, status} = useRewayahVerseUnits(
    rewayah === 'hafs' ? null : rewayah,
  );
  // Callers build the request from a payload on every render: key on content.
  const verseKeysSig = request.verseKeys?.join(',') ?? '';
  const unitKeysSig = request.unitKeys?.join(',') ?? '';
  return useMemo(
    () =>
      selectVerses(
        {
          rewayah,
          verseKey,
          surahNumber,
          ayahNumber,
          verseKeys: verseKeysSig ? verseKeysSig.split(',') : undefined,
          unitKeys: unitKeysSig ? unitKeysSig.split(',') : undefined,
        },
        units,
        status,
      ),
    [
      rewayah,
      verseKey,
      surahNumber,
      ayahNumber,
      verseKeysSig,
      unitKeysSig,
      units,
      status,
    ],
  );
}

/**
 * For actions (copy, share, bookmark, play): resolves to the selection once
 * its verses can be named, waiting (bounded, like copy / share wait for
 * text) for another rewayah's verse units while they load. Resolves to null
 * after telling the user why nothing was done (units refused, words not
 * loadable, or no numbered verse selected). Hafs is ready at once.
 */
export function useRequireSelection(
  selection: VerseSelection,
  request: VerseSelectionRequest,
): (
  action: Parameters<typeof selectionFailureMessage>[1],
) => Promise<ReadyVerseSelection | null> {
  return useCallback(
    async action => {
      if (selection.status === 'ready') return selection;
      const resolved = await resolveVerseSelection(request);
      if (resolved.status === 'ready') return resolved;
      const {title, message} = selectionFailureMessage(resolved, action);
      showToast(title, message, 'error');
      return null;
    },
    [selection, request],
  );
}

/**
 * Texts of a selection's verses (one per verse), for copy, share and the
 * share card: unit texts once the selection is ready; a Hafs selection reads
 * useRewayahVerseTexts (bundled Hafs text when the Hafs words failed), as
 * before. 'unavailable' when the selection cannot be named ('error',
 * 'unavailable', 'invalid'); `retry` asks for the rewayah's words again.
 */
export function useSelectionVerseTexts(
  selection: VerseSelection,
): UseRewayahVerseTextsResult {
  const {rewayah} = selection;
  const hafsKeys =
    selection.status === 'ready' && !selection.units ? selection.keys : NO_KEYS;
  // For another rewayah the Hafs-keyed hook reads no verse; it only asks for
  // that rewayah's words (the load the units wait for) and offers retry.
  const keyed = useRewayahVerseTexts(hafsKeys, rewayah);
  return useMemo((): UseRewayahVerseTextsResult => {
    const {retry} = keyed;
    if (selection.status === 'loading') {
      return {status: 'loading', rewayah, retry};
    }
    if (selection.status !== 'ready') {
      return {status: 'unavailable', rewayah, retry};
    }
    const texts = readUnitTexts(selection);
    return texts ? {status: 'ready', rewayah, texts, retry} : keyed;
  }, [selection, keyed, rewayah]);
}
