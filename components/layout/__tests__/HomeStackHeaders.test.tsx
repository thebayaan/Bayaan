// @ai-generated
/**
 * Home stack screens that draw their own header on non-glass devices must
 * hide the native one there, or both show. Playlist detail drew a native
 * back button above CollectionStickyHeader's own back button.
 * The layout lives in app/, so its test lives here.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

const mockScreens: Record<string, {headerShown?: boolean}> = {};
const mockGlass = {value: false};

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
  return {Stack};
});

jest.mock('@/hooks/useGlassProps', () => ({
  get USE_GLASS() {
    return mockGlass.value;
  },
}));

jest.mock('@/components/layout/MaxWidthContainer', () => ({
  MaxWidthContainer: ({children}: {children: React.ReactNode}) => children,
  capScreensExcept: () => undefined, // @ai
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

function renderLayout(glass: boolean) {
  mockGlass.value = glass;
  jest.isolateModules(() => {
    const HomeLayout = require('@/app/(tabs)/(a.home)/_layout').default;
    act(() => {
      TestRenderer.create(<HomeLayout />);
    });
  });
}

it('hides the native header on playlist detail without glass', () => {
  renderLayout(false);
  expect(mockScreens['playlist/[id]'].headerShown).toBe(false);
});

it('keeps the native header on playlist detail with glass', () => {
  renderLayout(true);
  expect(mockScreens['playlist/[id]'].headerShown).toBe(true);
});
