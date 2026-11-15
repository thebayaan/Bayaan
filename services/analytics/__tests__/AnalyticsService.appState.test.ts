// @ai-generated
// app_backgrounded and app_opened from the AppState changes, without React.
// iOS goes `inactive` on the way to `background`, and stays `inactive` while
// Control Center, the notification list or the app switcher is open.
import type {AppStateStatus} from 'react-native';

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => undefined,
    set: jest.fn(),
    delete: jest.fn(),
    getAllKeys: () => [],
  }),
}));
jest.mock('expo-crypto', () => ({randomUUID: () => 'test-device-id'}));
jest.mock('../LocalAggregationStore', () => ({
  localAggregationStore: {getToday: () => '2026-11-15'},
}));

type Service = typeof import('../AnalyticsService').analyticsService;

const capture = jest.fn();

/** A fresh service in an app process that starts in `launchState`. */
async function launch(launchState: AppStateStatus): Promise<Service> {
  jest.resetModules();
  require('react-native').AppState.currentState = launchState;
  const {analyticsService} = require('../AnalyticsService');
  const {useAnalyticsConsentStore} = require('@/store/analyticsConsentStore');
  await analyticsService.initialize();
  if (!useAnalyticsConsentStore.persist.hasHydrated()) {
    await new Promise<void>(resolve => {
      const unsub = useAnalyticsConsentStore.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }
  analyticsService.setPostHogInstance({
    capture,
    register: jest.fn(),
    identify: jest.fn(),
    optIn: jest.fn(() => Promise.resolve()),
    optOut: jest.fn(() => Promise.resolve()),
  });
  capture.mockClear();
  return analyticsService;
}

function sent(service: Service, states: AppStateStatus[]): string[] {
  capture.mockClear();
  states.forEach(state => service.handleAppStateChange(state));
  return capture.mock.calls.map(([event]) => event);
}

it('a cold launch sends nothing more than the mount does', async () => {
  // iOS starts `inactive` and then goes `active`; Android starts `active`.
  expect(sent(await launch('inactive'), ['active'])).toEqual([]);
  expect(sent(await launch('active'), ['active'])).toEqual([]);
});

it('a launch that starts in the background sends app_opened at its first active', async () => {
  const service = await launch('background');
  expect(sent(service, ['background', 'inactive', 'active'])).toEqual([
    'app_opened',
  ]);
  expect(sent(service, ['active'])).toEqual([]);
});

it('Control Center opening and closing sends nothing', async () => {
  const service = await launch('active');
  expect(sent(service, ['inactive', 'active', 'inactive', 'active'])).toEqual(
    [],
  );
});

it('one real background sends one app_backgrounded, and the return one app_opened', async () => {
  const service = await launch('active');
  // iOS: home screen, then back through the app switcher.
  expect(sent(service, ['inactive', 'background'])).toEqual([
    'app_backgrounded',
  ]);
  expect(sent(service, ['inactive', 'active'])).toEqual(['app_opened']);
  // Android: no inactive.
  expect(sent(service, ['background', 'active'])).toEqual([
    'app_backgrounded',
    'app_opened',
  ]);
});
