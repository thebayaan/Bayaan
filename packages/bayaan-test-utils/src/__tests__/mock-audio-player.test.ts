import {MockAudioPlayer, type PlaybackStatus} from '../audio/mock-audio-player';

describe('MockAudioPlayer', () => {
  let player: MockAudioPlayer;

  beforeEach(() => {
    player = new MockAudioPlayer();
  });

  it('starts in an empty unloaded state', () => {
    const status = player.getStatus();
    expect(status.isLoaded).toBe(false);
    expect(status.isPlaying).toBe(false);
    expect(status.positionMillis).toBe(0);
    expect(status.durationMillis).toBeNull();
    expect(status.didJustFinish).toBe(false);
  });

  it('emits status updates to subscribed listeners', () => {
    const updates: PlaybackStatus[] = [];
    player.addListener('playbackStatusUpdate', (s) => updates.push(s));
    player.simulateLoaded({durationMillis: 30_000});
    player.play();
    player.simulatePlaybackProgress(5_000);

    expect(updates.length).toBe(3);
    expect(updates[0].isLoaded).toBe(true);
    expect(updates[1].isPlaying).toBe(true);
    expect(updates[2].positionMillis).toBe(5_000);
  });

  it('removes listeners via the returned subscription', () => {
    const updates: PlaybackStatus[] = [];
    const subscription = player.addListener('playbackStatusUpdate', (s) =>
      updates.push(s),
    );
    player.simulateLoaded({durationMillis: 1000});
    expect(updates).toHaveLength(1);

    subscription.remove();
    player.simulatePlaybackProgress(500);
    expect(updates).toHaveLength(1);
  });

  it('models the natural-end transition with didJustFinish=true', () => {
    player.simulateLoaded({durationMillis: 10_000});
    player.play();
    player.simulateEnded();

    const status = player.getStatus();
    expect(status.didJustFinish).toBe(true);
    expect(status.isPlaying).toBe(false);
    expect(status.positionMillis).toBe(10_000);
  });

  it('clears state when the source is replaced', async () => {
    player.simulateLoaded({durationMillis: 30_000});
    player.play();
    player.simulatePlaybackProgress(15_000);

    await player.replace({uri: 'https://example.invalid/next.mp3'});

    const status = player.getStatus();
    expect(status.isLoaded).toBe(false);
    expect(status.isPlaying).toBe(false);
    expect(status.positionMillis).toBe(0);
    expect(status.durationMillis).toBeNull();
  });

  it('records calls on its surface as jest mocks', () => {
    player.play();
    player.pause();
    player.seekTo(1234);
    player.setRate(1.5);
    player.setVolume(0.7);

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledWith(1234);
    expect(player.setRate).toHaveBeenCalledWith(1.5);
    expect(player.setVolume).toHaveBeenCalledWith(0.7);
  });
});
