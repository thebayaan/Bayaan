import {
  CONFIRM_MS,
  LAST_STEP_RETRIES,
  createFocusMemory,
  focusInSteps,
  landedSince,
  requestFocus,
  type Schedule,
} from './layerFocus';

function view(onFocus?: () => void) {
  const v = {requestTVFocus: jest.fn(() => onFocus?.())};
  return v;
}

/** A scheduler driven by hand: run() fires what is due, in order. */
function manualSchedule() {
  const due: Array<{cb: () => void; ms: number; live: boolean}> = [];
  const schedule: Schedule = (cb, ms) => {
    const job = {cb, ms, live: true};
    due.push(job);
    return () => {
      job.live = false;
    };
  };
  const run = (): void => {
    const job = due.shift();
    if (job?.live) job.cb();
  };
  return {schedule, run, pending: () => due.filter(j => j.live).length, due};
}

describe('requestFocus', () => {
  it('asks a view that can take focus', () => {
    const v = view();
    expect(requestFocus(v)).toBe(true);
    expect(v.requestTVFocus).toHaveBeenCalledTimes(1);
  });

  it('has nothing to ask of a missing, detached or plain target', () => {
    expect(requestFocus(null)).toBe(false);
    expect(requestFocus(42)).toBe(false);
    expect(requestFocus({})).toBe(false);
    const detached = {...view(), isConnected: false};
    expect(requestFocus(detached)).toBe(false);
    expect(detached.requestTVFocus).not.toHaveBeenCalled();
  });
});

describe('createFocusMemory', () => {
  it('remembers the element focused last, and whether focus is inside', () => {
    const memory = createFocusMemory();
    const a = view();
    const b = view();
    expect(memory.inside()).toBe(false);
    expect(memory.last()).toBeNull();
    memory.focus(a);
    memory.focus(b);
    memory.blur(a); // the old view's blur after the new one's focus
    expect(memory.inside()).toBe(true);
    expect(memory.last()).toBe(b);
    memory.blur(b);
    expect(memory.inside()).toBe(false);
    // Focus left the part: the element is still what to go back to.
    expect(memory.last()).toBe(b);
    expect(memory.count()).toBe(2);
  });

  it('forgets an element that can no longer take focus', () => {
    const memory = createFocusMemory();
    const gone = {...view(), isConnected: true};
    memory.focus(gone);
    gone.isConnected = false;
    expect(memory.last()).toBeNull();
    memory.focus(7); // a bare tag (old renderer): nothing to refocus
    expect(memory.last()).toBeNull();
    expect(memory.inside()).toBe(true);
  });

  it('does not count a focused element that unmounted without a blur', () => {
    const memory = createFocusMemory();
    const row = {...view(), isConnected: true};
    memory.focus(row);
    expect(memory.inside()).toBe(true);
    row.isConnected = false;
    expect(memory.inside()).toBe(false);
  });
});

describe('recent', () => {
  it('keeps the last few elements, newest first, without repeats', () => {
    const memory = createFocusMemory();
    const [a, b, c, d] = [view(), view(), view(), view()];
    [a, b, a, c, d].forEach(memory.focus);
    expect(memory.recent()).toEqual([d, c, a]);
  });

  it('steps back to where focus came from when the newest has gone', () => {
    const memory = createFocusMemory();
    const hero = view(() => memory.focus(hero));
    // A removed card: still referenced, but its view went with it.
    const card = view();
    memory.focus(hero);
    memory.focus(card);
    memory.blur(card); // the menu took focus
    const {schedule, run} = manualSchedule();
    focusInSteps(
      memory.recent().map(v => () => requestFocus(v)),
      landedSince(memory),
      schedule,
    );
    expect(card.requestTVFocus).toHaveBeenCalledTimes(1);
    run();
    expect(hero.requestTVFocus).toHaveBeenCalledTimes(1);
  });
});

