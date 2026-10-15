import {getAppDisplayName} from '@/i18n/format'; // @ai
import {Stack} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';
import branding from '@/config/branding';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

// @ai-start
export default function SettingsLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation(['settings', 'common']);

  return (
    <MaxWidthContainer>
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
        <Stack.Screen name="index" options={{headerShown: false}} />
        <Stack.Screen name="storage" options={{title: t('layout.storage')}} />
        <Stack.Screen
          name="about"
          options={{
            title: t('layout.about', {
              appName: getAppDisplayName(branding.appName),
            }),
          }}
        />
        <Stack.Screen name="credits" options={{title: t('layout.credits')}} />
        <Stack.Screen
          name="mushaf-settings"
          options={{title: t('layout.mushafSettings')}}
        />
        <Stack.Screen
          name="default-reciter"
          options={{title: t('layout.defaultReciter')}}
        />
        <Stack.Screen
          name="reciter-choice"
          options={{title: t('layout.reciterChoice')}}
        />
        <Stack.Screen name="account" options={{title: t('layout.account')}} />
        <Stack.Screen
          name="translations"
          options={{title: t('layout.translations')}}
        />
        <Stack.Screen
          name="reading-theme"
          options={{title: t('layout.readingTheme')}}
        />
        <Stack.Screen
          name="whats-new"
          options={{title: t('layout.whatsNew')}}
        />
        <Stack.Screen
          name="language"
          options={{title: t('common:language.title')}}
        />
      </Stack>
    </MaxWidthContainer>
  );
}
// @ai-end
