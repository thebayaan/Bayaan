import {parsePendingWidgetEvents} from '../widgetEvents';

describe('parsePendingWidgetEvents', () => {
  it('parses completed sessions with their completion time', () => {
    const json = JSON.stringify([
      {
        name: 'adhkar_session_completed',
        props: {category: 'morning-adhkar', duration_ms: 1200, dhikr_count: 24},
        completedAtMs: 1791799200000,
      },
    ]);
    expect(parsePendingWidgetEvents(json, 5)).toEqual([
      {
        name: 'adhkar_session_completed',
        props: {category: 'morning-adhkar', duration_ms: 1200, dhikr_count: 24},
        completedAtMs: 1791799200000,
      },
    ]);
  });
  it('falls back to now when the completion time is missing or bad', () => {
    const props = {category: 'evening-adhkar', duration_ms: 1, dhikr_count: 2};
    const json = JSON.stringify([
      {name: 'adhkar_session_completed', props},
      {name: 'adhkar_session_completed', props, completedAtMs: 'x'},
      {name: 'adhkar_session_completed', props, completedAtMs: -1},
    ]);
    expect(
      parsePendingWidgetEvents(json, 42).map(e => e.completedAtMs),
    ).toEqual([42, 42, 42]);
  });
  it('returns [] for junk', () => {
    expect(parsePendingWidgetEvents('nope')).toEqual([]);
    expect(parsePendingWidgetEvents(null)).toEqual([]);
    expect(parsePendingWidgetEvents('{}')).toEqual([]);
  });
  it('drops unknown names and bad props', () => {
    const json = JSON.stringify([
      {name: 'other', props: {}},
      {
        name: 'adhkar_session_completed',
        props: {category: 1, duration_ms: 1, dhikr_count: 1},
      },
    ]);
    expect(parsePendingWidgetEvents(json)).toEqual([]);
  });
});
