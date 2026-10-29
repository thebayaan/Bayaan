// The adhkar session's entry point outside the adhkar screens: a card at the
// head of Home's Continue Listening (AdhkarSessionCard) and a player on the
// Adhkar screen (AdhkarSessionPlayer).
import React, {useEffect} from 'react';
import {moderateScale} from '@/utils/scale';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {dropStaleSession} from '@/services/adhkar/playback/sessionPersistence';
import {AdhkarSessionCard} from '@/components/adhkar/AdhkarSessionCard';
import {AdhkarSessionPlayer} from '@/components/adhkar/AdhkarSessionPlayer';
import {RECENT_CARD_WIDTH} from '@/components/cards/recentCardStyles';

// The card's width: RecentReciterCard's container width, which the adhkar
// card shares through recentCardStyles. RecitersView adds it to getItemLayout's
// offsets when the card heads the row.
export const ADHKAR_TILE_WIDTH = RECENT_CARD_WIDTH;
// Equals `sectionContent.gap` in RecitersView, which the list applies around
// the header too, so the header needs no margin of its own.
export const ADHKAR_TILE_GAP = moderateScale(8);

export function useHasAdhkarSession(): boolean {
  return useAdhkarSessionStore(s => s.session !== null);
}

export function AdhkarNowPlayingCard({
  variant,
  width, // @ai
}: {
  variant: 'tile' | 'row';
  /** The tile's width. Defaults to RECENT_CARD_WIDTH. */
  width?: number; // @ai
}): React.JSX.Element | null {
  const session = useAdhkarSessionStore(s => s.session);

  useEffect(() => {
    dropStaleSession(Date.now());
  }, []);

  if (!session) return null;
  if (variant === 'tile')
    return <AdhkarSessionCard session={session} width={width} />; // @ai
  return <AdhkarSessionPlayer session={session} />;
}
