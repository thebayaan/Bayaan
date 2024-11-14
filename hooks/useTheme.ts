import {useThemeStore} from '@/store/themeStore';
import {ThemeMode, PrimaryColor} from '@/utils/themeUtils';

export function useTheme() {
  const store = useThemeStore();

  return {
    theme: store.theme,
    themeMode: store.themeMode,
    primaryColor: store.primaryColor,
    setThemeMode: (mode: ThemeMode) => store.setThemeMode(mode),
    setPrimaryColor: (color: PrimaryColor) => store.setPrimaryColor(color),
    isDarkMode: store.theme.isDarkMode,
  };
}
