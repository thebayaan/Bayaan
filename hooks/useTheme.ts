import {useThemeStore} from '@/store/themeStore';
import {ThemeMode, PrimaryColor} from '@/utils/themeUtils';
import {shallow} from 'zustand/shallow';

export function useTheme() {
  const {theme, themeMode, primaryColor, setThemeMode, setPrimaryColor} =
    useThemeStore(
      state => ({
        theme: state.theme,
        themeMode: state.themeMode,
        primaryColor: state.primaryColor,
        setThemeMode: state.setThemeMode,
        setPrimaryColor: state.setPrimaryColor,
      }),
      shallow,
    );

  return {
    theme,
    themeMode,
    primaryColor,
    setThemeMode: (mode: ThemeMode) => setThemeMode(mode),
    setPrimaryColor: (color: PrimaryColor) => setPrimaryColor(color),
    isDarkMode: theme.isDarkMode,
  };
}
