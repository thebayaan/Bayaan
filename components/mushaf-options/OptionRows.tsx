// @ai-generated
import React from 'react';
import {Pressable, Text, View} from 'react-native';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import {Feather} from '@expo/vector-icons';
import {NativeSwitch} from '@/components/native/NativeSwitch';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {flipX, isRTL} from '@/utils/rtl';
import {textAlpha, useOptionStyles} from './optionStyles';
import {useChevronTurn} from './motion';

/** A row with a title, an optional subtitle and a switch. */
export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  testID,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}): React.JSX.Element {
  const styles = useOptionStyles();
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <NativeSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        testID={testID}
      />
    </View>
  );
}

export function Separator(): React.JSX.Element {
  const styles = useOptionStyles();
  return <View style={styles.separator} />;
}

/** A chevron for a row that pushes a screen, or one that folds open. */
export function Chevron({
  open,
  size = moderateScale(16),
}: {
  /** Turns a quarter turn when true; omitted for a push row. */
  open?: boolean;
  size?: number;
}): React.JSX.Element {
  const {theme} = useTheme();
  const turn = useChevronTurn(open ?? false);
  // The mirrored chevron turns the other way so it still ends pointing down.
  const quarter = isRTL ? -90 : 90;
  const rotate = useAnimatedStyle(() => ({
    transform: [{rotate: `${turn.value * quarter}deg`}],
  }));
  return (
    <Animated.View style={rotate}>
      <Feather
        name="chevron-right"
        size={size}
        color={textAlpha(theme, 0.4)}
        style={flipX}
      />
    </Animated.View>
  );
}

/**
 * The header of a folded card: its title, a live summary of what is on,
 * and a chevron. Reports its expanded state.
 */
export function FoldHeader({
  title,
  summary,
  open,
  onPress,
  testID,
}: {
  title: string;
  summary: string;
  open: boolean;
  onPress: () => void;
  testID?: string;
}): React.JSX.Element {
  const styles = useOptionStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityValue={{text: summary}}
      accessibilityState={{expanded: open}}
      testID={testID}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Chevron open={open} />
    </Pressable>
  );
}
