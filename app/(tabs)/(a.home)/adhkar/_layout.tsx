import {Stack} from 'expo-router';
import {AdhkarAudioProvider} from '@/components/adhkar/AdhkarAudioProvider';

export default function AdhkarLayout() {
  return (
    <AdhkarAudioProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen name="[categoryId]" />
        <Stack.Screen name="category/[superId]" />
        <Stack.Screen name="dhikr/[dhikrId]" />
      </Stack>
    </AdhkarAudioProvider>
  );
}
