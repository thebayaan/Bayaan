// @ai-generated
// The reader is told, once per fallback, when the saved rewayah could not be
// loaded at startup and Hafs is shown instead.
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  installRewayahFallbackNotice,
  rewayahFallbackNotice,
} from '../rewayahFallbackNotice';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

const {showToast} = jest.requireMock('@/utils/toastUtils') as {
  showToast: jest.Mock;
};

/** What the data service does when Warsh fails to load at startup. */
function fallBackFromWarsh(): void {
  useMushafSettingsStore.setState({rewayah: 'warsh'});
  useMushafSettingsStore.getState().startRewayahFallback('warsh');
  useMushafSettingsStore.getState().setRewayah('hafs');
}

let uninstall: (() => void) | null = null;

beforeEach(() => {
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    rewayahFallbackFrom: null,
  });
  showToast.mockClear();
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
});

it('names the rewayah that failed and says Hafs is shown', () => {
  expect(rewayahFallbackNotice('warsh')).toEqual({
    title: "Couldn't load Warsh",
    message: 'Showing Hafs instead.',
  });
  expect(rewayahFallbackNotice('al-duri-abi-amr').title).not.toMatch(/[—–]/);
});

it('shows one error toast when a fallback starts', () => {
  uninstall = installRewayahFallbackNotice();
  fallBackFromWarsh();
  expect(showToast).toHaveBeenCalledTimes(1);
  expect(showToast).toHaveBeenCalledWith(
    "Couldn't load Warsh",
    'Showing Hafs instead.',
    'error',
  );

  // Other settings changes during the fallback stay quiet.
  useMushafSettingsStore.getState().setArabicFontSize(30);
  useMushafSettingsStore.getState().setRewayah('hafs');
  expect(showToast).toHaveBeenCalledTimes(1);
});

it('stays quiet when a fallback ends, and speaks again for a new one', () => {
  uninstall = installRewayahFallbackNotice();
  fallBackFromWarsh();
  useMushafSettingsStore.getState().setRewayah('warsh'); // a retry loaded it
  expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
  expect(showToast).toHaveBeenCalledTimes(1);

  fallBackFromWarsh();
  expect(showToast).toHaveBeenCalledTimes(2);
});

it('announces a fallback that started before it was installed', () => {
  fallBackFromWarsh();
  uninstall = installRewayahFallbackNotice();
  expect(showToast).toHaveBeenCalledTimes(1);
});

it('installs once and can be removed', () => {
  uninstall = installRewayahFallbackNotice();
  expect(installRewayahFallbackNotice()).toBe(uninstall);
  uninstall();
  uninstall = null;
  fallBackFromWarsh();
  expect(showToast).not.toHaveBeenCalled();
});
