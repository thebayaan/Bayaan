// "Now playing" pill under the header: shown while the playing row of this
// list is scrolled away, pointing toward it.
import React, {useEffect} from 'react';
import {Pressable, Text} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from '@/utils/scale';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {PlayingBars} from './PlayingBars';

const FADE_MS = 150;

export function jumpPillDirection(
  visible: readonly number[],
  target: number | null,
): 'up' | 'down' | null {
  if (target === null || visible.length === 0 || visible.includes(target)) {
    return null;
  }
  return target < Math.min(...visible) ? 'up' : 'down';
}

// Row indices of the viewable tokens. Section headers and footers report
// index null and are not rows, so they are dropped. A token holding several
// cards (the iPad's paired rows) gives one index per card.
export function visibleRowIndices<T extends {index: number | null}>(
  tokens: readonly T[],
  toRowIndex: (token: T) => number | readonly number[] | undefined,
): number[] {
  return tokens
    .filter(v => v.index !== null)
    .flatMap(toRowIndex)
    .filter((i): i is number => typeof i === 'number');
}

export function AdhkarJumpPill({
  direction,
  playing,
  top,
  onPress,
}: {
  direction: 'up' | 'down' | null;
  playing: boolean;
  top: number;
  onPress: () => void;
}): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  useEffect(() => {
    const to = direction ? 1 : 0;
    opacity.value = reduceMotion ? to : withTiming(to, {duration: FADE_MS});
  }, [direction, reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({opacity: opacity.value}));

  return (
    <Animated.View
      pointerEvents={direction ? 'auto' : 'none'}
      style={[
        {position: 'absolute', top, alignSelf: 'center', zIndex: 10},
        style,
      ]}>
      <Pressable
        testID="adhkar-jump-pill"
        accessibilityRole="button"
        accessibilityLabel={t('adhkar.jumpToPlaying')}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: moderateScale(8),
          paddingHorizontal: moderateScale(14),
          height: moderateScale(34),
          borderRadius: moderateScale(17),
          backgroundColor: theme.colors.background,
          borderWidth: 1,
          borderColor: Color(theme.colors.text).alpha(0.12).toString(),
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: {width: 0, height: 2},
          elevation: 3,
        }}>
        <PlayingBars
          animating={playing}
          color={theme.colors.textSecondary}
          size={moderateScale(11)}
        />
        <Text
          style={{
            fontFamily: theme.fonts.semiBold,
            fontSize: moderateScale(13),
            color: theme.colors.text,
          }}>
          {t('adhkar.jumpToPlaying')}
        </Text>
        <Feather
          name={direction === 'up' ? 'arrow-up' : 'arrow-down'}
          size={moderateScale(14)}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );
}
