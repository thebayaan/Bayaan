// @ai-generated
/**
 * Choosing a reciter for a surah from the Surahs tab stays in that tab: the
 * Surahs stack has its own reciter browser and profile, and the tab pushes
 * onto them. It used to push Home's browser, so going back after choosing a
 * reciter left the user on Home.
 * The screens live in app/, so their test lives here.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

const mockScreens: Record<string, {headerShown?: boolean}> = {};
const mockGlass = {value: false};
const mockPush = jest.fn();
let mockSurahsViewProps: {
  onSurahLongPress: (surah: {id: number}) => void;
} | null = null;
const mockSettings = {
  askEveryTime: false,
  defaultReciterSelection: 'browseAll' as string | null,
};

jest.mock('expo-router', () => {
  function Stack({children}: {children: React.ReactNode}) {
    return children;
  }
  function Screen({
    name,
    options,
  }: {
    name: string;
    options?: {headerShown?: boolean};
  }) {
    mockScreens[name] = options ?? {};
    return null;
  }
  Stack.Screen = Screen;
  return {
    Stack,
    useRouter: () => ({push: mockPush}),
    useNavigation: () => ({setOptions: jest.fn()}),
  };
});

jest.mock('@/hooks/useGlassProps', () => ({
  get USE_GLASS() {
    return mockGlass.value;
  },
}));

jest.mock('@/components/layout/MaxWidthContainer', () => ({
  capScreensExcept: () => undefined,
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => mockSettings,
}));

jest.mock('@/store/reciterStore', () => ({
  useReciterStore: (select: (s: {defaultReciter: null}) => unknown) =>
    select({defaultReciter: null}),
}));

jest.mock('@/hooks/useReciterSelection', () => ({
  useReciterSelection: () => ({
    playWithReciter: jest.fn(),
    playWithRandomReciter: jest.fn(),
  }),
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));

jest.mock('@/components/SurahsView', () => ({
  __esModule: true,
  default: (props: NonNullable<typeof mockSurahsViewProps>) => {
    mockSurahsViewProps = props;
    return null;
  },
}));

import {SheetManager} from 'react-native-actions-sheet';

function renderSurahsLayout(glass: boolean) {
  mockGlass.value = glass;
  jest.isolateModules(() => {
    const SurahsLayout = require('@/app/(tabs)/(b.surahs)/_layout').default;
    act(() => {
      TestRenderer.create(<SurahsLayout />);
    });
  });
}

function longPressSurah(id: number) {
  const SurahsScreen = require('@/app/(tabs)/(b.surahs)/index').default;
  act(() => {
    TestRenderer.create(<SurahsScreen />);
  });
  act(() => {
    mockSurahsViewProps?.onSurahLongPress({id});
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.askEveryTime = false;
  mockSettings.defaultReciterSelection = 'browseAll';
});

it.each([false, true])(
  'declares the reciter browser and profile in the Surahs stack (glass %s)',
  glass => {
    renderSurahsLayout(glass);
    // Same header rule as Home's copies: the native header only with glass.
    expect(mockScreens['reciter/browse'].headerShown).toBe(glass);
    expect(mockScreens['reciter/[id]'].headerShown).toBe(glass);
  },
);

it('opens the Surahs tab’s own reciter browser', () => {
  longPressSurah(36);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(tabs)/(b.surahs)/reciter/browse',
    params: {view: 'all', surahId: 36},
  });
});

it('asks for a reciter without naming a tab, so the sheet uses this one', () => {
  mockSettings.askEveryTime = true;
  longPressSurah(36);
  expect(SheetManager.show).toHaveBeenCalledWith('select-reciter', {
    payload: {surahId: '36'},
  });
});
