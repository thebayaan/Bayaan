import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ThemeMode, PrimaryColor, Theme, createTheme} from '@/utils/themeUtils';
import {Appearance, Platform} from 'react-native';

interface ThemeState {
  themeMode: ThemeMode;
  primaryColor: PrimaryColor;
  theme: Theme;
  setThemeMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: PrimaryColor) => void;
}

const getEffectiveTheme = (
  mode: ThemeMode,
  primaryColor: PrimaryColor,
): Theme => {
  const systemTheme = Appearance.getColorScheme();

  if (mode === 'system') {
    const effectiveTheme = systemTheme === 'dark' ? 'dark' : 'light';
    return createTheme(effectiveTheme, primaryColor);
  }
  return createTheme(mode, primaryColor);
};

// Subscribe to system theme changes outside of the store
Appearance.addChangeListener(({colorScheme}) => {
  const state = useThemeStore.getState();

  if (state.themeMode === 'system') {
    const effectiveTheme = colorScheme === 'dark' ? 'dark' : 'light';
    const newTheme = createTheme(effectiveTheme, state.primaryColor);
    useThemeStore.setState({theme: newTheme});
  }
});

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeMode: 'system',
      primaryColor: 'Blue',
      theme: getEffectiveTheme('system', 'Blue'),

      setThemeMode: mode =>
        set(state => {
          // On iOS, always follow system appearance (liquid glass requires it)
          const effectiveMode =
            Platform.OS === 'ios' ? 'system' : mode;
          const newTheme = getEffectiveTheme(effectiveMode, state.primaryColor);
          return {
            themeMode: effectiveMode,
            theme: newTheme,
          };
        }),

      setPrimaryColor: color =>
        set(state => {
          const newTheme = getEffectiveTheme(state.themeMode, color);
          return {
            primaryColor: color,
            theme: newTheme,
          };
        }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        themeMode: state.themeMode,
        primaryColor: state.primaryColor,
      }),
      onRehydrateStorage: () => state => {
        if (state) {
          // On iOS, always force system theme (liquid glass requires it)
          const effectiveMode =
            Platform.OS === 'ios' ? 'system' : state.themeMode;
          const theme = getEffectiveTheme(effectiveMode, state.primaryColor);
          useThemeStore.setState({
            ...state,
            themeMode: effectiveMode,
            theme,
          });
        }
      },
    },
  ),
);
