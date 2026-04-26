import * as Font from 'expo-font';
import {useEffect, useState} from 'react';

export function useFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Manrope-Regular': require('../assets/fonts/Manrope-Regular.ttf'),
          'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
          'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
          'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
          'Manrope-Light': require('../assets/fonts/Manrope-Light.ttf'),
          'Manrope-ExtraLight': require('../assets/fonts/Manrope-ExtraLight.ttf'),
          'Manrope-ExtraBold': require('../assets/fonts/Manrope-ExtraBold.ttf'),
          surah_names: require('../assets/fonts/surah_names.ttf'),
          surah_names_2: require('../assets/fonts/surah_names_2.ttf'),
          'ScheherazadeNew-Regular': require('../assets/fonts/ScheherazadeNew-Regular.ttf'),
          'ScheherazadeNew-Medium': require('../assets/fonts/ScheherazadeNew-Medium.ttf'),
          'ScheherazadeNew-Bold': require('../assets/fonts/ScheherazadeNew-Bold.ttf'),
          'ScheherazadeNew-SemiBold': require('../assets/fonts/ScheherazadeNew-SemiBold.ttf'),
        });
        if (!isCancelled) {
          setFontsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading fonts:', error);
      }
    }

    loadFonts();

    return () => {
      isCancelled = true;
    };
  }, []);

  return fontsLoaded;
}
