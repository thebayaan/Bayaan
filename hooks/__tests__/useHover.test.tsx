// @ai-generated
import React, {act} from 'react';
import type {PointerEvent} from 'react-native';
import TestRenderer from 'react-test-renderer';
import {useHover} from '../useHover';

function pointer(pointerType: string): PointerEvent {
  return {nativeEvent: {pointerType}} as unknown as PointerEvent;
}

describe('useHover', () => {
  let result: ReturnType<typeof useHover>;
  function Probe() {
    result = useHover();
    return null;
  }

  beforeEach(() => {
    act(() => {
      TestRenderer.create(<Probe />);
    });
  });

  it('is hovered while a mouse or trackpad pointer is over the view', () => {
    expect(result.hovered).toBe(false);
    act(() => result.hoverProps.onPointerEnter(pointer('mouse')));
    expect(result.hovered).toBe(true);
    act(() => result.hoverProps.onPointerLeave());
    expect(result.hovered).toBe(false);
  });

  it('ignores a finger', () => {
    act(() => result.hoverProps.onPointerEnter(pointer('touch')));
    expect(result.hovered).toBe(false);
  });
});
