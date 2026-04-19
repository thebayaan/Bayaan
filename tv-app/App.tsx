import React, {useEffect} from 'react';
import {StatusBar} from 'expo-status-bar';
import {StyleSheet, View} from 'react-native';
import {Router} from './components/nav/Router';
import {createAudioEngine} from './services/audioEngine';
import {useTVPlayerStore} from './store/tvPlayerStore';
import {colors} from './theme/colors';

// NOTE (v1 constraint): ExpoAudioService requires setPlayer() to be called
// from a React component holding a useAudioPlayer hook instance before any
// load/play calls will work. On TV targets we cannot pull in the phone-side
// ExpoAudioProvider (it drags in phone-specific providers). Until a TV-native
// audio provider is added, the engine is wired to the store here so the UI
// renders and navigates correctly, but actual audio output won't start until
// a component calls expoAudioService.setPlayer(). Track as a follow-up.
export default function App(): React.ReactElement {
  const setEngine = useTVPlayerStore(s => s.setEngine);

  useEffect(() => {
    const engine = createAudioEngine();
    setEngine(engine);
  }, [setEngine]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Router />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
});
