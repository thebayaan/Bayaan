import {create} from 'zustand';
import {storage} from '../services/storage';
import type {Reciter} from '../types/reciter';

// Shared with the legacy `useDefaultReciter` hook so the picker stays in sync
// with the screens that still read through that hook.
const DEFAULT_RECITER_KEY = 'bayaan_tv_default_reciter_id';

/** The picker open beside the Settings rows, if any. */
export type SettingsPicker =
  | 'reciter'
  | 'speed'
  | 'sound'
  | 'mode'
  | 'translation'
  | 'textSize'
  | 'dim';

/** Pickers for what the listening room shows; they open beside a big preview. */
export const DISPLAY_PICKERS: readonly SettingsPicker[] = [
  'mode',
  'translation',
  'textSize',
];

type SettingsState = {
  defaultReciterId: string | null;
  setDefaultReciterId: (id: string | null) => void;
  picker: SettingsPicker | null;
  setPicker: (picker: SettingsPicker | null) => void;
};

export function readPersistedDefaultReciterId(): string | null {
  return storage.getString(DEFAULT_RECITER_KEY) ?? null;
}

export const useSettingsStore = create<SettingsState>(set => ({
  defaultReciterId: readPersistedDefaultReciterId(),
  setDefaultReciterId: (id: string | null): void => {
    if (id === null) {
      storage.remove(DEFAULT_RECITER_KEY);
    } else {
      storage.set(DEFAULT_RECITER_KEY, id);
    }
    set({defaultReciterId: id});
  },
  picker: null,
  setPicker: picker => set({picker}),
}));

// Reflect external MMKV writes (e.g. the Onboarding screen still sets the
// default through `useDefaultReciter`) back into the store. Guarded because the
// node test mock does not implement the listener API.
if (typeof storage.addOnValueChangedListener === 'function') {
  storage.addOnValueChangedListener((key: string) => {
    if (key !== DEFAULT_RECITER_KEY) return;
    const next = readPersistedDefaultReciterId();
    if (useSettingsStore.getState().defaultReciterId !== next) {
      useSettingsStore.setState({defaultReciterId: next});
    }
  });
}

/**
 * Resolves the effective default reciter for first-launch / Quick Play seeding.
 * The persisted picker choice wins; otherwise we defer to A1's
 * `getDefaultReciter` (prefers `is_featured`, else first), passed in by
 * interface to avoid a hard dependency between this store and the data layer.
 */
export function resolveDefaultReciter(
  reciters: Reciter[],
  getFallbackDefault: (reciters: Reciter[]) => Reciter | null,
): Reciter | null {
  const persistedId = useSettingsStore.getState().defaultReciterId;
  if (persistedId !== null) {
    const match = reciters.find(r => r.id === persistedId);
    if (match) return match;
  }
  return getFallbackDefault(reciters);
}
