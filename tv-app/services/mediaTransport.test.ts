import {useTVPlayerStore} from '../store/tvPlayerStore';
import type {AudioEngine} from './audioEngine';
import {applyMediaKey, playerTransport} from './mediaTransport';
import {MEDIA_SEEK_SECONDS} from './remoteKeys';
import {resumeNewestContinue} from './resumeContinue';

jest.mock('./resumeContinue', () => ({
  resumeNewestContinue: jest.fn(() => true),
}));

const item = {
  reciterId: 'r1',
  rewayahId: 'w1',
  surahNumber: 1,
  audioUrl: 'https://x/001.mp3',
  title: 'Al-Fatihah',
  subtitle: 'al-Afasy',
};

function stubPlayer(status: 'playing' | 'paused' | 'buffering' = 'paused') {
  const actions = {
    toggle: jest.fn(),
    next: jest.fn().mockResolvedValue(undefined),
    prev: jest.fn().mockResolvedValue(undefined),
    seekBy: jest.fn(),
  };
  const engine = {pause: jest.fn()} as unknown as AudioEngine;
  useTVPlayerStore.setState({
    queue: [item],
    status,
    held: false,
    engine,
    ...actions,
  });
  return {...actions, engine};
}

describe('applyMediaKey', () => {
  it('maps each transport key to the player', () => {
    const player = stubPlayer();
    applyMediaKey('playPause');
    applyMediaKey('next');
    applyMediaKey('previous');
    applyMediaKey('fastForward');
    applyMediaKey('rewind');
    expect(player.toggle).toHaveBeenCalledTimes(1);
    expect(player.next).toHaveBeenCalledTimes(1);
    expect(player.prev).toHaveBeenCalledTimes(1);
    expect(player.seekBy.mock.calls).toEqual([
      [MEDIA_SEEK_SECONDS],
      [-MEDIA_SEEK_SECONDS],
    ]);
  });

  it('maps the separate Play and Pause keys without toggling back', () => {
    const paused = stubPlayer('paused');
    applyMediaKey('pause');
    applyMediaKey('play');
    expect(paused.toggle).toHaveBeenCalledTimes(1);
    expect(paused.engine.pause).not.toHaveBeenCalled();

    const playing = stubPlayer('playing');
    applyMediaKey('play');
    applyMediaKey('pause');
    expect(playing.toggle).not.toHaveBeenCalled();
    expect(playing.engine.pause).toHaveBeenCalledTimes(1);
  });

  it('resumes the newest Continue entry on Play before anything was played', () => {
    const player = stubPlayer();
    useTVPlayerStore.setState({queue: []});
    jest.mocked(resumeNewestContinue).mockClear();
    applyMediaKey('playPause');
    applyMediaKey('play');
    applyMediaKey('pause');
    applyMediaKey('next');
    expect(resumeNewestContinue).toHaveBeenCalledTimes(2);
    expect(resumeNewestContinue).toHaveBeenCalledWith('media-key');
    expect(player.toggle).not.toHaveBeenCalled();
    expect(player.next).not.toHaveBeenCalled();
  });
});

describe('playerTransport', () => {
  it('plays only when stopped and pauses only when playing', () => {
    const paused = stubPlayer('paused');
    playerTransport.play();
    playerTransport.pause();
    expect(paused.toggle).toHaveBeenCalledTimes(1);
    expect(paused.engine.pause).not.toHaveBeenCalled();

    const playing = stubPlayer('buffering');
    playerTransport.play();
    playerTransport.pause();
    expect(playing.toggle).not.toHaveBeenCalled();
    expect(playing.engine.pause).toHaveBeenCalledTimes(1);
  });

  it('routes next and previous through the queue', () => {
    const player = stubPlayer();
    playerTransport.next();
    playerTransport.previous();
    playerTransport.toggle();
    playerTransport.seekBy(-15);
    expect(player.seekBy).toHaveBeenCalledWith(-15);
    expect(player.next).toHaveBeenCalledTimes(1);
    expect(player.prev).toHaveBeenCalledTimes(1);
    expect(player.toggle).toHaveBeenCalledTimes(1);
  });

  it('resumes the newest Continue entry on Vega Play before anything was played', () => {
    const player = stubPlayer();
    useTVPlayerStore.setState({queue: []});
    jest.mocked(resumeNewestContinue).mockClear();
    playerTransport.toggle();
    playerTransport.play();
    playerTransport.pause();
    expect(resumeNewestContinue).toHaveBeenCalledTimes(2);
    expect(player.toggle).not.toHaveBeenCalled();
  });

  it("treats a verse repeat's gap as playing", () => {
    const player = stubPlayer('paused');
    useTVPlayerStore.setState({held: true});
    playerTransport.play();
    expect(player.toggle).not.toHaveBeenCalled();
    // Pause in the gap cancels the replay (the store's toggle does that).
    playerTransport.pause();
    expect(player.toggle).toHaveBeenCalledTimes(1);
    expect(player.engine.pause).not.toHaveBeenCalled();
  });
});
