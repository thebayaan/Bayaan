import React from 'react';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import {AdhkarSessionOptionsSheet} from '@/components/sheets/AdhkarSessionOptionsSheet';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

// Strings come from the app's English resources (test-utils/setupI18n.ts).

const mockHide = jest.fn();
jest.mock('react-native-actions-sheet', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
      <MockView>{children}</MockView>
    ),
    SheetManager: {
      show: jest.fn(),
      hide: (...args: unknown[]) => mockHide(...args),
    },
  };
});
// The shared styles live in HomeCardOptionsSheet; keep its heavy imports out.
jest.mock('@/hooks/useFavoriteReciters', () => ({}));
jest.mock('@/hooks/useLoved', () => ({}));
jest.mock('@/hooks/usePlayerActions', () => ({}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({}));
jest.mock('@/services/dataService', () => ({}));
jest.mock('@/utils/audioUtils', () => ({}));
jest.mock('@/utils/artworkUtils', () => ({}));
jest.mock('@/utils/shareUtils', () => ({}));
jest.mock('@/components/Icons', () => ({}));
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
jest.mock('@expo/vector-icons', () => {
  const {View: MockView} = jest.requireActual('react-native');
  return {Feather: MockView};
});

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: [{dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'}],
  index: 0,
  mode: 'all',
  loop: false,
  status: 'paused',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: Date.now(),
};

let mounted: ReactTestRenderer | undefined;

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

it('shows the list and ends the session from Stop adhkar', () => {
  act(() => {
    useAdhkarSessionStore.setState({session});
  });
  act(() => {
    mounted = TestRenderer.create(
      <AdhkarSessionOptionsSheet
        sheetId="adhkar-session-options"
        payload={{title: 'Morning Adhkar', subtitle: 'Dhikr 1 of 1'}}
      />,
    );
  });
  if (!mounted) throw new Error('not rendered');
  const texts = mounted.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => [n.props.children].flat().join(''));
  expect(texts).toEqual(['Morning Adhkar', 'Dhikr 1 of 1', 'Stop adhkar']);

  const stop = mounted.root.findByProps({testID: 'adhkar-session-stop'});
  act(() => {
    stop.props.onPress();
  });
  expect(useAdhkarSessionStore.getState().session).toBeNull();
  expect(mockHide).toHaveBeenCalledWith('adhkar-session-options');
});
