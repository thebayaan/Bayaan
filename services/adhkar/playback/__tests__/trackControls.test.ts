/**
 * Lock screen and car next / previous for the adhkar session.
 */
import {
  adhkarTrackControls,
  adhkarTrackEvent,
  adhkarTrackTarget,
  skipAdhkarTrack,
} from '../trackControls';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarSession} from '../types';

// Rows b and d have no audio.
const items = ['a', 'b', 'c', 'd', 'e'].map(id => ({
  dhikrId: id,
  audioFile: `${id}.mp3`,
  playable: id !== 'b' && id !== 'd',
  preview: id,
}));

function at(index: number, mode: AdhkarSession['mode'] = 'all'): AdhkarSession {
  return {
    listId: 'morning-adhkar',
    listTitle: 'Morning Adhkar',
    items,
    index,
    mode,
    loop: false,
    status: 'playing',
    error: false,
    trackToken: 1,
    positionSec: 0,
    lastActiveAt: 0,
  };
}

describe('adhkarTrackTarget', () => {
  it('skips rows without audio both ways', () => {
    expect(adhkarTrackTarget(at(0), 'next')).toBe(2);
    expect(adhkarTrackTarget(at(2), 'next')).toBe(4);
    expect(adhkarTrackTarget(at(4), 'previous')).toBe(2);
    expect(adhkarTrackTarget(at(2), 'previous')).toBe(0);
  });

  it('is -1 past either end', () => {
    expect(adhkarTrackTarget(at(0), 'previous')).toBe(-1);
    expect(adhkarTrackTarget(at(4), 'next')).toBe(-1);
  });

  it('moves on from a silent row the session sits on', () => {
    expect(adhkarTrackTarget(at(1), 'next')).toBe(2);
    expect(adhkarTrackTarget(at(1), 'previous')).toBe(0);
  });
});

describe('adhkarTrackControls', () => {
  it('disables previous on the first dhikr and next on the last', () => {
    expect(adhkarTrackControls(at(0))).toEqual({previous: false, next: true});
    expect(adhkarTrackControls(at(2))).toEqual({previous: true, next: true});
    expect(adhkarTrackControls(at(4))).toEqual({previous: true, next: false});
  });

  it('is off in single mode', () => {
    expect(adhkarTrackControls(at(2, 'single'))).toBeNull();
  });
});

describe('adhkarTrackEvent', () => {
  it('is a track skip to the target dhikr', () => {
    expect(adhkarTrackEvent(at(0), 'next')).toEqual({
      type: 'trackSkipped',
      listId: 'morning-adhkar',
      dhikrId: 'c',
    });
  });

  it('is null with nowhere to go or in single mode', () => {
    expect(adhkarTrackEvent(at(4), 'next')).toBeNull();
    expect(adhkarTrackEvent(at(0, 'single'), 'next')).toBeNull();
  });
});

describe('skipAdhkarTrack', () => {
  beforeEach(() => useAdhkarSessionStore.setState({session: null}));

  it('moves the stored session', () => {
    useAdhkarSessionStore.setState({session: at(0)});
    skipAdhkarTrack('next');
    expect(useAdhkarSessionStore.getState().session?.index).toBe(2);
  });

  it('plays the next dhikr from a paused session', () => {
    useAdhkarSessionStore.setState({session: {...at(0), status: 'paused'}});
    skipAdhkarTrack('next');
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 2,
      status: 'loading',
    });
  });

  it('plays the previous dhikr from a paused session', () => {
    useAdhkarSessionStore.setState({session: {...at(4), status: 'paused'}});
    skipAdhkarTrack('previous');
    expect(useAdhkarSessionStore.getState().session).toMatchObject({
      index: 2,
      status: 'loading',
    });
  });

  it('does nothing without a session', () => {
    skipAdhkarTrack('next');
    expect(useAdhkarSessionStore.getState().session).toBeNull();
  });
});
