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
  optIn: jest.Mock;
  optOut: jest.Mock;
};

function makeFakePostHog(): FakePostHog {
  return {
    capture: jest.fn(),
    identify: jest.fn(),
    register: jest.fn(),
    // optIn()/optOut() return Promise<void> on the real SDK; mirror that so
    // applyConsent's rejection-guard (`.catch`) has a promise to attach to.
    optIn: jest.fn(() => Promise.resolve()),
    optOut: jest.fn(() => Promise.resolve()),
  };
}

type ConsentStore =
  typeof import('@/store/analyticsConsentStore').useAnalyticsConsentStore;

async function loadService(envEnabled: string | undefined): Promise<{
  analyticsService: typeof import('../AnalyticsService').analyticsService;
  consentStore: ConsentStore;
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const consentMod = require('@/store/analyticsConsentStore');
  const consentStore: ConsentStore = consentMod.useAnalyticsConsentStore;
  // Initialize while the env flag is still set — the service latches `enabled`
  // inside initialize(), so the env var is only read once.
  await mod.analyticsService.initialize();
  // The consent store persists over AsyncStorage and hydrates asynchronously;
  // the service fails closed until then. Wait so assertions see the real flag.
  await waitForConsentHydration(consentStore);
  if (original === undefined) {
    delete process.env.EXPO_PUBLIC_ANALYTICS_ENABLED;
  } else {
    process.env.EXPO_PUBLIC_ANALYTICS_ENABLED = original;
  }
  return {analyticsService: mod.analyticsService, consentStore};
}

function waitForConsentHydration(store: ConsentStore): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
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
        reciter_name: 'Reciter One',
        rewayah_id: 'rw-1',
        source: 'direct',
        position_ms: 0,
      });

      expect(posthog.capture).toHaveBeenCalledWith('playback_started', {
        surah_id: 1,
        reciter_id: 'r-1',
        reciter_name: 'Reciter One',
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
        reciter_name: 'Reciter One',
        rewayah_id: 'rw-1',
        source: 'direct',
        position_ms: 0,
      });

      expect(posthog.capture).not.toHaveBeenCalled();
    });
  });

  describe('when the user opts out at runtime (Settings → Privacy)', () => {
    it('pushes optOut() to the SDK and optIn() when re-enabled', async () => {
      const {analyticsService, consentStore} = await loadService(undefined);

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );
      // Default consent is enabled, so connecting opts in.
      expect(posthog.optIn).toHaveBeenCalledTimes(1);
      expect(posthog.optOut).not.toHaveBeenCalled();

      consentStore.getState().setAnalyticsEnabled(false);
      expect(posthog.optOut).toHaveBeenCalledTimes(1);

      consentStore.getState().setAnalyticsEnabled(true);
      expect(posthog.optIn).toHaveBeenCalledTimes(2);
    });

    it('suppresses capture and identify while opted out', async () => {
      const {analyticsService, consentStore} = await loadService(undefined);

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );

      consentStore.getState().setAnalyticsEnabled(false);

      analyticsService.trackPlaybackStarted({
        surah_id: 1,
        reciter_id: 'r-1',
        reciter_name: 'Reciter One',
        rewayah_id: 'rw-1',
        source: 'direct',
        position_ms: 0,
      });
      analyticsService.identifyUser('user-123');

      expect(posthog.capture).not.toHaveBeenCalled();
      expect(posthog.identify).not.toHaveBeenCalled();
    });

    it('resumes capture and identify after opting back in', async () => {
      const {analyticsService, consentStore} = await loadService(undefined);

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );

      consentStore.getState().setAnalyticsEnabled(false);
      consentStore.getState().setAnalyticsEnabled(true);

      analyticsService.identifyUser('user-123');

      expect(posthog.identify).toHaveBeenCalledWith('user-123');
    });
  });

  describe('applyConsent', () => {
    it('calls optOut() when disabled and optIn() when enabled', async () => {
      const {analyticsService} = await loadService(undefined);

      const posthog = makeFakePostHog();
      analyticsService.setPostHogInstance(
        posthog as unknown as Parameters<
          typeof analyticsService.setPostHogInstance
        >[0],
      );
      posthog.optIn.mockClear();
      posthog.optOut.mockClear();

      analyticsService.applyConsent(false);
      expect(posthog.optOut).toHaveBeenCalledTimes(1);
      expect(posthog.optIn).not.toHaveBeenCalled();

      analyticsService.applyConsent(true);
      expect(posthog.optIn).toHaveBeenCalledTimes(1);
    });

    it('no-ops before a PostHog instance is connected', async () => {
      const {analyticsService} = await loadService(undefined);

      expect(() => analyticsService.applyConsent(false)).not.toThrow();
    });
  });
});
