import TrackPlayer, {State as TrackPlayerState} from 'react-native-track-player';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {createTrack} from '@/utils/track';

export const restoreSession = async () => {
  try {
    const recentlyPlayedTracks = await useRecentlyPlayedStore.getState().recentTracks;

    if( recentlyPlayedTracks.length === 0){
        return;
    }

    const firstTrack = recentlyPlayedTracks[0];
    const playerStore = usePlayerStore.getState();

    const {reciter, surah, rewayatId, progress, duration} = firstTrack;

    // Calculate actual start position in seconds (progress is 0-1)
    const startPosition = progress * duration;

    const track = await createTrack(reciter, surah, rewayatId);

    // Update queue AND set start position in one go
    await playerStore.updateQueue([track], 0, startPosition);

  } catch (error) {
    console.error('[RestoreSession] Error restoring session:', error);
    if (error instanceof Error) {
        console.error('[RestoreSession] Error details:', error.message);
    }
  }
}