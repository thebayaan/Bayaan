// @ai-generated
import React from 'react';
import {View} from 'react-native';
import {Group, Host, Popover, RNHostView} from '@expo/ui/swift-ui';
import {presentationBackground} from '@expo/ui/swift-ui/modifiers';
import {useTheme} from '@/hooks/useTheme';
import {useNativeTheme} from './useNativeTheme';
import type {NativePopoverProps} from './popoverTypes';

/**
 * A SwiftUI popover anchored to its trigger, with an arrow, holding React
 * Native content painted in the reading theme. iPad only: in a compact
 * window the system shows it as a sheet.
 */
export function NativePopover({
  isPresented,
  onDismiss,
  content,
  contentWidth,
  contentHeight,
  arrowEdge = 'none',
  style,
  children,
}: NativePopoverProps) {
  const {theme} = useTheme();
  const native = useNativeTheme();
  return (
    <Host
      matchContents
      style={style}
      colorScheme={native.colorScheme}
      layoutDirection={native.layoutDirection}>
      <Popover
        isPresented={isPresented}
        onIsPresentedChange={presented => {
          if (!presented) onDismiss();
        }}
        arrowEdge={arrowEdge}>
        <Popover.Trigger>
          <RNHostView matchContents>{children}</RNHostView>
        </Popover.Trigger>
        <Popover.Content>
          <Group modifiers={[presentationBackground(theme.colors.background)]}>
            <RNHostView matchContents>
              <View
                style={{
                  width: contentWidth,
                  height: contentHeight,
                  backgroundColor: theme.colors.background,
                }}>
                {content}
              </View>
            </RNHostView>
          </Group>
        </Popover.Content>
      </Popover>
    </Host>
  );
}
