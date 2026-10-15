// @ai-generated
import {useCallback} from 'react';
import {type ScrollViewProps} from 'react-native';
import {useBottomSheetScrollableCreator} from '@gorhom/bottom-sheet';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';

/**
 * Gorhom locks vertical scrollables with scrollTo(ref, 0, y). Fabric converts
 * that x coordinate in RTL, which can trigger another scroll event and lock
 * recursively while the player is closed. Keep only the native viewport LTR;
 * its content still inherits the selected language's direction.
 */
export function usePlayerScrollable() {
  const createScrollable = useBottomSheetScrollableCreator<ScrollViewProps>();

  return useCallback(
    (props: ScrollViewProps, ref?: never) =>
      createScrollable(
        {
          ...props,
          style: [props.style, forceLTR],
          contentContainerStyle: [
            props.contentContainerStyle,
            appLayoutDirection,
          ],
        },
        ref,
      ),
    [createScrollable],
  );
}
