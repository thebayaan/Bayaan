import {
  createMediaKeyFilter,
  createRemoteKeyFilter,
  screenOwnsMediaKey,
  screenOwnsPlayPause,
} from './remoteKeys';
import {claimTransport, resetTransportGate} from './transportGate';

beforeEach(resetTransportGate);

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
  it('maps the Android TV transport keys (key-up only)', () => {
    const filter = createMediaKeyFilter();
    expect(filter({eventType: 'playPause', eventKeyAction: 1})).toBe(
      'playPause',
    );
    expect(filter({eventType: 'next', eventKeyAction: 1})).toBe('next');
    expect(filter({eventType: 'previous', eventKeyAction: 1})).toBe('previous');
    expect(filter({eventType: 'fastForward', eventKeyAction: 1})).toBe(
      'fastForward',
    );
    expect(filter({eventType: 'rewind', eventKeyAction: 1})).toBe('rewind');
    expect(filter({eventType: 'play', eventKeyAction: 1})).toBe('play');
    expect(filter({eventType: 'pause', eventKeyAction: 1})).toBe('pause');
  });

  it('maps the Vega transport keys once per down/up pair', () => {
    const filter = createMediaKeyFilter();
    expect(filter({eventType: 'skip_forward', eventKeyAction: 0})).toBe(
      'fastForward',
    );
    expect(filter({eventType: 'skip_forward', eventKeyAction: 1})).toBeNull();
    expect(filter({eventType: 'forward', eventKeyAction: 0})).toBe(
      'fastForward',
    );
    expect(filter({eventType: 'skip_backward', eventKeyAction: 0})).toBe(
      'rewind',
    );
  });

  it('ignores the D-pad and touch-surface swipes, which move focus', () => {
    const filter = createMediaKeyFilter();
    expect(filter({eventType: 'right'})).toBeNull();
    expect(filter({eventType: 'swipeRight'})).toBeNull();
    expect(filter({eventType: 'swipeLeft'})).toBeNull();
    expect(filter({eventType: 'select'})).toBeNull();
  });
});

describe('Play/Pause and the transport gate', () => {
  it('drops a key press the system already handled as a media command', () => {
    claimTransport('system');
    expect(createRemoteKeyFilter()({eventType: 'playpause'})).toBeNull();
    expect(createMediaKeyFilter()({eventType: 'playpause'})).toBeNull();
  });

  it('lets every listener see the same key press', () => {
    const screen = createRemoteKeyFilter();
    const global = createMediaKeyFilter();
    expect(screen({eventType: 'playPause'})).toBe('playPause');
    expect(global({eventType: 'playPause'})).toBe('playPause');
  });

  it('gates seeks and surah changes on their own channels', () => {
    claimTransport('system', 'seek');
    expect(createMediaKeyFilter()({eventType: 'forward'})).toBeNull();
    expect(createRemoteKeyFilter()({eventType: 'forward'})).toBeNull();
    expect(createMediaKeyFilter()({eventType: 'playPause'})).toBe('playPause');
    claimTransport('system', 'track');
    expect(createMediaKeyFilter()({eventType: 'previous'})).toBeNull();
  });

  it('never gates the D-pad', () => {
    claimTransport('system');
    claimTransport('system', 'seek');
    expect(createRemoteKeyFilter()({eventType: 'right'})).toBe('right');
    expect(createRemoteKeyFilter()({eventType: 'left'})).toBe('left');
  });
});

describe('screenOwnsMediaKey', () => {
  it('the player keeps play/pause and seeking but not surah changes', () => {
    const player = {screen: 'nowPlaying' as const};
    expect(screenOwnsMediaKey(player, 'playPause')).toBe(true);
    expect(screenOwnsMediaKey(player, 'fastForward')).toBe(true);
    expect(screenOwnsMediaKey(player, 'rewind')).toBe(true);
    expect(screenOwnsMediaKey(player, 'next')).toBe(false);
    expect(screenOwnsMediaKey(player, 'previous')).toBe(false);
  });

  it('the adhkar reader owns every transport key', () => {
    const reader = {screen: 'adhkarReader' as const, listId: 'x'};
    for (const key of [
      'playPause',
      'next',
      'previous',
      'fastForward',
      'rewind',
    ] as const) {
      expect(screenOwnsMediaKey(reader, key)).toBe(true);
    }
  });

  it('root places leave every key to the app-wide handler', () => {
    expect(screenOwnsMediaKey(undefined, 'next')).toBe(false);
    expect(screenOwnsMediaKey(undefined, 'fastForward')).toBe(false);
  });
});
