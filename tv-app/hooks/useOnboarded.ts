import {create} from 'zustand';
import {storage} from '../services/storage';
import {useNavStore, type ScreenEntry} from '../store/navStore';

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

/**
 * Shows the welcome again (Settings > Show welcome again). Only in memory:
 * the saved flag stays, so an app killed during the rerun relaunches to
 * Home, not to a first-launch welcome.
 */
export function resetOnboarded(): void {
  useOnboardingStore.setState({onboarded: false, rerun: true});
}

/**
 * Opening the player during a rerun (its now-playing pill) ends the rerun,
 * so the player shows over Settings and Back returns there. A first-launch
 * welcome is never skipped this way.
 */
export function endRerunForPlayer(stack: readonly ScreenEntry[]): void {
  if (!useOnboardingStore.getState().rerun) return;
  if (stack.some(e => e.screen === 'nowPlaying')) markOnboarded();
}

useNavStore.subscribe((state, prev) => {
  if (state.stack !== prev.stack) endRerunForPlayer(state.stack);
});

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
