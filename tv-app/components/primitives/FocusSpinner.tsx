import React from 'react';
import {ActivityIndicator, Platform} from 'react-native';
import {scale} from '../../theme/scale';
import {useFocusTint} from './focusContext';

/** tvOS draws 'small' and 'large' at these sizes, in design pixels. */
const DESIGN_SIZE = {small: 20, large: 37} as const;

/**
 * A spinner inside a focusable button: ink on the cream fill while focused.
 * Android sizes 'small'/'large' in dp, twice the design size at the TV's 0.5
 * scale (the button would grow while loading), so it gets the scaled number;
 * tvOS only knows the two names.
 */
export function FocusSpinner({
  size = 'small',
  color,
}: {
  size?: keyof typeof DESIGN_SIZE;
  color?: string;
}): React.ReactElement {
  return (
    <ActivityIndicator
      size={Platform.OS === 'android' ? scale(DESIGN_SIZE[size]) : size}
      color={useFocusTint(color)}
    />
  );
}
