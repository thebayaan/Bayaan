import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareReciterSurahReceiver() {
  const {slug, num} = useLocalSearchParams<{slug: string; num: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!slug) {
      router.replace('/');
      return;
    }
    // Navigate to the reciter profile — the reciter screen handles surah
    // selection via params. Pass surah number so it can pre-select if supported.
    router.replace({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {id: slug, surah: num ?? ''},
    });
  }, [slug, num, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}
