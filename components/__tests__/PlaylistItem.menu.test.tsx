// @ai-generated
import React from 'react';
import {View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {PlaylistItem} from '../PlaylistItem';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#eeeeee',
        border: '#dddddd',
        primary: '#6366F1',
      },
      fonts: {regular: 'r', medium: 'm', semiBold: 's'},
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/components/Icons', () => ({PlaylistIcon: () => null}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialIcons: () => null,
}));

function optionsButtonPress(
  optionsMenu: React.ReactNode | undefined,
): (() => void) | undefined {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <PlaylistItem
        id="p1"
        name="Morning"
        itemCount={2}
        onPress={jest.fn()}
        onOptionsPress={jest.fn()}
        optionsMenu={optionsMenu}
      />,
    );
  });
  // The ••• button is the only Pressable with a hit slop.
  const button = renderer.root.find(
    n => typeof n.type !== 'string' && n.props.hitSlop === 8,
  );
  return button.props.onPress;
}

describe('PlaylistItem options button', () => {
  it('opens the sheet when there is no native menu', () => {
    expect(optionsButtonPress(undefined)).toEqual(expect.any(Function));
  });

  it('leaves the tap to the native menu when one is laid over it', () => {
    // Firing the sheet as well races the menu's presentation and leaves the
    // screen unresponsive.
    expect(optionsButtonPress(<View testID="menu" />)).toBeUndefined();
  });
});
