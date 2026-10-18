import {nowPlayingTile, type TileInput} from './nowPlayingTile';

const item = {title: 'Al-Baqarah', subtitle: 'Mishary Alafasi'};
const entry = {
  reciterId: 'r1',
  rewayahId: 'w1',
  surahNumber: 18,
  positionSeconds: 300,
  durationSeconds: 1200,
  updatedAt: 1,
};

function input(over: Partial<TileInput> = {}): TileInput {
  return {
    item,
    status: 'playing',
    finished: false,
    positionSeconds: 30,
    durationSeconds: 120,
    resume: null,
    ...over,
  };
}

describe('nowPlayingTile', () => {
  it('is hidden when nothing is queued and nothing can be resumed', () => {
    expect(nowPlayingTile(input({item: null}))).toBeNull();
  });

  it('names the state in words and opens the player', () => {
    const tile = nowPlayingTile(input())!;
    expect(tile.state).toBe('playing');
    expect(tile.action).toBe('open');
    expect(tile.label).toBe('Now playing');
    expect(tile.title).toBe('Al-Baqarah');
    expect(tile.detail).toBe('Now playing · Mishary Alafasi');
    expect(tile.progress).toBeCloseTo(0.25);
    expect(tile.accessibilityLabel).toBe(
      'Now playing: Al-Baqarah. Open player.',
    );
  });

  it('reads paused, loading and buffering', () => {
    expect(nowPlayingTile(input({status: 'paused'}))!.label).toBe('Paused');
    expect(nowPlayingTile(input({status: 'idle'}))!.label).toBe('Paused');
    expect(nowPlayingTile(input({status: 'loading'}))!.state).toBe('loading');
    expect(nowPlayingTile(input({status: 'buffering'}))!.state).toBe('loading');
  });

  it('says what OK does after an error or the end of the queue', () => {
    const failed = nowPlayingTile(input({status: 'error'}))!;
    expect(failed.detail).toBe("Couldn't play · Open to retry");
    expect(failed.action).toBe('open');
    const done = nowPlayingTile(input({status: 'paused', finished: true}))!;
    expect(done.detail).toBe('Finished · Play again');
    expect(done.action).toBe('replay');
    expect(done.progress).toBe(1);
  });

  it('has no progress before the duration is known', () => {
    expect(nowPlayingTile(input({durationSeconds: 0}))!.progress).toBeNull();
  });

  it('stands in the newest Continue listening entry after a relaunch', () => {
    const tile = nowPlayingTile(
      input({
        item: null,
        status: 'idle',
        resume: {title: 'Al-Kahf', subtitle: 'Mishary Alafasi', entry},
      }),
    )!;
    expect(tile.state).toBe('resume');
    expect(tile.action).toBe('resume');
    expect(tile.detail).toBe('Continue · Mishary Alafasi');
    expect(tile.progress).toBeCloseTo(0.25);
  });
});
