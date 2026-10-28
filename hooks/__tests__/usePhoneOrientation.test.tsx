// @ai-generated
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

const mockLockAsync = jest.fn();
const mockUnlockAsync = jest.fn();
jest.mock('expo-screen-orientation', () => ({
  lockAsync: (...args: unknown[]) => mockLockAsync(...args),
  unlockAsync: () => mockUnlockAsync(),
  OrientationLock: {PORTRAIT_UP: 'PORTRAIT_UP'},
}));

let mockIsTablet = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: mockIsTablet}),
}));

import {usePhoneOrientation} from '@/hooks/usePhoneOrientation';

function Probe({mode}: {mode: 'portrait' | 'free'}) {
  usePhoneOrientation(mode);
  return null;
}

// The app root with the Mushaf open on top of it, like app/mushaf.tsx.
function RootWithMushaf({mushafOpen}: {mushafOpen: boolean}) {
  usePhoneOrientation('portrait');
  return mushafOpen ? <Probe mode="free" /> : null;
}

function lastCall(): 'lock' | 'unlock' | undefined {
  const lock = mockLockAsync.mock.invocationCallOrder.at(-1) ?? 0;
  const unlock = mockUnlockAsync.mock.invocationCallOrder.at(-1) ?? 0;
  if (!lock && !unlock) return undefined;
  return lock > unlock ? 'lock' : 'unlock';
}

function render(mode: 'portrait' | 'free'): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Probe mode={mode} />);
  });
  return renderer;
}

describe('usePhoneOrientation', () => {
  beforeEach(() => {
    mockLockAsync.mockClear();
    mockUnlockAsync.mockClear();
  });

  describe('on phones', () => {
    beforeEach(() => {
      mockIsTablet = false;
    });

    it('locks the app to portrait', () => {
      render('portrait');
      expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
      expect(mockUnlockAsync).not.toHaveBeenCalled();
    });

    it('unlocks a free screen and locks portrait again when it closes', () => {
      const renderer = render('free');
      expect(mockUnlockAsync).toHaveBeenCalledTimes(1);
      expect(mockLockAsync).not.toHaveBeenCalled();

      act(() => renderer.unmount());
      expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
    });
  });

  describe('on tablets', () => {
    beforeEach(() => {
      mockIsTablet = true;
    });

    it.each(['portrait', 'free'] as const)(
      'unlocks and never locks (%s)',
      mode => {
        const renderer = render(mode);
        act(() => renderer.unmount());
        expect(mockLockAsync).not.toHaveBeenCalled();
        expect(mockUnlockAsync).toHaveBeenCalled();
      },
    );
  });

  describe('when the window changes class (iPhone Duo fold)', () => {
    let mounted: ReactTestRenderer | undefined;

    // The free-screen count is module state, so unmount between tests.
    afterEach(() => {
      act(() => mounted?.unmount());
      mounted = undefined;
    });

    function mount(mushafOpen: boolean): ReactTestRenderer {
      let renderer!: ReactTestRenderer;
      act(() => {
        renderer = create(<RootWithMushaf mushafOpen={mushafOpen} />);
      });
      mounted = renderer;
      return renderer;
    }

    function setTablet(renderer: ReactTestRenderer, value: boolean) {
      mockIsTablet = value;
      act(() => {
        renderer.update(<RootWithMushaf mushafOpen={mushafOpenNow} />);
      });
    }

    let mushafOpenNow = false;

    it('unlocks when a phone unfolds into a tablet', () => {
      mockIsTablet = false;
      mushafOpenNow = false;
      const renderer = mount(false);
      expect(lastCall()).toBe('lock');

      setTablet(renderer, true);
      expect(lastCall()).toBe('unlock');
    });

    it('locks portrait again when it folds back', () => {
      mockIsTablet = true;
      mushafOpenNow = false;
      const renderer = mount(false);

      setTablet(renderer, false);
      expect(lastCall()).toBe('lock');
    });

    it('stays unlocked when folding with the Mushaf open', () => {
      mockIsTablet = true;
      mushafOpenNow = true;
      const renderer = mount(true);

      setTablet(renderer, false);
      expect(lastCall()).toBe('unlock');

      act(() => {
        renderer.update(<RootWithMushaf mushafOpen={false} />);
      });
      expect(lastCall()).toBe('lock');
    });

    it('stays unlocked when unfolding with the Mushaf open', () => {
      mockIsTablet = false;
      mushafOpenNow = true;
      const renderer = mount(true);
      expect(lastCall()).toBe('unlock');

      setTablet(renderer, true);
      expect(lastCall()).toBe('unlock');

      act(() => {
        renderer.update(<RootWithMushaf mushafOpen={false} />);
      });
      expect(mockLockAsync).toHaveBeenCalledTimes(1);
      expect(lastCall()).toBe('unlock');
    });
  });
});
