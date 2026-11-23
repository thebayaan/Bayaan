// @ai-generated
import React, {type ReactNode} from 'react';
import {Platform, View, type StyleProp, type ViewStyle} from 'react-native';
import {NativeMenu} from '@/components/native/NativeMenu';
import {
  nativeMenusAvailable,
  rowContextMenusEnabled,
} from '@/components/native/nativeMenus';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {useResponsive} from '@/hooks/useResponsive';

export type MenuTrigger = 'tap' | 'longPress';

/**
 * Whether an options sheet shows as a native menu here instead.
 *
 * Tablets only: phones keep their bottom sheets. A tap on ••• opens the menu
 * on iPad and Android tablets. A long press (or secondary click) opens it on
 * iPad only; Android tablets keep long-press opening the sheet's menu card,
 * because Compose has no context-menu gesture to hand it to.
 */
export function useNativeOptionsMenu(trigger: MenuTrigger = 'tap'): boolean {
  const {isTablet} = useResponsive();
  if (!nativeMenusAvailable || !isTablet) return false;
  if (trigger === 'tap') return true;
  return Platform.OS === 'ios' && rowContextMenusEnabled;
}

export interface OptionsMenuModel {
  title?: string;
  entries: NativeMenuEntry[];
  onSelect: (id: string) => void;
}

export interface OptionsMenuProps {
  /** `tap` wraps a ••• button; `longPress` wraps the whole row or card. */
  trigger?: MenuTrigger;
  /** See `NativeMenuProps.layout`. */
  layout?: 'wrap' | 'overlay' | 'row';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** The trigger. Overlay menus that sit over an existing button can omit it. */
  children?: ReactNode;
}

/** Renders a built menu model around its trigger. */
export function OptionsMenuView({
  model,
  trigger = 'tap',
  layout,
  accessibilityLabel,
  style,
  children,
}: OptionsMenuProps & {model: OptionsMenuModel}) {
  return (
    <NativeMenu
      title={model.title}
      entries={model.entries}
      onSelect={model.onSelect}
      trigger={trigger}
      layout={layout}
      accessibilityLabel={accessibilityLabel}
      style={style}>
      {children ?? <View />}
    </NativeMenu>
  );
}
