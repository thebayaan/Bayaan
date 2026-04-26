import {useThemeStore} from '@/store/themeStore';
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
    setThemeMode,
    setPrimaryColor,
    isDarkMode: theme.isDarkMode,
  };
}
