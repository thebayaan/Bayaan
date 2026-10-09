// @ai-generated
// Startup fallback rules in the settings store: while Hafs stands in for a
// saved rewayah that could not be loaded, `rewayah` names the Hafs on screen
// and the saved rewayah is what gets persisted, until the reader's own
// choice (or a font that cannot draw it) replaces it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useMushafSettingsStore,
  type MushafRenderer,
} from '../mushafSettingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

async function persisted(): Promise<Record<string, unknown>> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const raw = await AsyncStorage.getItem('mushaf-settings');
  return raw ? (JSON.parse(raw).state as Record<string, unknown>) : {};
}

const partialize = (state: Record<string, unknown>) => {
  const options = useMushafSettingsStore.persist.getOptions();
  if (!options.partialize) throw new Error('store has no partialize');
  return options.partialize(
    state as unknown as ReturnType<typeof useMushafSettingsStore.getState>,
  ) as unknown as Record<string, unknown>;
};

/** The state right after a startup fallback from `from` to Hafs. */
function fellBackFrom(
  from: 'warsh' | 'qalun',
  mushafRenderer: MushafRenderer = 'dk_v2',
): void {
  useMushafSettingsStore.setState({
    mushafRenderer,
    uthmaniFont: mushafRenderer === 'dk_v1' ? 'v1' : 'v2',
    rewayah: from,
    rewayahFallbackFrom: null,
  });
  const store = useMushafSettingsStore.getState();
  store.startRewayahFallback(from);
  store.setRewayah('hafs'); // the data service's Hafs commit
}

describe('startRewayahFallback', () => {
  it('records the saved rewayah while the store names the Hafs shown', async () => {
    fellBackFrom('warsh');
    const state = useMushafSettingsStore.getState();
    expect(state.rewayah).toBe('hafs');
    expect(state.rewayahFallbackFrom).toBe('warsh');
    const saved = await persisted();
    expect(saved.rewayah).toBe('warsh');
    expect(saved).not.toHaveProperty('rewayahFallbackFrom');
  });

  // @ai-start
  it('names the Hafs shown and keeps the saved rewayah in one update', async () => {
    useMushafSettingsStore.setState({
      mushafRenderer: 'dk_v2',
      uthmaniFont: 'v2',
      rewayah: 'warsh',
      rewayahFallbackFrom: null,
    });
    const seen: [string, string | null][] = [];
    const unsubscribe = useMushafSettingsStore.subscribe(state =>
      seen.push([state.rewayah, state.rewayahFallbackFrom]),
    );
    useMushafSettingsStore.getState().startRewayahFallback('warsh');
    unsubscribe();
    expect(seen).toEqual([['hafs', 'warsh']]);
    expect((await persisted()).rewayah).toBe('warsh');
  });
  // @ai-end

  it('never records Hafs, or anything under Mushaf 1440', () => {
    useMushafSettingsStore.setState({
      mushafRenderer: 'dk_v1',
      rewayah: 'hafs',
      rewayahFallbackFrom: null,
    });
    useMushafSettingsStore.getState().startRewayahFallback('hafs');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();

    useMushafSettingsStore.setState({mushafRenderer: 'qcf_v2'});
    useMushafSettingsStore.getState().startRewayahFallback('warsh');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
  });
});

describe('ending a fallback', () => {
  it('ends when a non-Hafs rewayah is shown, which is then saved', async () => {
    fellBackFrom('warsh');
    useMushafSettingsStore.getState().setRewayah('qalun');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
    expect((await persisted()).rewayah).toBe('qalun');
  });

  it('survives Hafs being shown again (the fallback itself shows Hafs)', async () => {
    fellBackFrom('warsh');
    useMushafSettingsStore.getState().setRewayah('hafs');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBe('warsh');
    expect((await persisted()).rewayah).toBe('warsh');
  });

  it('saves Hafs when the reader keeps it', async () => {
    fellBackFrom('warsh');
    useMushafSettingsStore.getState().clearRewayahFallback();
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
    expect((await persisted()).rewayah).toBe('hafs');
  });

  it('ends when the reader picks a font that cannot draw the saved rewayah', async () => {
    for (const renderer of ['dk_indopak', 'qcf_v2'] as const) {
      fellBackFrom('warsh');
      useMushafSettingsStore.getState().setMushafRenderer(renderer);
      const state = useMushafSettingsStore.getState();
      expect(state.mushafRenderer).toBe(renderer);
      expect(state.rewayah).toBe('hafs');
      expect(state.rewayahFallbackFrom).toBeNull();
      // Never a persisted IndoPak or Mushaf 1440 + Warsh pair.
      const saved = await persisted();
      expect(saved.rewayah).toBe('hafs');
      expect(saved.mushafRenderer).toBe(renderer);
    }
  });

  it('survives a switch between the Madani fonts, which draw every rewayah', async () => {
    fellBackFrom('qalun', 'dk_v2');
    useMushafSettingsStore.getState().setMushafRenderer('dk_v1');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBe('qalun');
    const saved = await persisted();
    expect(saved.rewayah).toBe('qalun');
    expect(saved.mushafRenderer).toBe('dk_v1');
  });
});

describe('persisted shape', () => {
  it('is unchanged when there is no fallback', () => {
    const out = partialize({
      rewayah: 'warsh',
      mushafRenderer: 'dk_v2',
      rewayahFallbackFrom: null,
    });
    expect(out).toEqual({rewayah: 'warsh', mushafRenderer: 'dk_v2'});
  });

  it('rehydrates the saved rewayah, never the fallback marker', async () => {
    fellBackFrom('warsh');
    const stored = await persisted();
    expect(stored.rewayah).toBe('warsh');
    expect(stored).not.toHaveProperty('rewayahFallbackFrom');
    await useMushafSettingsStore.persist.rehydrate();
    expect(useMushafSettingsStore.getState().rewayah).toBe('warsh');
  });
});
