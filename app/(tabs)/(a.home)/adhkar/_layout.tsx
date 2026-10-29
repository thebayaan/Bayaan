import React from 'react'; // @ai
import {Pressable} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from '@/utils/scale';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {flipX} from '@/utils/rtl';
import {capScreensExcept} from '@/components/layout/MaxWidthContainer'; // @ai
import {DhikrListWidth} from '@/components/adhkar/DhikrCardRow'; // @ai

// @ai-start
// The category grid takes the whole pane on iPad and readers stay in the
// 720pt column (ipad-standards §5.3). The dhikr lists take the pane only
// when their cards pair up, so they size themselves.
const DHIKR_LIST_ROUTES = ['[superId]/index', 'saved/index'];
const capOthers = capScreensExcept(['index', ...DHIKR_LIST_ROUTES]);
function screenLayout(props: {
  route: {name: string};
  children: React.ReactElement;
}): React.ReactElement {
  return DHIKR_LIST_ROUTES.includes(props.route.name) ? (
    <DhikrListWidth>{props.children}</DhikrListWidth>
  ) : (
    capOthers(props)
  );
}
// @ai-end

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
      screenLayout={screenLayout} // @ai
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
