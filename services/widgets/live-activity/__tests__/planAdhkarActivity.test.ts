// services/widgets/live-activity/__tests__/planAdhkarActivity.test.ts
import type {
  AdhkarSession,
  SessionItem,
} from '@/services/adhkar/playback/types';
import {
  ADHKAR_PAUSED_END_MS,
  ADHKAR_PLAYING_STALE_MS,
  INITIAL_ADHKAR_ACTIVITY_MEMORY,
  adhkarActivityState,
  adhkarSessionKey,
  adhkarStaleAt,
  afterAdhkarEnd,
  afterAdhkarStart,
  afterAdhkarUpdate,
  planAdhkarActivity,
  type AdhkarActivityMemory,
} from '../planAdhkarActivity';

const NOW = 10_000_000;

function item(id: string): SessionItem {
  return {
    dhikrId: id,
    audioFile: `${id}.mp3`,
    playable: true,
    preview: `preview ${id}`,
  };
}

function session(over: Partial<AdhkarSession> = {}): AdhkarSession {
  return {
    listId: 'morning-adhkar',
    listTitle: 'Morning Adhkar',
    items: [item('a'), item('b'), item('c')],
    index: 0,
    mode: 'all',
    loop: false,
    status: 'playing',
    error: false,
    trackToken: 1,
    positionSec: 0,
    lastActiveAt: NOW,
    ...over,
  };
}

function liveFor(s: AdhkarSession): AdhkarActivityMemory {
  const state = adhkarActivityState(s);
  if (!state) throw new Error('expected a state');
  return {
    live: true,
    last: state,
    sessionKey: adhkarSessionKey(s),
    suppressedSession: null,
  };
}

const idle = INITIAL_ADHKAR_ACTIVITY_MEMORY;

describe('adhkarActivityState', () => {
  it('maps the current item, 1-based, and counts loading as playing', () => {
    expect(adhkarActivityState(session({index: 1, status: 'loading'}))).toEqual(
      {
        listTitle: 'Morning Adhkar',
        preview: 'preview b',
        position: 2,
        total: 3,
        isPlaying: true,
      },
    );
    expect(adhkarActivityState(session({status: 'paused'}))?.isPlaying).toBe(
      false,
    );
  });

  it('is null when the index is out of range', () => {
    expect(adhkarActivityState(session({index: 7}))).toBeNull();
  });
});

describe('adhkarSessionKey', () => {
  it('ignores the index of an all session', () => {
    expect(adhkarSessionKey(session({index: 2}))).toBe(
      adhkarSessionKey(session({index: 0})),
    );
  });

  it('includes the dhikr of a single session', () => {
    expect(adhkarSessionKey(session({mode: 'single', index: 1}))).not.toBe(
      adhkarSessionKey(session({mode: 'single', index: 2})),
    );
  });

  it('differs between lists and modes', () => {
    const base = adhkarSessionKey(session());
    expect(adhkarSessionKey(session({listId: 'evening-adhkar'}))).not.toBe(
      base,
    );
    expect(adhkarSessionKey(session({mode: 'single'}))).not.toBe(base);
  });
});

describe('adhkarStaleAt', () => {
  it('is 10 minutes out while playing or loading', () => {
    expect(adhkarStaleAt(session(), NOW + 5)).toBe(
      NOW + 5 + ADHKAR_PLAYING_STALE_MS,
    );
    expect(adhkarStaleAt(session({status: 'loading'}), NOW)).toBe(
      NOW + ADHKAR_PLAYING_STALE_MS,
    );
  });

  it('is 15 minutes after the pause while paused', () => {
    expect(
      adhkarStaleAt(
        session({status: 'paused', lastActiveAt: NOW}),
        NOW + 60_000,
      ),
    ).toBe(NOW + ADHKAR_PAUSED_END_MS);
  });
});

