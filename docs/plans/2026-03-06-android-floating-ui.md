> **SHIPPED — This feature is implemented.** The floating tab bar and floating player redesign shipped. See `components/BottomTabBar.tsx` and the `FloatingPlayer` component.

# Android Floating Tab Bar + Redesigned Floating Player

**Goal:** Redesign Android's bottom tab bar as a floating pill and simplify the floating player to an artwork-forward layout matching iOS MiniPlayer style.

**Architecture:** Two independent UI changes — (1) BottomTabBar becomes a floating pill with horizontal margins, rounded corners, and alpha-based design system colors; (2) FloatingPlayer simplified to `[ReciterImage] [Title/Artist] [PlayButton]` with no love button, surah glyph, or animations. Both share the same visual language.

**Tech Stack:** React Native, react-native-size-matters, Color, expo-image (ReciterImage), Zustand (playerStore)

---

### Task 1: Update constants for floating tab bar positioning

**Files:**
- Modify: `utils/constants.ts`

**Step 1: Update constants**

Add horizontal margin and tab bar bottom margin constants. Update `TOTAL_BOTTOM_PADDING` to account for the floating tab bar's bottom margin.

```typescript
import {Dimensions, Platform} from 'react-native';
import {moderateScale} from 'react-native-size-matters';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export const MAX_PLAYER_CONTENT_HEIGHT = SCREEN_HEIGHT * 0.45;
export const FLOATING_PLAYER_HEIGHT = moderateScale(58);
export const TAB_BAR_HEIGHT =
  Platform.OS === 'android' ? moderateScale(55, 0.5) : moderateScale(50, 0.5);
export const FLOATING_PLAYER_BOTTOM_MARGIN = moderateScale(8, 0.1);
export const FLOATING_UI_HORIZONTAL_MARGIN = moderateScale(16);
export const FLOATING_TAB_BAR_BOTTOM_MARGIN = moderateScale(12);

export const TOTAL_BOTTOM_PADDING =
  FLOATING_PLAYER_HEIGHT +
  TAB_BAR_HEIGHT +
  FLOATING_PLAYER_BOTTOM_MARGIN +
  FLOATING_TAB_BAR_BOTTOM_MARGIN;

export const getFloatingPlayerBottomPosition = (bottomInset = 0): number => {
  return (
    TAB_BAR_HEIGHT +
    bottomInset +
    FLOATING_PLAYER_BOTTOM_MARGIN +
    FLOATING_TAB_BAR_BOTTOM_MARGIN
  );
};
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add utils/constants.ts
git commit -m "refactor: update constants for floating tab bar positioning"
```

---

### Task 2: Redesign BottomTabBar as floating pill

**Files:**
- Modify: `components/BottomTabBar.tsx`

**Step 1: Rewrite BottomTabBar with floating pill style**

Replace the entire file. Key changes:
- Absolute positioning with horizontal margins and bottom margin
- Pill shape with `borderRadius: moderateScale(24)`
- Alpha-based background from design system
- Same tab content (icons + labels), just in floating container

