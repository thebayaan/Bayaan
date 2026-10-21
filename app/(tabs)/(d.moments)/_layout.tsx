// @ai-start
import {Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';

// A screen pushed in this stack lands on top of the feed, so back always
// returns to the same moment.
export const unstable_settings = {initialRouteName: 'index'};

export default function MomentsLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: '#000000'},
      }}>
      {/* Named so iOS back menus say "Moments", not the route name. */}
      <Stack.Screen name="index" options={{title: t('tabs.moments')}} />
      {/* The reciter profile opens inside Moments, as a normal themed screen,
          like the one in the Collection tab. */}
      <Stack.Screen
        name="reciter/[id]"
        options={{
          contentStyle: {backgroundColor: theme.colors.background},
          ...(USE_GLASS
            ? {
                headerShown: true,
                headerTransparent: true,
                headerBlurEffect: undefined,
                headerStyle: {backgroundColor: 'transparent'},
                headerShadowVisible: false,
                headerTitle: '',
                headerBackTitle: ' ',
                headerBackButtonDisplayMode: 'minimal',
                headerTintColor: theme.colors.text,
              }
            : {headerShown: false}),
        }}
      />
    </Stack>
  );
}
// @ai-end
