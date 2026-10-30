// @ai-generated
import React, {useEffect, useState, type ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheet, Group, Host, RNHostView} from '@expo/ui/swift-ui';
import {
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import {notifyNativeSheetDismissed, setNativeSheetHost} from './nativeSheets';
import {useNativeTheme} from './useNativeTheme';

/**
 * Presents `presentNativeSheet` content as a SwiftUI sheet: medium and large
 * detents, the system grabber, and the page behind kept interactive up to
 * the medium detent so the selected verse stays visible and tappable. On
 * iOS 26 the sheet is the system's Liquid Glass. The React Native content
 * gets its own gesture root, because inside the sheet it sits outside the
 * app's. Mounted once at the root.
 */
export function NativeSheetHost() {
  const [content, setContent] = useState<ReactNode>(null);
  const [isPresented, setIsPresented] = useState(false);
  const native = useNativeTheme();

  useEffect(
    () =>
      setNativeSheetHost({
        present: next => {
          setContent(next);
          setIsPresented(true);
        },
        dismiss: () => setIsPresented(false),
      }),
    [],
  );

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <Host
        style={styles.host}
        colorScheme={native.colorScheme}
        layoutDirection={native.layoutDirection}>
        <BottomSheet
          isPresented={isPresented}
          onIsPresentedChange={setIsPresented}
          onDismiss={() => {
            setContent(null);
            notifyNativeSheetDismissed();
          }}>
          {/* Presentation modifiers go on the sheet's content. */}
          <Group
            modifiers={[
              presentationDetents(['medium', 'large']),
              presentationDragIndicator('visible'),
              presentationBackgroundInteraction({
                type: 'enabledUpThrough',
                detent: 'medium',
              }),
            ]}>
            <RNHostView>
              <GestureHandlerRootView style={styles.content}>
                {content}
              </GestureHandlerRootView>
            </RNHostView>
          </Group>
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {position: 'absolute', left: 0, bottom: 0, width: 1, height: 1},
  host: {width: 1, height: 1},
  content: {flex: 1},
});
