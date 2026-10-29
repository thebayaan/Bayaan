import React, {useContext} from 'react';
import {StyleProp, Text, TextProps, View, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {scale} from '../../theme/scale';

/** Whether the nearest FocusableButton / FocusableCard above is focused. */
export const FocusedContext = React.createContext(false);

export function useButtonFocused(): boolean {
  return useContext(FocusedContext);
}

/**
 * Colour for content inside a FocusableButton: `rest` normally, ink while the
 * button is focused (its cream fill is behind it).
 */
export function useFocusTint(
  rest: string = colors.text,
  focused: string = colors.onFocus,
): string {
  return useButtonFocused() ? focused : rest;
}

type FocusTextProps = TextProps & {
  /** Colour at rest; ink is used while the button is focused. */
  color?: string;
  /** Colour while focused, for secondary text (defaults to ink). */
  focusedColor?: string;
};

/** Text that turns ink when its FocusableButton is focused. */
export function FocusText({
  color = colors.text,
  focusedColor = colors.onFocus,
  style,
  ...rest
}: FocusTextProps): React.ReactElement {
  const tint = useFocusTint(color, focusedColor);
  return <Text {...rest} style={[style, {color: tint}]} />;
}

type IconLike = React.ComponentType<{
  color: string;
  size: number;
  filled?: boolean;
}>;

/** An icon that turns ink when its FocusableButton is focused. */
export function FocusIcon({
  icon: Icon,
  size,
  color = colors.text,
  filled,
}: {
  icon: IconLike;
  /** Size in design pixels. */
  size: number;
  color?: string;
  filled?: boolean;
}): React.ReactElement {
  return (
    <Icon color={useFocusTint(color)} size={scale(size)} filled={filled} />
  );
}

type FrameProps = {
  children: React.ReactNode;
  /** Corner radius of the artwork inside, in design pixels. */
  radius: number;
  style?: StyleProp<ViewStyle>;
};

/** Ring width and the ink gap between ring and artwork, in design pixels. */
const RING = 4;
const GAP = 5;

/**
 * The artwork half of the focus treatment: a cream ring set a little off the
 * artwork (an ink gap between), drawn when the card around it is focused.
 * Space for the ring is always reserved so focus never shifts the layout.
 */
export function FocusFrame({
  children,
  radius,
  style,
}: FrameProps): React.ReactElement {
  const focused = useButtonFocused();
  return (
    <View
      style={[
        {
          padding: scale(GAP),
          borderWidth: scale(RING),
          borderRadius: scale(radius + GAP + RING),
          borderColor: focused ? colors.focusRing : 'transparent',
        },
        style,
      ]}>
      <View style={{borderRadius: scale(radius), overflow: 'hidden', flex: 1}}>
        {children}
      </View>
    </View>
  );
}
