// @ai-generated
/**
 * Opening a saved verse in its rewayah tells the reader so in the app's
 * language: the toasts were English even in the Arabic UI.
 */
import i18n from '@/i18n';

const mockService = {
  rewayah: 'hafs' as string,
  switchRewayah: jest.fn(async (id: string) => {
    mockService.rewayah = id;
  }),
};
// Read lazily: the module under test is imported before these consts run.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get rewayah() {
      return mockService.rewayah;
    },
    switchRewayah: (id: string) => mockService.switchRewayah(id),
  },
  isRewayahSwitchSuperseded: (error: unknown) =>
    (error as Error).name === 'RewayahSwitchSupersededError',
}));

const mockSettings = {
  rewayah: 'hafs',
  mushafRenderer: 'dk_v2',
  setRewayah: jest.fn((id: string) => {
    mockSettings.rewayah = id;
  }),
};
jest.mock('@/store/mushafSettingsStore', () => ({
  REWAYAH_FALLBACK_RENDERER_LABEL: 'Madani 1421',
  useMushafSettingsStore: {getState: () => mockSettings},
}));

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

import {restoreSavedRewayah} from '../restoreSavedRewayah';
import {showToast} from '@/utils/toastUtils';

beforeEach(() => {
  mockService.rewayah = 'hafs';
  mockSettings.rewayah = 'hafs';
  jest.mocked(showToast).mockClear();
});

afterAll(() => i18n.changeLanguage('en'));

describe('restoreSavedRewayah toasts', () => {
  it('English: as before', async () => {
    await i18n.changeLanguage('en');
    await restoreSavedRewayah('warsh');
    expect(showToast).toHaveBeenCalledWith('Opening in', 'Warsh');
  });

  it('Arabic: the toast is in Arabic', async () => {
    await i18n.changeLanguage('ar');
    await restoreSavedRewayah('warsh');
    expect(showToast).toHaveBeenCalledWith('يُفتح برواية', 'ورش');
  });

  it('Arabic: a failed switch is reported in Arabic', async () => {
    await i18n.changeLanguage('ar');
    mockService.switchRewayah.mockRejectedValueOnce(new Error('db'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await restoreSavedRewayah('warsh');
    error.mockRestore();
    expect(showToast).toHaveBeenCalledWith(
      'تعذّر الفتح برواية ورش',
      'يُعرض برواية حفص بدلًا منها.',
      'error',
    );
  });
});
