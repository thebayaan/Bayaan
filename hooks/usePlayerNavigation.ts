import {useRouter} from 'expo-router';
import {usePlayerStore} from '@/store/playerStore';
import {generateAudioUrl} from '@/utils/audioUtils';
import {Track} from '@/types/audio';
import {Reciter} from '@/data/reciterData';
import {getSurahById} from '@/services/dataService';

export const usePlayerNavigation = () => {
  const router = useRouter();
  const {loadAndPlayTrack} = usePlayerStore();

  const navigateToPlayer = async (
    reciter: Reciter,
    surahId: string,
    useReplace = false,
  ) => {
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

      const navigationFunction = useReplace ? router.replace : router.push;
      navigationFunction({
        pathname: '/(modals)/player',
        params: {artwork: track.artwork},
      });

      console.log('Attempting to load and play track:', track);
      await loadAndPlayTrack(track);
      console.log('Track loaded and play attempted');
    } catch (error) {
      console.error('Error loading track:', error);
    }
  };

  return {navigateToPlayer};
};
