// @ai-generated
import type {ReactElement, ReactNode} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';

export interface NativePopoverProps {
  /** Shown while true; the trigger's own press sets it. */
  isPresented: boolean;
  /** Called when the system dismisses the popover (tap outside, Escape). */
  onDismiss: () => void;
  /** React Native content drawn inside the popover. */
  content: ReactNode;
  /** The content's width in points; its height follows the content. */
  contentWidth: number;
  /** A fixed height for content that scrolls; otherwise it sizes itself. */
  contentHeight?: number;
  /** The edge the arrow points from. Defaults to letting the system pick. */
  arrowEdge?: 'leading' | 'trailing' | 'top' | 'bottom' | 'none';
  style?: StyleProp<ViewStyle>;
  /** The trigger the popover points at. It stays interactive. */
  children: ReactElement;
}
