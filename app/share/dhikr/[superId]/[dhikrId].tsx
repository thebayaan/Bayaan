import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareDhikrReceiver() {
  const {superId, dhikrId} = useLocalSearchParams<{
    superId: string;
    dhikrId: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!superId || !dhikrId) {
      router.replace('/');
      return;
    }

    router.replace('/(tabs)/(a.home)');
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/(a.home)/adhkar/[superId]',
        params: {superId},
      });
      setTimeout(() => {
        router.push({
          pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
          params: {superId, dhikrId},
        });
      }, 100);
    }, 100);
  }, [superId, dhikrId, router]);

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
