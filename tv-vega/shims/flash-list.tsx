import React from 'react';
import {
  FlashList as VegaFlashList,
  type FlashListProps,
} from '@amazon-devices/shopify__flash-list';

export * from '@amazon-devices/shopify__flash-list';

/**
 * Vega stand-in for FlashList v2. Amazon's port is FlashList 1.6.3, and the
 * shared screens are written for v2, which sizes cells itself and has no
 * `estimatedItemSize`. Without one, v1 lays out the first frame from a
 * guess (and warns), so grids jump and the preferred-focus cell can land
 * off-screen. The screens already describe their cell height through
 * `overrideItemLayout` (which v2 ignores for size and v1 honours as an
 * estimate), so the first item's answer becomes the estimate here.
 */
function estimateFromLayout<T>(props: FlashListProps<T>): number | undefined {
  const {data, overrideItemLayout, numColumns, extraData} = props;
  if (!overrideItemLayout || !data || data.length === 0) return undefined;
  const layout: {span?: number; size?: number} = {};
  overrideItemLayout(layout, data[0], 0, numColumns ?? 1, extraData);
  return layout.size;
}

function FlashListShim<T>(
  props: FlashListProps<T>,
  ref: React.ForwardedRef<VegaFlashList<T>>,
): React.ReactElement {
  const estimatedItemSize =
    props.estimatedItemSize ?? estimateFromLayout(props);
  // v2's `{disabled: true}` turns off an anchoring v1 never does; passed on,
  // the native ScrollView would read it as v1's {minIndexForVisible}.
  const {maintainVisibleContentPosition, ...rest} = props;
  const anchor =
    maintainVisibleContentPosition &&
    'minIndexForVisible' in maintainVisibleContentPosition
      ? maintainVisibleContentPosition
      : undefined;
  return (
    <VegaFlashList<T>
      {...rest}
      maintainVisibleContentPosition={anchor}
      ref={ref}
      estimatedItemSize={estimatedItemSize}
    />
  );
}

export const FlashList = React.forwardRef(FlashListShim) as <T>(
  props: FlashListProps<T> & {ref?: React.Ref<VegaFlashList<T>>},
) => React.ReactElement;

/** v2's ref type; on v1 the list instance offers the same scroll methods. */
export type FlashListRef<T> = VegaFlashList<T>;
