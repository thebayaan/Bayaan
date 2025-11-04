import {Stack} from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{headerShown: false}}>
      <Stack.Screen name="index" options={{headerShown: false}} />
      <Stack.Screen name="reciter/[id]" options={{headerShown: false}} />
      <Stack.Screen name="reciter/browse" options={{headerShown: false}} />
      <Stack.Screen name="settings/index" options={{headerShown: false}} />
      <Stack.Screen name="browse-all" options={{headerShown: false}} />
    </Stack>
  );
}
