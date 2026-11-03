// @ai-generated
// RFC-023 step 5: one restore state for a launch into the reader.
const mockSession = {lastScreenWasMushaf: true, throws: false};
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastScreenWasMushaf: () => {
      if (mockSession.throws) throw new Error('no storage');
      return mockSession.lastScreenWasMushaf;
    },
  },
}));

import {
  HOME_AFTER_SHOWN_MS,
  RESTORE_SAFETY_LIMIT_MS,
  SPLASH_DEADLINE_MS,
  beginReaderRestore,
  endReaderRestore,
  getReaderRestoreState,
  noteReaderFirstContent,
  noteReaderPushed,
  readerRestoreHoldsHome,
  readerRestoreHoldsSplash,
  shouldPushReader,
  subscribeReaderRestore,
} from '../readerRestoreState';

/** The launch up to the push: the reader is on its way. */
function pushReader(): void {
  beginReaderRestore();
  expect(shouldPushReader(null)).toBe(true);
  noteReaderPushed();
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSession.lastScreenWasMushaf = true;
  mockSession.throws = false;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('a launch with no restore', () => {
  beforeEach(() => {
    mockSession.lastScreenWasMushaf = false;
    beginReaderRestore();
  });

  it('never waits', () => {
    expect(getReaderRestoreState()).toBe('none');
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(readerRestoreHoldsHome()).toBe(false);
  });

  it('does not push, and later reports change nothing', () => {
    expect(shouldPushReader(null)).toBe(false);
    noteReaderPushed();
    noteReaderFirstContent();
    endReaderRestore();
    expect(getReaderRestoreState()).toBe('none');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('treats a failed read of the flag as no restore', () => {
    mockSession.throws = true;
    beginReaderRestore();
    expect(getReaderRestoreState()).toBe('none');
  });
});

describe('a launch from a deep link', () => {
  it('does not restore, and nothing waits', () => {
    beginReaderRestore();
    expect(readerRestoreHoldsHome()).toBe(true);
    expect(shouldPushReader('bayaan://mushaf?page=3')).toBe(false);
    expect(getReaderRestoreState()).toBe('ended');
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(readerRestoreHoldsHome()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('a launch that restores the reader', () => {
  it('holds the splash and the home route until the first content', () => {
    beginReaderRestore();
    expect(getReaderRestoreState()).toBe('pushing');
    expect(readerRestoreHoldsSplash()).toBe(true);
    expect(readerRestoreHoldsHome()).toBe(true);

    expect(shouldPushReader(null)).toBe(true);
    noteReaderPushed();
    expect(getReaderRestoreState()).toBe('waitingForContent');
    expect(readerRestoreHoldsSplash()).toBe(true);
    expect(readerRestoreHoldsHome()).toBe(true);
  });

  it('frees the splash at the first content, and the home route 1 s later', () => {
    pushReader();
    noteReaderFirstContent();
    expect(getReaderRestoreState()).toBe('shown');
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(readerRestoreHoldsHome()).toBe(true);

    jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS - 1);
    expect(readerRestoreHoldsHome()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(getReaderRestoreState()).toBe('ended');
    expect(readerRestoreHoldsHome()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('counts only the first report', () => {
    pushReader();
    noteReaderFirstContent();
    jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS - 1);
    noteReaderFirstContent(); // the next page must not move the end
    jest.advanceTimersByTime(1);
    expect(getReaderRestoreState()).toBe('ended');
  });

  it('ignores a report before the push (a link into the reader)', () => {
    beginReaderRestore();
    noteReaderFirstContent();
    expect(getReaderRestoreState()).toBe('pushing');
  });

  it('keeps the first answer: the reader writes the flag while it is open', () => {
    pushReader();
    mockSession.lastScreenWasMushaf = false;
    expect(getReaderRestoreState()).toBe('waitingForContent');
  });
});

describe('a reader that never reports', () => {
  it('frees the splash at the deadline from the push; the home route waits', () => {
    beginReaderRestore();
    // The deadline counts from the push, not from the launch.
    jest.advanceTimersByTime(SPLASH_DEADLINE_MS);
    expect(readerRestoreHoldsSplash()).toBe(true);

    noteReaderPushed();
    jest.advanceTimersByTime(SPLASH_DEADLINE_MS - 1);
    expect(readerRestoreHoldsSplash()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(getReaderRestoreState()).toBe('waitingForContent');
    expect(readerRestoreHoldsHome()).toBe(true);
  });

  it('still takes a first content after the deadline', () => {
    pushReader();
    jest.advanceTimersByTime(SPLASH_DEADLINE_MS);
    noteReaderFirstContent();
    expect(getReaderRestoreState()).toBe('shown');
    jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS);
    expect(readerRestoreHoldsHome()).toBe(false);
  });

  it('ends at the safety limit, counted from the launch', () => {
    beginReaderRestore();
    jest.advanceTimersByTime(1000);
    noteReaderPushed();
    jest.advanceTimersByTime(RESTORE_SAFETY_LIMIT_MS - 1001);
    expect(readerRestoreHoldsHome()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(getReaderRestoreState()).toBe('ended');
    expect(readerRestoreHoldsHome()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('frees everything at the safety limit when no push ever came', () => {
    beginReaderRestore();
    jest.advanceTimersByTime(RESTORE_SAFETY_LIMIT_MS);
    expect(getReaderRestoreState()).toBe('ended');
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(readerRestoreHoldsHome()).toBe(false);
    expect(shouldPushReader(null)).toBe(false);
  });
});

describe('the end of the wait', () => {
  it.each([
    ['pushing', () => beginReaderRestore()],
    ['waitingForContent', () => pushReader()],
    [
      'shown',
      () => {
        pushReader();
        noteReaderFirstContent();
      },
    ],
  ])('renders the home route at once from %s', (from, reach) => {
    reach();
    expect(getReaderRestoreState()).toBe(from);
    endReaderRestore();
    expect(getReaderRestoreState()).toBe('ended');
    expect(readerRestoreHoldsHome()).toBe(false);
    expect(readerRestoreHoldsSplash()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stays ended: a later report or push does nothing', () => {
    pushReader();
    endReaderRestore();
    noteReaderFirstContent();
    noteReaderPushed();
    expect(getReaderRestoreState()).toBe('ended');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('subscribers', () => {
  it('hears each change, and nothing after it leaves', () => {
    const heard: string[] = [];
    const stop = subscribeReaderRestore(() =>
      heard.push(getReaderRestoreState()),
    );
    pushReader();
    noteReaderFirstContent();
    jest.advanceTimersByTime(HOME_AFTER_SHOWN_MS);
    expect(heard).toEqual(['pushing', 'waitingForContent', 'shown', 'ended']);

    stop();
    beginReaderRestore();
    expect(heard).toHaveLength(4);
  });

  it('hears the deadline, so the splash can go', () => {
    pushReader();
    const listener = jest.fn();
    const stop = subscribeReaderRestore(listener);
    jest.advanceTimersByTime(SPLASH_DEADLINE_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('allows a subscriber to leave while it hears a change', () => {
    const stop = subscribeReaderRestore(() => stop());
    const other = jest.fn();
    const stopOther = subscribeReaderRestore(other);
    beginReaderRestore();
    expect(other).toHaveBeenCalledTimes(1);
    stopOther();
  });
});
