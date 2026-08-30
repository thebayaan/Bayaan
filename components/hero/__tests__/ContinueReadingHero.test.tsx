import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {useQfSyncStore} from '@/store/qfSyncStore';

jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {getLastReadPage: jest.fn(() => null)},
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (n: number) => n,
}));
jest.mock('../HeroSection', () => ({
  HeroSection: ({mainHero}: {mainHero: React.ReactNode}) => mainHero,
}));
jest.mock('../SurahsHero', () => ({
  SurahHeroSection: jest.fn((props: Record<string, unknown>) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'continue-reading-card',
    }),
  ),
}));

import {ContinueReadingHero} from '../ContinueReadingHero';

const mockGetLastReadPage = jest.mocked(
  require('@/services/mushaf/MushafSessionStore').mushafSessionStore
    .getLastReadPage,
);
const mockSurahHeroSection = jest.mocked(
  require('../SurahsHero').SurahHeroSection,
);
const mountedTrees: renderer.ReactTestRenderer[] = [];

async function renderHero(): Promise<renderer.ReactTestRenderer> {
  let tree: renderer.ReactTestRenderer | null = null;
  await act(async () => {
    tree = renderer.create(<ContinueReadingHero />);
  });
  if (!tree) throw new Error('Continue Reading card did not render');
  mountedTrees.push(tree);
  return tree;
}

beforeEach(() => {
  mockGetLastReadPage.mockReset().mockReturnValue(null);
  mockSurahHeroSection.mockClear();
  useQfSyncStore.getState().resetForTesting();
});

afterEach(() => {
  for (const tree of mountedTrees.splice(0)) {
    act(() => tree.unmount());
  }
});

it('refreshes a mounted Continue Reading card after pulled progress is applied', async () => {
  let cachedPage = 8;
  mockGetLastReadPage.mockImplementation(() => cachedPage);
  const tree = await renderHero();
  expect(
    tree.root.findByProps({testID: 'continue-reading-card'}).props.resumePage,
  ).toBe(8);

  await act(async () => {
    cachedPage = 293;
    useQfSyncStore.getState().refreshData();
  });

  expect(
    tree.root.findByProps({testID: 'continue-reading-card'}).props.resumePage,
  ).toBe(293);
});

it('renders an account switch from the new cache without a prior-account card frame', async () => {
  let cachedPage = 42;
  mockGetLastReadPage.mockImplementation(() => cachedPage);
  const tree = await renderHero();
  mockSurahHeroSection.mockClear();

  await act(async () => {
    cachedPage = 99;
    useQfSyncStore.setState(state => ({
      activeAccountId: 'account-b',
      scopeRevision: state.scopeRevision + 1,
    }));
  });

  expect(
    tree.root.findByProps({testID: 'continue-reading-card'}).props.resumePage,
  ).toBe(99);
  expect(
    mockSurahHeroSection.mock.calls.map(
      (call: [{resumePage?: number}]) => call[0].resumePage,
    ),
  ).toEqual([99]);
});
