// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {useSelectionPop} from './motion';

/**
 * A picture tile: a framed illustration with its name under it, picked as
 * one of a radio group. The selected tile gets a ring that pops in with a
 * small spring.
 */
export function PictureTile({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityHint,
  testID,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pop = useSelectionPop(selected);
  const ring = useAnimatedStyle(() => ({transform: [{scale: pop.value}]}));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.tile, disabled && styles.disabled]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{checked: selected, disabled}}
      testID={testID}>
      {({pressed}) => (
        <>
          <Animated.View
            style={[styles.ring, selected && styles.ringSelected, ring]}>
            <View style={[styles.mock, pressed && styles.mockPressed]}>
              {children}
            </View>
          </Animated.View>
          <Text
            style={[styles.label, selected && styles.labelSelected]}
            numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  const text = Color(theme.colors.text);
  return StyleSheet.create({
    tile: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: moderateScale(6),
    },
    disabled: {
      opacity: 0.42,
    },
    ring: {
      width: '100%',
      aspectRatio: 1.3,
      borderRadius: moderateScale(20),
      padding: moderateScale(3),
      borderWidth: 3,
      borderColor: 'transparent',
    },
    ringSelected: {
      borderColor: theme.colors.text,
    },
    mock: {
      flex: 1,
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: text.alpha(0.16).toString(),
      backgroundColor: Color(theme.colors.background)
        .mix(text, 0.04)
        .toString(),
      alignItems: 'center',
      justifyContent: 'center',
    },
    mockPressed: {
      backgroundColor: text.alpha(0.06).toString(),
    },
    label: {
      fontSize: theme.typography.smallSize,
      fontFamily: 'Manrope-Medium',
      color: text.alpha(0.55).toString(),
    },
    labelSelected: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
}
