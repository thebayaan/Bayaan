// @ai-generated
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

// Render the real sheet with its dependencies stubbed, to check that it can
// go from "no payload" to "payload" without changing its hook order.
jest.mock('react-native-actions-sheet', () => {
  const {View} = jest.requireActual('react-native');
  const ActionSheet = ({children}: {children: React.ReactNode}) => (
    <View>{children}</View>
  );
  return {
    __esModule: true,
    default: ActionSheet,
    SheetManager: {hide: jest.fn(), show: jest.fn()},
  };
});
jest.mock('expo-router', () => ({useRouter: () => ({push: jest.fn()})}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#ffffff',
        border: '#dddddd',
      },
    },
  }),
}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({
    isFavoriteReciter: () => false,
    toggleFavorite: jest.fn(),
  }),
}));
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({isLovedWithRewayat: () => false, toggleLoved: jest.fn()}),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({addToQueue: jest.fn()}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({removeTrack: jest.fn()})},
}));
jest.mock('@/services/dataService', () => ({
  getReciterById: jest.fn(),
  getSurahById: () => undefined,
}));
jest.mock('@/utils/audioUtils', () => ({generateSmartAudioUrl: jest.fn()}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: jest.fn()}));
jest.mock('@/utils/shareUtils', () => ({
  recitationShareUrl: jest.fn(),
  reciterShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));
jest.mock('@/components/Icons', () => {
  const Icon = () => null;
  return {
    PlayIcon: Icon,
    QueueIcon: Icon,
    ProfileIcon: Icon,
    HeartIcon: Icon,
    StarIcon: Icon,
  };
});
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

import {HomeCardOptionsSheet} from '../HomeCardOptionsSheet';

const payload = {
  reciterId: 'r1',
  reciterName: 'Reciter One',
  variant: 'reciter' as const,
};

it('renders nothing without a payload, then the options once it arrives', () => {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<HomeCardOptionsSheet sheetId="home-card-options" />);
  });
  expect(renderer.toJSON()).toBeNull();

  expect(() =>
    act(() => {
      renderer.update(
        <HomeCardOptionsSheet sheetId="home-card-options" payload={payload} />,
      );
    }),
  ).not.toThrow();
  expect(JSON.stringify(renderer.toJSON())).toContain('Reciter One');

  // And back again, which used to render fewer hooks than the last render.
  expect(() =>
    act(() => {
      renderer.update(<HomeCardOptionsSheet sheetId="home-card-options" />);
    }),
  ).not.toThrow();
  expect(renderer.toJSON()).toBeNull();
});
