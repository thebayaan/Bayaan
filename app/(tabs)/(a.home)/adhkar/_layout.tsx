import {Stack} from 'expo-router';
import {AdhkarAudioProvider} from '@/components/adhkar/AdhkarAudioProvider';

export default function AdhkarLayout() {
  return (
    <AdhkarAudioProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerBackTitle: '',
        }}>
        <Stack.Screen name="[superId]" />
        <Stack.Screen name="saved" />
      </Stack>
    </AdhkarAudioProvider>
  );
}
