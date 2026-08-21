/**
 * RecitationsList — RFC-020 `has-surah` result-row mode.
 *
 * When a surah filter is active, the reciter-browse destination shows one
 * row per (reciter, rewaya) recitation of that surah instead of the reciter
 * grid (RFC-020 §3 — result rows switch to `(reciter, rewaya)` tuples when
 * `has-surah` is active). This component owns that surface: the row-build,
 * the tap-to-play handler, and the `LegendList` render — so the grid vs.
 * tuple fork reads as `surahId ? <RecitationsList/> : <BrowseGrid/>`.
 */
import React, {useMemo, useCallback} from 'react';
import {Keyboard} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LegendList} from '@legendapp/list';
import {ReciterItem} from '@/components/ReciterItem';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import {getSurahById} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useSettings} from '@/hooks/useSettings';
import {useBottomInset} from '@/hooks/useBottomInset';
import {Reciter, Rewayat} from '@/data/reciterData';

/** One (reciter, rewaya) tuple covering the filtered surah. */
export interface RecitationRow {
  key: string;
  reciter: Reciter;
  rewaya: Rewayat;
}

/**
 * Expand a reciter list into one row per rewaya that has this surah, lifted
 * to a pure function so `BrowseReciters` can reuse it for the result count
 * without re-rendering. Single-rewaya reciters still get one row each.
 */
export function buildRecitationRows(
  reciters: Reciter[],
  surahId: number,
): RecitationRow[] {
  const rows: RecitationRow[] = [];
  for (const reciter of reciters) {
    for (const rewaya of reciter.rewayat) {
      if (!rewaya.surah_list?.includes(surahId)) continue;
      rows.push({
        key: `${reciter.id}:${rewaya.id ?? rewaya.name ?? 'unnamed'}`,
        reciter,
        rewaya,
      });
    }
  }
  return rows;
}

interface RecitationsListProps {
  surahId: number;
  reciters: Reciter[];
}

export default function RecitationsList({
  surahId,
  reciters,
}: RecitationsListProps) {
  const {updateQueue, play} = usePlayerActions();
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain);
  const {setReciterPreference} = useSettings();
  const bottomInset = useBottomInset();

  const recitationRows = useMemo(
    () => buildRecitationRows(reciters, surahId),
    [reciters, surahId],
  );

  const handleRecitationPress = useCallback(
    async (reciter: Reciter, rewaya: Rewayat) => {
      if (!surahId) return;
      Keyboard.dismiss();
      try {
        const surah = await getSurahById(surahId);
        if (!surah) return;
        const rewayatId = rewaya.id ?? reciter.rewayat[0]?.id;
        if (rewayatId) {
          setReciterPreference(reciter.id, rewayatId);
        }
        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          rewayatId,
        );
        await updateQueue(tracks, 0);
        await play();
        await startNewChain(reciter, surah, 0, 0, rewayatId);

        // Expand the now-playing PlayerSheet (the ayah-list-style player
        // surface the mini-player itself opens on tap) so a tap on a
        // recitation lands on the full player rather than dismissing back.
        expandPlayerSheet();
      } catch (error) {
        console.error('Error playing recitation:', error);
      }
    },
    [setReciterPreference, surahId, updateQueue, play, startNewChain],
  );

  return (
    // Listen → Surah tile shows recitations (reciter + rewaya rows) instead
    // of the grid of reciters; each row is one tap-to-play.
    <LegendList
      data={recitationRows}
      keyExtractor={row => row.key}
      estimatedItemSize={moderateScale(72)}
      contentContainerStyle={{
        paddingBottom: Math.max(
          moderateScale(80),
          bottomInset + moderateScale(16),
        ),
      }}
      renderItem={({item}) => {
        const rewayaLabel = item.rewaya.name
          ? (getDisplayLabelFromName(item.rewaya.name) ?? item.rewaya.name)
          : undefined;
        return (
          <ReciterItem
            item={item.reciter}
            onPress={() => handleRecitationPress(item.reciter, item.rewaya)}
            secondaryText={rewayaLabel}
          />
        );
      }}
      onScrollBeginDrag={() => Keyboard.dismiss()}
    />
  );
}
