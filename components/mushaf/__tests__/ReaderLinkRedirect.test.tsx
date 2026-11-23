// @ai-generated
// The link routes hand off to the one Mushaf reader with dismissTo (pop back
// to an open reader, or replace the link route), never with the replace of a
// <Redirect>, which stacked a second reader. Lives outside app/ because every
// file there is bundled as a route.
import React from 'react';
import {act, create} from 'react-test-renderer';

const mockRouter = {dismissTo: jest.fn(), replace: jest.fn()};
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const {useEffect} = jest.requireActual('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    // The screen is focused while it is mounted.
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    // A <Redirect> replaces the route it renders in.
    Redirect: ({href}: {href: unknown}) => {
      useEffect(() => mockRouter.replace(href), [href]);
      return null;
    },
  };
});

import MushafPageLink from '@/app/mushaf/[page]';
import QuranSurahLink from '@/app/quran/[surah]';

beforeEach(() => {
  mockRouter.dismissTo.mockClear();
  mockRouter.replace.mockClear();
});

it('/mushaf/N dismisses to the reader with the page', () => {
  mockParams = {page: '60'};
  act(() => {
    create(<MushafPageLink />);
  });
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith({
    pathname: '/mushaf',
    params: {page: '60'},
  });
});

it('/quran/S?ayah=A dismisses to the reader with the verse', () => {
  mockParams = {surah: '2', ayah: '255'};
  act(() => {
    create(<QuranSurahLink />);
  });
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockRouter.dismissTo).toHaveBeenCalledWith({
    pathname: '/mushaf',
    params: {surah: '2', ayah: '255'},
  });
});

it('hands off once, though the route renders again with a new params object', () => {
  mockParams = {page: '60'};
  let renderer: ReturnType<typeof create> | null = null;
  act(() => {
    renderer = create(<MushafPageLink />);
  });
  mockParams = {page: '60'};
  act(() => {
    renderer?.update(<MushafPageLink />);
  });
  expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
});
