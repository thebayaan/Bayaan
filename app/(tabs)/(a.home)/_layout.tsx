import {Stack} from 'expo-router';
import {Platform} from 'react-native';

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
      <Stack.Screen
        name="reciter/[id]"
        options={{
          title: '',
          // Android uses custom NavigationButtons; hide native header to avoid clash
          headerShown: Platform.OS === 'ios',
        }}
      />
      <Stack.Screen
        name="reciter/browse"
        options={{
          // Android uses custom Header component inside BrowseReciters
          headerShown: Platform.OS === 'ios',
        }}
      />
      <Stack.Screen name="playlist/[id]" options={{title: ''}} />
      <Stack.Screen name="adhkar" options={{headerShown: false}} />
      <Stack.Screen name="settings/index" options={{}} />
      <Stack.Screen name="settings/storage" options={{}} />
      <Stack.Screen name="settings/about" options={{}} />
      <Stack.Screen name="settings/credits" options={{}} />
      <Stack.Screen name="settings/mushaf-settings" options={{}} />
      <Stack.Screen name="settings/default-reciter" options={{}} />
      <Stack.Screen name="settings/reciter-choice" options={{}} />
      <Stack.Screen name="settings/account" options={{}} />
      <Stack.Screen
        name="browse-all"
        options={{
          title: 'Browse All',
          // Android uses custom Header component; hide native header to avoid clash
          headerShown: Platform.OS === 'ios',
        }}
      />
    </Stack>
  );
}
