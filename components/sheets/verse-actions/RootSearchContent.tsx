import React, {useCallback} from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {RootResults} from '@/components/search/quran/RootResults';
import {useOpenQuranHit} from '@/hooks/useOpenQuranHit';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {matchedPositions, type QuranVerseHit} from '@/utils/search/quranSearch';

interface RootSearchContentProps {
  /** The verse sheet this screen is in: an ayah closes it. */
  sheetId: string;
  /** The root in the i'rab spelling ('ر ح م'). */
  root: string;
  /** The studied word's lemma: its chip starts selected. */
  initialLemma?: string;
}

/**
 * Root search from Word Study: every ayah of the root, inside the verse
 * sheet. An ayah closes the sheet and opens in the Mushaf on its matched
 * words, as in the Search tab: in the reader already open under the sheet
 * or the player, else in a new one (useOpenQuranHit). The open player is
 * drawn above every route (app/_layout.tsx renders PlayerHost after the
 * Stack), so it collapses first, as Repeat and the translation settings do;
 * otherwise the Mushaf would show out of sight behind it. Already collapsed,
 * this does nothing.
 */
export const RootSearchContent: React.FC<RootSearchContentProps> = ({
  sheetId,
  root,
  initialLemma,
}) => {
  const openQuranHit = useOpenQuranHit();

  const handleVersePress = useCallback(
    async (hit: QuranVerseHit) => {
      await SheetManager.hide(sheetId);
      usePlayerStore.getState().setSheetMode('hidden');
      openQuranHit(hit.verseKey, matchedPositions(hit));
    },
    [sheetId, openQuranHit],
  );

  return (
    <RootResults
      root={root}
      initialLemma={initialLemma}
      onVersePress={handleVersePress}
    />
  );
};
