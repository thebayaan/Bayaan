import {
  newestResumable,
  nowPlayingTile,
  type TileInput,
} from './nowPlayingTile';

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
    expect(tile.detail).toBe('Now playing · Al-Afasi');
    expect(tile.progress).toBeCloseTo(0.25);
    expect(tile.accessibilityLabel).toBe(
      'Now playing: Al-Baqarah with Mishary Alafasi. Open player.',
    );
  });

  it('shortens a long reciter name on the second line only', () => {
    const tile = nowPlayingTile(
      input({item: {title: 'Al-Asr', subtitle: 'Mohammed Siddiq Al-Minshawi'}}),
    )!;
    expect(tile.detail).toBe('Now playing · Al-Minshawi');
    expect(tile.accessibilityLabel).toContain('Mohammed Siddiq Al-Minshawi');
  });

  it('resumes a paused track on OK, as the Home strip does', () => {
    const paused = nowPlayingTile(input({status: 'paused'}))!;
    expect(paused.action).toBe('toggle');
    expect(paused.accessibilityLabel).toMatch(/Resume\.$/);
    expect(nowPlayingTile(input({status: 'loading'}))!.action).toBe('open');
  });

  it('reads paused, loading and buffering', () => {
    expect(nowPlayingTile(input({status: 'paused'}))!.label).toBe('Paused');
    expect(nowPlayingTile(input({status: 'idle'}))!.label).toBe('Paused');
    expect(nowPlayingTile(input({status: 'loading'}))!.state).toBe('loading');
    expect(nowPlayingTile(input({status: 'buffering'}))!.state).toBe('loading');
  });

  it('says what OK does after an error or the end of the queue', () => {
    const failed = nowPlayingTile(input({status: 'error'}))!;
    expect(failed.detail).toBe("Couldn't play · Try again");
    expect(failed.action).toBe('toggle');
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
    expect(tile.detail).toBe('Continue · Al-Afasi');
    expect(tile.progress).toBeCloseTo(0.25);
  });
});

describe('newestResumable', () => {
  it("skips entries whose reciter left the catalog, as Home's rail does", () => {
    const gone = {...entry, reciterId: 'gone', updatedAt: 2};
    expect(newestResumable([gone, entry], id => id === 'r1')).toBe(entry);
    expect(newestResumable([gone], id => id === 'r1')).toBeNull();
  });
});
