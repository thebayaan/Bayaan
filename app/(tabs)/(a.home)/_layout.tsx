import {Stack} from 'expo-router';

export default function HomeLayout() {
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
        }}
      />
      <Stack.Screen name="reciter/[id]" options={{title: ''}} />
      <Stack.Screen name="reciter/browse" options={{}} />
      <Stack.Screen name="playlist/[id]" options={{title: ''}} />
      <Stack.Screen name="adhkar" options={{}} />
      <Stack.Screen name="settings/index" options={{}} />
      <Stack.Screen name="settings/storage" options={{}} />
      <Stack.Screen name="settings/about" options={{}} />
      <Stack.Screen name="settings/credits" options={{}} />
      <Stack.Screen
        name="settings/mushaf-settings"
        options={{}}
      />
      <Stack.Screen
        name="settings/default-reciter"
        options={{}}
      />
      <Stack.Screen
        name="settings/reciter-choice"
        options={{}}
      />
      <Stack.Screen name="settings/account" options={{}} />
      <Stack.Screen name="browse-all" options={{title: 'Browse All'}} />
    </Stack>
  );
}
