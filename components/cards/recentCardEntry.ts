// @ai-generated
import {
  useRecentlyPlayedStore,
  type RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';

/** What a Continue Listening card shows, enough to find its entry again. */
export interface RecentCardIdentity {
  reciterId: string;
  surahId?: number;
  rewayatId?: string;
  /** Set on an upload's card: the upload's id. */
  userRecitationId?: string;
}

/**
 * Where a Continue Listening card's entry is in the recents list right now,
 * or -1 when it is no longer there.
 *
 * The store moves and removes entries by position. A card only knows its
 * position among the cards drawn, at the time it was drawn. Home leaves
 * broken entries out, and a new card can arrive at the front while the
 * card's options are open, so that position can belong to another card:
 * "Remove from recents" then removed the wrong one. Look the entry up by
 * what it is, at the moment it is needed.
 */
export function findRecentIndex(card: RecentCardIdentity): number {
  const {recentTracks} = useRecentlyPlayedStore.getState();
  if (card.userRecitationId) {
    return recentTracks.findIndex(
      t => t.userRecitationId === card.userRecitationId,
    );
  }

  const sameReciter = (t: RecentlyPlayedTrack) =>
    !t.isUserUpload && t.reciter?.id === card.reciterId;
  const exact = recentTracks.findIndex(
    t =>
      sameReciter(t) &&
      t.surah?.id === card.surahId &&
      (t.rewayatId || '') === (card.rewayatId || ''),
  );
  if (exact !== -1) return exact;
  // Playback moved on to the next surah while the options were open, which
  // rewrites the card in place. The list keeps one card per reciter, so the
  // reciter's card is still the one that was pressed.
  return recentTracks.findIndex(sameReciter);
}
