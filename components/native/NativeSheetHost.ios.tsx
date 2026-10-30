// @ai-generated
import React, {useEffect, useMemo, useSyncExternalStore} from 'react';
import {StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import {BottomSheet, Group, Host, RNHostView} from '@expo/ui/swift-ui';
import {
  ignoreSafeArea,
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
 * Sheet content runs under the home indicator, to the screen's bottom edge,
 * so the indicator is the only inset: scroll content ends with it, sticky
 * footers clear it. The top and sides are the sheet's own.
 */
const SHEET_INSETS = {
  top: 0,
  left: 0,
  right: 0,
  bottom: initialWindowMetrics?.insets.bottom ?? 0,
};

/**
 * One sheet level: a SwiftUI sheet with its detents (medium and large
 * unless the sheet asks otherwise), the system grabber, and a dimmed page
 * behind that closes the sheet when tapped. On iOS 26 it is the system's
 * Liquid Glass. The level above is rendered inside this one's content, so
 * SwiftUI presents it from this sheet (a sheet on a sheet).
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
  const key = level?.key;
  const id = level?.id;
  const fit = level?.fit;
  const info = useMemo(
    () =>
      key === undefined || id === undefined
        ? null
        : {key, id, fit: fit ?? false},
    [key, id, fit],
  );
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
              presentationDetents(level.detents),
              presentationDragIndicator('visible'),
              // Without this the content stops above the home indicator and
              // leaves a blank band at the bottom of every sheet.
              ignoreSafeArea({regions: 'container', edges: 'bottom'}),
            ]}>
            <RNHostView>
              {/* Inside the sheet the content sits outside the app's
                  gesture root, so it gets its own. */}
              <GestureHandlerRootView style={styles.content}>
                <SafeAreaInsetsContext.Provider value={SHEET_INSETS}>
                  <NativeSheetLevelContext.Provider value={info}>
                    {level.content}
                  </NativeSheetLevelContext.Provider>
                </SafeAreaInsetsContext.Provider>
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
