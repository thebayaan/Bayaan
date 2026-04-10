import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareAdhkarReceiver() {
  const {superId} = useLocalSearchParams<{superId: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!superId) {
      router.replace('/');
      return;
    }
    router.replace({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]',
      params: {superId},
    });
  }, [superId, router]);

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
