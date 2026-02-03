import {Stack} from 'expo-router';

export default function AdhkarLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="[categoryId]" />
      <Stack.Screen name="category/[superId]" />
      <Stack.Screen name="dhikr/[dhikrId]" />
    </Stack>
  );
}
