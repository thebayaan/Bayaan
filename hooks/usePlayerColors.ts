import {useEffect, useCallback} from 'react';
import {usePlayerStore} from '@/store/playerStore';
import {useTheme} from './useTheme';
import ImageColors from 'react-native-image-colors';
import {Asset} from 'expo-asset';
import {reciterImages} from '@/utils/reciterImages';
import {
  PlayerColors,
  CachedReciterColors,
  CACHE_DURATION,
  calculatePlayerColors,
} from '@/utils/playerColorUtils';

export function usePlayerColors(): PlayerColors | null {
  const {theme, isDarkMode} = useTheme();
  const {currentTrack, colors, cachedColors, setColors, setCachedColors} =
    usePlayerStore();

  const extractColors = useCallback(
    async (reciterName: string) => {
      try {
        const formattedName = reciterName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        const localImageSource = reciterImages[formattedName];

        if (!localImageSource) {
          console.log('No image found for reciter:', reciterName);
          return null;
        }

        const asset = Asset.fromModule(localImageSource as number);
        await asset.downloadAsync();
        const imagePath = asset.localUri || asset.uri;

        const result = await ImageColors.getColors(imagePath, {
          fallback: theme.colors.card,
          cache: true,
          key: formattedName,
        });

        const extractedColors: Omit<CachedReciterColors, 'timestamp'> =
          result.platform === 'ios'
            ? {
                primary: result.primary,
                secondary: result.secondary || result.primary,
              }
            : result.platform === 'android'
              ? {
                  primary: result.dominant || theme.colors.card,
                  secondary: result.average || theme.colors.card,
                }
              : {
                  primary: result.dominant || theme.colors.card,
                  secondary: theme.colors.card,
                };

        return extractedColors;
      } catch (error) {
        console.warn('Error extracting colors:', error);
        return null;
      }
    },
    [theme.colors.card],
  );

  useEffect(() => {
    const reciterName = currentTrack?.reciterName;
    if (!reciterName) {
      return;
    }

    const updateColors = async () => {
      // Check cache first
      const cached = cachedColors[reciterName];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        const playerColors = calculatePlayerColors(
          cached.primary,
          cached.secondary,
          theme,
          isDarkMode,
        );
        setColors(playerColors);
        return;
      }

      // Extract colors if not in cache or cache expired
      const extractedColors = await extractColors(reciterName);
      if (!extractedColors) {
        return;
      }

      // Cache the new colors
      setCachedColors(reciterName, {
        ...extractedColors,
        timestamp: Date.now(),
      });

      // Calculate and set player colors
      const playerColors = calculatePlayerColors(
        extractedColors.primary,
        extractedColors.secondary,
        theme,
        isDarkMode,
      );
      setColors(playerColors);
    };

    updateColors();
  }, [
    currentTrack?.reciterName,
    theme,
    isDarkMode,
    extractColors,
    setColors,
    setCachedColors,
    cachedColors,
  ]);

  return colors;
}
