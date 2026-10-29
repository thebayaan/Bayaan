import {Stack} from 'expo-router';
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';

// Grids and shelves take the whole pane on iPad; other screens stay in the
// 720pt column for now (ipad-standards §5.3). @ai
const SCREEN_LAYOUT = capScreensExcept(['index']); // @ai

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
    </Stack>
  );
}
