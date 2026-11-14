// @ai-generated
/**
 * RFC-023 step 5: the restore state of a launch into the reader. The root
 * layout owns it (app/_layout.tsx). This file holds its rules, once: the events
 * that each phase takes, and the one timer of each phase.
 */
import {
  HOME_AFTER_SHOWN_MS,
  PHASE_TIMERS,
  RESTORE_SAFETY_LIMIT_MS,
  SPLASH_DEADLINE_MS,
  holdsHome,
  holdsSplash,
  readerRestoreReducer,
  type ReaderRestoreEvent,
  type ReaderRestorePhase,
} from '../readerRestoreState';

const ALL_EVENTS: ReaderRestoreEvent[] = [
  'pushed',
  'linkOpened',
  'content',
  'closed',
  'splashDeadline',
  'safetyLimit',
  'homeDelay',
];

function after(
  phase: ReaderRestorePhase,
  ...events: ReaderRestoreEvent[]
): ReaderRestorePhase {
  return events.reduce(readerRestoreReducer, phase);
}

describe('a launch with no restore', () => {
  it('never waits, and no event changes it', () => {
    expect(holdsSplash('none')).toBe(false);
    expect(holdsHome('none')).toBe(false);
    expect(PHASE_TIMERS.none).toBeUndefined();
    expect(after('none', ...ALL_EVENTS)).toBe('none');
  });
});

describe('a launch that restores the reader', () => {
  it('holds the splash and the home route until the push', () => {
    expect(holdsSplash('pushing')).toBe(true);
    expect(holdsHome('pushing')).toBe(true);
    expect(after('pushing', 'pushed')).toBe('waiting');
  });

  // Review finding 1: a boot or a share import can take longer than the safety
  // limit. The limit starts at the push, so the push always comes.
  it('F2 (store): has no time limit before the push', () => {
    expect(PHASE_TIMERS.pushing).toBeUndefined();
    expect(
      after('pushing', 'content', 'splashDeadline', 'safetyLimit', 'pushed'),
    ).toBe('waiting');
  });

  it('does not restore for a deep link, and nothing waits', () => {
    expect(after('pushing', 'linkOpened')).toBe('ended');
  });

  it('frees the splash at the first content, and the home route 1 s later', () => {
    expect(holdsSplash('waiting')).toBe(true);
    const shown = after('waiting', 'content');
    expect(shown).toBe('shown');
    expect(holdsSplash(shown)).toBe(false);
    expect(holdsHome(shown)).toBe(true);
    expect(PHASE_TIMERS.shown).toEqual({
      ms: HOME_AFTER_SHOWN_MS,
      event: 'homeDelay',
    });
    expect(holdsHome(after(shown, 'homeDelay'))).toBe(false);
  });

  it('takes only the first report', () => {
    expect(after('waiting', 'content', 'content')).toBe('shown');
  });
});

describe('a reader that never reports', () => {
  it('frees the splash at the deadline from the push; the home route waits', () => {
    expect(PHASE_TIMERS.waiting).toEqual({
      ms: SPLASH_DEADLINE_MS,
      event: 'splashDeadline',
    });
    const late = after('waiting', 'splashDeadline');
    expect(late).toBe('late');
    expect(holdsSplash(late)).toBe(false);
    expect(holdsHome(late)).toBe(true);
  });

  it('still takes a first content after the deadline', () => {
    expect(after('late', 'content')).toBe('shown');
  });

  it('ends at the safety limit, counted from the push', () => {
    const late = PHASE_TIMERS.late;
    expect(late?.event).toBe('safetyLimit');
    expect(SPLASH_DEADLINE_MS + (late?.ms ?? 0)).toBe(RESTORE_SAFETY_LIMIT_MS);
    expect(after('late', 'safetyLimit')).toBe('ended');
  });
});

describe('the end of the wait', () => {
  it.each<ReaderRestorePhase>(['waiting', 'late', 'shown'])(
    'ends when the reader closes in %s',
    phase => {
      expect(after(phase, 'closed')).toBe('ended');
    },
  );

  it('ignores the timer of another phase', () => {
    expect(after('waiting', 'safetyLimit', 'homeDelay')).toBe('waiting');
    expect(after('late', 'splashDeadline', 'homeDelay')).toBe('late');
    expect(after('shown', 'splashDeadline', 'safetyLimit')).toBe('shown');
  });

  it('stays ended, with no timer', () => {
    expect(PHASE_TIMERS.ended).toBeUndefined();
    expect(after('ended', ...ALL_EVENTS)).toBe('ended');
    expect(holdsSplash('ended')).toBe(false);
    expect(holdsHome('ended')).toBe(false);
  });
});
