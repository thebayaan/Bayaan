// services/adhkar/playback/__tests__/sessionReducer.test.ts
import {
  reduceSession,
  nextPlayableIndex,
  playAllState,
} from '@/services/adhkar/playback/sessionReducer';
import type {
  AdhkarSession,
  SessionItem,
  SessionSource,
} from '@/services/adhkar/playback/types';

const NOW = 1_000_000;

function item(id: string, playable = true): SessionItem {
  return {
    dhikrId: id,
    audioFile: playable ? `${id}.mp3` : null,
    playable,
    preview: id,
  };
}

function source(
  listId: string,
  ids: string[],
  silent: string[] = [],
): SessionSource {
  return {
    listId,
    listTitle: listId,
    items: ids.map(id => item(id, !silent.includes(id))),
  };
}

const morning = source('morning-adhkar', ['a', 'b', 'c', 'd'], ['c']);
const evening = source('evening-adhkar', ['a', 'x']);

function session(over: Partial<AdhkarSession> = {}): AdhkarSession {
  return {
    ...morning,
    index: 0,
    mode: 'all',
    loop: false,
    status: 'playing',
    error: false,
    trackToken: 1,
    positionSec: 0,
    lastActiveAt: 0,
    ...over,
  };
}

describe('nextPlayableIndex', () => {
  it('skips rows without audio', () => {
    expect(nextPlayableIndex(morning.items, 2)).toBe(3);
  });
  it('returns -1 past the end', () => {
    expect(nextPlayableIndex(morning.items, 4)).toBe(-1);
  });
});

describe('rule 1: start from a card', () => {
  it('starts a single session when nothing plays', () => {
    const s = reduceSession(
      null,
      {type: 'pressCard', source: morning, index: 1},
      NOW,
    );
    expect(s).toMatchObject({
      listId: 'morning-adhkar',
      index: 1,
      mode: 'single',
      status: 'loading',
      positionSec: 0,
      lastActiveAt: NOW,
    });
  });
  it('replaces an all session of another list with a single session', () => {
    const s = reduceSession(
      session(),
      {type: 'pressCard', source: evening, index: 1},
      NOW,
    );
    expect(s).toMatchObject({
      listId: 'evening-adhkar',
      index: 1,
      mode: 'single',
      status: 'loading',
    });
  });
  it('jumps inside an all session of the same list and stays all', () => {
    const before = session({index: 0, trackToken: 4});
    const s = reduceSession(
      before,
      {type: 'pressCard', source: morning, index: 3},
      NOW,
    );
    expect(s).toMatchObject({
      mode: 'all',
      index: 3,
      status: 'loading',
      trackToken: 5,
    });
  });
  it('ignores a card without audio', () => {
    expect(
      reduceSession(null, {type: 'pressCard', source: morning, index: 2}, NOW),
    ).toBeNull();
  });
  it('treats the same dhikr in another list as a different card', () => {
    const before = session({index: 0});
    const s = reduceSession(
      before,
      {type: 'pressCard', source: evening, index: 0},
      NOW,
    );
    expect(s).toMatchObject({
      listId: 'evening-adhkar',
      mode: 'single',
      status: 'loading',
    });
  });
});

describe('rule 2: toggle the current card', () => {
  it('pauses a playing current card', () => {
    const s = reduceSession(
      session({index: 1}),
      {type: 'pressCard', source: morning, index: 1},
      NOW,
    );
    expect(s).toMatchObject({status: 'paused', index: 1});
  });
  it('resumes a paused current card through loading', () => {
    const s = reduceSession(
      session({index: 1, status: 'paused', positionSec: 3}),
      {type: 'pressCard', source: morning, index: 1},
      NOW,
    );
    expect(s).toMatchObject({status: 'loading', positionSec: 3});
  });
});

