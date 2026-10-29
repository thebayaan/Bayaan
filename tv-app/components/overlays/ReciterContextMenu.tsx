import React, {useMemo} from 'react';
import {View} from 'react-native';
import {ReciterPortrait} from '../browse/ReciterPortrait';
import {FocusIcon} from '../primitives/focusContext';
import {MenuRow, MenuSheet, menuStyles} from './MenuSheet';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {useReciters} from '../../hooks/useReciters';
import {useFavorites} from '../../hooks/useFavorites';
import {useNavStore} from '../../store/navStore';
import {playOrOpen} from '../../services/playbackRouting';
import {reciterPlayRequest} from '../../services/menuChoices';
import {toggleFavorite} from '../../services/favoritesStore';
import {getCachedRewayat} from '../../services/tvDataService';
import {
  HeartIcon,
  PlayIcon,
  ShuffleIcon,
  InfoRoundedIcon,
} from '../../../components/Icons';

export {MenuRow, menuStyles} from './MenuSheet';
export type {MenuRowProps} from './MenuSheet';

/**
 * Long-press menu for a reciter: play or shuffle their default recitation
 * (the one their page opens on), favourite them, or open their page.
 */
export function ReciterContextMenu(): React.ReactElement | null {
  const reciterId = useContextMenuStore(s =>
    s.target?.kind === 'reciter' ? s.target.reciterId : null,
  );
  const close = useContextMenuStore(s => s.close);
  const {reciters} = useReciters();
  const favorites = useFavorites();
  const push = useNavStore(s => s.push);

  const reciter = useMemo(
    () => (reciterId ? reciters.find(r => r.id === reciterId) : null),
    [reciters, reciterId],
  );

  if (!reciterId || !reciter) return null;

  const isFav = favorites.some(f => f.reciterId === reciterId);

  // The player opens at once (playOrOpen) and shows loading or any failure,
  // so the menu never waits on the network.
  function play(shuffle: boolean): void {
    if (!reciter) return;
    close({restoreFocus: false});
    const known = getCachedRewayat(reciter.id) ?? reciter.rewayat ?? [];
    void playOrOpen(reciterPlayRequest(reciter.id, known, shuffle));
  }

  function handleFavorite(): void {
    if (!reciterId) return;
    toggleFavorite(reciterId);
  }

  function handleOpenDetail(): void {
    if (!reciterId) return;
    close({restoreFocus: false});
    push({screen: 'reciterDetail', reciterId});
  }

  return (
    <MenuSheet
      kicker="RECITER"
      title={reciter.name}
      art={
        // The same portrait as the grids: the photo, or the pigment and
        // Arabic initial when there is none.
        <View style={menuStyles.portrait}>
          <ReciterPortrait reciter={reciter} size={88} idPrefix="menu" />
        </View>
      }>
      <MenuRow
        icon={<FocusIcon icon={PlayIcon} size={24} />}
        label="Play"
        onPress={() => play(false)}
        hasTVPreferredFocus
      />
      <MenuRow
        icon={<FocusIcon icon={ShuffleIcon} size={24} />}
        label="Shuffle play"
        onPress={() => play(true)}
      />
      <MenuRow
        icon={<FocusIcon icon={HeartIcon} size={24} filled={isFav} />}
        label={isFav ? 'Remove from favourites' : 'Add to favourites'}
        onPress={handleFavorite}
      />
      <MenuRow
        icon={<FocusIcon icon={InfoRoundedIcon} size={24} />}
        label="Open reciter page"
        onPress={handleOpenDetail}
      />
    </MenuSheet>
  );
}
