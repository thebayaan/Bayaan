import {Stack} from 'expo-router';
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';
import {USE_GLASS} from '@/hooks/useGlassProps'; // @ai

// Grids, shelves and the reciter page take the whole pane on iPad; other
// screens stay in the 720pt column for now (ipad-standards §5.3). @ai
const SCREEN_LAYOUT = capScreensExcept([
  'index',
  'reciter/browse',
  'reciter/[id]',
]); // @ai

export default function SurahsLayout() {
  return (
    <Stack
      screenLayout={SCREEN_LAYOUT} // @ai
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
          headerShown: false,
        }}
      />
      {/* @ai-start */}
      {/* Same options as Home's copies of these screens. */}
      <Stack.Screen
        name="reciter/browse"
        options={{
          // Non-glass devices use custom Header component inside BrowseReciters
          headerShown: USE_GLASS,
        }}
      />
      <Stack.Screen
        name="reciter/[id]"
        options={{
          title: '',
          // Non-glass devices use custom NavigationButtons; hide native header to avoid clash
          headerShown: USE_GLASS,
        }}
      />
      {/* @ai-end */}
    </Stack>
  );
}
