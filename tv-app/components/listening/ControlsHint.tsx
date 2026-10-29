import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

/** How long the hint stays before it fades. */
const HOLD_MS = 4000;
const FADE_MS = 900;

/**
 * "Press OK for controls", quiet at the top of the listening room when it
 * opens, fading away after a few seconds so the verse has the screen.
 */
export function ControlsHint(): React.ReactElement {
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
      Press OK for controls
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
