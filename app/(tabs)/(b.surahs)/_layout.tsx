import {Stack} from 'expo-router';
import {USE_GLASS} from '@/hooks/useGlassProps';

export default function SurahsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        freezeOnBlur: true,
        headerTransparent: true,
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
