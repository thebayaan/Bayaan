// @ai-generated
import {useMemo} from 'react';
import {Platform, type ViewStyle} from 'react-native';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {moderateScale} from '@/utils/scale';

/** The one elevation every floating pill shares on Android. */
const ANDROID_PILL_ELEVATION = 6;

/**
 * The surface of a floating pill (tab bar, mini player, adhkar player),
 * without its position. On Android it is an elevated Material surface: a
 * solid white sheet in light, the page lifted by an 8% white overlay in
 * dark, and one soft elevation shadow, so the pills read as raised cards
 * instead of a grey band with a border. iOS keeps its hairline and shadow.
 */
export function useFloatingPillStyle(): ViewStyle {
  const {theme} = useTheme();
  return useMemo((): ViewStyle => {
    const shape: ViewStyle = {
      borderRadius: moderateScale(100),
      overflow: 'hidden',
    };
    if (Platform.OS === 'android') {
      return {
        ...shape,
        backgroundColor: theme.isDarkMode
          ? Color(theme.colors.background).mix(Color('#ffffff'), 0.08).hex()
          : '#ffffff',
        shadowColor: '#000000',
        elevation: ANDROID_PILL_ELEVATION,
      };
    }
    return {
      ...shape,
      borderWidth: USE_GLASS ? 0 : 1,
      borderColor: USE_GLASS
        ? undefined
        : Color(theme.colors.text).alpha(0.1).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 8,
    };
  }, [theme.colors.background, theme.colors.text, theme.isDarkMode]);
}
