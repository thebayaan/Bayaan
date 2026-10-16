import {Pressable} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {flipX} from '@/utils/rtl';

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};

// @ai-start
export default function AdhkarLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const router = useRouter();

  return (
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
        options={{
          title: t('common:terms.adhkar'),
          // The first screen of this stack gets no system back button, so
          // draw one whenever the home stack has a screen to return to.
          headerLeft: ({canGoBack}) =>
            canGoBack ? (
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common:actions.back')}
                style={{padding: moderateScale(4)}}>
                <Ionicons
                  name="chevron-back"
                  size={moderateScale(24)}
                  color={theme.colors.text}
                  style={flipX}
                />
              </Pressable>
            ) : null,
        }}
      />
      <Stack.Screen name="[superId]/index" />
      {/* The readers page with a full-width horizontal list, which wins
          over the iOS 26 swipe-back-from-anywhere gesture. With it off, the
          left-edge swipe takes priority over the pager and pops. A reader
          opened by a list row's zoom link keeps the zoom dismiss. */}
      <Stack.Screen
        name="[superId]/[dhikrId]"
        options={{fullScreenGestureEnabled: false}}
      />
      <Stack.Screen name="saved" />
      <Stack.Screen
        name="saved/[dhikrId]"
        options={{fullScreenGestureEnabled: false}}
      />
    </Stack>
  );
}
// @ai-end
