import {useEffect, useRef} from 'react';
import {useButtonFocused} from '../primitives/focusContext';

/**
 * Placed inside a FocusableButton or FocusableCard: calls `onChange` when
 * that control gains or loses focus (the primitives only report gaining it).
 */
export function FocusWatch({
  onChange,
}: {
  onChange: (focused: boolean) => void;
}): null {
  const focused = useButtonFocused();
  const was = useRef(focused);
  useEffect(() => {
    if (was.current !== focused) onChange(focused);
    was.current = focused;
  }, [focused, onChange]);
  return null;
}
