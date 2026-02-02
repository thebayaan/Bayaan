import {Stack} from 'expo-router';

export default function DuaDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="[duaId]" />
    </Stack>
  );
}
