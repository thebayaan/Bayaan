import {useMemo} from 'react';
import {useTheme} from '@/hooks/useTheme';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  getReadingThemeById,
  type ReadingThemeColors,
} from '@/constants/readingThemes';

/**
 * Returns the active reading theme colors for mushaf/list/player views.
 * Resolves lightThemeId or darkThemeId based on the current app theme mode.
 */
export function useReadingThemeColors(): ReadingThemeColors {
  const {isDarkMode} = useTheme();
  const lightThemeId = useMushafSettingsStore(s => s.lightThemeId);
  const darkThemeId = useMushafSettingsStore(s => s.darkThemeId);

  return useMemo(() => {
    const themeId = isDarkMode ? darkThemeId : lightThemeId;
    const rt = getReadingThemeById(themeId);
    if (rt) return rt.colors;
    // Fallback to defaults if theme not found
    return isDarkMode
      ? getReadingThemeById('dark-default')!.colors
      : getReadingThemeById('default')!.colors;
  }, [isDarkMode, lightThemeId, darkThemeId]);
}
