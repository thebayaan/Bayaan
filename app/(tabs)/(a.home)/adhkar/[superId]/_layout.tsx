import {Stack} from 'expo-router';

export default function SuperCategoryLayout() {
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
