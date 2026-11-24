// @ai-generated
import React, {useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';

const LETTER_HEIGHT = moderateScale(14);
const MIN_LETTER_HEIGHT = moderateScale(9);
/**
 * Room the list leaves at its trailing edge while the rail shows, so the
 * panels end before the letters instead of running under them. @ai
 */
export const RAIL_GUTTER = moderateScale(14);
const RAIL_PADDING = moderateScale(6);

/**
 * The A–Z index at the side of a long list. Touching or dragging along it
 * jumps to the letter under the finger, with a light tick per letter and
 * the letter shown large while the finger is down. It stays between
 * `insetTop` and `insetBottom` (the header and the bars over the list), and
 * letters shrink when there are more than fit there, as in Arabic, where
 * the rail carries both the Latin and the Arabic letters.
 */
export function AlphabetRail({
  letters,
  onLetter,
  insetTop = 0,
  insetBottom = 0,
}: {
  letters: readonly string[];
  onLetter: (letter: string) => void;
  insetTop?: number;
  insetBottom?: number;
}) {
  const {theme} = useTheme();
  const [active, setActive] = useState<string | null>(null);
  const [space, setSpace] = useState(0);
  const lastRef = useRef<string | null>(null);
  const letterHeight =
    space > 0
      ? Math.max(
          MIN_LETTER_HEIGHT,
          Math.min(LETTER_HEIGHT, (space - RAIL_PADDING * 2) / letters.length),
        )
      : LETTER_HEIGHT;
  const onHostLayout = (event: LayoutChangeEvent) =>
    setSpace(event.nativeEvent.layout.height);

  const pick = (event: GestureResponderEvent) => {
    // locationY is measured from the view under the finger, so the letters
    // ignore touches and the rail itself is always that view.
    const i = Math.floor(
      (event.nativeEvent.locationY - RAIL_PADDING) / letterHeight,
    );
    const letter = letters[Math.min(letters.length - 1, Math.max(0, i))];
    if (!letter || letter === lastRef.current) return;
    lastRef.current = letter;
    setActive(letter);
    Haptics.selectionAsync().catch(() => undefined);
    onLetter(letter);
  };
  const end = () => {
    lastRef.current = null;
    setActive(null);
  };

  if (letters.length < 2) return null;
  return (
    <View
      style={[styles.host, {top: insetTop, bottom: insetBottom}]}
      onLayout={onHostLayout}
      pointerEvents="box-none">
      <View
        style={styles.rail}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={end}
        onResponderTerminate={end}
        accessibilityRole="adjustable"
        accessibilityLabel={letters.join(' ')}>
        <View pointerEvents="none" style={styles.letters}>
          {letters.map(letter => (
            <Text
              key={letter}
              style={[
                styles.letter,
                {
                  height: letterHeight,
                  lineHeight: letterHeight,
                  fontSize: Math.min(moderateScale(10), letterHeight - 2),
                  color:
                    letter === active
                      ? theme.colors.text
                      : Color(theme.colors.text).alpha(0.5).toString(),
                },
              ]}>
              {letter}
            </Text>
          ))}
        </View>
      </View>
      {active ? (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: theme.isDarkMode
                ? 'rgba(44,50,56,0.94)'
                : 'rgba(255,255,255,0.96)',
            },
          ]}
          pointerEvents="none">
          <Text style={[styles.bubbleText, {color: theme.colors.text}]}>
            {active}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    start: 0,
    end: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rail: {
    paddingHorizontal: moderateScale(3),
    paddingVertical: RAIL_PADDING,
    marginEnd: moderateScale(1),
    alignItems: 'center',
  },
  letters: {alignItems: 'center'},
  letter: {
    fontFamily: 'Manrope-Bold',
    textAlign: 'center',
  },
  bubble: {
    position: 'absolute',
    alignSelf: 'center',
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 6},
  },
  bubbleText: {fontSize: moderateScale(34), fontFamily: 'Manrope-ExtraBold'},
});
