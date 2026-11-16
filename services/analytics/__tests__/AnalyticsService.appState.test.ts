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

/** The events that the mount (`'mount'`) and the AppState changes send. */
function sent(service: Service, steps: (AppStateStatus | 'mount')[]): string[] {
  capture.mockClear();
  steps.forEach(step => {
    if (step === 'mount') {
      service.trackAppOpenedOnMount();
      return;
    }
    require('react-native').AppState.currentState = step;
    service.handleAppStateChange(step);
  });
  return capture.mock.calls.map(([event]) => event);
}

it('a cold launch sends one app_opened, from the mount', async () => {
  // iOS starts `inactive` and then goes `active`; Android starts `active`.
  expect(sent(await launch('inactive'), ['mount', 'active'])).toEqual([
    'app_opened',
  ]);
  expect(sent(await launch('active'), ['mount', 'active'])).toEqual([
    'app_opened',
  ]);
});

it('a launch that starts in the background sends app_opened at its first active', async () => {
  const service = await launch('background');
  expect(sent(service, ['background', 'inactive', 'active'])).toEqual([
    'app_opened',
  ]);
  expect(sent(service, ['active'])).toEqual([]);
});

it('a launch in the background, then the mount, then active sends one app_opened', async () => {
  // A CarPlay launch: the process starts in the background, and the phone
  // root mounts before the app comes to the screen.
  const carPlay = await launch('background');
  expect(sent(carPlay, ['mount'])).toEqual([]);
  expect(sent(carPlay, ['inactive', 'active'])).toEqual(['app_opened']);
  // The phone root mounts after the app comes to the screen: the mount sends
  // app_opened, and Control Center after it sends nothing.
  const service = await launch('background');
  require('react-native').AppState.currentState = 'active';
  expect(sent(service, ['mount', 'inactive', 'active'])).toEqual([
    'app_opened',
  ]);
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
