import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {Track} from '@/types/audio';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import TrackPlayer from 'react-native-track-player';

function createTrackFromSurah(reciter: Reciter, surah: Surah): Track {
  const track = {
    id: `${reciter.id}:${surah.id}`,
    url: generateSmartAudioUrl(reciter, surah.id.toString()),
    title: surah.name,
    artist: reciter.name,
    artwork: getReciterArtwork(reciter),
    duration: 0, // Will be updated by TrackPlayer
    surahId: surah.id.toString(),
    reciterId: reciter.id,
    reciterName: reciter.name,
  };
  console.log('[DEBUG] Created track:', track);
  return track;
}

export function useMigrationBridge() {
  const {updateQueue, play, setSheetMode} = useUnifiedPlayer();

  const playTrack = async (reciter: Reciter, surah: Surah) => {
    try {
      console.log('[DEBUG] Playing single track:', {
        reciter: reciter.name,
        surah: surah.name,
      });

      // First set sheet mode to hidden to ensure floating player will show
      setSheetMode('hidden');

      const track = createTrackFromSurah(reciter, surah);
      await updateQueue([track], 0);

      console.log('[DEBUG] Starting playback');
      await play();

      const queue = await TrackPlayer.getQueue();
      console.log('[DEBUG] Final state:', {
        queueLength: queue.length,
        currentTrack: track.title,
      });
    } catch (error) {
      console.error('[ERROR] Error in playTrack:', error);
      throw error;
    }
  };

  const playFromSurah = async (reciter: Reciter, surah: Surah) => {
    // TODO: Implement batching for large surah collections
    await playTrack(reciter, surah);
  };

  const playAll = async (reciter: Reciter, surahs: Surah[]) => {
    // TODO: Implement batching for large surah collections
    if (surahs.length > 0) {
      await playTrack(reciter, surahs[0]);
    }
  };

  return {
    playFromSurah,
    playAll,
    playTrack,
  };
}
