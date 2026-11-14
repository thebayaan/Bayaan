/**
 * Repro for finding 7 of the PR 489 review (RFC-023 step 2). Low impact.
 *
 * MushafPreloadService._doInit now starts loadSkiaFonts() before it awaits
 * the data. When the data rejects, _doInit publishes 'failed' while the
 * fonts are still loading. A retry (initialize() again) resets the font
 * fields and starts a second font load. When the first load finishes later,
 * it writes its own font provider over the one the retry published, and no
 * subscriber is told.
 *
 * What the test expects: once the retry has published 'ready' with its font
 * provider (id 2), that provider stays the published one, and subscribers are
 * told exactly twice ('failed', then 'ready'). The test also passes with the
 * suggested fix (Promise.allSettled before publishing), where the first run
 * publishes 'failed' only after its own fonts finish.
 *
 * What happens on the PR head: after the first run's font load finishes, the
 * published provider is the first run's (id 1, not the retry's id 2), with no
 * notification.
 *
 * Skia, the data service, the text service and the diff service are mocked.
 * The first font of each load waits on that load's gate, so the test decides
 * which load finishes first.
 *
 * Run: npx jest services/mushaf/__tests__/repro_489_7_font_load_retry_race -w 1
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

describe('finding 7: the font load and a retry after a data failure', () => {
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
    // On the PR head the first run is already 'failed' here, with its font
    // load still in flight. A fixed _doInit waits for the fonts before it
    // publishes, so it is still 'loading' until they finish.
    if (mushafPreloadService.state === 'loading') releaseFirstFonts();
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

    releaseFirstFonts(); // on the PR head, the first run's font load ends now
    await flush();

    expect({notified, fontMgrAfter: providerId()}).toEqual({
      notified: ['failed', 'ready'],
      fontMgrAfter: atReady,
    });
  });
});
