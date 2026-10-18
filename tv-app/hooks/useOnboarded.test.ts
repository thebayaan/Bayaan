import {
  markOnboarded,
  resetOnboarded,
  useOnboardingStore,
} from './useOnboarded';
import {storage} from '../services/storage';

const KEY = 'bayaan_tv_onboarded';

beforeEach(() => {
  storage.clearAll();
  useOnboardingStore.setState({onboarded: false, rerun: false});
});

describe('onboarding gate', () => {
  it('marks onboarding done and persists it', () => {
    markOnboarded();
    expect(useOnboardingStore.getState()).toEqual({
      onboarded: true,
      rerun: false,
    });
    expect(storage.getString(KEY)).toBe('1');
  });

  it('shows the welcome again from Settings as a rerun', () => {
    markOnboarded();
    resetOnboarded();
    expect(useOnboardingStore.getState()).toEqual({
      onboarded: false,
      rerun: true,
    });
    expect(storage.getString(KEY)).toBeUndefined();
  });

  it('finishing a rerun clears the rerun flag', () => {
    resetOnboarded();
    markOnboarded();
    expect(useOnboardingStore.getState().rerun).toBe(false);
  });
});
