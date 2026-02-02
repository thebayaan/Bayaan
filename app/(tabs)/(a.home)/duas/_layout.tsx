import {Stack} from 'expo-router';

export default function DuasLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="[categoryId]" />
      <Stack.Screen name="dua/[duaId]" />
    </Stack>
  );
}
