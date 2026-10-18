import {createPauseDetector, type PlayerSample} from './pauseDetector';

const playing: PlayerSample = {
  reportedPlaying: true,
  isPlaying: true,
  isBuffering: false,
  isLoaded: true,
};
const stopped: PlayerSample = {...playing, isPlaying: false};

describe('createPauseDetector', () => {
  it('reports a pause after two stopped polls in a row', () => {
    const detect = createPauseDetector();
    expect(detect(playing)).toBe(false);
    expect(detect(stopped)).toBe(false);
    expect(detect(stopped)).toBe(true);
  });

  it('a single stopped poll (play() still starting) is not a pause', () => {
    const detect = createPauseDetector();
    expect(detect(stopped)).toBe(false);
    expect(detect(playing)).toBe(false);
    expect(detect(stopped)).toBe(false);
  });

  it('buffering or loading is never a pause', () => {
    const detect = createPauseDetector();
    detect({...stopped, isBuffering: true});
    expect(detect({...stopped, isBuffering: true})).toBe(false);
    detect({...stopped, isLoaded: false});
    expect(detect({...stopped, isLoaded: false})).toBe(false);
  });

  it('only applies while the app thinks it is playing', () => {
    const detect = createPauseDetector();
    detect({...stopped, reportedPlaying: false});
    expect(detect({...stopped, reportedPlaying: false})).toBe(false);
  });

  it('resumes reporting playing once the player plays again', () => {
    const detect = createPauseDetector();
    detect(stopped);
    expect(detect(stopped)).toBe(true);
    expect(detect(playing)).toBe(false);
  });
});
