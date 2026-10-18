import {
  useSettingsStore,
  resolveDefaultReciter,
  readPersistedDefaultReciterId,
} from './settingsStore';
import {storage} from '../services/storage';
import type {Reciter} from '../types/reciter';

const DEFAULT_RECITER_KEY = 'bayaan_tv_default_reciter_id';

function makeReciter(id: string, featured = false): Reciter {
  return {
    id,
    name: `Reciter ${id}`,
    name_arabic: null,
    date: '',
    image_url: null,
    bio: null,
    slug: id,
    is_featured: featured,
    is_active: true,
    created_at: '',
    updated_at: '',
    rewayat: [],
  };
}

// Mirrors A1's getDefaultReciter contract: prefers is_featured, else first.
function getDefaultReciter(reciters: Reciter[]): Reciter | null {
  if (reciters.length === 0) return null;
  return reciters.find(r => r.is_featured) ?? reciters[0];
}

beforeEach(() => {
  storage.clearAll();
  useSettingsStore.setState({
    defaultReciterId: null,
    picker: null,
    focusRow: null,
  });
});

describe('settingsStore', () => {
  it('defaults to null when nothing is persisted', () => {
    expect(useSettingsStore.getState().defaultReciterId).toBeNull();
    expect(readPersistedDefaultReciterId()).toBeNull();
  });

  it('setDefaultReciterId updates state and persists to MMKV', () => {
    useSettingsStore.getState().setDefaultReciterId('reciter-7');
    expect(useSettingsStore.getState().defaultReciterId).toBe('reciter-7');
    expect(storage.getString(DEFAULT_RECITER_KEY)).toBe('reciter-7');
  });

  it('persists across a re-init reading straight from MMKV', () => {
    useSettingsStore.getState().setDefaultReciterId('reciter-7');
    // Simulate a fresh launch reading the persisted value back from MMKV.
    expect(readPersistedDefaultReciterId()).toBe('reciter-7');
  });

  it('setDefaultReciterId(null) clears the persisted value', () => {
    useSettingsStore.getState().setDefaultReciterId('reciter-7');
    useSettingsStore.getState().setDefaultReciterId(null);
    expect(useSettingsStore.getState().defaultReciterId).toBeNull();
    expect(readPersistedDefaultReciterId()).toBeNull();
  });

  describe('picker focus', () => {
    it('remembers the row a picker opened from, in the same update', () => {
      useSettingsStore.getState().setPicker('speed');
      expect(useSettingsStore.getState().focusRow).toBe('speed');
      useSettingsStore.getState().setPicker(null);
      // Closing keeps the row, so focus goes straight back to it.
      expect(useSettingsStore.getState()).toMatchObject({
        picker: null,
        focusRow: 'speed',
      });
    });

    it('lets a plain row take focus back', () => {
      useSettingsStore.getState().setPicker('dim');
      useSettingsStore.getState().setPicker(null);
      useSettingsStore.getState().setFocusRow('welcome');
      expect(useSettingsStore.getState().focusRow).toBe('welcome');
      useSettingsStore.getState().setFocusRow(null);
      expect(useSettingsStore.getState().focusRow).toBeNull();
    });
  });

  describe('resolveDefaultReciter', () => {
    const reciters = [
      makeReciter('a'),
      makeReciter('b', true), // featured
      makeReciter('c'),
    ];

    it('overrides the featured default with the persisted reciter', () => {
      useSettingsStore.getState().setDefaultReciterId('c');
      const resolved = resolveDefaultReciter(reciters, getDefaultReciter);
      expect(resolved?.id).toBe('c');
      // Sanity: the featured fallback would otherwise have been 'b'.
      expect(getDefaultReciter(reciters)?.id).toBe('b');
    });

    it('falls back to getDefaultReciter when nothing is persisted', () => {
      const resolved = resolveDefaultReciter(reciters, getDefaultReciter);
      expect(resolved?.id).toBe('b');
    });

    it('falls back when the persisted id matches no reciter', () => {
      useSettingsStore.getState().setDefaultReciterId('does-not-exist');
      const resolved = resolveDefaultReciter(reciters, getDefaultReciter);
      expect(resolved?.id).toBe('b');
    });

    it('returns null when there are no reciters and nothing persisted', () => {
      expect(resolveDefaultReciter([], getDefaultReciter)).toBeNull();
    });
  });
});
