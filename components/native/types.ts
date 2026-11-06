// @ai-generated
import type {StyleProp, ViewStyle} from 'react-native';

export interface NativeSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Applied to the host view; the switch keeps its native size inside it. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface NativeSliderProps {
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  /** 0 or omitted means continuous. */
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number) => void;
  /** The finger went down on the slider. */
  onSlidingStart?: () => void;
  /** The finger lifted; receives the last value. */
  onSlidingComplete?: (value: number) => void;
  /**
   * Hide the thumb unless the user is dragging (the player scrubber look).
   * Honored on Android only: SwiftUI's slider in Expo UI always draws it.
   */
  thumbOnlyWhileSliding?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
