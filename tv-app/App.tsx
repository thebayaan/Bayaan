import React, {useEffect} from 'react';
import {LogBox, View} from 'react-native';
import {AppStatusBar} from './components/app/AppStatusBar';
import {ErrorBoundary} from './components/ErrorBoundary';
import {Router} from './components/nav/Router';
import {TVAudioProvider} from './components/providers/TVAudioProvider';
import {createAudioEngine} from './services/audioEngine';
import {seedDefaultReciter} from './services/tvDataService';
import {useOverlayStore} from './store/overlayStore';
import {useTVPlayerStore} from './store/tvPlayerStore';
import {colors} from './theme/colors';
import {createScaledStyles} from './theme/scale';
import {useBrandFonts} from './hooks/useBrandFonts';

LogBox.ignoreAllLogs(true);

export default function App(): React.ReactElement {
  const setEngine = useTVPlayerStore(s => s.setEngine);

  const fontsLoaded = useBrandFonts();

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
        <AppStatusBar />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppStatusBar />
      <ErrorBoundary>
        <TVAudioProvider>
          <Router />
        </TVAudioProvider>
      </ErrorBoundary>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1, backgroundColor: colors.background},
});
