import {Stack} from 'expo-router';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {USE_GLASS} from '@/hooks/useGlassProps';
import {capScreensExcept} from '@/components/layout/MaxWidthContainer';

// Grids, shelves and the reciter page take the whole pane on iPad; other
// screens stay in the 720pt column for now (ipad-standards §5.3). @ai
const SCREEN_LAYOUT = capScreensExcept([
  'index',
  'browse-all',
  'reciter/browse',
  'reciter/[id]',
  // Adhkar caps its own screens, all but its category grid. @ai
  'adhkar',
]); // @ai

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};

// @ai-start
export default function HomeLayout() {
  const {t} = useTranslation('home');
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
      <Stack.Screen
        name="reciter/browse"
        options={{
          // Non-glass devices use custom Header component inside BrowseReciters
          headerShown: USE_GLASS,
        }}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={{
          title: '',
          // Non-glass devices use CollectionStickyHeader's own back button
          headerShown: USE_GLASS,
        }}
      />
      <Stack.Screen name="adhkar" options={{headerShown: false}} />
      <Stack.Screen
        name="browse-all"
        options={{
          title: t('browse.browseAll'),
          // Non-glass devices use custom Header component; hide native header to avoid clash
          headerShown: USE_GLASS,
        }}
      />
      <Stack.Screen
        name="browse-all-surahs"
        options={{
          title: t('browse.allSurahs'),
          // Non-glass devices use the custom Header inside BrowseSurahs
          headerShown: USE_GLASS,
        }}
      />
    </Stack>
  );
}
// @ai-end
