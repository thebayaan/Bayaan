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
});
