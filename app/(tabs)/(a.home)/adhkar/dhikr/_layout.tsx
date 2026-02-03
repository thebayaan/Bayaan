import {Stack} from 'expo-router';

export default function DhikrDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="[dhikrId]" />
    </Stack>
  );
}
