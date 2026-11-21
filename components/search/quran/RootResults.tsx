// @ai-generated
import React, {useCallback, useMemo, useState} from 'react';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {SheetScrollView} from '@/components/sheets/verse-actions/sheetGestures';
import {useQuranRootSearch} from '@/hooks/useQuranSearch';
import type {QuranVerseHit} from '@/utils/search/quranSearch';
import {
  QURAN_PAGE_SIZE,
  quranResultRows,
  type QuranResultRow,
} from './quranResultRows';
import {QuranResultRowView} from './QuranResultRowView';

export interface RootResultsProps {
  /** The root in the i'rab spelling ('ر ح م'), as the word view shows it. */
  root: string;
  /** The word's lemma (الأصل المعجمي): its chip starts selected. */
  initialLemma?: string;
  /**
   * The ayah as the sheet names it, in the sheet's rewayah ("Quraysh 106:5
   * · Warsh"); default its Hafs verse ("Quraysh 106:4").
   */
  verseLabel?: (hit: QuranVerseHit) => string;
  /** Say the ayahs are the Hafs text (the sheet reads another rewayah). */
  hafsNote?: boolean;
  onVersePress: (hit: QuranVerseHit) => void;
}

const noop = () => undefined;

/**
 * Every word of a root in the Quran, for the word view's root screen inside
 * the verse actions sheet: the root's counts, lemma chips, and its ayahs
 * (30 at a time) with the root's words tinted. A FlashList on the verse
 * sheet's list (SheetScrollView): scrolled down, a drag only scrolls the
 * ayahs; at their top, a drag down moves the sheet.
 */
export const RootResults: React.FC<RootResultsProps> = ({
  root,
  initialLemma,
  verseLabel,
  hafsNote = false,
  onVersePress,
}) => {
  const search = useQuranRootSearch(root);
  // The view state of one root: another root starts over. `chosen`
  // undefined means not chosen yet, so the word's own lemma (if any) shows.
  const [view, setView] = useState<{
    root: string;
    chosen: number | null | undefined;
    shown: number;
  }>({root, chosen: undefined, shown: QURAN_PAGE_SIZE});
  const current =
    view.root === root
      ? view
      : {root, chosen: undefined, shown: QURAN_PAGE_SIZE};
  const {chosen, shown} = current;

  const result = search.result;
  const initialLemmaId = useMemo(() => {
    if (!result || !initialLemma) return null;
    const wanted = initialLemma.normalize('NFC');
    return (
      result.lemmas.find(l => l.lemma?.normalize('NFC') === wanted)?.id ?? null
    );
  }, [result, initialLemma]);
  const selectedLemma = chosen === undefined ? initialLemmaId : chosen;

  const rows = useMemo<QuranResultRow[]>(() => {
    if (search.status === 'loading') {
      return [{type: 'quran-loading', key: 'quran-loading'}];
    }
    if (search.status === 'error') {
      return [{type: 'quran-error', key: 'quran-error'}];
    }
    if (!result) {
      return [
        {type: 'quran-empty', key: 'quran-empty', query: root, root: true},
      ];
    }
    return quranResultRows(
      {
        status: 'done',
        outcome: {
          kind: 'root',
          letters: root,
          candidates: [result.root],
          result,
        },
      },
      {
        shown,
        selectedLemma,
        hafsNote,
        query: root,
        includeEmpty: true,
      },
    );
  }, [search.status, result, root, shown, selectedLemma, hafsNote]);

  const handleLemmaPress = useCallback(
    (lemmaId: number | null) =>
      setView({root, chosen: lemmaId, shown: QURAN_PAGE_SIZE}),
    [root],
  );
  const handleShowMore = useCallback(
    () =>
      setView(prev => ({
        root,
        chosen: prev.root === root ? prev.chosen : undefined,
        shown:
          (prev.root === root ? prev.shown : QURAN_PAGE_SIZE) + QURAN_PAGE_SIZE,
      })),
    [root],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<QuranResultRow>) => (
      <QuranResultRowView
        row={item}
        verseLabel={verseLabel}
        onVersePress={onVersePress}
        onRootPress={noop}
        onLemmaPress={handleLemmaPress}
        onShowMore={handleShowMore}
        inset={false}
      />
    ),
    [verseLabel, onVersePress, handleLemmaPress, handleShowMore],
  );

  return (
    <FlashList
      data={rows}
      renderItem={renderItem}
      keyExtractor={item => item.key}
      getItemType={item => item.type}
      renderScrollComponent={SheetScrollView}
      keyboardShouldPersistTaps="handled"
    />
  );
};
