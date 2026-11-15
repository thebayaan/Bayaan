// @ai A switch that a newer open takes over is not a failure.
import {restoreSavedRewayah} from '../restoreSavedRewayah';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {showToast} from '@/utils/toastUtils';

class FakeSuperseded extends Error {}

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {rewayah: 'hafs', switchRewayah: jest.fn()},
  isRewayahSwitchSuperseded: (error: unknown) =>
    (error as Error).name === 'RewayahSwitchSupersededError',
}));
jest.mock('@/services/rewayah/RewayahIdentity', () => ({
  hasTextData: () => true,
}));
const mockSetRewayah = jest.fn();
jest.mock('@/store/mushafSettingsStore', () => ({
  REWAYAH_FALLBACK_RENDERER_LABEL: 'Madani',
  useMushafSettingsStore: {
    getState: () => ({
      rewayah: 'hafs',
      mushafRenderer: 'dk_v2',
      setRewayah: mockSetRewayah,
    }),
  },
}));
jest.mock('@/utils/rewayahLabels', () => ({
  getRewayahShortLabel: (rewayah: string) => rewayah,
}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

const switchRewayah = digitalKhattDataService.switchRewayah as jest.Mock;

describe('restoreSavedRewayah', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('stays silent when a newer open supersedes the switch', async () => {
    const superseded = new FakeSuperseded('superseded');
    superseded.name = 'RewayahSwitchSupersededError';
    switchRewayah.mockRejectedValueOnce(superseded);

    await restoreSavedRewayah('warsh');

    expect(showToast).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(mockSetRewayah).not.toHaveBeenCalled();
    expect(switchRewayah).toHaveBeenCalledTimes(1);
  });

  it('tells the reader when the switch really fails', async () => {
    switchRewayah.mockRejectedValueOnce(new Error('unreadable'));

    await restoreSavedRewayah('warsh');

    expect(showToast).toHaveBeenCalledWith(
      "Couldn't open in warsh",
      'Showing hafs instead.',
      'error',
    );
  });
});
