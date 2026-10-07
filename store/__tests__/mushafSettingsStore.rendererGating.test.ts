// @ai-generated
// Renderer gating for non-Hafs rewayat: IndoPak cannot draw their marks, so
// a non-Hafs rewayah always renders with a Madani DigitalKhatt font, and the
// persisted IndoPak + non-Hafs pair is migrated without touching the rewayah.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDkFontFamily,
  isRendererCompatibleWithRewayah,
  REWAYAH_FALLBACK_RENDERER,
  useMushafSettingsStore,
  type MushafRenderer,
} from '../mushafSettingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const reset = (
  mushafRenderer: MushafRenderer = 'dk_v1',
  rewayah: 'hafs' | 'warsh' = 'hafs',
): void => {
  useMushafSettingsStore.setState({
    mushafRenderer,
    rewayah,
    uthmaniFont: mushafRenderer === 'dk_v1' ? 'v1' : 'v2',
    showTajweed: true,
    showRewayahDiffs: true,
  });
};

const migrate = (state: Record<string, unknown>, version: number) => {
  const options = useMushafSettingsStore.persist.getOptions();
  if (!options.migrate) throw new Error('store has no migrate function');
  return options.migrate({...state}, version) as unknown as Record<
    string,
    unknown
  >;
};

describe('renderer helpers', () => {
  it('treats only the Madani DigitalKhatt fonts as able to draw non-Hafs text', () => {
    expect(isRendererCompatibleWithRewayah('dk_v1', 'warsh')).toBe(true);
    expect(isRendererCompatibleWithRewayah('dk_v2', 'qalun')).toBe(true);
    expect(isRendererCompatibleWithRewayah('dk_indopak', 'warsh')).toBe(false);
    expect(isRendererCompatibleWithRewayah('qcf_v2', 'warsh')).toBe(false);
    for (const renderer of [
      'dk_v1',
      'dk_v2',
      'dk_indopak',
      'qcf_v2',
    ] as const) {
      expect(isRendererCompatibleWithRewayah(renderer, 'hafs')).toBe(true);
    }
  });

  it('never draws non-Hafs text with the IndoPak font', () => {
    expect(getDkFontFamily('dk_indopak', 'hafs')).toBe('DigitalKhattIndoPak');
    expect(getDkFontFamily('dk_indopak', 'warsh')).toBe('DigitalKhattV2');
    expect(getDkFontFamily('dk_indopak', 'al-bazzi')).toBe('DigitalKhattV2');
    expect(getDkFontFamily('dk_v1', 'warsh')).toBe('DigitalKhattV1');
    expect(getDkFontFamily('dk_v2', 'hafs')).toBe('DigitalKhattV2');
    expect(getDkFontFamily('qcf_v2', 'hafs')).toBe('DigitalKhattV2');
  });

  it('falls back to a Madani DigitalKhatt renderer', () => {
    expect(['dk_v1', 'dk_v2']).toContain(REWAYAH_FALLBACK_RENDERER);
  });
});

describe('setRewayah', () => {
  it('moves IndoPak to the fallback Madani font when a non-Hafs rewayah is chosen', () => {
    reset('dk_indopak', 'hafs');

    useMushafSettingsStore.getState().setRewayah('warsh');

    const state = useMushafSettingsStore.getState();
    expect(state.rewayah).toBe('warsh');
    expect(state.mushafRenderer).toBe(REWAYAH_FALLBACK_RENDERER);
    expect(state.uthmaniFont).toBe(
      REWAYAH_FALLBACK_RENDERER === 'dk_v1' ? 'v1' : 'v2',
    );
  });

  it('keeps IndoPak for Hafs', () => {
    reset('dk_indopak', 'hafs');

    useMushafSettingsStore.getState().setRewayah('hafs');

    expect(useMushafSettingsStore.getState().mushafRenderer).toBe('dk_indopak');
  });

  it('leaves Madani fonts alone', () => {
    reset('dk_v1', 'hafs');

    useMushafSettingsStore.getState().setRewayah('qalun');

    const state = useMushafSettingsStore.getState();
    expect(state.rewayah).toBe('qalun');
    expect(state.mushafRenderer).toBe('dk_v1');
    expect(state.uthmaniFont).toBe('v1');
  });

  it('still refuses a non-Hafs rewayah under Mushaf 1440', () => {
    reset('qcf_v2', 'hafs');

    useMushafSettingsStore.getState().setRewayah('warsh');

    const state = useMushafSettingsStore.getState();
    expect(state.rewayah).toBe('hafs');
    expect(state.mushafRenderer).toBe('qcf_v2');
  });
});

