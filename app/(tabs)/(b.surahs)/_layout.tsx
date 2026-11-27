import {Stack} from 'expo-router';
import {USE_GLASS} from '@/hooks/useGlassProps'; // @ai
import {tintedBackOptions} from '@/components/TintedHeader'; // @ai
import {withTabBarScrim} from '@/components/TabBarScrim'; // @ai
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';

// Grids and shelves take the whole pane on iPad; other screens stay in the
// 720pt column for now (ipad-standards §5.3). @ai
const SCREEN_LAYOUT = capScreensExcept(['index', 'reciter/browse']); // @ai

// @ai-start
// A link that opens a screen in this stack lands on top of its first
// screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};
// @ai-end

function SurahsLayout() {
  return (
    <Stack
      screenLayout={SCREEN_LAYOUT} // @ai
      screenOptions={{
        ...tintedBackOptions, // @ai
        headerShown: true,
        freezeOnBlur: true,
        headerTransparent: true,
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerShown: false,
        }}
      />
      {/* @ai-start */}
      <Stack.Screen
        name="reciter/browse"
        options={{
          // Non-glass devices use the custom Header inside BrowseReciters
          headerShown: USE_GLASS,
        }}
      />
      {/* @ai-end */}
    </Stack>
  );
}

export default withTabBarScrim(SurahsLayout); // @ai
