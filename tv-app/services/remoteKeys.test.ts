import {
  createMediaKeyFilter,
  createRemoteKeyFilter,
  mediaKeyCommand,
  screenOwnsPlayPause,
} from './remoteKeys';

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

describe('createMediaKeyFilter', () => {
  it('maps the discrete media keys once per press', () => {
    const filter = createMediaKeyFilter();
    expect(filter({eventType: 'play', eventKeyAction: 1})).toBe('play');
    expect(filter({eventType: 'pause', eventKeyAction: 0})).toBe('pause');
    expect(filter({eventType: 'pause', eventKeyAction: 1})).toBeNull();
    expect(filter({eventType: 'next'})).toBe('next');
    expect(filter({eventType: 'previous'})).toBe('previous');
  });

  it('leaves the keys createRemoteKeyFilter maps alone', () => {
    const filter = createMediaKeyFilter();
    expect(filter({eventType: 'playPause'})).toBeNull();
    expect(filter({eventType: 'right'})).toBeNull();
    // ...and the other way round, so screens never see media keys.
    expect(createRemoteKeyFilter()({eventType: 'play'})).toBeNull();
    expect(createRemoteKeyFilter()({eventType: 'next'})).toBeNull();
  });
});

describe('mediaKeyCommand', () => {
  const root = undefined;
  it('Play only starts and Pause only stops', () => {
    expect(mediaKeyCommand('play', root, 'paused')).toBe('toggle');
    expect(mediaKeyCommand('play', root, 'error')).toBe('toggle');
    expect(mediaKeyCommand('play', root, 'playing')).toBeNull();
    expect(mediaKeyCommand('play', root, 'loading')).toBeNull();
    expect(mediaKeyCommand('pause', root, 'playing')).toBe('toggle');
    expect(mediaKeyCommand('pause', root, 'paused')).toBeNull();
    expect(mediaKeyCommand('pause', root, 'loading')).toBeNull();
  });

  it('moves through the queue, in the player too', () => {
    expect(mediaKeyCommand('next', {screen: 'nowPlaying'}, 'playing')).toBe(
      'next',
    );
    expect(mediaKeyCommand('previous', root, 'paused')).toBe('previous');
  });

  it('stays out of the adhkar reader, which plays its own audio', () => {
    const reader = {screen: 'adhkarReader' as const, listId: 'x'};
    expect(mediaKeyCommand('pause', reader, 'playing')).toBeNull();
    expect(mediaKeyCommand('next', reader, 'playing')).toBeNull();
  });
});