describe('planAdhkarActivity', () => {
  it('does nothing without a session', () => {
    expect(planAdhkarActivity(idle, null, NOW, false)).toEqual({kind: 'none'});
  });

  it('starts when a session first plays', () => {
    const s = session();
    expect(planAdhkarActivity(idle, s, NOW, false)).toEqual({
      kind: 'start',
      key: adhkarSessionKey(s),
      state: adhkarActivityState(s),
      staleAt: NOW + ADHKAR_PLAYING_STALE_MS,
    });
  });

  it('does not start a loading or paused (restored) session', () => {
    expect(
      planAdhkarActivity(idle, session({status: 'loading'}), NOW, false),
    ).toEqual({kind: 'none'});
    expect(
      planAdhkarActivity(idle, session({status: 'paused'}), NOW, false),
    ).toEqual({kind: 'none'});
  });

  it('updates on an index change', () => {
    const next = session({index: 1, status: 'loading'});
    expect(
      planAdhkarActivity(liveFor(session()), next, NOW, false),
    ).toMatchObject({kind: 'update', state: {position: 2, isPlaying: true}});
  });

  it('updates on a play-state change', () => {
    const paused = session({status: 'paused', lastActiveAt: NOW});
    expect(planAdhkarActivity(liveFor(session()), paused, NOW, false)).toEqual({
      kind: 'update',
      key: adhkarSessionKey(paused),
      state: adhkarActivityState(paused),
      staleAt: NOW + ADHKAR_PAUSED_END_MS,
    });
  });

  it('does nothing when nothing shown changed', () => {
    const s = session();
    expect(
      planAdhkarActivity(liveFor(s), {...s, positionSec: 12}, NOW, false),
    ).toEqual({kind: 'none'});
    // loading after playing on the same row looks the same
    expect(
      planAdhkarActivity(liveFor(s), {...s, status: 'loading'}, NOW, false),
    ).toEqual({kind: 'none'});
  });

  it('ends when the session ends', () => {
    expect(planAdhkarActivity(liveFor(session()), null, NOW, false)).toEqual({
      kind: 'end',
    });
  });

  it('ends when another source took over a paused session', () => {
    const paused = session({status: 'paused'});
    expect(planAdhkarActivity(liveFor(session()), paused, NOW, true)).toEqual({
      kind: 'end',
    });
  });

  it('ignores another source while the session plays', () => {
    const s = session();
    expect(planAdhkarActivity(liveFor(s), s, NOW, true)).toEqual({
      kind: 'none',
    });
  });

  it('keeps a session the user paused until 15 minutes have passed', () => {
    const paused = session({status: 'paused', lastActiveAt: NOW});
    const memory = liveFor(paused);
    expect(
      planAdhkarActivity(memory, paused, NOW + ADHKAR_PAUSED_END_MS - 1, false),
    ).toEqual({kind: 'none'});
    expect(
      planAdhkarActivity(memory, paused, NOW + ADHKAR_PAUSED_END_MS, false),
    ).toEqual({kind: 'end'});
  });

  it('updates in place when a new session replaces a live one', () => {
    const next = session({listId: 'evening-adhkar', listTitle: 'Evening'});
    expect(
      planAdhkarActivity(liveFor(session()), next, NOW, false),
    ).toMatchObject({
      kind: 'update',
      key: adhkarSessionKey(next),
      state: {listTitle: 'Evening'},
    });
  });

  it('does not start a suppressed session, but starts a new one', () => {
    const s = session();
    const memory = {...idle, suppressedSession: adhkarSessionKey(s)};
    expect(planAdhkarActivity(memory, s, NOW, false)).toEqual({kind: 'none'});
    const other = session({listId: 'evening-adhkar'});
    expect(planAdhkarActivity(memory, other, NOW, false)).toMatchObject({
      kind: 'start',
    });
  });

  it('forgets the suppression once the session is gone', () => {
    const memory = {...idle, suppressedSession: 'x'};
    expect(planAdhkarActivity(memory, null, NOW, false)).toEqual({
      kind: 'reset',
    });
  });

  it('starts again when a session ended by a hand-off plays again', () => {
    expect(
      planAdhkarActivity(afterAdhkarEnd(), session(), NOW, false),
    ).toMatchObject({kind: 'start'});
  });
});

describe('memory transitions', () => {
  const s = session();
  const key = adhkarSessionKey(s);
  const state = adhkarActivityState(s);
  if (!state) throw new Error('expected a state');

  it('goes live after started or updated', () => {
    for (const result of ['started', 'updated'] as const) {
      expect(afterAdhkarStart(idle, key, state, result)).toEqual({
        live: true,
        last: state,
        sessionKey: key,
        suppressedSession: null,
      });
    }
  });

  it('retries a deferred start later without suppressing', () => {
    expect(afterAdhkarStart(idle, key, state, 'deferred')).toEqual(idle);
  });

  it('suppresses the session after a refused or failed start', () => {
    for (const result of [
      'disabled',
      'unsupported',
      'invalid',
      'error',
      'unavailable',
    ] as const) {
      expect(afterAdhkarStart(idle, key, state, result)).toEqual({
        ...idle,
        suppressedSession: key,
      });
    }
  });

  it('keeps a successful update and suppresses a dismissed activity', () => {
    const live = liveFor(s);
    const next = {...state, position: 2};
    expect(afterAdhkarUpdate(live, key, next, true)).toEqual({
      ...live,
      last: next,
    });
    expect(afterAdhkarUpdate(live, key, next, false)).toEqual({
      ...idle,
      suppressedSession: key,
    });
  });

  it('forgets everything after an end', () => {
    expect(afterAdhkarEnd()).toEqual(idle);
  });
});
