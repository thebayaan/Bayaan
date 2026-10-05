import {useMushafSettingsStore} from '../mushafSettingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const reset = (): void => {
  useMushafSettingsStore.setState({
    mushafRenderer: 'dk_v1',
    rewayah: 'hafs',
    showRewayahDiffs: true,
    rewayahExperimentalNoticeSeen: false,
  });
};

describe('mushafSettingsStore rewayah guards', () => {
  beforeEach(reset);

  it('switches rewayah under a Digital Khatt renderer', () => {
    useMushafSettingsStore.getState().setRewayah('warsh');

    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
  });

  it('refuses to switch rewayah under Mushaf 1440 (qcf_v2)', () => {
    // Mushaf 1440 pins the text to Hafs. This store guard is the last line of
    // defense behind the disabled picker; if it ever regresses, the reader
    // silently renders a rewayah the QCF pipeline cannot represent.
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});

    useMushafSettingsStore.getState().setRewayah('warsh');

    expect(useMushafSettingsStore.getState().rewayah).toBe('hafs');
  });

  it('refuses to toggle rewayah diffs under Mushaf 1440', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});

    useMushafSettingsStore.getState().toggleRewayahDiffs();

    expect(useMushafSettingsStore.getState().showRewayahDiffs).toBe(true);
  });
});

describe('rewayah experimental notice', () => {
  beforeEach(reset);

  it('starts unacknowledged so the first non-Hafs switch explains itself', () => {
    expect(
      useMushafSettingsStore.getState().rewayahExperimentalNoticeSeen,
    ).toBe(false);
  });

  it('stays acknowledged once marked, so the notice shows only once', () => {
    const {markRewayahExperimentalNoticeSeen} =
      useMushafSettingsStore.getState();

    markRewayahExperimentalNoticeSeen();
    markRewayahExperimentalNoticeSeen();

    expect(
      useMushafSettingsStore.getState().rewayahExperimentalNoticeSeen,
    ).toBe(true);
  });
});
