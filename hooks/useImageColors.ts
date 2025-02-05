import {useState, useEffect} from 'react';
import ImageColors from 'react-native-image-colors';
import {Asset} from 'expo-asset';
import {reciterImages} from '@/utils/reciterImages';
import {useTheme} from './useTheme';
import Color from 'color';

interface DominantColors {
  primary: string;
  secondary: string;
}

interface AndroidImageColors {
  dominant?: string;
  average?: string;
  vibrant?: string;
  darkVibrant?: string;
  lightVibrant?: string;
  darkMuted?: string;
  lightMuted?: string;
  muted?: string;
  platform: 'android';
}

interface IOSImageColors {
  primary: string;
  secondary?: string;
  background?: string;
  detail?: string;
  platform: 'ios';
}

interface WebImageColors {
  dominant?: string;
  platform: 'web';
}

type ImageColorsResult = AndroidImageColors | IOSImageColors | WebImageColors;

const MIN_BRIGHTNESS = Color('#121212').luminosity();

function ensureMinBrightness(colorStr: string): string {
  const color = Color(colorStr);
  return color.luminosity() < MIN_BRIGHTNESS ? '#121212' : colorStr;
}

export function useImageColors(
  reciterName: string | undefined | null,
): DominantColors {
  const {theme} = useTheme();
  const [dominantColors, setDominantColors] = useState<DominantColors>({
    primary: theme.colors.card,
    secondary: theme.colors.card,
  });

  useEffect(() => {
    const extractColors = async () => {
      if (!reciterName) {
        return;
      }

      try {
        const formattedName = reciterName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        const localImageSource = reciterImages[formattedName];

        if (!localImageSource) {
          console.log('No image found for reciter:', reciterName);
          return;
        }

        const asset = Asset.fromModule(localImageSource as number);
        await asset.downloadAsync();
        const imagePath = asset.localUri || asset.uri;

        const result = (await ImageColors.getColors(imagePath, {
          fallback: theme.colors.card,
          cache: true,
          key: formattedName,
        })) as ImageColorsResult;

        if (result.platform === 'ios') {
          const colors = {
            primary: ensureMinBrightness(result.primary),
            secondary: ensureMinBrightness(result.secondary || result.primary),
          };
          setDominantColors(colors);
        } else if (result.platform === 'android') {
          const colors = {
            primary: ensureMinBrightness(result.dominant || theme.colors.card),
            secondary: ensureMinBrightness(result.average || theme.colors.card),
          };
          setDominantColors(colors);
        } else {
          const colors = {
            primary: ensureMinBrightness(result.dominant || theme.colors.card),
            secondary: ensureMinBrightness(theme.colors.card),
          };
          setDominantColors(colors);
        }
      } catch (error) {
        console.error('Error extracting colors:', error);
      }
    };

    extractColors();
  }, [reciterName, theme.colors.card]);

  return dominantColors;
}
