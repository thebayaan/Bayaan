// @ai-generated
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Button,
  ContextMenu,
  Host,
  Menu,
  RNHostView,
  Section,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel as a11yLabel,
  disabled as disabledModifier,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import {useNativeTheme} from './useNativeTheme';
import {
  isMenuGroup,
  type NativeMenuEntry,
  type NativeMenuItem,
  type NativeMenuProps,
} from './menuTypes';

function renderItem(
  item: NativeMenuItem,
  onSelect: (id: string) => void,
  tintColor: string,
) {
  const modifiers = [];
  if (item.disabled) modifiers.push(disabledModifier(true));
  if (!item.destructive) modifiers.push(tint(tintColor));
  if (item.checked !== undefined) {
    return (
      <Toggle
        key={item.id}
        label={item.title}
        systemImage={item.systemImage}
        isOn={item.checked}
        onIsOnChange={() => onSelect(item.id)}
        modifiers={modifiers}
      />
    );
  }
  return (
    <Button
      key={item.id}
      label={item.title}
      systemImage={item.systemImage}
      role={item.destructive ? 'destructive' : undefined}
      onPress={() => onSelect(item.id)}
      modifiers={modifiers}
    />
  );
}

function renderEntry(
  entry: NativeMenuEntry,
  onSelect: (id: string) => void,
  tintColor: string,
): React.ReactNode {
  if (!isMenuGroup(entry)) return renderItem(entry, onSelect, tintColor);
  const rows = entry.items.map(item => renderItem(item, onSelect, tintColor));
  if (entry.submenu) {
    return (
      <Menu key={entry.id} label={entry.title} systemImage={entry.systemImage}>
        {rows}
      </Menu>
    );
  }
  return (
    <Section key={entry.id} title={entry.title}>
      {rows}
    </Section>
  );
}

/**
 * A SwiftUI menu around a React Native trigger. A tap opens `Menu`; a long
 * press (or a secondary click with a pointer) opens `ContextMenu`, which also
 * lifts the trigger out as its preview. iPadOS anchors and sizes both, so
 * they work in any window size without our own placement maths.
 */
export function NativeMenu({
  entries,
  onSelect,
  title,
  trigger = 'tap',
  layout = trigger === 'tap' ? 'wrap' : 'row',
  accessibilityLabel,
  style,
  testID,
  children,
}: NativeMenuProps) {
  const native = useNativeTheme();
  const rows = entries.map(entry => renderEntry(entry, onSelect, native.tint));
  const body = title ? <Section title={title}>{rows}</Section> : rows;
  // A tap menu owns the touch and the VoiceOver element, so its React Native
  // trigger is only drawn. A context menu keeps its trigger live: the row
  // still plays on tap, and the menu takes over on a long press or a
  // secondary click.
  const matchContents =
    layout === 'wrap' ? true : layout === 'row' ? {vertical: true} : false;
  const label = (
    <RNHostView matchContents={matchContents} boundedByHost>
      {trigger === 'tap' ? (
        <View
          pointerEvents="none"
          style={layout === 'overlay' ? StyleSheet.absoluteFill : undefined}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {children}
        </View>
      ) : (
        <View>{children}</View>
      )}
    </RNHostView>
  );
  const modifiers = accessibilityLabel ? [a11yLabel(accessibilityLabel)] : [];

  return (
    <Host
      matchContents={matchContents}
      style={layout === 'overlay' ? [StyleSheet.absoluteFill, style] : style}
      testID={testID}
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}
      ignoreSafeArea="all">
      {trigger === 'longPress' ? (
        <ContextMenu modifiers={modifiers}>
          <ContextMenu.Trigger>{label}</ContextMenu.Trigger>
          <ContextMenu.Items>{body}</ContextMenu.Items>
        </ContextMenu>
      ) : (
        <Menu label={label} modifiers={modifiers}>
          {body}
        </Menu>
      )}
    </Host>
  );
}
