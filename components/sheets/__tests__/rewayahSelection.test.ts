// @ai-generated
// The settings rewayah picker keeps the settings store and the data service
// in step: a failed switch leaves the store naming the rewayah still on
// screen and tells the reader; a switch overtaken by a newer tap is silent;
// choosing Hafs after a startup fallback makes Hafs the saved rewayah.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  chooseMushafRewayah,
  reconcileRewayahWithService,
  selectMushafRewayah,
} from '../rewayahSelection';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

// A data service whose switch outcome each test scripts. A successful switch
// commits like the real one: the served rewayah changes and the store is
// written in the same step.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const state = {
    rewayah: 'hafs',
    initialized: true,
    pendingRewayah: null as string | null,
    outcome: 'commit' as 'commit' | 'fail' | 'supersede',
  };
  const service = {
    get rewayah() {
      return state.rewayah;
    },
    get initialized() {
      return state.initialized;
    },
    get pendingRewayah() {
      return state.pendingRewayah;
    },
    switchRewayah: jest.fn(async (rewayah: string) => {
      if (rewayah === state.rewayah) {
        state.pendingRewayah = null;
        return;
      }
      if (state.outcome === 'supersede') {
        const error = new Error(`switch to ${rewayah} superseded`);
        error.name = 'RewayahSwitchSupersededError';
        throw error;
      }
      if (state.outcome === 'fail') {
        const error = new Error(`Could not load rewayah "${rewayah}"`);
        error.name = 'RewayahLoadError';
        throw error;
      }
      state.rewayah = rewayah;
      state.initialized = true;
      const {useMushafSettingsStore: store} = jest.requireActual(
        '@/store/mushafSettingsStore',
      );
      if (store.getState().rewayah !== rewayah) {
        store.getState().setRewayah(rewayah);
      }
    }),
  };
  return {
    digitalKhattDataService: service,
    isRewayahSwitchSuperseded: (error: unknown) =>
      error instanceof Error && error.name === 'RewayahSwitchSupersededError',
    __state: state,
  };
});

const {__state: dk, digitalKhattDataService: service} = jest.requireMock(
  '@/services/mushaf/DigitalKhattDataService',
) as {
  __state: {
    rewayah: string;
    initialized: boolean;
    pendingRewayah: string | null;
    outcome: 'commit' | 'fail' | 'supersede';
  };
  digitalKhattDataService: {switchRewayah: jest.Mock};
};
const {showToast} = jest.requireMock('@/utils/toastUtils') as {
  showToast: jest.Mock;
};

