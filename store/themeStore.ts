import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage'; // @ai
import {ThemeMode, PrimaryColor, Theme, createTheme} from '@/utils/themeUtils';
import {Appearance} from 'react-native'; // @ai

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

// @ai-start
// Whether this run of the app has pinned a look on the native side. A cold
// start has none, so System has nothing to remove then and the native side is
// left exactly as the OS started it.
let nativeLookPinned = false;

// Tells the native side which look the app uses, so the keyboard, alerts and
// glass chrome match. 'light' and 'dark' pin it; 'unspecified' removes the pin
// and the app follows the device again. React Native takes 'unspecified' on
// iOS and Android alike. The old `null` left React Native's own cached scheme
// null on iOS (so screens asking it saw "light" inside a dark app), and was
// never sent on Android (so System kept the last pinned look until restart).
const syncNativeColorScheme = (mode: ThemeMode) => {
  if (mode !== 'system') {
    nativeLookPinned = true;
    Appearance.setColorScheme(mode);
  } else if (nativeLookPinned) {
    nativeLookPinned = false;
    Appearance.setColorScheme('unspecified');
  }
};
// @ai-end

// Subscribe to system theme changes outside of the store
// @ai-start
// This is also what completes a switch to System: the native side removes the
// pin a moment after syncNativeColorScheme() asks, and reports the device's
// scheme here when it differs from the pinned one.
// @ai-end
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
          // Sync native UI (keyboard, alerts, liquid glass chrome) with the choice
          // @ai-start
          syncNativeColorScheme(mode);
          // Read the scheme after the sync, never before. For System, React
          // Native still reports the pinned look at this point (the pin comes
          // off a moment later), so the theme stays as it is and the change
          // listener above switches it when the device's scheme arrives.
          const newTheme = getEffectiveTheme(mode, state.primaryColor);
          // @ai-end
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
      storage: persistStorage(), // @ai
      partialize: state => ({
        themeMode: state.themeMode,
        primaryColor: state.primaryColor,
      }),
      onRehydrateStorage: () => state => {
        if (state) {
          // Sync native UI with the persisted preference on app launch
          // @ai-start
          syncNativeColorScheme(state.themeMode);
          const theme = getEffectiveTheme(state.themeMode, state.primaryColor);
          // @ai-end
          useThemeStore.setState({
            ...state,
            theme,
          });
        }
      },
    },
  ),
);
