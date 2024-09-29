// hooks/usePlayback.ts
import {usePlayerStore} from '@/store/playerStore';
import {useQueueStore} from '@/store/queueStore';
import {generateAudioUrl} from '@/utils/audioUtils';
import {Track} from '@/types/audio';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {getSurahById} from '@/services/dataService';
import TrackPlayer from 'react-native-track-player';

export const usePlayback = () => {
  const {setActiveTrack} = usePlayerStore();
  const {addToQueue, clearQueue, skipToTrack} = useQueueStore();

  const playTrack = async (reciter: Reciter, surahId: string) => {
    try {
      const surah = await getSurahById(parseInt(surahId, 10));
      if (!surah) {
        throw new Error('Failed to fetch surah data');
      }

      const audioUrl = generateAudioUrl(reciter, surahId);
      const track: Track = {
        id: surahId,
        url: audioUrl,
        title: surah.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork: reciter.image_url || undefined,
      };

      await TrackPlayer.reset();
      await TrackPlayer.add([track]);
      await TrackPlayer.play();
      await setActiveTrack(track);
      usePlayerStore.getState().setIsPlaying(true);
    } catch (error) {
      console.error('Error in playTrack:', error);
    }
  };

  const createTracksFromSurahs = (
    reciter: Reciter,
    surahs: Surah[],
  ): Track[] => {
    return surahs.map(surah => ({
      id: surah.id.toString(),
      url: generateAudioUrl(reciter, surah.id.toString()),
      title: surah.name,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork: reciter.image_url || undefined,
    }));
  };

  const playAllTracks = async (tracks: Track[]) => {
    await TrackPlayer.play();
    await setActiveTrack(tracks[0]);
  };

  const playAll = async (
    reciter: Reciter,
    surahs: Surah[],
    shuffle = false,
  ) => {
    if (surahs.length > 0) {
      const tracks = createTracksFromSurahs(reciter, surahs);

      await clearQueue();

      if (shuffle) {
        // Shuffle the tracks before adding to the queue
        for (let i = tracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
      }

      await addToQueue(tracks);
      await skipToTrack(0);
      await playAllTracks(tracks);
    }
  };

  return {playTrack, playAll};
};
