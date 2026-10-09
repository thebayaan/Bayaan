import {createRemoteKeyFilter} from './remoteKeys';

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
