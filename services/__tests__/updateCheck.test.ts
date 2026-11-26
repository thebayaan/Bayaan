// @ai-generated
// RFC-025 — updateCheck behavior.
//
// Covers the behaviors that matter for a tenant:
//   - no `branding.updateSource` → off, no call (Bayaan default)
//   - recommended > running build → update, with the store link from branding
//   - equal / lower / null / malformed / rejected / slow source → no update
//   - no `appStoreId` → no iOS link, so no card on iOS
//   - store deep link fails → web store fallback
//   - 7-day snooze

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve();
      }),
      __mockStore: store,
    },
  };
});

jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  Linking: {openURL: jest.fn(() => Promise.resolve())},
}));

jest.mock('expo-application', () => ({nativeBuildVersion: '100'}));

jest.mock('@/config/branding', () => {
  const branding: Record<string, unknown> = {
    appSlug: 'testapp',
    appStoreId: '123456',
    bundleId: {ios: 'com.example.app', android: 'com.example.app'},
  };
  return {__esModule: true, default: branding};
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Linking, Platform} from 'react-native';
import * as Application from 'expo-application';
import branding from '@/config/branding';
import {
  UPDATE_CARD_SNOOZE_MS,
  checkForUpdate,
  getRunningBuildNumber,
  getStoreUrl,
  isUpdateCardSnoozed,
  openStoreForUpdate,
  snoozeUpdateCard,
  type UpdateSource,
} from '../updateCheck';

const mutableBranding = branding as unknown as Record<string, unknown>;
const mutablePlatform = Platform as {OS: string};
const mutableApplication = Application as {nativeBuildVersion: string | null};
const store = (AsyncStorage as unknown as {__mockStore: Map<string, string>})
  .__mockStore;

const source =
  (info: unknown): UpdateSource =>
  () =>
    Promise.resolve(info as never);

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  delete mutableBranding.updateSource;
  delete mutableBranding.openUpdate;
  mutableBranding.appStoreId = '123456';
  mutablePlatform.OS = 'ios';
  mutableApplication.nativeBuildVersion = '100';
});