describe('rule 3: Play All', () => {
  it('starts at the first playable row', () => {
    const s = reduceSession(
      null,
      {type: 'pressPlayAll', source: source('l', ['q', 'r'], ['q'])},
      NOW,
    );
    expect(s).toMatchObject({index: 1, mode: 'all', status: 'loading'});
  });
  it('pauses the active all list when pressed while playing', () => {
    const s = reduceSession(
      session(),
      {type: 'pressPlayAll', source: morning},
      NOW,
    );
    expect(s).toMatchObject({mode: 'all', index: 0, status: 'paused'});
  });
  it('pauses the active all list when pressed while loading', () => {
    const s = reduceSession(
      session({status: 'loading'}),
      {type: 'pressPlayAll', source: morning},
      NOW,
    );
    expect(s).toMatchObject({status: 'paused'});
  });
  it('resumes the paused all list at its current row', () => {
    const s = reduceSession(
      session({status: 'paused', index: 1, trackToken: 4}),
      {type: 'pressPlayAll', source: morning},
      NOW,
    );
    expect(s).toMatchObject({
      mode: 'all',
      index: 1,
      status: 'loading',
      trackToken: 4,
    });
  });
  it('restarts from the first playable row for another list', () => {
    const s = reduceSession(
      session({index: 3}),
      {type: 'pressPlayAll', source: evening},
      NOW,
    );
    expect(s).toMatchObject({listId: 'evening-adhkar', mode: 'all', index: 0});
  });
  it('replaces a single session of the same list', () => {
    const s = reduceSession(
      session({mode: 'single', index: 3}),
      {type: 'pressPlayAll', source: morning},
      NOW,
    );
    expect(s).toMatchObject({mode: 'all', index: 0});
  });
  it('does nothing for a list without audio', () => {
    expect(
      reduceSession(
        null,
        {type: 'pressPlayAll', source: source('l', ['q'], ['q'])},
        NOW,
      ),
    ).toBeNull();
  });
});

describe('rule 4: advance', () => {
  it('moves to the next playable row in all mode', () => {
    const s = reduceSession(
      session({index: 1, trackToken: 2}),
      {type: 'trackEnded', token: 2},
      NOW,
    );
    expect(s).toMatchObject({
      index: 3,
      status: 'loading',
      trackToken: 3,
      positionSec: 0,
    });
  });
  it('ends after the last row', () => {
    expect(
      reduceSession(
        session({index: 3, trackToken: 2}),
        {type: 'trackEnded', token: 2},
        NOW,
      ),
    ).toBeNull();
  });
  it('ends a single session when its clip ends', () => {
    expect(
      reduceSession(
        session({mode: 'single', trackToken: 2}),
        {type: 'trackEnded', token: 2},
        NOW,
      ),
    ).toBeNull();
  });
  it('ignores an end for a stale token', () => {
    const before = session({index: 1, trackToken: 2});
    expect(reduceSession(before, {type: 'trackEnded', token: 1}, NOW)).toBe(
      before,
    );
  });
});

describe('rule 5: swiping in the reader', () => {
  it('moves playback in the active all list', () => {
    const s = reduceSession(
      session({index: 0, trackToken: 1}),
      {type: 'swipedTo', listId: 'morning-adhkar', dhikrId: 'b'},
      NOW,
    );
    expect(s).toMatchObject({index: 1, status: 'loading', trackToken: 2});
  });
  it('stays paused when swiping a paused all session', () => {
    const s = reduceSession(
      session({status: 'paused'}),
      {type: 'swipedTo', listId: 'morning-adhkar', dhikrId: 'b'},
      NOW,
    );
    expect(s).toMatchObject({index: 1, status: 'paused'});
  });
  it('pauses on a row without audio', () => {
    const s = reduceSession(
      session(),
      {type: 'swipedTo', listId: 'morning-adhkar', dhikrId: 'c'},
      NOW,
    );
    expect(s).toMatchObject({index: 2, status: 'paused'});
  });
  it('ignores swipes in single mode', () => {
    const before = session({mode: 'single'});
    expect(
      reduceSession(
        before,
        {type: 'swipedTo', listId: 'morning-adhkar', dhikrId: 'b'},
        NOW,
      ),
    ).toBe(before);
  });
  it('ignores a dhikr the session does not have', () => {
    const before = session();
    expect(
      reduceSession(
        before,
        {type: 'swipedTo', listId: 'morning-adhkar', dhikrId: 'gone'},
        NOW,
      ),
    ).toBe(before);
  });
  it('ignores swipes in another list', () => {
    const before = session();
    expect(
      reduceSession(
        before,
        {type: 'swipedTo', listId: 'evening-adhkar', dhikrId: 'x'},
        NOW,
      ),
    ).toBe(before);
  });
});