describe('setMushafRenderer', () => {
  it('refuses IndoPak while a non-Hafs rewayah is active, without touching the rewayah', () => {
    reset('dk_v2', 'warsh');

    useMushafSettingsStore.getState().setMushafRenderer('dk_indopak');

    const state = useMushafSettingsStore.getState();
    expect(state.mushafRenderer).toBe('dk_v2');
    expect(state.rewayah).toBe('warsh');
  });

  it('allows IndoPak for Hafs', () => {
    reset('dk_v1', 'hafs');

    useMushafSettingsStore.getState().setMushafRenderer('dk_indopak');

    const state = useMushafSettingsStore.getState();
    expect(state.mushafRenderer).toBe('dk_indopak');
    expect(state.uthmaniFont).toBe('v2');
  });

  it('keeps the Mushaf 1440 rule: Hafs, no tajweed, no rewayah diffs', () => {
    reset('dk_v2', 'warsh');

    useMushafSettingsStore.getState().setMushafRenderer('qcf_v2');

    const state = useMushafSettingsStore.getState();
    expect(state.mushafRenderer).toBe('qcf_v2');
    expect(state.rewayah).toBe('hafs');
    expect(state.showTajweed).toBe(false);
    expect(state.showRewayahDiffs).toBe(false);
  });

  it('maps Madani 1405 to the v1 font and the others to v2', () => {
    reset('dk_v2', 'hafs');
    useMushafSettingsStore.getState().setMushafRenderer('dk_v1');
    expect(useMushafSettingsStore.getState().uthmaniFont).toBe('v1');
    useMushafSettingsStore.getState().setMushafRenderer('dk_v2');
    expect(useMushafSettingsStore.getState().uthmaniFont).toBe('v2');
  });
});

describe('persist migration v18', () => {
  it('moves a persisted IndoPak + non-Hafs pair to the fallback font and keeps the rewayah', () => {
    const migrated = migrate(
      {mushafRenderer: 'dk_indopak', uthmaniFont: 'v2', rewayah: 'warsh'},
      17,
    );
    expect(migrated.rewayah).toBe('warsh');
    expect(migrated.mushafRenderer).toBe(REWAYAH_FALLBACK_RENDERER);
  });

  it('leaves IndoPak + Hafs and Madani + non-Hafs untouched', () => {
    expect(
      migrate({mushafRenderer: 'dk_indopak', rewayah: 'hafs'}, 17)
        .mushafRenderer,
    ).toBe('dk_indopak');
    expect(
      migrate({mushafRenderer: 'dk_v1', rewayah: 'qalun'}, 17).mushafRenderer,
    ).toBe('dk_v1');
  });

  it('runs after the slug migration for very old states', () => {
    const migrated = migrate(
      {
        mushafRenderer: 'dk_indopak',
        uthmaniFont: 'v2',
        rewayah: 'qaloon',
        arabicTextWeight: 'normal',
      },
      14,
    );
    expect(migrated.rewayah).toBe('qalun');
    expect(migrated.mushafRenderer).toBe(REWAYAH_FALLBACK_RENDERER);
  });

  it('does not re-run for states already at v18', () => {
    const migrated = migrate(
      {mushafRenderer: 'dk_indopak', rewayah: 'warsh'},
      18,
    );
    expect(migrated.mushafRenderer).toBe('dk_indopak');
  });

  it('applies on rehydration from storage', async () => {
    await AsyncStorage.setItem(
      'mushaf-settings',
      JSON.stringify({
        state: {
          mushafRenderer: 'dk_indopak',
          uthmaniFont: 'v2',
          rewayah: 'al-duri-abi-amr',
          showRewayahDiffs: true,
        },
        version: 17,
      }),
    );

    await useMushafSettingsStore.persist.rehydrate();

    const state = useMushafSettingsStore.getState();
    expect(state.rewayah).toBe('al-duri-abi-amr');
    expect(state.mushafRenderer).toBe(REWAYAH_FALLBACK_RENDERER);
  });
});
