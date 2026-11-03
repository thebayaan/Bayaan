import React from 'react';
import {Keyboard, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', textSecondary: '#555555'}},
  }),
}));
const mockSheets = {show: jest.fn()};
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (id: string) => mockSheets.show(id)},
}));

import {ReciteToSearchRow} from '../ReciteToSearchRow';

describe('ReciteToSearchRow', () => {
  it('says what it does and opens Which ayah?', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<ReciteToSearchRow />);
    });
    const shown = r.root
      .findAll(n => (n.type as unknown) === Text)
      .map(n => n.props.children);
    expect(shown).toEqual([
      'Recite to search',
      'Recite a few words and Bayaan finds the ayah.',
    ]);
    act(() => {
      r.root.find(n => n.props.accessibilityRole === 'button').props.onPress();
    });
    expect(dismiss).toHaveBeenCalled();
    expect(mockSheets.show).toHaveBeenCalledWith('which-ayah');
  });
});
