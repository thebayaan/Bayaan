const mockStorage = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    delete: (key: string) => mockStorage.delete(key),
    getAllKeys: () => Array.from(mockStorage.keys()),
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'test-device-id',
}));

jest.mock('../LocalAggregationStore', () => ({
  localAggregationStore: {
    getToday: () => '2026-04-16',
    addListeningTime: jest.fn(),
    addPagesRead: jest.fn(),
    addPagesOpened: jest.fn(),
    incrementMeaningfulListens: jest.fn(),
    incrementAdhkarSessions: jest.fn(),
    addTasbeehCount: jest.fn(),
    markSurahCompleted: jest.fn(),
  },
}));

type FakePostHog = {
  capture: jest.Mock;
  identify: jest.Mock;
  register: jest.Mock;
};

function makeFakePostHog(): FakePostHog {
  return {capture: jest.fn(), identify: jest.fn(), register: jest.fn()};
}

async function loadService(envEnabled: string | undefined): Promise<{
  analyticsService: typeof import('../AnalyticsService').analyticsService;
}> {
  const original = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED;
  if (envEnabled === undefined) {
    delete process.env.EXPO_PUBLIC_ANALYTICS_ENABLED;
  } else {
    process.env.EXPO_PUBLIC_ANALYTICS_ENABLED = envEnabled;
  }
  jest.resetModules();
  mockStorage.clear();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../AnalyticsService');
  // Initialize while the env flag is still set — the service latches `enabled`
  // inside initialize(), so the env var is only read once.
  await mod.analyticsService.initialize();
  if (original === undefined) {
    delete process.env.EXPO_PUBLIC_ANALYTICS_ENABLED;
  } else {
    process.env.EXPO_PUBLIC_ANALYTICS_ENABLED = original;
  }
  return {analyticsService: mod.analyticsService};
}

describe('AnalyticsService', () => {
  describe('when analytics is enabled (default)', () => {
    it('registers the platform super property on setPostHogInstance without identifying the device', async () => {
      const {analyticsService} = await loadService(undefined);

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );

      expect(posthog.register).toHaveBeenCalledWith({platform: 'mobile'});
      expect(posthog.identify).not.toHaveBeenCalled();
    });

    it('forwards event name and props to posthog.capture', async () => {
      const {analyticsService} = await loadService(undefined);
      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );

      analyticsService.trackPlaybackStarted({
        surah_id: 1,
        reciter_id: 'r-1',
        rewayah_id: 'rw-1',
        source: 'direct',
        position_ms: 0,
      });

      expect(posthog.capture).toHaveBeenCalledWith('playback_started', {
        surah_id: 1,
        reciter_id: 'r-1',
        rewayah_id: 'rw-1',
        source: 'direct',
        position_ms: 0,
      });
    });

    it('silently no-ops when posthog has not been connected yet', async () => {
      const {analyticsService} = await loadService(undefined);

      expect(() =>
        analyticsService.trackAdhkarSessionStarted({category: 'morning'}),
      ).not.toThrow();
    });
  });

  describe('when analytics is disabled via env flag', () => {
    it('skips register and identify on setPostHogInstance', async () => {
      const {analyticsService} = await loadService('false');

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );

      expect(posthog.register).not.toHaveBeenCalled();
      expect(posthog.identify).not.toHaveBeenCalled();
    });

    it('never forwards events to posthog', async () => {
      const {analyticsService} = await loadService('false');

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );

      analyticsService.trackPlaybackStarted({
        surah_id: 1,
        reciter_id: 'r-1',
        rewayah_id: 'rw-1',
        source: 'direct',
        position_ms: 0,
      });

      expect(posthog.capture).not.toHaveBeenCalled();
    });
  });
});
