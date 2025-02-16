import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ThemeMode, PrimaryColor, Theme, createTheme} from '@/utils/themeUtils';
import {Appearance} from 'react-native';

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
      primaryColor: 'Purple',
      theme: getEffectiveTheme('system', 'Purple'),

      setThemeMode: mode =>
        set(state => {
          const newTheme = getEffectiveTheme(mode, state.primaryColor);
          return {
            themeMode: mode,
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
          const theme = getEffectiveTheme(state.themeMode, state.primaryColor);
          useThemeStore.setState({...state, theme});
        }
      },
    },
  ),
);
