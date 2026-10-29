// @ai-generated
import React from 'react';
import {Platform} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

const mockToast = jest.fn();
jest.mock('@/utils/toastUtils', () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));
const mockPick = jest.fn();
jest.mock('@/utils/randomRecitation', () => ({
  pickRandomRecitations: (n: number) => mockPick(n),
}));
const mockUpdateQueue = jest.fn();
const mockPlay = jest.fn();
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({updateQueue: mockUpdateQueue, play: mockPlay}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: () => ({startNewChain: jest.fn()}),
}));
jest.mock('@/utils/track', () => ({
  createTracksForReciter: jest.fn(async () => [{id: 't'}]),
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (r: {name: string}) => r.name,
  getSurahDisplayName: (s: {name: string}) => s.name,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {colors: {text: '#000', background: '#fff'}}}),
}));
jest.mock('../random-recitation/backgrounds', () => ({
  renderFullWidthBackground: () => null,
  getTextColors: () => ({labelColor: '#000', subtitleColor: '#000'}),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {Medium: 'medium'},
}));
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {View},
    useSharedValue: (v: number) => ({value: v}),
    useAnimatedStyle: () => ({}),
    withSpring: (v: number) => v,
  };
});

import {RandomRecitationHero} from '../RandomRecitationHero';

async function pressHero() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<RandomRecitationHero />);
  });
  const pressable = renderer.root.find(
    node => typeof node.props.onPress === 'function',
  );
  await act(async () => {
    await pressable.props.onPress();
  });
}

beforeEach(() => {
  mockToast.mockClear();
  mockPick.mockReset();
  mockUpdateQueue.mockReset();
  mockPlay.mockReset();
});

it('runs on iOS', () => {
  expect(Platform.OS).toBe('ios');
});

it('tells the user what is playing through the shared toast', async () => {
  mockPick.mockReturnValue([
    {reciter: {name: 'Reciter'}, surah: {name: 'Al-Mulk'}, rewayatId: 'r'},
  ]);
  await pressHero();
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast.mock.calls[0][0]).toEqual(expect.any(String));
  expect(mockPlay).toHaveBeenCalled();
});

it('shows an error toast when nothing can be picked', async () => {
  mockPick.mockReturnValue([]);
  await pressHero();
  expect(mockToast).toHaveBeenCalledWith(
    expect.any(String),
    undefined,
    'error',
  );
  expect(mockPlay).not.toHaveBeenCalled();
});

it('shows an error toast when playback fails', async () => {
  mockPick.mockReturnValue([
    {reciter: {name: 'Reciter'}, surah: {name: 'Al-Mulk'}, rewayatId: 'r'},
  ]);
  mockUpdateQueue.mockRejectedValue(new Error('boom'));
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await pressHero();
  expect(mockToast).toHaveBeenLastCalledWith(
    expect.any(String),
    undefined,
    'error',
  );
});
