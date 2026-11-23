// @ai-generated
import {DownloadError} from '@/services/downloadService';
import {useNetworkStore} from '@/store/networkStore';
import {showDownloadFailedToast} from '../downloadFailedToast';

const mockToast = jest.fn();
jest.mock('@/utils/toastUtils', () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));
jest.mock('@/services/dataService', () => ({fetchAudioUrl: jest.fn()}));
jest.mock('expo-file-system/legacy', () => ({documentDirectory: 'file:///d/'}));

const surah = {name: 'Al-Baqarah', name_arabic: 'البقرة'};

beforeEach(() => {
  mockToast.mockClear();
  useNetworkStore.setState({isOnline: true});
});

it('says the download failed', () => {
  showDownloadFailedToast(surah, new Error('HTTP 404'));
  expect(mockToast).toHaveBeenCalledWith(
    "Couldn't download Al-Baqarah",
    'Check your internet connection and try again.',
    'error',
  );
});

it('says the device is offline when the download did not start', () => {
  showDownloadFailedToast(surah, new DownloadError('offline', 'offline'));
  expect(mockToast).toHaveBeenCalledWith(
    "Couldn't download Al-Baqarah",
    "You're offline. Connect to the internet and try again.",
    'error',
  );
});

it('says the device is offline when a started download failed offline', () => {
  // Android: the download is tried and fails by itself.
  useNetworkStore.setState({isOnline: false});
  showDownloadFailedToast(surah, new Error('Unable to resolve host'));
  expect(mockToast.mock.calls[0][1]).toBe(
    "You're offline. Connect to the internet and try again.",
  );
});

it('stays quiet when the user stopped the download', () => {
  showDownloadFailedToast(surah, new DownloadError('stopped', 'cancelled'));
  expect(mockToast).not.toHaveBeenCalled();
});
