// @ai RFC-023 step 2: the fonts load while the data loads.
/**
 * When the data load rejects, the run must not end before its font load
 * does: a retry resets the font fields and starts a second font load, and a
 * first load that ended later would write its own provider over the one the
 * retry published, with no subscriber told.
 *
 * Skia, the data service, the text service and the diff service are mocked.
 * The first font of each load waits on that load's gate, so the test decides
 * which load ends first.
 */
const mockFontGates: Promise<void>[] = [];
let mockProviders = 0;
let mockFirstFontPending = false;

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    TypefaceFontProvider: {
      Make: () => {
        mockProviders += 1;
        mockFirstFontPending = true;
        return {id: mockProviders, registerFont: () => undefined};
      },
    },
    Data: {
      fromURI: async (uri: string) => {
        if (mockFirstFontPending) {
          // The first font of the load that just started waits on its gate.
          mockFirstFontPending = false;
          await mockFontGates[mockProviders - 1];
        }
        return {uri};
      },
    },
    Typeface: {
      MakeFreeTypeFaceFromData: (data: unknown) => ({data}),
    },
  },
}));

const mockDataInit = jest.fn();
jest.mock('../DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    initialize: (...args: unknown[]) => mockDataInit(...args),
    onRewayahChange: () => () => undefined,
  },
}));
jest.mock('../QuranTextService', () => ({
  quranTextService: {clearCaches: () => undefined},
}));
jest.mock('../RewayahDiffService', () => ({
  rewayahDiffService: {loadForRewayah: () => undefined},
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {
    getState: () => ({rewayah: 'hafs', setRewayah: () => undefined}),
    persist: {
      hasHydrated: () => true,
      onFinishHydration: () => () => undefined,
    },
  },
}));

import {Image} from 'react-native';
import {mushafPreloadService} from '../MushafPreloadService';

function gate(): () => void {
  let release!: () => void;
  mockFontGates.push(new Promise<void>(resolve => (release = resolve)));
  return release;
}

async function flush(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

const providerId = () =>
  (mushafPreloadService.fontMgr as unknown as {id: number} | null)?.id ?? null;

let consoleSpies: jest.SpyInstance[] = [];
beforeEach(() => {
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
  ];
  jest.spyOn(Image, 'resolveAssetSource').mockImplementation(asset => ({
    uri: `asset:${String(asset)}`,
    width: 0,
    height: 0,
    scale: 1,
  }));
});
afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  jest.restoreAllMocks();
});

describe('the font load and a retry after a data failure', () => {
  it('the font provider a retry published stays published when the first font load ends', async () => {
    const releaseFirstFonts = gate();
    const releaseSecondFonts = gate();
    const notified: string[] = [];
    mushafPreloadService.subscribe(() =>
      notified.push(mushafPreloadService.state),
    );
    mockDataInit.mockRejectedValueOnce(new Error('words DB unreadable'));
    mockDataInit.mockResolvedValueOnce(undefined);

    const first = mushafPreloadService.initialize();
    await flush();
    // The data failed, and the run waits for its fonts.
    expect(mushafPreloadService.state).toBe('loading');
    releaseFirstFonts();
    await first;
    expect(mushafPreloadService.state).toBe('failed');

    const retry = mushafPreloadService.initialize();
    await flush();
    expect(mockProviders).toBe(2); // the retry started its own font load
    releaseSecondFonts();
    await retry;
    expect(mushafPreloadService.state).toBe('ready');
    const atReady = providerId();
    expect(atReady).toBe(2);

    await flush();

    expect({notified, fontMgrAfter: providerId()}).toEqual({
      notified: ['failed', 'ready'],
      fontMgrAfter: atReady,
    });
  });
});
