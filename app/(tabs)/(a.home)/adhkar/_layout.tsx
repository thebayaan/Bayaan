import {Stack} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {AdhkarAudioProvider} from '@/components/adhkar/AdhkarAudioProvider';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';

// @ai-start
export default function AdhkarLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);

  return (
    <AdhkarAudioProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          freezeOnBlur: true,
          headerTintColor: theme.colors.text,
          ...(USE_GLASS
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
        <Stack.Screen
          name="index"
          options={{title: t('common:terms.adhkar')}}
        />
        <Stack.Screen name="[superId]/index" />
        <Stack.Screen name="[superId]/[dhikrId]" />
        <Stack.Screen name="saved" />
      </Stack>
    </AdhkarAudioProvider>
  );
}
// @ai-end
