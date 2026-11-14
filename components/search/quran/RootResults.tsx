// @ai-generated
import React, {useCallback, useMemo, useState} from 'react';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {ScrollView} from 'react-native-actions-sheet';
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
  onVersePress: (hit: QuranVerseHit) => void;
}

const noop = () => undefined;

/**
 * Every word of a root in the Quran, for the word view's root screen inside
 * the verse actions sheet: the root's counts, lemma chips, and its ayahs
 * (30 at a time) with the root's words tinted. A FlashList on the sheet's
 * scroll view, so it scrolls with the sheet's gestures.
 */
export const RootResults: React.FC<RootResultsProps> = ({
  root,
  initialLemma,
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
        hafsNote: false,
        query: root,
        includeEmpty: true,
      },
    );
  }, [search.status, result, root, shown, selectedLemma]);

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
        onVersePress={onVersePress}
        onRootPress={noop}
        onLemmaPress={handleLemmaPress}
        onShowMore={handleShowMore}
        inset={false}
      />
    ),
    [onVersePress, handleLemmaPress, handleShowMore],
  );

  return (
    <FlashList
      data={rows}
      renderItem={renderItem}
      keyExtractor={item => item.key}
      getItemType={item => item.type}
      renderScrollComponent={ScrollView}
      keyboardShouldPersistTaps="handled"
    />
  );
};
