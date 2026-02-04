import {Stack} from 'expo-router';

export default function SavedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[dhikrId]" />
    </Stack>
  );
}