describe('checkForUpdate', () => {
  it('is off when branding has no updateSource (Bayaan default)', async () => {
    await expect(checkForUpdate()).resolves.toEqual({
      updateAvailable: false,
      storeUrl: null,
    });
  });

  it('reads branding.updateSource when no source is passed', async () => {
    const fn = jest.fn(source({ios: {recommended: 101}}));
    mutableBranding.updateSource = fn;
    await expect(checkForUpdate()).resolves.toEqual({
      updateAvailable: true,
      storeUrl: 'itms-apps://apps.apple.com/app/id123456',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reports an update on Android with the Play link', async () => {
    mutablePlatform.OS = 'android';
    await expect(
      checkForUpdate({source: source({android: {recommended: 200}})}),
    ).resolves.toEqual({
      updateAvailable: true,
      storeUrl: 'market://details?id=com.example.app',
    });
  });

  it.each([
    ['equal build', {ios: {recommended: 100}}],
    ['lower build', {ios: {recommended: 99}}],
    ['null recommendation', {ios: {recommended: null}}],
    ['other platform only', {android: {recommended: 500}}],
    ['null info', null],
    ['string build', {ios: {recommended: '101'}}],
    ['fraction', {ios: {recommended: 100.5}}],
    ['array', []],
  ])('reports no update for %s', async (_label, info) => {
    await expect(checkForUpdate({source: source(info)})).resolves.toEqual({
      updateAvailable: false,
      storeUrl: null,
    });
  });

  it('reports no update when the source rejects', async () => {
    const failing: UpdateSource = () => Promise.reject(new Error('offline'));
    await expect(checkForUpdate({source: failing})).resolves.toMatchObject({
      updateAvailable: false,
    });
  });

  it('reports no update when the source throws synchronously', async () => {
    const throwing = (() => {
      throw new Error('bad');
    }) as unknown as UpdateSource;
    await expect(checkForUpdate({source: throwing})).resolves.toMatchObject({
      updateAvailable: false,
    });
  });

  it('reports no update when the source is slower than the timeout', async () => {
    jest.useFakeTimers();
    try {
      const slow: UpdateSource = () => new Promise(() => undefined);
      const pending = checkForUpdate({source: slow, timeoutMs: 50});
      jest.advanceTimersByTime(60);
      await expect(pending).resolves.toMatchObject({updateAvailable: false});
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports no update on iOS when branding has no appStoreId', async () => {
    delete mutableBranding.appStoreId;
    const fn = jest.fn(source({ios: {recommended: 999}}));
    await expect(checkForUpdate({source: fn})).resolves.toMatchObject({
      updateAvailable: false,
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('reports no update when the running build is unknown', async () => {
    mutableApplication.nativeBuildVersion = null;
    await expect(
      checkForUpdate({source: source({ios: {recommended: 999}})}),
    ).resolves.toMatchObject({updateAvailable: false});
  });

  it('reports no update on a platform without a store', async () => {
    mutablePlatform.OS = 'web';
    await expect(
      checkForUpdate({source: source({ios: {recommended: 999}})}),
    ).resolves.toMatchObject({updateAvailable: false});
  });
});

describe('getRunningBuildNumber', () => {
  it.each([
    ['100', 100],
    ['', null],
    ['1.2', null],
    ['abc', null],
    ['0', null],
  ])('parses %j as %j', (raw, expected) => {
    mutableApplication.nativeBuildVersion = raw;
    expect(getRunningBuildNumber()).toBe(expected);
  });
});

describe('getStoreUrl', () => {
  it('builds the links from branding', () => {
    expect(getStoreUrl('ios')).toBe('itms-apps://apps.apple.com/app/id123456');
    expect(getStoreUrl('android')).toBe('market://details?id=com.example.app');
    expect(getStoreUrl(null)).toBeNull();
  });
});

describe('openStoreForUpdate', () => {
  it('opens the store deep link', async () => {
    await openStoreForUpdate('ios');
    expect(Linking.openURL).toHaveBeenCalledWith(
      'itms-apps://apps.apple.com/app/id123456',
    );
  });

  it('falls back to the web store page when the deep link fails', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no app'));
    await openStoreForUpdate('android');
    expect(Linking.openURL).toHaveBeenLastCalledWith(
      'https://play.google.com/store/apps/details?id=com.example.app',
    );
  });

  it('does not throw when both links fail', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no app'));
    await expect(openStoreForUpdate('ios')).resolves.toBeUndefined();
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
  });

  it('lets branding.openUpdate handle the update', async () => {
    const openUpdate = jest.fn(() => Promise.resolve(true));
    mutableBranding.openUpdate = openUpdate;
    await openStoreForUpdate('android');
    expect(openUpdate).toHaveBeenCalledWith(
      'market://details?id=com.example.app',
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('does not call branding.openUpdate without a store link', async () => {
    delete mutableBranding.appStoreId;
    const openUpdate = jest.fn(() => Promise.resolve(true));
    mutableBranding.openUpdate = openUpdate;
    await openStoreForUpdate('ios');
    expect(openUpdate).not.toHaveBeenCalled();
  });

  it('ignores a required field in the source', async () => {
    await expect(
      checkForUpdate({
        source: source({ios: {recommended: 100, required: 200}}),
      }),
    ).resolves.toMatchObject({updateAvailable: false});
  });

  it.each([
    ['resolves false', () => Promise.resolve(false)],
    ['rejects', () => Promise.reject(new Error('no Play'))],
  ])(
    'opens the store link when branding.openUpdate %s',
    async (_label, impl) => {
      mutableBranding.openUpdate = jest.fn(impl);
      await openStoreForUpdate('android');
      expect(Linking.openURL).toHaveBeenCalledWith(
        'market://details?id=com.example.app',
      );
    },
  );

  it('opens nothing on iOS without an appStoreId', async () => {
    delete mutableBranding.appStoreId;
    await openStoreForUpdate('ios');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

describe('snooze', () => {
  it('hides the card for 7 days, then shows it again', async () => {
    const now = 1_000_000;
    await expect(isUpdateCardSnoozed(now)).resolves.toBe(false);
    await snoozeUpdateCard(now);
    await expect(isUpdateCardSnoozed(now + 1)).resolves.toBe(true);
    await expect(
      isUpdateCardSnoozed(now + UPDATE_CARD_SNOOZE_MS - 1),
    ).resolves.toBe(true);
    await expect(
      isUpdateCardSnoozed(now + UPDATE_CARD_SNOOZE_MS + 1),
    ).resolves.toBe(false);
  });

  it('treats a bad stored value as not snoozed', async () => {
    store.set('@testapp:updateCardSnoozedUntil', 'garbage');
    await expect(isUpdateCardSnoozed()).resolves.toBe(false);
  });
});
