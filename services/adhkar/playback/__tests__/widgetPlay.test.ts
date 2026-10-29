// @ai-generated
import {adhkarPlaybackEvents, widgetPlayEvents} from '../widgetPlay';
import type {AdhkarSession, SessionSource} from '../types';

const source: SessionSource = {
  listId: 'morning',
  listTitle: 'Morning',
  items: [
    {dhikrId: 'silent', audioFile: null, playable: false, preview: ''},
    {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: ''},
    {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: ''},
  ],
};

function session(overrides: Partial<AdhkarSession>): AdhkarSession {
  return {
    ...source,
    index: 1,
    mode: 'all',
    loop: false,
    status: 'playing',
    error: false,
    trackToken: 1,
    positionSec: 0,
    lastActiveAt: 0,
    ...overrides,
  };
}

it('starts the list from the first dhikr with audio', () => {
  expect(widgetPlayEvents(null, source, null)).toEqual([
    {type: 'pressPlayAll', source},
  ]);
});

it('starts the list and moves to the widget dhikr', () => {
  expect(widgetPlayEvents(null, source, 'b')).toEqual([
    {type: 'pressPlayAll', source},
    {type: 'swipedTo', listId: 'morning', dhikrId: 'b'},
  ]);
});

it('skips a dhikr without audio to the next one', () => {
  expect(widgetPlayEvents(null, source, 'silent')).toEqual([
    {type: 'pressPlayAll', source},
  ]);
});

it('starts all mode over a single-dhikr session of the same list', () => {
  expect(widgetPlayEvents(session({mode: 'single'}), source, 'a')).toEqual([
    {type: 'pressPlayAll', source},
  ]);
});

it('resumes a paused session of the list instead of toggling Play All', () => {
  expect(widgetPlayEvents(session({status: 'paused'}), source, 'a')).toEqual([
    {type: 'toggle'},
  ]);
});

it('moves a playing session of the list to the widget dhikr', () => {
  expect(widgetPlayEvents(session({}), source, 'b')).toEqual([
    {type: 'swipedTo', listId: 'morning', dhikrId: 'b'},
  ]);
});

it('does nothing when it is already playing that dhikr', () => {
  expect(widgetPlayEvents(session({}), source, 'a')).toEqual([]);
});

it('does nothing for a list without audio', () => {
  const silent = {...source, items: [source.items[0]]};
  expect(widgetPlayEvents(null, silent, null)).toEqual([]);
});

describe('adhkarPlaybackEvents', () => {
  it('pauses a playing session', () => {
    expect(adhkarPlaybackEvents(session({}), false)).toEqual([
      {type: 'toggle'},
    ]);
  });

  it('pauses a loading session', () => {
    expect(adhkarPlaybackEvents(session({status: 'loading'}), false)).toEqual([
      {type: 'toggle'},
    ]);
  });

  it('resumes a paused session', () => {
    expect(adhkarPlaybackEvents(session({status: 'paused'}), true)).toEqual([
      {type: 'toggle'},
    ]);
  });

  it('leaves a session already in that state', () => {
    expect(adhkarPlaybackEvents(session({}), true)).toEqual([]);
    expect(adhkarPlaybackEvents(session({status: 'paused'}), false)).toEqual(
      [],
    );
  });

  it('does nothing without a session', () => {
    expect(adhkarPlaybackEvents(null, false)).toEqual([]);
  });
});
