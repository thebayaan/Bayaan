import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

/** How long the hint stays before it fades. */
const HOLD_MS = 4000;
const FADE_MS = 900;

/** The hint's words: what OK, Left/Right and holding OK do here. */
export function hintText(synced: boolean): string {
  return synced
    ? 'OK for controls  ·  Left / Right for a verse  ·  Hold OK to repeat it'
    : 'OK for controls  ·  Left / Right to skip 15 seconds';
}

/**
 * How to drive the room, quiet at the top once the recitation starts,
 * fading away after a few seconds so the verse has the screen.
 */
export function ControlsHint({
  synced,
}: {
  /** Whether the recitation has verse timings (verse steps and repeat). */
  synced: boolean;
}): React.ReactElement {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.Text
      style={[styles.hint, {opacity}]}
      pointerEvents="none"
      accessibilityElementsHidden>
      {hintText(synced)}
    </Animated.Text>
  );
}

const styles = createScaledStyles({
  hint: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
