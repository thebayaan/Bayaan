import {createRemoteKeyFilter, screenOwnsPlayPause} from './remoteKeys';

describe('createRemoteKeyFilter', () => {
  it('passes tvOS events, which carry no key phase', () => {
    const filter = createRemoteKeyFilter();
    expect(filter({eventType: 'playPause'})).toBe('playPause');
    expect(filter({eventType: 'swipeRight'})).toBe('seekForward');
    expect(filter({eventType: 'right', eventKeyAction: -1})).toBe('right');
  });

  it('acts on Android key-up-only events', () => {
    const filter = createRemoteKeyFilter();
    expect(filter({eventType: 'right', eventKeyAction: 1})).toBe('right');
    expect(filter({eventType: 'right', eventKeyAction: 1})).toBe('right');
  });

  it('acts once per Vega down/up pair', () => {
    const filter = createRemoteKeyFilter();
    expect(filter({eventType: 'playpause', eventKeyAction: 0})).toBe(
      'playPause',
    );
    expect(filter({eventType: 'playpause', eventKeyAction: 1})).toBeNull();
    expect(filter({eventType: 'skip_forward', eventKeyAction: 0})).toBe(
      'seekForward',
    );
    expect(filter({eventType: 'skip_forward', eventKeyAction: 1})).toBeNull();
  });

  it('ignores events it does not map', () => {
    const filter = createRemoteKeyFilter();
    expect(filter({eventType: 'select'})).toBeNull();
    expect(filter({eventType: 'up', eventKeyAction: 0})).toBeNull();
  });
});

describe('screenOwnsPlayPause', () => {
  it('the player and the adhkar reader handle Play/Pause themselves', () => {
    expect(screenOwnsPlayPause({screen: 'nowPlaying'})).toBe(true);
    expect(screenOwnsPlayPause({screen: 'adhkarReader', listId: 'x'})).toBe(
      true,
    );
  });

  it('root places and other screens leave it to the app-wide handler', () => {
    expect(screenOwnsPlayPause(undefined)).toBe(false);
    expect(screenOwnsPlayPause({screen: 'reciterDetail', reciterId: 'r'})).toBe(
      false,
    );
    expect(screenOwnsPlayPause({screen: 'playlist', playlistId: 'p'})).toBe(
      false,
    );
  });
});
