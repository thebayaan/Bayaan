import React from 'react';
import {moderateScale} from '@/utils/scale';
import {NativeSegmentedControl} from '@/components/native/NativeSegmentedControl';

// @ai-start
interface TabSelectorProps<T extends string> {
  options: T[];
  selectedOption: T;
  onSelect: (option: T) => void;
  width?: number;
  getLabel?: (option: T) => string;
}

/** A segmented control over string options, native on both platforms. */
function TabSelector<T extends string>({
  options,
  selectedOption,
  onSelect,
  width,
  getLabel = option => option,
}: TabSelectorProps<T>) {
  const resolvedWidth = width ?? moderateScale(80 * options.length);
  return (
    <NativeSegmentedControl
      values={options.map(getLabel)}
      selectedIndex={options.indexOf(selectedOption)}
      onChange={index => onSelect(options[index])}
      style={{width: resolvedWidth, minHeight: moderateScale(40)}}
    />
  );
}
// @ai-end

export default TabSelector;
