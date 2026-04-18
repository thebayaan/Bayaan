import React, {useEffect, useRef} from 'react';
import {View} from 'react-native';
import {Redirect, useLocalSearchParams} from 'expo-router';
import TrackPlayer from 'react-native-track-player';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {getReciterById, getAllSurahs} from '@/services/dataService';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';

// Receiver for canonical recitation deep links:
//   https://app.thebayaan.com/reciter/{slug}/{surah}?rewayah={id}&t={sec}
//
// Triggers playback of the requested surah for the reciter, then redirects
// to the reciter profile page inside the home tab.
export default function RecitationDeepLinkReceiver(): React.ReactElement {
  const params = useLocalSearchParams<{
    id: string;
    surah: string;
    rewayah?: string;
    t?: string;
  }>();
  const didStartRef = useRef(false);

  useEffect(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;

    const reciterId = params.id;
    const surahNum = Number(params.surah);
    const rewayahId = params.rewayah;
    const tSec = params.t ? Number(params.t) : undefined;

    if (!reciterId || !Number.isFinite(surahNum)) return;

    (async () => {
      try {
        const reciter = await getReciterById(reciterId);
        if (!reciter) return;
        const surahs = await getAllSurahs();
        const surah = surahs.find(s => s.id === surahNum);
        if (!surah) return;

        const chosenRewayat =
          (rewayahId && reciter.rewayat.find(r => r.id === rewayahId)) ||
          reciter.rewayat[0];
        if (!chosenRewayat) return;

        useDownloadStore.getState();
        const artwork = getReciterArtwork(reciter);
        const firstTrack = {
          id: `${reciter.id}:${surah.id}`,
          url: generateSmartAudioUrl(
            reciter,
            surah.id.toString(),
            chosenRewayat.id,
          ),
          title: surah.name,
          artist: reciter.name,
          reciterId: reciter.id,
          artwork,
          surahId: surah.id.toString(),
          reciterName: reciter.name,
          rewayatId: chosenRewayat.id,
        };

        await TrackPlayer.reset();
        await TrackPlayer.add(firstTrack);
        if (tSec && Number.isFinite(tSec) && tSec > 0) {
          await TrackPlayer.seekTo(tSec);
        }
        await TrackPlayer.play();

        usePlayerStore.getState().updateQueueState({
          tracks: [firstTrack],
          currentIndex: 0,
          total: 1,
          loading: false,
          endReached: false,
        });
      } catch (error) {
        console.error('[Deep link] Failed to start recitation:', error);
      }
    })();
  }, [params.id, params.surah, params.rewayah, params.t]);

  if (!params.id) {
    return (
      <View style={{flex: 1}}>
        <LoadingIndicator />
      </View>
    );
  }

  return <Redirect href={`/reciter/${params.id}`} />;
}
