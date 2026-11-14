// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {RecentVerseRow} from '../RecentVerseRow';

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#000000'}}}),
}));

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('RecentVerseRow', () => {
  it('names the ayah and opens it', () => {
    const onPress = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <RecentVerseRow verseKey="2:255" onPress={onPress} />,
      );
    });
    const button = renderer.root.find(
      n =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        typeof n.type !== 'string',
    );
    expect(button.props.accessibilityLabel).toBe('Al-Baqarah 2:255');
    expect(button.props.accessibilityHint).toBe('Opens the ayah in the Mushaf');
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });
});
