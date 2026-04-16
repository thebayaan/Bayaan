import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterBySlug} from '@/services/dataService';
import {resolveRewayat} from '@/utils/shareUtils';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {SURAHS} from '@/data/surahData';
import {usePlayerStore} from '@/services/player/store/playerStore';

export default function ShareRecitationReceiver() {
  const {slug, rewayat, style, num} = useLocalSearchParams<{
    slug: string;
    rewayat: string;
    style: string;
    num: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();
  const isInitialized = useReciterStore(s => s.isInitialized);

  useEffect(() => {
    if (!isInitialized || !slug || !rewayat || !style || !num) return;

    const reciter = getReciterBySlug(slug);
    if (!reciter) {
      router.replace('/');
      return;
    }

    const rw = resolveRewayat(reciter, rewayat, style);
    if (!rw) {
      router.replace('/');
      return;
    }

    const surahNum = parseInt(num, 10);
    const surah = SURAHS.find(s => s.id === surahNum);
    const artwork = getReciterArtwork(reciter);
    const track = {
      id: `${reciter.id}:${surahNum}`,
      url: generateSmartAudioUrl(reciter, surahNum.toString(), rw.id),
      title: surah?.name ?? `Surah ${surahNum}`,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork,
      surahId: surahNum.toString(),
      reciterName: reciter.name,
      rewayatId: rw.id,
    };

    const startPlaybackAndNavigate = async (): Promise<void> => {
      await usePlayerStore.getState().updateQueue([track], 0);

      router.replace('/(tabs)/(a.home)');
      setTimeout(() => {
        router.push({
          pathname: '/(tabs)/(a.home)/reciter/[id]',
          params: {id: reciter.id},
        });
      }, 100);
    };

    startPlaybackAndNavigate();
  }, [isInitialized, slug, rewayat, style, num, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.text} />
    </View>
  );
}
