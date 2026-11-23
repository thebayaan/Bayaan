// @ai-generated
import type {ReactNode} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import type {SFSymbol} from 'sf-symbols-typescript';

/** One row of a native menu. */
export interface NativeMenuItem {
  id: string;
  title: string;
  /** SF Symbol shown on iOS. Android menus are text only. */
  systemImage?: SFSymbol;
  /** Shows a checkmark: the current choice in a pick-one menu. */
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

/** A titled group of rows; `submenu` nests it behind its own row instead. */
export interface NativeMenuGroup {
  id: string;
  title?: string;
  items: NativeMenuItem[];
  submenu?: boolean;
  systemImage?: SFSymbol;
}

export type NativeMenuEntry = NativeMenuItem | NativeMenuGroup;

export function isMenuGroup(entry: NativeMenuEntry): entry is NativeMenuGroup {
  return 'items' in entry;
}

export interface NativeMenuProps {
  entries: NativeMenuEntry[];
  onSelect: (id: string) => void;
  /** Header shown above the rows on iOS. */
  title?: string;
  /** `tap` for a ••• or tool button, `longPress` for a row's context menu. */
  trigger?: 'tap' | 'longPress';
  /**
   * How the menu's host sits in the layout:
   * - `wrap` (default for `tap`): sized by the trigger it wraps.
   * - `overlay`: fills its parent (`absoluteFill`) over a button that draws
   *   itself, so the whole button area opens the menu with no layout change.
   * - `row` (default for `longPress`): width from `style` (usually
   *   `flex: 1`), height from the wrapped row.
   */
  layout?: 'wrap' | 'overlay' | 'row';
  /** Read by VoiceOver for the trigger, which hides the child's own label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** The visible trigger. It must not handle presses itself. */
  children: ReactNode;
}
