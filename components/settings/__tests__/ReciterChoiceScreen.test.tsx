// @ai-generated
/**
 * Settings → Reciter choice lists every choice the reciter sheet can
 * remember. "Random Reciter" was missing: after picking it in the sheet with
 * "Ask every time" off, this screen showed nothing selected while surahs
 * played with a random reciter.
 * The screen lives in app/, so its test lives here.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

let mockSelection: string | null = null;
const mockSetSelection = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    askEveryTime: false,
    setAskEveryTime: jest.fn(),
    defaultReciterSelection: mockSelection,
    setDefaultReciterSelection: mockSetSelection,
  }),
}));
jest.mock('@/components/native/NativeSwitch', () => ({
  NativeSwitch: () => null,
}));
jest.mock('@expo/vector-icons', () => ({
  AntDesign: () => null,
  // Named so the test can find the tick on the selected row.
  Feather: function Feather() {
    return null;
  },
}));

import ReciterChoiceScreen from '@/app/(tabs)/(d.settings)/reciter-choice';

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ReciterChoiceScreen />);
  });
  return renderer;
}

/** The option row whose title is `label`. */
function row(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.find(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node
        .findAll(child => (child.type as unknown) === Text)
        .some(text => text.props.children === label),
  );
}

const isTicked = (node: TestRenderer.ReactTestInstance) =>
  node.findAll(child => child.props.name === 'check-circle').length > 0;

beforeEach(() => {
  jest.clearAllMocks();
  mockSelection = null;
});

it('shows Random Reciter as selected when the sheet saved it', () => {
  mockSelection = 'randomReciter';
  const renderer = render();

  expect(isTicked(row(renderer, 'Random Reciter'))).toBe(true);
  expect(isTicked(row(renderer, 'Use Default Reciter'))).toBe(false);
  expect(isTicked(row(renderer, 'Browse All Reciters'))).toBe(false);
});

it('saves the value the playback choice reads', () => {
  const renderer = render();

  act(() => {
    row(renderer, 'Random Reciter').props.onPress();
  });

  expect(mockSetSelection).toHaveBeenCalledWith('randomReciter');
});
