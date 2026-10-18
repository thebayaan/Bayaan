import {create} from 'zustand';
import {storage} from '../services/storage';

const KEY = 'bayaan_tv_onboarded';

type OnboardingState = {
  onboarded: boolean;
  /**
   * The welcome was opened again from Settings, so Back on its first step
   * closes it instead of leaving it with nowhere to go.
   */
  rerun: boolean;
};

function readOnboarded(): boolean {
  return storage.getString(KEY) === '1';
}

/** Shared by the Router (the gate), Onboarding and Settings. */
export const useOnboardingStore = create<OnboardingState>(() => ({
  onboarded: readOnboarded(),
  rerun: false,
}));

export function markOnboarded(): void {
  storage.set(KEY, '1');
  useOnboardingStore.setState({onboarded: true, rerun: false});
}

/** Shows the welcome again (Settings > Show welcome again). */
export function resetOnboarded(): void {
  storage.remove(KEY);
  useOnboardingStore.setState({onboarded: false, rerun: true});
}

// Reflect external MMKV writes back into the store. Guarded because the node
// test mock does not implement the listener API.
if (typeof storage.addOnValueChangedListener === 'function') {
  storage.addOnValueChangedListener((key: string) => {
    if (key !== KEY) return;
    const next = readOnboarded();
    if (useOnboardingStore.getState().onboarded !== next) {
      useOnboardingStore.setState({onboarded: next});
    }
  });
}

export function useOnboarded(): {
  onboarded: boolean;
  rerun: boolean;
  markOnboarded: () => void;
  resetOnboarded: () => void;
} {
  const onboarded = useOnboardingStore(s => s.onboarded);
  const rerun = useOnboardingStore(s => s.rerun);
  return {onboarded, rerun, markOnboarded, resetOnboarded};
}
