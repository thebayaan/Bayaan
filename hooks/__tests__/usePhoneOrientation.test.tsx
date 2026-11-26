// @ai-generated
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {Platform} from 'react-native'; // @ai

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
      'never locks or unlocks (%s)',
      mode => {
        const renderer = render(mode);
        act(() => renderer.unmount());
        expect(mockLockAsync).not.toHaveBeenCalled();
        expect(mockUnlockAsync).not.toHaveBeenCalled();
      },
    );
  });

  // @ai-start
  describe('on Android tablets', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      mockIsTablet = true;
      Platform.OS = 'android';
    });

    afterEach(() => {
      Platform.OS = originalOS;
    });

    // The manifest pins the activity to portrait, so a tablet that is
    // "never locked" has to be unlocked, or it cannot turn at all.
    it.each(['portrait', 'free'] as const)(
      'unlocks, and never locks (%s)',
      mode => {
        const renderer = render(mode);
        expect(mockUnlockAsync).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
        expect(mockLockAsync).not.toHaveBeenCalled();
      },
    );

    it('releases the phone lock when a foldable unfolds into a tablet', () => {
      mockIsTablet = false;
      let renderer!: ReactTestRenderer;
      act(() => {
        renderer = create(<Probe mode="portrait" />);
      });
      expect(mockLockAsync).toHaveBeenCalledWith('PORTRAIT_UP');

      mockIsTablet = true;
      act(() => {
        renderer.update(<Probe mode="portrait" />);
      });
      expect(mockUnlockAsync).toHaveBeenCalledTimes(1);
    });
  });
  // @ai-end
});
