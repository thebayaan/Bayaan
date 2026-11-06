// @ai-start
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {useMushafSettingsStore as store} from '../mushafSettingsStore';

describe('Mushaf 1440 tajweed preview', () => {
  it('enables the preview when selecting 1440 and keeps Hafs selected', () => {
    store.setState({
      mushafRenderer: 'dk_v1',
      showTajweed: false,
      rewayah: 'hafs',
    });
    store.getState().setMushafRenderer('qcf_v2');
    expect(store.getState()).toMatchObject({
      showTajweed: true,
      rewayah: 'hafs',
    });
    store.getState().setRewayah('warsh');
    expect(store.getState().rewayah).toBe('hafs');
  });

  it('can switch tajweed off and on without changing the renderer', () => {
    store.setState({mushafRenderer: 'qcf_v2', showTajweed: true});
    store.getState().toggleTajweed();
    store.getState().setMushafRenderer('qcf_v2');
    expect(store.getState().showTajweed).toBe(false);
    store.getState().toggleTajweed();
    expect(store.getState()).toMatchObject({
      mushafRenderer: 'qcf_v2',
      showTajweed: true,
    });
  });

  it('enables the preview for existing 1440 settings without changing DK preferences', async () => {
    const migrate = store.persist.getOptions().migrate;
    if (!migrate) throw new Error('Mushaf settings migration is missing');
    expect(
      await migrate({mushafRenderer: 'qcf_v2', showTajweed: false}, 18),
    ).toMatchObject({showTajweed: true});
    expect(
      await migrate({mushafRenderer: 'dk_v1', showTajweed: false}, 18),
    ).toMatchObject({showTajweed: false});
    expect(
      await migrate({mushafRenderer: 'qcf_v2', showTajweed: false}, 19),
    ).toMatchObject({showTajweed: false});
  });
});
// @ai-end
