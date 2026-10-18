import {nowPlayingView} from './homeNowPlaying';

const view = (
  status: Parameters<typeof nowPlayingView>[0]['status'],
  extra: {finished?: boolean; pending?: boolean} = {},
) =>
  nowPlayingView({
    status,
    finished: extra.finished ?? false,
    pending: extra.pending ?? false,
  });

describe('nowPlayingView', () => {
  it('playing just opens the player', () => {
    expect(view('playing')).toEqual({
      kicker: 'NOW PLAYING',
      hint: 'Open player',
      action: 'open',
    });
  });

  it('paused resumes', () => {
    expect(view('paused')).toMatchObject({kicker: 'PAUSED', action: 'resume'});
    expect(view('idle').action).toBe('resume');
  });

  it('a finished queue plays again', () => {
    expect(view('paused', {finished: true})).toMatchObject({
      kicker: 'FINISHED',
      hint: 'Play again',
      action: 'replay',
    });
  });

  it('an error retries, even when finished', () => {
    expect(view('error', {finished: true})).toMatchObject({
      hint: 'Try again',
      action: 'retry',
    });
  });

  it('loading only opens, so it never resumes the previous track', () => {
    expect(view('loading').action).toBe('open');
    expect(view('buffering').action).toBe('open');
    expect(view('paused', {pending: true})).toMatchObject({
      kicker: 'LOADING',
      action: 'open',
    });
  });
});