```typescript
import React, {useCallback, useMemo} from 'react';
import {View, Pressable, Text, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {
  HomeIcon,
  SearchIcon,
  CollectionIcon,
  SettingsIcon,
} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions} from '@react-navigation/native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {
  FLOATING_UI_HORIZONTAL_MARGIN,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
} from '@/utils/constants';

function getIcon(
  routeName: string,
  isFocused: boolean,
  theme: Theme,
  iconSize: number,
) {
  const color = isFocused
    ? theme.colors.text
    : Color(theme.colors.text).alpha(0.5).toString();

  switch (routeName) {
    case '(a.home)':
      return <HomeIcon filled={isFocused} color={color} size={iconSize} />;
    case '(b.search)':
      return <SearchIcon filled={isFocused} color={color} size={iconSize} />;
    case '(c.collection)':
      return (
        <CollectionIcon filled={isFocused} color={color} size={iconSize} />
      );
    case '(d.settings)':
      return <SettingsIcon filled={isFocused} color={color} size={iconSize} />;
    default:
      return null;
  }
}

interface TabItemProps {
  routeName: string;
  routeKey: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  theme: Theme;
  iconSize: number;
}

const TabItem = React.memo(function TabItem({
  routeName,
  label,
  isFocused,
  onPress,
  theme,
  iconSize,
}: TabItemProps) {
  const labelColor = isFocused
    ? Color(theme.colors.text).alpha(0.85).toString()
    : Color(theme.colors.text).alpha(0.5).toString();

  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      {getIcon(routeName, isFocused, theme, iconSize)}
      <Text
        style={[
          styles.tabText,
          {
            color: labelColor,
            fontFamily: isFocused ? 'Manrope-SemiBold' : 'Manrope-Medium',
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
});

const BottomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const iconSize = moderateScale(24, 0.2);

  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      bottom: insets.bottom + FLOATING_TAB_BAR_BOTTOM_MARGIN,
      left: FLOATING_UI_HORIZONTAL_MARGIN,
      right: FLOATING_UI_HORIZONTAL_MARGIN,
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(24),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 8,
    }),
    [theme.colors.text, insets.bottom],
  );

  const handleTabPress = useCallback(
    (route: (typeof state.routes)[number], index: number) => {
      const isFocused = state.index === index;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.dispatch(
          CommonActions.navigate({name: route.name, merge: true}),
        );
      }
    },
    [state.index, navigation],
  );

  return (
    <View style={containerStyle}>
      <View style={styles.content}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              routeKey={route.key}
              label={typeof label === 'string' ? label : ''}
              isFocused={isFocused}
              onPress={() => handleTabPress(route, index)}
              theme={theme}
              iconSize={iconSize}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
  },
  tabText: {
    fontSize: moderateScale(10, 0.2),
    marginTop: moderateScale(3),
  },
});

export default BottomTabBar;
```

**Step 2: Run type check and format**

Run: `npx tsc --noEmit && npx prettier --write components/BottomTabBar.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add components/BottomTabBar.tsx
git commit -m "feat: redesign Android BottomTabBar as floating pill"
```

---

### Task 3: Redesign FloatingPlayer — artwork-forward, simplified

**Files:**
- Modify: `components/player/v2/FloatingPlayer/index.tsx`

**Step 1: Rewrite FloatingPlayer**

Replace the entire file. Key changes:
- Add ReciterImage (40x40 with rounded corners)
- Remove love button, surah glyph, heart animation
- Remove appear/disappear animation (just conditionally render)
- Use same alpha-based bg as floating tab bar
- Use same horizontal margins as tab bar
- Simplified imports (remove BlurView, HeartIcon, MicrophoneIcon, surahGlyphMap, reanimated)

```typescript
import React, {useCallback, useMemo, useRef} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {usePathname} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {ReciterImage} from '@/components/ReciterImage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import {
  getFloatingPlayerBottomPosition,
  FLOATING_UI_HORIZONTAL_MARGIN,
} from '@/utils/constants';

export const FloatingPlayer: React.FC = React.memo(function FloatingPlayer() {
  const {theme} = useTheme();
  const {play, pause, setSheetMode} = usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);
  const queueTracks = usePlayerStore(state => state.queue.tracks);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const trackLoading = usePlayerStore(state => state.loading.trackLoading);
  const stateRestoring = usePlayerStore(state => state.loading.stateRestoring);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isMushafActive = pathname === '/mushaf';
  const prevTrackIdRef = useRef<string | null>(null);

  const currentTrack = useMemo(
    () => queueTracks?.[currentIndex],
    [queueTracks, currentIndex],
  );

  const isLoadingNewTrack = useMemo(() => {
    const isTrackChanging = currentTrack?.id !== prevTrackIdRef.current;
    if (currentTrack?.id) {
      prevTrackIdRef.current = currentTrack.id;
    }
    return (trackLoading && isTrackChanging) || playbackState === 'buffering';
  }, [trackLoading, playbackState, currentTrack?.id]);

  const shouldShow = !stateRestoring && !!currentTrack && !isMushafActive;

  const handlePress = useCallback(() => {
    setSheetMode('full');
  }, [setSheetMode]);

  const handlePlayPause = useCallback(async () => {
    if (playbackState === 'playing') {
      await pause();
    } else {
      await play();
    }
  }, [playbackState, pause, play]);

  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      bottom: getFloatingPlayerBottomPosition(insets.bottom),
      left: FLOATING_UI_HORIZONTAL_MARGIN,
      right: FLOATING_UI_HORIZONTAL_MARGIN,
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(20),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 8,
    }),
    [theme.colors.text, insets.bottom],
  );

  if (!shouldShow) return null;

  const textColor = Color(theme.colors.text).alpha(0.85).toString();
  const subtitleColor = Color(theme.colors.textSecondary)
    .alpha(0.45)
    .toString();

  return (
    <View style={containerStyle}>
      <Pressable
        onPress={handlePress}
        style={styles.content}
        android_ripple={{color: 'rgba(0, 0, 0, 0.1)', borderless: false}}>
        <ReciterImage
          reciterName={currentTrack.reciterName}
          style={styles.artwork}
        />
        <View style={styles.trackInfo}>
          <Text style={[styles.title, {color: textColor}]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text
            style={[styles.subtitle, {color: subtitleColor}]}
            numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <Pressable
          onPress={handlePlayPause}
          style={styles.playButton}
          hitSlop={10}>
          {isLoadingNewTrack ? (
            <LoadingIndicator color={theme.colors.text} />
          ) : playbackState === 'playing' ? (
            <PauseIcon color={theme.colors.text} size={moderateScale(22)} />
          ) : (
            <PlayIcon color={theme.colors.text} size={moderateScale(22)} />
          )}
        </Pressable>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    gap: moderateScale(12),
  },
  artwork: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(10),
    overflow: 'hidden',
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: moderateScale(2),
  },
  title: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-SemiBold',
  },
  subtitle: {
    fontSize: moderateScale(11),
    fontFamily: 'Manrope-Medium',
  },
  playButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
```

