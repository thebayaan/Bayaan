import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareVerseReceiver() {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!surah || !ayah) {
      router.replace('/');
      return;
    }

    router.replace({
      pathname: '/mushaf',
      params: {surah, ayah},
    });
  }, [surah, ayah, router]);

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
