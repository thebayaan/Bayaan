// @ai-generated
// `branding.appStoreId` seam for the iOS "Write a Review" link.
// The jest-expo preset runs as iOS, so the iOS branch is the one under test.
// `APP_STORE_ID` is resolved at module load, so each case loads
// `reviewUtils` in isolation with its own branding mock.
import {Linking} from 'react-native';

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

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

beforeEach(() => openURL.mockClear());

it('uses the Bayaan App Store id when branding.appStoreId is absent', async () => {
  await loadReviewUtils(baseBranding).openAppStoreForReview();
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