**Step 2: Run type check and format**

Run: `npx tsc --noEmit && npx prettier --write components/player/v2/FloatingPlayer/index.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add components/player/v2/FloatingPlayer/index.tsx
git commit -m "feat: redesign FloatingPlayer with artwork-forward layout"
```

---

### Task 4: Render FloatingPlayer in Android tabs layout

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Import and render FloatingPlayer in AndroidTabs**

The FloatingPlayer is absolutely positioned, so it needs to be rendered alongside the Tabs component inside a wrapper View. The Tabs component must still be rendered normally (it controls routing), but we wrap everything so the FloatingPlayer can overlay.

In `app/(tabs)/_layout.tsx`, update the `AndroidTabs` function:

```typescript
import {FloatingPlayer} from '@/components/player/v2/FloatingPlayer';

function AndroidTabs() {
  return (
    <View style={{flex: 1}}>
      <Tabs
        initialRouteName="(a.home)"
        screenOptions={{headerShown: false, lazy: true}}
        tabBar={tabBarComponent}>
        <Tabs.Screen name="(a.home)" options={{title: 'Home'}} />
        <Tabs.Screen name="(b.search)" options={{title: 'Search'}} />
        <Tabs.Screen name="(c.collection)" options={{title: 'Collection'}} />
        <Tabs.Screen name="(d.settings)" options={{title: 'Settings'}} />
      </Tabs>
      <FloatingPlayer />
    </View>
  );
}
```

Also add `View` to the React Native import if not already there.

**Step 2: Adjust tab bar style to be transparent**

Since BottomTabBar is now absolutely positioned, the Tabs component's built-in tab bar area still occupies space. The `tabBar` prop renders our custom component, and since our component is `position: absolute`, the Tabs container should allocate no space for the tab bar. Add `tabBarStyle: {height: 0, overflow: 'hidden'}` to screenOptions:

```typescript
screenOptions={{
  headerShown: false,
  lazy: true,
  tabBarStyle: {position: 'absolute', height: 0, overflow: 'hidden', borderTopWidth: 0},
}}
```

This ensures the native tab bar container doesn't take up space since our custom one is absolutely positioned.

**Step 3: Run type check and format**

Run: `npx tsc --noEmit && npx prettier --write "app/(tabs)/_layout.tsx"`
Expected: No errors

**Step 4: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat: render FloatingPlayer in Android tabs layout"
```

---

### Task 5: Verify and adjust — visual check & cleanup

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Format all changed files**

Run: `npx prettier --write utils/constants.ts components/BottomTabBar.tsx components/player/v2/FloatingPlayer/index.tsx "app/(tabs)/_layout.tsx"`

**Step 3: Delete PlayButton.tsx if no longer imported**

The FloatingPlayer no longer imports `PlayButton` — it renders `PlayIcon`/`PauseIcon` directly (matching MiniPlayer pattern). Check if `PlayButton.tsx` is imported anywhere else:

Run: `grep -r "PlayButton" --include="*.tsx" --include="*.ts" -l`

If only used by old FloatingPlayer, delete: `components/player/v2/FloatingPlayer/PlayButton.tsx`

**Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore: cleanup unused PlayButton, format files"
```
