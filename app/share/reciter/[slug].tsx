import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareReciterReceiver() {
  const {slug} = useLocalSearchParams<{slug: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!slug) {
      router.replace('/');
      return;
    }
    router.replace({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {id: slug},
    });
  }, [slug, router]);

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
