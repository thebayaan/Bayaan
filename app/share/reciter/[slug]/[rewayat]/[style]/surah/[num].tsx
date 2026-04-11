import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterBySlug} from '@/services/dataService';
import {resolveRewayat} from '@/utils/shareUtils';

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

    router.replace({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {
        id: reciter.id,
        surah: num,
        rewayatId: rw?.id ?? '',
        autoPlay: '1',
      },
    });
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
