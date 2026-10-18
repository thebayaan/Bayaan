import {
  markOnboarded,
  resetOnboarded,
  useOnboardingStore,
} from './useOnboarded';
import {storage} from '../services/storage';
import {useNavStore} from '../store/navStore';

const KEY = 'bayaan_tv_onboarded';

beforeEach(() => {
  storage.clearAll();
  useOnboardingStore.setState({onboarded: false, rerun: false});
  useNavStore.getState().reset();
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
    // Kept, so a kill during the rerun relaunches to Home.
    expect(storage.getString(KEY)).toBe('1');
  });

  it('opening the player during a rerun ends it', () => {
    markOnboarded();
    resetOnboarded();
    useNavStore.getState().push({screen: 'nowPlaying'});
    expect(useOnboardingStore.getState()).toEqual({
      onboarded: true,
      rerun: false,
    });
  });

  it('never skips a first-launch welcome for the player', () => {
    useNavStore.getState().push({screen: 'nowPlaying'});
    expect(useOnboardingStore.getState().onboarded).toBe(false);
    expect(storage.getString(KEY)).toBeUndefined();
  });

  it('finishing a rerun clears the rerun flag', () => {
    resetOnboarded();
    markOnboarded();
    expect(useOnboardingStore.getState().rerun).toBe(false);
  });
});
