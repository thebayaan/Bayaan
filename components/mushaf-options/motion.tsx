// @ai-generated
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {runOnJS} from 'react-native-worklets';

/**
 * Motion shared by the Reading sheet. Everything runs on the UI thread:
 * loops are Reanimated clocks read by animated styles, so they cost no JS
 * frames. Loops stop when the sheet's content unmounts (the sheet or
 * popover closed), while a sub-screen covers the tiles, and under Reduce
 * Motion, where the sheet also uses plain fades.
 */

/** The prototype's ease-out for sheet growth, accordions and pushes. */
export const EASE_OUT = Easing.bezier(0.2, 0.9, 0.25, 1);
export const ACCORDION_MS = 380;
export const PUSH_MS = 420;
export const FADE_MS = 250;

/** False while the looping tiles are hidden (a sub-screen is pushed). */
export const LoopsActiveContext = createContext(true);

/** Whether the tiles' loops should run now. */
export function useLoopsRunning(): boolean {
  const active = useContext(LoopsActiveContext);
  const reduceMotion = useReducedMotion();
  return active && !reduceMotion;
}

/**
 * A 0 to 1 clock that repeats every `durationMs` while `running`, frozen at
 * 0 otherwise. Animated styles derive each tile's frame from it.
 */
export function useLoopClock(
  durationMs: number,
  running: boolean,
): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!running) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, {duration: durationMs, easing: Easing.linear}),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [clock, durationMs, running]);
  return clock;
}

/**
 * Scale for a selection ring: a small spring from 0.92 each time it becomes
 * selected (none under Reduce Motion).
 */
export function useSelectionPop(selected: boolean): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const wasSelected = useRef(selected);
  useEffect(() => {
    const popped = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (!popped || reduceMotion) return;
    scale.value = 0.92;
    scale.value = withSpring(1, {damping: 9, stiffness: 260, mass: 0.6});
  }, [selected, reduceMotion, scale]);
  return scale;
}

/**
 * Content that folds open and shut by animating its height, with a fade.
 * Its children mount on the first open and unmount once it has closed, so
 * a closed card costs nothing. Under Reduce Motion the height snaps and
 * only the fade remains.
 */
export function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const measured = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);
  const fade = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (open) setMounted(true);
    if (reduceMotion) {
      // Plain fades: the height snaps open, or snaps shut once faded out.
      if (open) progress.value = 1;
      fade.value = withTiming(open ? 1 : 0, {duration: FADE_MS}, finished => {
        if (!finished || open) return;
        progress.value = 0;
        runOnJS(setMounted)(false);
      });
      return;
    }
    progress.value = withTiming(
      open ? 1 : 0,
      {duration: ACCORDION_MS, easing: EASE_OUT},
      finished => {
        if (finished && !open) runOnJS(setMounted)(false);
      },
    );
    // The content fades in a little after the card starts to open.
    fade.value = withTiming(open ? 1 : 0, {
      duration: open ? FADE_MS + 100 : FADE_MS,
    });
  }, [open, reduceMotion, progress, fade]);

  const outer = useAnimatedStyle(() => ({
    height: measured.value * progress.value,
  }));
  const inner = useAnimatedStyle(() => ({opacity: fade.value}));

  const onLayout = (event: LayoutChangeEvent): void => {
    measured.value = event.nativeEvent.layout.height;
  };

  return (
    <Animated.View style={[{overflow: 'hidden'}, outer]}>
      {mounted ? (
        <Animated.View
          style={[{position: 'absolute', top: 0, left: 0, right: 0}, inner]}>
          <View onLayout={onLayout}>{children}</View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** A chevron that turns a quarter turn while its card is open. */
export function useChevronTurn(open: boolean): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, {
      duration: reduceMotion ? 0 : 300,
      easing: EASE_OUT,
    });
  }, [open, reduceMotion, turn]);
  return turn;
}

/**
 * Fades its content in when it mounts, rising a few points (only fading
 * under Reduce Motion). Key it to replay on a change.
 */
export function FadeInView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(1, {duration: FADE_MS + 100, easing: EASE_OUT});
  }, [shown]);
  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{translateY: reduceMotion ? 0 : (1 - shown.value) * 8}],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export const THEME_FADE_MS = 450;

/**
 * Cross-fades a surface when the theme changes: a layer in the previous
 * background sits over the new colors and fades away. Draws nothing until
 * the color changes.
 */
export function ThemeCrossfade({
  color,
}: {
  color: string;
}): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const [previous, setPrevious] = useState<string | null>(null);
  const shown = useRef(color);
  const cover = useSharedValue(0);
  useEffect(() => {
    if (shown.current === color) return;
    setPrevious(shown.current);
    shown.current = color;
    cover.value = 1;
    cover.value = withTiming(
      0,
      {duration: reduceMotion ? FADE_MS : THEME_FADE_MS},
      finished => {
        if (finished) runOnJS(setPrevious)(null);
      },
    );
  }, [color, reduceMotion, cover]);
  const animated = useAnimatedStyle(() => ({opacity: cover.value}));
  if (previous === null) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
        {backgroundColor: previous},
        animated,
      ]}
    />
  );
}
