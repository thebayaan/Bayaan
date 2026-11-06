// @ai-generated
// `branding.appStoreId` seam for the "Write a Review" link.
// The jest-expo preset runs as iOS; the Android case replaces `Platform.OS`.
// `APP_STORE_ID` is resolved at module load, so each case loads
// `reviewUtils` in isolation with its own branding mock.
import {Linking, Platform} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {getItem: jest.fn(), setItem: jest.fn()},
}));

const baseBranding = {
  appSlug: 'Bayaan',
  bundleId: {ios: 'com.bayaan.app', android: 'com.bayaan.app'},
};

function loadReviewUtils(branding: object): typeof import('../reviewUtils') {
  let mod: typeof import('../reviewUtils') | undefined;
  jest.isolateModules(() => {
    jest.doMock('../../config/branding', () => ({
      __esModule: true,
      default: branding,
    }));
    mod = require('../reviewUtils');
  });
  if (!mod) {
    throw new Error('reviewUtils did not load');
  }
  return mod;
}

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

beforeEach(() => openURL.mockClear());

it("opens Bayaan's review page with Bayaan's branding", async () => {
  const bayaan = jest.requireActual('../../config/branding');
  const reviewUtils = loadReviewUtils(bayaan);
  expect(reviewUtils.canOpenAppStoreForReview()).toBe(true);
  await reviewUtils.openAppStoreForReview();
  expect(openURL).toHaveBeenCalledWith(
    'https://apps.apple.com/app/id6648769980?action=write-review',
  );
});

it('uses branding.appStoreId when a fork sets it', async () => {
  await loadReviewUtils({
    ...baseBranding,
    appStoreId: '123',
  }).openAppStoreForReview();
  expect(openURL).toHaveBeenCalledWith(
    'https://apps.apple.com/app/id123?action=write-review',
  );
});

it('opens no App Store page on iOS when branding.appStoreId is absent', async () => {
  const reviewUtils = loadReviewUtils(baseBranding);
  expect(reviewUtils.canOpenAppStoreForReview()).toBe(false);
  await reviewUtils.openAppStoreForReview();
  expect(openURL).not.toHaveBeenCalled();
});

it('keeps the Play Store link on Android when branding.appStoreId is absent', async () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  try {
    const reviewUtils = loadReviewUtils(baseBranding);
    expect(reviewUtils.canOpenAppStoreForReview()).toBe(true);
    await reviewUtils.openAppStoreForReview();
    expect(openURL).toHaveBeenCalledWith(
      'market://details?id=com.bayaan.app&showAllReviews=true',
    );
  } finally {
    os.restore();
  }
});