describe('focusInSteps', () => {
  it('stops at the first step whose focus lands', () => {
    const memory = createFocusMemory();
    const tile = view(() => memory.focus(tile));
    const guide = view();
    const {schedule, run} = manualSchedule();
    focusInSteps(
      [() => requestFocus(tile), () => requestFocus(guide)],
      landedSince(memory),
      schedule,
    );
    expect(tile.requestTVFocus).toHaveBeenCalledTimes(1);
    run();
    expect(guide.requestTVFocus).not.toHaveBeenCalled();
  });

  it('tries the next step when a request goes nowhere, after CONFIRM_MS', () => {
    const memory = createFocusMemory();
    const dropped = view(); // never sends a focus event
    const sidebar = view(() => memory.focus(sidebar));
    const {schedule, run, due} = manualSchedule();
    focusInSteps(
      [() => requestFocus(dropped), () => requestFocus(sidebar)],
      landedSince(memory),
      schedule,
    );
    expect(due[0].ms).toBe(CONFIRM_MS);
    expect(sidebar.requestTVFocus).not.toHaveBeenCalled();
    run();
    expect(sidebar.requestTVFocus).toHaveBeenCalledTimes(1);
  });

  it('skips steps with nothing to try at once', () => {
    const memory = createFocusMemory();
    const guide = view();
    const {schedule} = manualSchedule();
    focusInSteps(
      [() => requestFocus(memory.last()), () => requestFocus(guide)],
      landedSince(memory),
      schedule,
    );
    expect(guide.requestTVFocus).toHaveBeenCalledTimes(1);
  });

  it('does nothing more once cancelled', () => {
    const memory = createFocusMemory();
    const dropped = view();
    const next = view();
    const {schedule, run, pending} = manualSchedule();
    const cancel = focusInSteps(
      [() => requestFocus(dropped), () => requestFocus(next)],
      landedSince(memory),
      schedule,
    );
    cancel();
    expect(pending()).toBe(0);
    run();
    expect(next.requestTVFocus).not.toHaveBeenCalled();
  });
});

describe('focusInSteps retries', () => {
  it('asks the last request again until it lands', () => {
    const memory = createFocusMemory();
    let mounted = false;
    const sidebar = view(() => {
      if (mounted) memory.focus(sidebar);
    });
    const {schedule, run, pending} = manualSchedule();
    focusInSteps(
      [() => false, () => requestFocus(sidebar)],
      landedSince(memory),
      schedule,
      LAST_STEP_RETRIES,
    );
    expect(sidebar.requestTVFocus).toHaveBeenCalledTimes(1);
    run(); // dropped: asked again
    expect(sidebar.requestTVFocus).toHaveBeenCalledTimes(2);
    mounted = true;
    run(); // dropped again: asked a third time, and this one lands
    expect(sidebar.requestTVFocus).toHaveBeenCalledTimes(3);
    run();
    expect(sidebar.requestTVFocus).toHaveBeenCalledTimes(3);
    expect(pending()).toBe(0);
  });

  it('gives up after the retries', () => {
    const memory = createFocusMemory();
    const dropped = view();
    const {schedule, run, pending} = manualSchedule();
    focusInSteps(
      [() => requestFocus(dropped)],
      landedSince(memory),
      schedule,
      2,
    );
    run();
    run();
    run();
    expect(dropped.requestTVFocus).toHaveBeenCalledTimes(3);
    expect(pending()).toBe(0);
  });

  it('retries only the last request, never an earlier step', () => {
    const memory = createFocusMemory();
    const first = view();
    const last = view();
    const {schedule, run} = manualSchedule();
    focusInSteps(
      [() => requestFocus(first), () => requestFocus(last)],
      landedSince(memory),
      schedule,
      1,
    );
    run();
    run();
    expect(first.requestTVFocus).toHaveBeenCalledTimes(1);
    expect(last.requestTVFocus).toHaveBeenCalledTimes(2);
  });

  it('does not retry by default', () => {
    const memory = createFocusMemory();
    const dropped = view();
    const {schedule, run, pending} = manualSchedule();
    focusInSteps([() => requestFocus(dropped)], landedSince(memory), schedule);
    run();
    expect(dropped.requestTVFocus).toHaveBeenCalledTimes(1);
    expect(pending()).toBe(0);
  });
});

describe('landedSince', () => {
  it('counts focus already inside, unless told not to', () => {
    const memory = createFocusMemory();
    memory.focus(view());
    expect(landedSince(memory)()).toBe(true);
    expect(landedSince(memory, {orInside: false})()).toBe(false);
    const landed = landedSince(memory, {orInside: false});
    memory.focus(view());
    expect(landed()).toBe(true);
  });
});
