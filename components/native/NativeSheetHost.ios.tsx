// @ai-generated
import React, {useEffect, useSyncExternalStore} from 'react';
import {StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheet, Group, Host, RNHostView} from '@expo/ui/swift-ui';
import {
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import {
  getNativeSheetLevels,
  notifyNativeSheetClosing,
  notifyNativeSheetDismissed,
  setNativeSheetHostMounted,
  subscribeNativeSheets,
  type NativeSheetLevel,
} from './nativeSheets';
import {NativeSheetLevelContext} from './nativeSheetContext';
import {useNativeTheme} from './useNativeTheme';

/**
 * One sheet level: a SwiftUI sheet with medium and large detents, the
 * system grabber, and the page behind kept interactive up to the medium
 * detent so a selected verse stays visible and tappable. On iOS 26 it is the
 * system's Liquid Glass. The level above is rendered inside this one's
 * content, so SwiftUI presents it from this sheet (a sheet on a sheet).
 */
function SheetLevel({
  levels,
  index,
}: {
  levels: NativeSheetLevel[];
  index: number;
}) {
  const native = useNativeTheme();
  const level = levels[index];
  if (!level) return null;

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <Host
        style={styles.host}
        colorScheme={native.colorScheme}
        layoutDirection={native.layoutDirection}>
        <BottomSheet
          isPresented={level.presented}
          onIsPresentedChange={isPresented => {
            if (!isPresented) notifyNativeSheetClosing(level.key);
          }}
          onDismiss={() => notifyNativeSheetDismissed(level.key)}>
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
              {/* Inside the sheet the content sits outside the app's
                  gesture root, so it gets its own. */}
              <GestureHandlerRootView style={styles.content}>
                <NativeSheetLevelContext.Provider value={level.id}>
                  {level.content}
                </NativeSheetLevelContext.Provider>
                <SheetLevel levels={levels} index={index + 1} />
              </GestureHandlerRootView>
            </RNHostView>
          </Group>
        </BottomSheet>
      </Host>
    </View>
  );
}

/** Presents `nativeSheets` levels. Mounted once at the root. */
export function NativeSheetHost() {
  const levels = useSyncExternalStore(
    subscribeNativeSheets,
    getNativeSheetLevels,
  );

  useEffect(() => {
    setNativeSheetHostMounted(true);
    return () => setNativeSheetHostMounted(false);
  }, []);

  return <SheetLevel levels={levels} index={0} />;
}

const styles = StyleSheet.create({
  anchor: {position: 'absolute', left: 0, bottom: 0, width: 1, height: 1},
  host: {width: 1, height: 1},
  content: {flex: 1},
});
