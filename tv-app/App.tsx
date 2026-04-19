import React, {useEffect} from 'react';
import {StatusBar} from 'expo-status-bar';
import {LogBox, StyleSheet, View} from 'react-native';
import {ErrorBoundary} from './components/ErrorBoundary';
import {Router} from './components/nav/Router';
import {TVAudioProvider} from './components/providers/TVAudioProvider';
import {createAudioEngine} from './services/audioEngine';
import {useTVPlayerStore} from './store/tvPlayerStore';
import {colors} from './theme/colors';

LogBox.ignoreAllLogs(true);

export default function App(): React.ReactElement {
  const setEngine = useTVPlayerStore(s => s.setEngine);

  useEffect(() => {
    const engine = createAudioEngine();
    setEngine(engine);
  }, [setEngine]);

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
