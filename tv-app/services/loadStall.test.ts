import {createLoadStallDetector, UNLOADED_POLLS_FOR_ERROR} from './loadStall';

describe('createLoadStallDetector', () => {
  it('fails a load that never arrives while asked to play', () => {
    const neverLoaded = createLoadStallDetector();
    const sample = {reportedPlaying: true, isLoaded: false};
    for (let i = 1; i < UNLOADED_POLLS_FOR_ERROR; i++) {
      expect(neverLoaded(sample)).toBe(false);
    }
    expect(neverLoaded(sample)).toBe(true);
  });

  it('starts counting again once the source loads or play stops', () => {
    const neverLoaded = createLoadStallDetector();
    for (let i = 1; i < UNLOADED_POLLS_FOR_ERROR; i++) {
      neverLoaded({reportedPlaying: true, isLoaded: false});
    }
    expect(neverLoaded({reportedPlaying: true, isLoaded: true})).toBe(false);
    expect(neverLoaded({reportedPlaying: true, isLoaded: false})).toBe(false);
    expect(neverLoaded({reportedPlaying: false, isLoaded: false})).toBe(false);
  });
});
