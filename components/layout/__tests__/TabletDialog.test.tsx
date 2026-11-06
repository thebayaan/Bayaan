// @ai-generated
import React from 'react';
import {Keyboard, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 20, left: 0, right: 0}),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {background: '#fff', text: '#000'}}}),
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => ({
  SHEET_MAX_WIDTH: 560,
  SHEET_MAX_HEIGHT: 760,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 744, height: 1133, scale: 2, fontScale: 1}),
}));

import {TabletDialog} from '@/components/layout/TabletDialog';

function cardStyle(renderer: TestRenderer.ReactTestRenderer): ViewStyle {
  const view: unknown = View;
  const card = renderer.root.findAll(
    node => node.type === view && node.props.accessibilityViewIsModal,
  )[0];
  return StyleSheet.flatten(card.props.style) as ViewStyle;
}

function render(height?: number) {
  const onClose = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <TabletDialog onClose={onClose} height={height}>
        <Text>filters</Text>
      </TabletDialog>,
    );
  });
  return {renderer, onClose, card: cardStyle(renderer)};
}

it('centers the content in a card no wider than an iPad sheet', () => {
  const {renderer, card} = render();
  const text: unknown = Text;
  expect(
    renderer.root.findAll(node => node.type === text)[0].props.children,
  ).toBe('filters');
  expect(card).toMatchObject({maxWidth: 560, maxHeight: 760});
  expect(card.height).toBeUndefined();
});

it('caps a fixed height to the window', () => {
  expect(render(640).card.height).toBe(640);
  // The window would allow 1041 (1133 less the safe area and margins).
  expect(render(2000).card).toMatchObject({maxHeight: 760, height: 760});
});

it('closes on a tap outside the card', () => {
  const {renderer, onClose} = render();
  const backdrop = renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function',
  )[0];
  act(() => backdrop.props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(backdrop.props.accessibilityLabel).toBe('actions.close');
});

it('stays above the keyboard', () => {
  const listeners: Record<string, (event?: unknown) => void> = {};
  const addListener = jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((event, listener) => {
      listeners[event] = listener as (event?: unknown) => void;
      return {remove: jest.fn()} as unknown as ReturnType<
        typeof Keyboard.addListener
      >;
    });
  const {renderer} = render(2000);

  act(() => listeners.keyboardWillShow({endCoordinates: {height: 400}}));
  // 1133 less the top inset, the keyboard and the margins.
  expect(cardStyle(renderer)).toMatchObject({maxHeight: 661, height: 661});

  act(() => listeners.keyboardWillHide());
  expect(cardStyle(renderer)).toMatchObject({maxHeight: 760, height: 760});
  addListener.mockRestore();
});
