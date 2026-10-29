// @ai-generated
import React from 'react';
import {Text, View} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {SheetProps} from 'react-native-actions-sheet';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

let mockIsTablet = true;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockIsTablet}),
}));
jest.mock('@/components/sheets/AdaptiveActionSheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      tabletPresentation,
    }: {
      children: React.ReactNode;
      tabletPresentation?: string;
    }) => (
      <MockView testID="sheet" tabletPresentation={tabletPresentation}>
        {children}
      </MockView>
    ),
  };
});
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', background: '#ffffff'}},
  }),
}));
const mockAmbient = {
  currentSound: 'rain',
  isEnabled: true,
  volume: 0.5,
  setSound: jest.fn(),
  setEnabled: jest.fn(),
  setVolume: jest.fn(),
};
jest.mock('@/store/ambientStore', () => ({
  useAmbientStore: (selector: (s: unknown) => unknown) => selector(mockAmbient),
}));
jest.mock('@/services/audio/AmbientAudioService', () => ({
  ambientAudioService: {stop: jest.fn()},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({playback: {state: 'playing'}})},
}));
jest.mock('react-native-svg', () => new Proxy({}, {get: () => () => null}));
jest.mock('@react-native-community/slider', () => () => null);

import {AmbientSoundsSheet} from '../AmbientSoundsSheet';

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <AmbientSoundsSheet
        {...({sheetId: 'ambient-sounds'} as SheetProps<'ambient-sounds'>)}
      />,
    );
  });
  return renderer;
}

/** The sound tiles, innermost first when a wrapper passes props through. */
const tiles = (r: TestRenderer.ReactTestRenderer) => {
  const all = r.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button',
  );
  return all.filter(n => !all.some(m => m !== n && m.parent === n));
};

const label = (tile: TestRenderer.ReactTestInstance) =>
  tile.find(n => (n.type as unknown) === Text).props.children;

beforeEach(() => {
  mockIsTablet = true;
  jest.clearAllMocks();
});

describe('AmbientSoundsSheet', () => {
  it('shows as a menu with the sounds in rows of three on iPad', () => {
    const r = render();
    const [sheet] = r.root.findAll(
      n => n.props.testID === 'sheet' && (n.type as unknown) === View,
    );
    expect(sheet.props.tabletPresentation).toBe('menu');

    const all = tiles(r);
    expect(all.map(label)).toEqual([
      'None',
      'Rain',
      'Forest',
      'Ocean',
      'Stream',
      'Thunder',
      'Fireplace',
      'Wind',
    ]);
    // Each row holds three tiles; the last is padded to keep tile widths.
    const rows = new Set(all.map(tile => tile.parent));
    expect([...rows].map(row => row?.props.children.flat().length)).toEqual([
      3, 3, 3,
    ]);
  });

  it('marks the playing sound as selected', () => {
    const states = tiles(render()).map(
      tile => tile.props.accessibilityState.selected,
    );
    expect(states).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('turns ambient off from None and picks a sound from its tile', () => {
    const [none, , forest] = tiles(render());
    act(() => none.props.onPress());
    expect(mockAmbient.setEnabled).toHaveBeenCalledWith(false);
    act(() => forest.props.onPress());
    expect(mockAmbient.setSound).toHaveBeenCalledWith('forest');
  });

  it('keeps the two-column phone grid in one wrapping row', () => {
    mockIsTablet = false;
    const rows = new Set(tiles(render()).map(tile => tile.parent));
    expect(rows.size).toBe(1);
  });
});
