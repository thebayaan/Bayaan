// @ai-generated
import React, {useEffect, useState} from 'react';
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import {
  Button,
  ConfirmationDialog,
  Host,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import {
  runConfirmed,
  setConfirmationListener,
  type PendingConfirmation,
} from '@/utils/confirmDestructive';
import {useNativeTheme} from './useNativeTheme';

/**
 * Shows `confirmDestructive` prompts as a SwiftUI confirmation dialog. On
 * iPhone it rises as an action sheet. A regular-width iPad window presents
 * it as a popover, so the host moves to the touch that asked for it and the
 * arrow points at that button. Mounted once at the root.
 */
export function ConfirmationDialogHost() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [presented, setPresented] = useState(false);
  const {width, height} = useWindowDimensions();
  const native = useNativeTheme();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    return setConfirmationListener(next => {
      setPending(next);
      setPresented(!!next);
    });
  }, []);

  if (!pending) return null;
  const anchor = pending.anchor ?? {x: width / 2, y: height / 2};

  const close = () => setPresented(false);

  return (
    <View
      pointerEvents="none"
      style={[styles.anchor, {left: anchor.x, top: anchor.y}]}>
      <Host
        style={styles.host}
        colorScheme={native.colorScheme}
        layoutDirection={native.layoutDirection}>
        <ConfirmationDialog
          title={pending.title}
          titleVisibility="visible"
          isPresented={presented}
          onIsPresentedChange={isPresented => {
            setPresented(isPresented);
            if (!isPresented) setPending(null);
          }}>
          <ConfirmationDialog.Trigger>
            <SwiftText> </SwiftText>
          </ConfirmationDialog.Trigger>
          <ConfirmationDialog.Actions>
            <Button
              label={pending.confirmText}
              role="destructive"
              onPress={() => {
                close();
                runConfirmed(pending);
              }}
            />
            <Button label={pending.cancelText} role="cancel" onPress={close} />
          </ConfirmationDialog.Actions>
          <ConfirmationDialog.Message>
            <SwiftText>{pending.message}</SwiftText>
          </ConfirmationDialog.Message>
        </ConfirmationDialog>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
  host: {
    width: 1,
    height: 1,
  },
});
