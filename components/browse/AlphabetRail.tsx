// @ai-generated
import React, {useRef, useState} from 'react';
import {StyleSheet, Text, View, type GestureResponderEvent} from 'react-native';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';

const LETTER_HEIGHT = moderateScale(14);

/**
 * The A–Z index at the side of a long list. Touching or dragging along it
 * jumps to the letter under the finger, with a light tick per letter and
 * the letter shown large while the finger is down.
 */
export function AlphabetRail({
  letters,
  onLetter,
}: {
  letters: readonly string[];
  onLetter: (letter: string) => void;
}) {
  const {theme} = useTheme();
  const [active, setActive] = useState<string | null>(null);
  const lastRef = useRef<string | null>(null);

  const pick = (event: GestureResponderEvent) => {
    const i = Math.floor(event.nativeEvent.locationY / LETTER_HEIGHT);
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
    <View style={styles.host} pointerEvents="box-none">
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
        {letters.map(letter => (
          <Text
            key={letter}
            style={[
              styles.letter,
              {
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
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rail: {
    paddingHorizontal: moderateScale(3),
    paddingVertical: moderateScale(6),
    marginEnd: moderateScale(1),
    alignItems: 'center',
  },
  letter: {
    height: LETTER_HEIGHT,
    lineHeight: LETTER_HEIGHT,
    fontSize: moderateScale(10),
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
