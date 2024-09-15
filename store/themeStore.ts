import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ThemeMode, PrimaryColor, Theme, createTheme} from '@/utils/themeUtils';

interface ThemeState {
  themeMode: ThemeMode;
  primaryColor: PrimaryColor;
  setThemeMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: PrimaryColor) => void;
  theme: Theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeMode: 'system',
      primaryColor: 'Purple',
      setThemeMode: (mode: ThemeMode) =>
        set(state => {
          const newTheme = createTheme(
            mode === 'system' ? 'light' : mode,
            state.primaryColor,
          );
          return {themeMode: mode, theme: newTheme};
        }),
      setPrimaryColor: (color: PrimaryColor) =>
        set(state => {
          const newTheme = createTheme(
            state.themeMode === 'system' ? 'light' : state.themeMode,
            color,
          );
          return {primaryColor: color, theme: newTheme};
        }),
      theme: createTheme('light', 'Purple'),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