describe('rules 7 and 8, player events', () => {
  it('stop ends the session', () => {
    expect(reduceSession(session(), {type: 'stop'}, NOW)).toBeNull();
  });
  it('other audio pauses but keeps the session', () => {
    expect(
      reduceSession(session(), {type: 'otherAudioStarted'}, NOW),
    ).toMatchObject({status: 'paused'});
  });
  it('toggle flips playing and paused', () => {
    expect(reduceSession(session(), {type: 'toggle'}, NOW)).toMatchObject({
      status: 'paused',
    });
    expect(
      reduceSession(session({status: 'paused'}), {type: 'toggle'}, NOW),
    ).toMatchObject({status: 'loading'});
  });
  it('playStarted confirms only the current token', () => {
    expect(
      reduceSession(
        session({status: 'loading', trackToken: 3}),
        {type: 'playStarted', token: 3},
        NOW,
      ),
    ).toMatchObject({status: 'playing', error: false});
    const before = session({status: 'loading', trackToken: 3});
    expect(reduceSession(before, {type: 'playStarted', token: 2}, NOW)).toBe(
      before,
    );
  });
  it('playFailed pauses with an error', () => {
    expect(
      reduceSession(
        session({status: 'loading', trackToken: 3}),
        {type: 'playFailed', token: 3},
        NOW,
      ),
    ).toMatchObject({status: 'paused', error: true});
  });
  it('remote pause and resume follow the player', () => {
    expect(reduceSession(session(), {type: 'playerPaused'}, NOW)).toMatchObject(
      {status: 'paused'},
    );
    expect(
      reduceSession(session({status: 'paused'}), {type: 'playerResumed'}, NOW),
    ).toMatchObject({status: 'playing'});
  });
  it('toggleLoop only applies in single mode', () => {
    expect(
      reduceSession(session({mode: 'single'}), {type: 'toggleLoop'}, NOW),
    ).toMatchObject({loop: true});
    const all = session();
    expect(reduceSession(all, {type: 'toggleLoop'}, NOW)).toBe(all);
  });
  it('positionSaved does not touch lastActiveAt', () => {
    expect(
      reduceSession(
        session({lastActiveAt: 5}),
        {type: 'positionSaved', positionSec: 12},
        NOW,
      ),
    ).toMatchObject({positionSec: 12, lastActiveAt: 5});
  });
  it('restored replaces the state', () => {
    const restored = session({status: 'paused', index: 3});
    expect(
      reduceSession(null, {type: 'restored', session: restored}, NOW),
    ).toBe(restored);
  });
});

describe('Saved list drift (a row unsaved during the session)', () => {
  const saved = source('saved', ['a', 'b', 'c', 'd']);
  // The reader dropped 'b'; the session still holds the four rows.
  const shorter = source('saved', ['a', 'c', 'd']);

  it('swipe resolves the dhikr in the session items, not the screen index', () => {
    const s = reduceSession(
      session({...saved, index: 0}),
      {type: 'swipedTo', listId: 'saved', dhikrId: 'c'},
      NOW,
    );
    expect(s?.items[s.index].dhikrId).toBe('c');
    expect(s?.index).toBe(2);
  });

  it('a card press in the same all list takes the screen items', () => {
    const s = reduceSession(
      session({...saved, index: 0}),
      {type: 'pressCard', source: shorter, index: 1},
      NOW,
    );
    expect(s).toMatchObject({mode: 'all', index: 1, status: 'loading'});
    expect(s?.items).toBe(shorter.items);
    expect(s?.items[s.index].dhikrId).toBe('c');
  });
});

describe('play on a row without audio in all mode', () => {
  it('toggle moves to the next playable row', () => {
    const s = reduceSession(
      session({index: 2, status: 'paused', trackToken: 3}),
      {type: 'toggle'},
      NOW,
    );
    expect(s).toMatchObject({index: 3, status: 'loading', trackToken: 4});
  });
  it('playerResumed moves to the next playable row', () => {
    const s = reduceSession(
      session({index: 2, status: 'paused'}),
      {type: 'playerResumed'},
      NOW,
    );
    expect(s).toMatchObject({index: 3, status: 'loading'});
  });
  it('ends the session when no playable row is left', () => {
    const tail = source('l', ['p', 'q'], ['q']);
    expect(
      reduceSession(
        session({...tail, index: 1, status: 'paused'}),
        {type: 'toggle'},
        NOW,
      ),
    ).toBeNull();
  });
});

describe('playAllState', () => {
  it('is idle without a session or for another list', () => {
    expect(playAllState(null, 'morning-adhkar')).toBe('idle');
    expect(playAllState(session(), 'evening-adhkar')).toBe('idle');
  });
  it('is idle for a single-mode session of the same list', () => {
    expect(playAllState(session({mode: 'single'}), 'morning-adhkar')).toBe(
      'idle',
    );
  });
  it('is playing while playing or loading, paused while paused', () => {
    expect(playAllState(session(), 'morning-adhkar')).toBe('playing');
    expect(playAllState(session({status: 'loading'}), 'morning-adhkar')).toBe(
      'playing',
    );
    expect(playAllState(session({status: 'paused'}), 'morning-adhkar')).toBe(
      'paused',
    );
  });
});