async function persistedRewayah(): Promise<unknown> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const raw = await AsyncStorage.getItem('mushaf-settings');
  return raw ? JSON.parse(raw).state.rewayah : undefined;
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  dk.rewayah = 'hafs';
  dk.initialized = true;
  dk.pendingRewayah = null;
  dk.outcome = 'commit';
  service.switchRewayah.mockClear();
  showToast.mockClear();
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    uthmaniFont: 'v2',
    rewayahFallbackFrom: null,
  });
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('selectMushafRewayah', () => {
  it('switches the data service first and then names the new rewayah', async () => {
    await expect(selectMushafRewayah('warsh')).resolves.toEqual({
      kind: 'switched',
      rewayah: 'warsh',
    });
    expect(service.switchRewayah).toHaveBeenCalledWith('warsh');
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
  });

  it('keeps the store on the rewayah still shown when the switch fails', async () => {
    dk.outcome = 'fail';
    await expect(selectMushafRewayah('warsh')).resolves.toEqual({
      kind: 'failed',
      requested: 'warsh',
      showing: 'hafs',
    });
    expect(dk.rewayah).toBe('hafs');
    expect(useMushafSettingsStore.getState().rewayah).toBe('hafs');
  });

  it('re-aligns a store that disagreed with the data service after a failure', async () => {
    useMushafSettingsStore.setState({rewayah: 'qalun'});
    dk.rewayah = 'warsh';
    dk.outcome = 'fail';
    const outcome = await selectMushafRewayah('al-bazzi');
    expect(outcome).toEqual({
      kind: 'failed',
      requested: 'al-bazzi',
      showing: 'warsh',
    });
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
  });

  it('is silent when a newer selection overtakes it', async () => {
    dk.outcome = 'supersede';
    await expect(selectMushafRewayah('warsh')).resolves.toEqual({
      kind: 'superseded',
    });
    expect(useMushafSettingsStore.getState().rewayah).toBe('hafs');
  });

  it('does nothing for the rewayah already shown', async () => {
    await expect(selectMushafRewayah('hafs')).resolves.toEqual({
      kind: 'unchanged',
    });
    expect(service.switchRewayah).not.toHaveBeenCalled();
  });

  it('cancels a switch still loading when the rewayah on screen is tapped', async () => {
    dk.pendingRewayah = 'qalun';
    await expect(selectMushafRewayah('hafs')).resolves.toEqual({
      kind: 'unchanged',
    });
    expect(service.switchRewayah).toHaveBeenCalledWith('hafs');
    expect(dk.pendingRewayah).toBeNull();
  });

  it('switches the data service when it does not serve the rewayah the store names', async () => {
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    const outcome = await selectMushafRewayah('warsh');
    expect(outcome).toEqual({kind: 'switched', rewayah: 'warsh'});
    expect(dk.rewayah).toBe('warsh');
  });

  it('refuses Mushaf 1440 and rewayat without bundled text', async () => {
    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    await expect(selectMushafRewayah('warsh')).resolves.toEqual({
      kind: 'unchanged',
    });
    useMushafSettingsStore.setState({mushafRenderer: 'dk_v2'});
    await expect(selectMushafRewayah('hisham')).resolves.toEqual({
      kind: 'unchanged',
    });
    expect(service.switchRewayah).not.toHaveBeenCalled();
  });

  it('reports that nothing is shown when the data service never loaded', async () => {
    dk.initialized = false;
    dk.outcome = 'fail';
    await expect(selectMushafRewayah('warsh')).resolves.toEqual({
      kind: 'failed',
      requested: 'warsh',
      showing: null,
    });
  });
});

describe('after a startup fallback', () => {
  beforeEach(() => {
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    useMushafSettingsStore.getState().startRewayahFallback('warsh');
    useMushafSettingsStore.getState().setRewayah('hafs');
  });

  it('makes Hafs the saved rewayah when the reader chooses it', async () => {
    expect(await persistedRewayah()).toBe('warsh');
    await expect(selectMushafRewayah('hafs')).resolves.toEqual({
      kind: 'kept-hafs',
    });
    expect(service.switchRewayah).not.toHaveBeenCalled();
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
    expect(await persistedRewayah()).toBe('hafs');
  });

  it('ends the fallback when a retry loads the saved rewayah', async () => {
    await expect(selectMushafRewayah('warsh')).resolves.toEqual({
      kind: 'switched',
      rewayah: 'warsh',
    });
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
    expect(await persistedRewayah()).toBe('warsh');
  });

  it('keeps the fallback and the saved rewayah when a retry fails', async () => {
    dk.outcome = 'fail';
    const outcome = await selectMushafRewayah('warsh');
    expect(outcome.kind).toBe('failed');
    expect(useMushafSettingsStore.getState().rewayah).toBe('hafs');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBe('warsh');
    expect(await persistedRewayah()).toBe('warsh');
  });
});

describe('chooseMushafRewayah', () => {
  it('announces a switch', async () => {
    await chooseMushafRewayah('warsh');
    expect(showToast).toHaveBeenCalledWith('Now reading', 'Warsh');
  });

  it('announces a failure with the rewayah still shown', async () => {
    dk.outcome = 'fail';
    await chooseMushafRewayah('warsh');
    expect(showToast).toHaveBeenCalledWith(
      "Couldn't load Warsh",
      'Still showing Hafs.',
      'error',
    );
  });

  it('asks for a retry when nothing could be shown', async () => {
    dk.initialized = false;
    dk.outcome = 'fail';
    await chooseMushafRewayah('warsh');
    expect(showToast).toHaveBeenCalledWith(
      "Couldn't load Warsh",
      'Please try again.',
      'error',
    );
  });

  it('stays quiet for an overtaken or unchanged selection', async () => {
    dk.outcome = 'supersede';
    await chooseMushafRewayah('warsh');
    await chooseMushafRewayah('hafs');
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe('reconcileRewayahWithService', () => {
  it('leaves the store alone before the data service has loaded', () => {
    dk.initialized = false;
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    reconcileRewayahWithService();
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
  });
});
