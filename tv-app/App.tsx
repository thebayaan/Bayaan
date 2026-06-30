import React, {useEffect} from 'react';
import {useFonts} from 'expo-font';
import {StatusBar} from 'expo-status-bar';
import {LogBox, StyleSheet, View} from 'react-native';
import {ErrorBoundary} from './components/ErrorBoundary';
import {Router} from './components/nav/Router';
import {TVAudioProvider} from './components/providers/TVAudioProvider';
import {createAudioEngine} from './services/audioEngine';
import {seedDefaultReciter} from './services/tvDataService';
import {useOverlayStore} from './store/overlayStore';
import {useTVPlayerStore} from './store/tvPlayerStore';
import {colors} from './theme/colors';
import {fonts} from './theme/typography';

LogBox.ignoreAllLogs(true);

export default function App(): React.ReactElement {
  const setEngine = useTVPlayerStore(s => s.setEngine);

  // Register the Manrope brand faces so `typography.fontFamily` resolves to the
  // real brand font instead of falling back to the platform system font. The
  // map keys are the family-name strings exported from `theme/typography.ts`
  // (do not hardcode them) so the registered names always match what styles
  // reference.
  const [fontsLoaded] = useFonts({
    [fonts.regular]: require('./assets/fonts/Manrope-Regular.ttf'),
    [fonts.medium]: require('./assets/fonts/Manrope-Medium.ttf'),
    [fonts.semiBold]: require('./assets/fonts/Manrope-SemiBold.ttf'),
    [fonts.bold]: require('./assets/fonts/Manrope-Bold.ttf'),
    [fonts.extraBold]: require('./assets/fonts/Manrope-ExtraBold.ttf'),
    [fonts.light]: require('./assets/fonts/Manrope-Light.ttf'),
    [fonts.extraLight]: require('./assets/fonts/Manrope-ExtraLight.ttf'),
  });

  useEffect(() => {
    const engine = createAudioEngine();
    setEngine(engine);
    // Re-apply the MMKV-persisted playback speed to the fresh engine so the
    // user's chosen rate survives relaunches.
    useOverlayStore.getState().applyPersistedSpeed();
  }, [setEngine]);

  useEffect(() => {
    void seedDefaultReciter();
  }, []);

  // Gate the first paint on the brand fonts so text never flashes in the
  // system fallback before swapping to Manrope. The deep-ink root keeps the
  // hold frame visually consistent with the app background.
  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ErrorBoundary>
        <TVAudioProvider>
          <Router />
        </TVAudioProvider>
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
});
