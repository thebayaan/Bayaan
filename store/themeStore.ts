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
    return createTheme(systemTheme || 'light', primaryColor);
  }
  return createTheme(mode, primaryColor);
};

// Subscribe to system theme changes outside of the store
Appearance.addChangeListener(({colorScheme}) => {
  console.log('[Theme Debug] System theme changed to:', colorScheme);
  const state = useThemeStore.getState();
  console.log('[Theme Debug] Current theme mode:', state.themeMode);

  if (state.themeMode === 'system') {
    console.log('[Theme Debug] Updating theme to match system');
    const newTheme = createTheme(colorScheme || 'light', state.primaryColor);
    useThemeStore.setState({...state, theme: newTheme});
  }
});

// Get initial system theme
const initialSystemTheme = Appearance.getColorScheme();
console.log('[Theme Debug] Initial system theme:', initialSystemTheme);

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeMode: 'system',
      primaryColor: 'Purple',
      theme: getEffectiveTheme('system', 'Purple'),

      setThemeMode: mode =>
        set(state => {
          console.log('[Theme Debug] Setting theme mode to:', mode);
          const newTheme = getEffectiveTheme(mode, state.primaryColor);
          return {
            themeMode: mode,
            theme: newTheme,
          };
        }),

      setPrimaryColor: color =>
        set(state => {
          console.log('[Theme Debug] Setting primary color to:', color);
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
          console.log('[Theme Debug] Rehydrating store with state:', state);
          const theme = getEffectiveTheme(state.themeMode, state.primaryColor);
          useThemeStore.setState({...state, theme});
        }
      },
    },
  ),
);
