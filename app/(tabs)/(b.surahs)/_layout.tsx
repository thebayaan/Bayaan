import {Stack} from 'expo-router';
import {tintedBackOptions} from '@/components/TintedHeader'; // @ai
import {withTabBarScrim} from '@/components/TabBarScrim'; // @ai
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';

// Grids and shelves take the whole pane on iPad; other screens stay in the
// 720pt column for now (ipad-standards §5.3). @ai
const SCREEN_LAYOUT = capScreensExcept(['index']); // @ai

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
    </Stack>
  );
}

export default withTabBarScrim(SurahsLayout); // @ai
