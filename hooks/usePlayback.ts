// hooks/usePlayback.ts
import {usePlayerStore} from '@/store/playerStore';
import {useQueueStore} from '@/store/queueStore';
import {generateAudioUrl} from '@/utils/audioUtils';
import {Track} from '@/types/audio';
import {Reciter} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {getSurahById} from '@/services/dataService';
import TrackPlayer, {
  Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import {getReciterById} from '@/services/dataService';
import {useRecentRecitersStore} from '@/store/recentRecitersStore';

export const usePlayback = () => {
  const {setActiveTrack} = usePlayerStore();
  const {getQueue} = useQueueStore();
  const {addRecentReciter, updateProgress} = useRecentRecitersStore();

  // Set up progress tracking at the hook level
  useTrackPlayerEvents([Event.PlaybackProgressUpdated], async event => {
    if (event.type === Event.PlaybackProgressUpdated) {
      const {position, duration} = event;
      if (duration > 0) {
        const progressValue = position / duration;
        const currentTrack = await TrackPlayer.getCurrentTrack();
        if (currentTrack) {
          const track = await TrackPlayer.getTrack(currentTrack);
          if (track && track.reciterId) {
            updateProgress(
              track.reciterId,
              parseInt(track.id, 10),
              progressValue,
            );
          }
        }
      }
    }
  });

  const playTrack = async (reciter: Reciter, surahId: string) => {
    try {
      const surah = await getSurahById(parseInt(surahId, 10));
      if (!surah) {
        throw new Error('Failed to fetch surah data');
      }

      // Create the track first
      const audioUrl = generateAudioUrl(reciter, surahId);
      const track: Track = {
        id: surahId,
        url: audioUrl,
        title: surah.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork: reciter.image_url || undefined,
      };

      // Reset player and add track
      await TrackPlayer.reset();
      await TrackPlayer.add([track]);
      await TrackPlayer.play();
      await setActiveTrack(track);
      usePlayerStore.getState().setIsPlaying(true);

      // Add to recent reciters AFTER successful playback start
      addRecentReciter(reciter, surah, 0);

      await getQueue();
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

  const playAll = async (
    reciter: Reciter,
    surahs: Surah[],
    shuffle = false,
  ) => {
    if (surahs.length === 0) return;

    const tracks = shuffle
      ? [...surahs].sort(() => Math.random() - 0.5)
      : surahs;

    // Create and play first track immediately
    const firstTrack = {
      id: tracks[0].id.toString(),
      url: generateAudioUrl(reciter, tracks[0].id.toString()),
      title: tracks[0].name,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork: reciter.image_url || undefined,
    };

    await TrackPlayer.reset();
    await TrackPlayer.add([firstTrack]);
    await TrackPlayer.play();
    await setActiveTrack(firstTrack);
    usePlayerStore.getState().setIsPlaying(true);

    // Add remaining tracks asynchronously
    if (tracks.length > 1) {
      const remainingTracks = createTracksFromSurahs(reciter, tracks.slice(1));
      await TrackPlayer.add(remainingTracks);
      await getQueue(); // Update queue
    }
  };

  const playFromSurah = async (
    reciter: Reciter,
    surah: Surah,
    allSurahs: Surah[],
  ) => {
    try {
      const startIndex = allSurahs.findIndex(s => s.id === surah.id);
      if (startIndex === -1) {
        throw new Error('Surah not found in the list');
      }

      // Create track for the selected surah first
      const initialTrack = {
        id: surah.id.toString(),
        url: generateAudioUrl(reciter, surah.id.toString()),
        title: surah.name,
        artist: reciter.name,
        reciterId: reciter.id,
        artwork: reciter.image_url || undefined,
      };

      // Reset and play the selected surah immediately
      await TrackPlayer.reset();
      await TrackPlayer.add([initialTrack]);
      await TrackPlayer.play();
      await setActiveTrack(initialTrack);
      usePlayerStore.getState().setIsPlaying(true);

      // Add to recent reciters AFTER successful playback start
      addRecentReciter(reciter, surah, 0);

      // Add remaining surahs to queue asynchronously
      const remainingSurahs = allSurahs.slice(startIndex + 1);
      if (remainingSurahs.length > 0) {
        const remainingTracks = createTracksFromSurahs(
          reciter,
          remainingSurahs,
        );
        await TrackPlayer.add(remainingTracks);
        await getQueue();
      }
    } catch (error) {
      console.error('Error in playFromSurah:', error);
    }
  };

  const playLovedTrack = async (trackId: string, lovedTrackIds: string[]) => {
    const [reciterId, surahId] = trackId.split(':');
    const reciter = getReciterById(reciterId);
    const surah = getSurahById(parseInt(surahId, 10));

    if (!reciter || !surah) {
      throw new Error('Failed to fetch reciter or surah data');
    }

    await playTrack(reciter, surahId);

    const startIndex = lovedTrackIds.indexOf(trackId);
    if (startIndex === -1) {
      throw new Error('Track not found in loved tracks');
    }

    const tracksToQueue = lovedTrackIds
      .slice(startIndex + 1)
      .map(id => {
        const [nextReciterId, nextSurahId] = id.split(':');
        const nextReciter = getReciterById(nextReciterId);
        const nextSurah = getSurahById(parseInt(nextSurahId, 10));
        if (nextReciter && nextSurah) {
          return {
            id: nextSurahId,
            url: generateAudioUrl(nextReciter, nextSurahId),
            title: nextSurah.name,
            artist: nextReciter.name,
            reciterId: nextReciter.id,
            artwork: nextReciter.image_url,
          } as Track;
        }
        return null;
      })
      .filter((track): track is Track => track !== null);

    if (tracksToQueue.length > 0) {
      await TrackPlayer.add(tracksToQueue);
      await getQueue(); // Update queue
    }
  };

  return {playTrack, playAll, playFromSurah, playLovedTrack};
};
