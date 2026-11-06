// @ai-generated
import React, {useCallback, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Host,
  RNHostView,
  Text,
} from '@expo/ui/jetpack-compose';
import {useNativeTheme} from './useNativeTheme';
import {
  isMenuGroup,
  type NativeMenuEntry,
  type NativeMenuItem,
  type NativeMenuProps,
} from './menuTypes';

// Clipped popups lose the status bar offset near the bottom of an
// edge-to-edge window (same setting as Expo UI's MenuView).
const POPUP_PROPERTIES = {clippingEnabled: false};

function Item({
  item,
  onSelect,
  close,
  errorColor,
}: {
  item: NativeMenuItem;
  onSelect: (id: string) => void;
  close: () => void;
  errorColor: string;
}) {
  const colors = item.destructive
    ? {textColor: errorColor, disabledTextColor: errorColor}
    : undefined;
  return (
    <DropdownMenuItem
      enabled={!item.disabled}
      elementColors={colors}
      onClick={() => {
        close();
        onSelect(item.id);
      }}>
      <DropdownMenuItem.Text>
        <Text>{item.title}</Text>
      </DropdownMenuItem.Text>
      {item.checked ? (
        <DropdownMenuItem.TrailingIcon>
          <Text>✓</Text>
        </DropdownMenuItem.TrailingIcon>
      ) : null}
    </DropdownMenuItem>
  );
}

function renderEntries(
  entries: NativeMenuEntry[],
  onSelect: (id: string) => void,
  close: () => void,
  errorColor: string,
) {
  return entries.map((entry, index) => {
    if (!isMenuGroup(entry)) {
      return (
        <Item
          key={entry.id}
          item={entry}
          onSelect={onSelect}
          close={close}
          errorColor={errorColor}
        />
      );
    }
    // Material menus have no sections or titled submenus here, so a group
    // becomes its rows between dividers.
    return (
      <React.Fragment key={entry.id}>
        {index > 0 ? <HorizontalDivider /> : null}
        {entry.items.map(item => (
          <Item
            key={item.id}
            item={item}
            onSelect={onSelect}
            close={close}
            errorColor={errorColor}
          />
        ))}
        {index < entries.length - 1 ? <HorizontalDivider /> : null}
      </React.Fragment>
    );
  });
}

/**
 * A Material 3 dropdown menu anchored to a React Native trigger. A tap (or a
 * long press for `trigger="longPress"`) opens it.
 */
export function NativeMenu({
  entries,
  onSelect,
  trigger = 'tap',
  layout = trigger === 'tap' ? 'wrap' : 'row',
  accessibilityLabel,
  style,
  testID,
  children,
}: NativeMenuProps) {
  const native = useNativeTheme();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const open = useCallback(() => {
    if (expandedRef.current) return;
    expandedRef.current = true;
    setExpanded(true);
  }, []);
  const close = useCallback(() => {
    expandedRef.current = false;
    setExpanded(false);
  }, []);

  const matchContents =
    layout === 'wrap' ? true : layout === 'row' ? {vertical: true} : false;
  const fill = layout === 'overlay' ? StyleSheet.absoluteFill : undefined;

  return (
    <View style={[fill, style]} testID={testID}>
      <Host
        matchContents={matchContents}
        colorScheme={native.colorScheme}
        layoutDirection={native.layoutDirection}
        style={layout === 'wrap' ? undefined : StyleSheet.absoluteFill}>
        <DropdownMenu
          expanded={expanded}
          onDismissRequest={close}
          properties={POPUP_PROPERTIES}>
          <DropdownMenu.Trigger>
            <RNHostView matchContents={matchContents}>
              <Pressable
                style={fill}
                onPress={trigger === 'tap' ? open : undefined}
                onLongPress={trigger === 'longPress' ? open : undefined}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}>
                {/* The menu takes the press, so the trigger only draws. */}
                <View pointerEvents="none" style={fill}>
                  {children}
                </View>
              </Pressable>
            </RNHostView>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {renderEntries(entries, onSelect, close, native.error)}
          </DropdownMenu.Items>
        </DropdownMenu>
      </Host>
    </View>
  );
}
