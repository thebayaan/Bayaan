// @ai-generated
/**
 * The "browse reciters" routes take a surahId param. One that is not a real
 * surah (a bad link) used to throw while building the title.
 * The screens live in app/, so their test lives here.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({back: jest.fn()}),
  useNavigation: () => ({setOptions: jest.fn()}),
  useLocalSearchParams: () => mockParams,
}));
const mockBrowse: {props: {surahId?: number; title?: string} | null} = {
  props: null,
};
jest.mock('@/components/browse/BrowseReciters', () => ({
  __esModule: true,
  default: (props: {surahId?: number; title?: string}) => {
    mockBrowse.props = props;
    return null;
  },
}));
jest.mock('@/hooks/useTheme', () => ({useTheme: () => ({theme: {}})}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

import HomeBrowseScreen from '@/app/(tabs)/(a.home)/reciter/browse';
import SearchBrowseScreen from '@/app/(tabs)/(b.search)/reciter/browse';
import SurahsBrowseScreen from '@/app/(tabs)/(b.surahs)/reciter/browse';

describe.each([
  ['Home', HomeBrowseScreen],
  ['Search', SearchBrowseScreen],
  ['Surahs', SurahsBrowseScreen],
])('%s tab browse route', (_tab, Screen) => {
  function open(surahId?: string) {
    mockParams = surahId === undefined ? {} : {surahId};
    mockBrowse.props = null;
    act(() => {
      TestRenderer.create(<Screen />);
    });
    return mockBrowse.props!;
  }

  it('names the surah the reciter is being chosen for', () => {
    const props = open('36');
    expect(props.surahId).toBe(36);
    expect(props.title).toBe('Browse Reciters - Ya-Sin');
  });

  it.each(['0', '115', 'abc'])(
    'opens the plain list for surahId %s',
    surahId => {
      const props = open(surahId);
      expect(props.surahId).toBeUndefined();
      expect(props.title).toBe('Browse All');
    },
  );

  it('opens the plain list without a surahId', () => {
    const props = open();
    expect(props.surahId).toBeUndefined();
    expect(props.title).toBe('Browse All');
  });
});
