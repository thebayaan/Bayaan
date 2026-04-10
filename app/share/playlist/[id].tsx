import React, {useEffect} from 'react';
import {View, ActivityIndicator, Text} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

// Phase 2: once server-side playlist sharing is implemented, fetch the playlist
// by ID and navigate to a playlist detail screen. For now, redirect to home.
export default function SharePlaylistReceiver() {
  const {id} = useLocalSearchParams<{id: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    // TODO(phase2): fetch shared playlist by id and navigate to playlist screen
    router.replace('/');
  }, [id, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text
        style={{
          marginTop: 12,
          color: theme.colors.textSecondary,
          fontSize: 14,
        }}>
        Opening playlist…
      </Text>
    </View>
  );
}
