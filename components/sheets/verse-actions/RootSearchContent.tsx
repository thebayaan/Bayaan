import React, {useCallback, useMemo} from 'react';
import {RootResults} from '@/components/search/quran/RootResults';
import {
  hitLabel,
  type ShownVerses,
} from '@/components/mushaf/mushafSearchVerses';
import {SURAHS} from '@/data/surahData';
import {useOpenQuranHit} from '@/hooks/useOpenQuranHit';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {getSurahDisplayName} from '@/i18n/format';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {matchedPositions, type QuranVerseHit} from '@/utils/search/quranSearch';
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai

interface RootSearchContentProps {
  /** The verse sheet this screen is in: an ayah closes it. */
  sheetId: string;
  /** The root in the i'rab spelling ('ر ح م'). */
  root: string;
  /** The studied word's lemma: its chip starts selected. */
  initialLemma?: string;
  /** The sheet's rewayah: its ayahs are named in its numbering. */
  rewayah: RewayahId;
}

function surahNameOf(verseKey: string): string {
  const surah = SURAHS[Number(verseKey.split(':')[0]) - 1];
  return surah ? getSurahDisplayName(surah) : '';
}

/**
 * Root search from Word Study: every ayah of the root, inside the verse
 * sheet. The results are the Hafs text, so in another rewayah each ayah is
 * named as the mushaf search names it: the verse of the sheet's rewayah
 * holding its first matched word ("Quraysh 106:5 · Warsh"), the one the
 * reader selects, or its Hafs verse saying so while that rewayah's verses
 * load and for the unnumbered Fatiha basmala ("Al-Fatihah 1:1 · Hafs"):
 * never a Hafs number under the rewayah's name. The root's header then
 * says the ayahs are the Hafs text, as the Search tab's header does.
 *
 * An ayah closes the sheet and opens in the Mushaf on its matched words, as
 * in the Search tab: in the reader already open under the sheet or the
 * player, else in a new one (useOpenQuranHit). The open player is drawn
 * above every route (app/_layout.tsx renders PlayerHost after the Stack),
 * so it collapses first, as Repeat and the translation settings do;
 * otherwise the Mushaf would show out of sight behind it. Already
 * collapsed, this does nothing.
 */
export const RootSearchContent: React.FC<RootSearchContentProps> = ({
  sheetId,
  root,
  initialLemma,
  rewayah,
}) => {
  const openQuranHit = useOpenQuranHit();
  const {units} = useRewayahVerseUnits(rewayah === 'hafs' ? null : rewayah);
  const shown = useMemo<ShownVerses>(
    () => ({rewayah, units}),
    [rewayah, units],
  );

  const verseLabel = useCallback(
    (hit: QuranVerseHit) =>
      hitLabel(
        hit.verseKey,
        matchedPositions(hit)[0] ?? 1,
        shown,
        surahNameOf(hit.verseKey),
      ),
    [shown],
  );

  const handleVersePress = useCallback(
    async (hit: QuranVerseHit) => {
      await hideSheet(sheetId as 'verse-actions');
      usePlayerStore.getState().setSheetMode('hidden');
      openQuranHit(hit.verseKey, matchedPositions(hit));
    },
    [sheetId, openQuranHit],
  );

  return (
    <RootResults
      root={root}
      initialLemma={initialLemma}
      verseLabel={verseLabel}
      hafsNote={rewayah !== 'hafs'}
      onVersePress={handleVersePress}
    />
  );
};
