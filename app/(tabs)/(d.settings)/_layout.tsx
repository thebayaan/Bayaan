import {Platform} from 'react-native';
import {Stack} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function SettingsLayout() {
  const {theme} = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        freezeOnBlur: true,
        headerTintColor: theme.colors.text,
        ...(Platform.OS === 'ios'
          ? {
              headerTransparent: true,
              headerStyle: {backgroundColor: 'transparent'},
            }
          : {
              headerStyle: {backgroundColor: theme.colors.background},
            }),
        headerTitleStyle: {
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.text,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="index" options={{headerShown: false}} />
      <Stack.Screen name="storage" options={{title: 'Storage'}} />
      <Stack.Screen name="about" options={{title: 'About Bayaan'}} />
      <Stack.Screen name="credits" options={{title: 'Credits'}} />
      <Stack.Screen
        name="mushaf-settings"
        options={{title: 'Mushaf Settings'}}
      />
      <Stack.Screen
        name="default-reciter"
        options={{title: 'Default Reciter'}}
      />
      <Stack.Screen
        name="reciter-choice"
        options={{title: 'Reciter Choice'}}
      />
      <Stack.Screen name="account" options={{title: 'Account'}} />
      <Stack.Screen
        name="translations"
        options={{title: 'Translations & Tafaseer'}}
      />
      <Stack.Screen name="whats-new" options={{title: "What's New"}} />
    </Stack>
  );
}
