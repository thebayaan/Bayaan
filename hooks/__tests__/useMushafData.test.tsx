// @ai-generated
/**
 * useMushafData() is not 'ready' while MushafPreloadService still loads the
 * Skia fonts, only once the data and the fonts are both loaded. The test uses
 * the real MushafPreloadService and holds the font loads open, so the data
 * finishes first, as it does on a cold start.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Image} from 'react-native';

jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({
  uri: 'file://font',
} as never);

const mockDk = {
  initialized: false,
  listeners: new Set<() => void>(),
};
// Font loads stay pending until release() is called.
const mockFontGate = {open: false, release: () => undefined as void};

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    TypefaceFontProvider: {Make: () => ({registerFont: () => undefined})},
    Data: {
      fromURI: () =>
        mockFontGate.open
          ? Promise.resolve({})
          : new Promise(resolve => {
              mockFontGate.release = () => {
                mockFontGate.open = true;
                resolve({});
              };
            }),
    },
    Typeface: {MakeFreeTypeFaceFromData: () => ({})},
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get initialized() {
      return mockDk.initialized;
    },
    rewayah: 'hafs',
    initialize: async () => {
      mockDk.initialized = true;
      mockDk.listeners.forEach(l => l());
    },
    onRewayahChange: () => () => undefined,
    getRewayahLoadState: () => (mockDk.initialized ? 'ready' : 'loading'),
    subscribeCacheChanges: (l: () => void) => {
      mockDk.listeners.add(l);
      return () => mockDk.listeners.delete(l);
    },
  },
}));
jest.mock('@/services/mushaf/QuranTextService', () => ({
  quranTextService: {clearCaches: () => undefined},
}));
jest.mock('@/services/mushaf/RewayahDiffService', () => ({
  rewayahDiffService: {loadForRewayah: () => undefined},
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: Object.assign(() => undefined, {
    getState: () => ({rewayah: 'hafs', setRewayah: () => undefined}),
    persist: {hasHydrated: () => true},
  }),
}));
jest.mock('@/services/rewayah/RewayahIdentity', () => ({
  migratePersistedId: (id: string) => id,
}));

import {useMushafData} from '@/hooks/useMushafData';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';

it('useMushafData is not ready while the fonts are still loading', async () => {
  const seen: string[] = [];
  function Probe() {
    seen.push(useMushafData().state);
    return null;
  }
  await act(async () => {
    TestRenderer.create(<Probe />);
  });
  await act(async () => {
    mushafPreloadService.startIfIdle();
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });

  // The data is loaded and the fonts are not (preconditions).
  expect(digitalKhattDataService.initialized).toBe(true);
  expect(mushafPreloadService.state).toBe('loading');
  expect(mushafPreloadService.fontMgr).toBeNull();
  expect(mushafPreloadService.quranCommonTypeface).toBeNull();
  // The codebase's own predicate says not ready.
  expect(
    mushafPreloadService.initialized && digitalKhattDataService.initialized,
  ).toBe(false);

  // The reader's hook agrees.
  expect(seen[seen.length - 1]).not.toBe('ready');

  await act(async () => {
    mockFontGate.release();
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
  });
  expect(mushafPreloadService.state).toBe('ready');
  expect(mushafPreloadService.quranCommonTypeface).not.toBeNull();
  expect(seen[seen.length - 1]).toBe('ready');
});
