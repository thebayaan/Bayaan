import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareMushafReceiver() {
  const {page} = useLocalSearchParams<{page: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    router.replace({
      pathname: '/mushaf',
      params: page ? {page} : {},
    });
  }, [page, router]);

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
