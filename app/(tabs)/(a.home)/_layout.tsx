import {Stack} from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{headerShown: false}}>
      <Stack.Screen name="index" options={{headerShown: false}} />
      <Stack.Screen name="reciter/[id]" options={{headerShown: false}} />
      <Stack.Screen name="reciter/browse" options={{headerShown: false}} />
      <Stack.Screen name="settings/index" options={{headerShown: false}} />
      <Stack.Screen name="settings/storage" options={{headerShown: false}} />
      <Stack.Screen name="settings/about" options={{headerShown: false}} />
      <Stack.Screen name="settings/credits" options={{headerShown: false}} />
      <Stack.Screen name="settings/mushaf-settings" options={{headerShown: false}} />
      <Stack.Screen name="settings/default-reciter" options={{headerShown: false}} />
      <Stack.Screen name="settings/reciter-choice" options={{headerShown: false}} />
      <Stack.Screen name="settings/account" options={{headerShown: false}} />
      <Stack.Screen name="browse-all" options={{headerShown: false}} />
    </Stack>
  );
}
