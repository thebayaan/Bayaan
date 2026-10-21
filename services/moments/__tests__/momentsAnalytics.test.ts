// @ai-start
import {
  buildMomentActionProps,
  buildMomentEndedProps,
  buildMomentViewedProps,
  isConversion,
  MomentsAnalyticsSink,
  MomentsSessionTracker,
  momentId,
  TrackedMoment,
} from '../momentsAnalytics';

function card(reciterId: string, key = `k-${reciterId}`): TrackedMoment {
  return {
    key,
    reciter: {id: reciterId},
    rewayat: {id: `${reciterId}-hafs`},
    passage: {id: '112:1-4', surah: 112},
    clip: {startMs: 10_000},
  };
}

function makeSink() {
  return {
    trackMomentsOpened: jest.fn(),
    trackMomentViewed: jest.fn(),
    trackMomentEnded: jest.fn(),
    trackMomentAction: jest.fn(),
    trackMomentsSessionEnded: jest.fn(),
  } satisfies MomentsAnalyticsSink;
}

function setup(priorPlays: Record<string, number> = {}) {
  let time = 1_000;
  const sink = makeSink();
  const tracker = new MomentsSessionTracker({
    entry: 'preview',
    priorPlays,
    sink,
    now: () => time,
  });
  const advance = (ms: number) => {
    time += ms;
  };
  return {tracker, sink, advance};
}

const playing = (key: string, positionMs: number) => ({
  key,
  positionMs,
  playing: true,
  buffering: false,
});

describe('payload builders', () => {
  it('builds a stable moment id', () => {
    expect(momentId(card('r1'))).toBe('r1/r1-hafs/112:1-4');
  });

  it('builds moment_viewed', () => {
    expect(buildMomentViewedProps(card('r1'), 3, 412.6, true)).toEqual({
      moment_id: 'r1/r1-hafs/112:1-4',
      reciter_id: 'r1',
      rewayah_id: 'r1-hafs',
      surah: 112,
      position: 3,
      start_latency_ms: 413,
      new_reciter: true,
    });
  });

  it('builds moment_ended', () => {
    expect(buildMomentEndedProps(card('r1'), 2_000.4, 'swiped')).toEqual({
      moment_id: 'r1/r1-hafs/112:1-4',
      reciter_id: 'r1',
      listened_ms: 2_000,
      reason: 'swiped',
    });
  });

  it('adds enabled only when given', () => {
    expect(buildMomentActionProps(card('r1'), 'share', false)).toEqual({
      moment_id: 'r1/r1-hafs/112:1-4',
      action: 'share',
      reciter_id: 'r1',
      new_reciter: false,
    });
    expect(buildMomentActionProps(card('r1'), 'like', true, false)).toEqual(
      expect.objectContaining({action: 'like', enabled: false}),
    );
  });

  it('counts Continue and Favorite on for new reciters as conversions', () => {
    expect(isConversion('continue', true)).toBe(true);
    expect(isConversion('favorite', true, true)).toBe(true);
    expect(isConversion('favorite', true, false)).toBe(false);
    expect(isConversion('like', true, true)).toBe(false);
    expect(isConversion('continue', false)).toBe(false);
  });
});

describe('MomentsSessionTracker', () => {
  it('reports opening with its entry', () => {
    const {tracker, sink} = setup();
    tracker.start();
    expect(sink.trackMomentsOpened).toHaveBeenCalledWith({entry: 'preview'});
  });

  it('measures start latency to the first progress past the start', () => {
    const {tracker, sink, advance} = setup();
    tracker.start();
    const c = card('r1');
    tracker.activate(c, 0);
    advance(150);
    tracker.progress({...playing(c.key, 10_000), buffering: true});
    expect(sink.trackMomentViewed).not.toHaveBeenCalled();
    advance(250);
    tracker.progress(playing(c.key, 10_100));
    advance(100);
    tracker.progress(playing(c.key, 10_200));
    expect(sink.trackMomentViewed).toHaveBeenCalledTimes(1);
    expect(sink.trackMomentViewed).toHaveBeenCalledWith(
      expect.objectContaining({position: 0, start_latency_ms: 400}),
    );
  });

  it('ignores playback for other cards', () => {
    const {tracker, sink} = setup();
    tracker.start();
    tracker.activate(card('r1'), 0);
    tracker.progress(playing('other', 20_000));
    expect(sink.trackMomentViewed).not.toHaveBeenCalled();
  });

  it('counts only audible time as listened and ends a swiped card', () => {
    const {tracker, sink, advance} = setup();
    tracker.start();
    const a = card('r1');
    tracker.activate(a, 0);
    tracker.progress(playing(a.key, 10_000));
    advance(1_000);
    tracker.progress({...playing(a.key, 11_000), playing: false});
    advance(5_000); // paused
    tracker.progress(playing(a.key, 11_000));
    advance(500);
    const ended = tracker.activate(card('r2'), 1);
    expect(ended).toEqual({card: a, reason: 'swiped', listenedMs: 1_500});
    expect(sink.trackMomentEnded).toHaveBeenCalledWith(
      expect.objectContaining({reciter_id: 'r1', listened_ms: 1_500}),
    );
  });

  it('ends a completed card once, not again on the next swipe', () => {
    const {tracker, sink, advance} = setup();
    tracker.start();
    const a = card('r1');
    tracker.activate(a, 0);
    tracker.progress(playing(a.key, 10_000));
    advance(8_000);
    expect(tracker.complete(a.key)?.reason).toBe('completed');
    expect(tracker.activate(card('r2'), 1)).toBeNull();
    expect(sink.trackMomentEnded).toHaveBeenCalledTimes(1);
    expect(sink.trackMomentEnded).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'completed', listened_ms: 8_000}),
    );
  });

  it('summarises the session with conversions of new reciters only', () => {
    const {tracker, sink, advance} = setup({known: 4});
    tracker.start();
    const fresh = card('fresh');
    const known = card('known');
    const other = card('other');
    tracker.activate(fresh, 0);
    tracker.action(fresh, 'favorite', true);
    tracker.action(fresh, 'continue');
    tracker.activate(known, 1);
    tracker.action(known, 'continue');
    tracker.activate(other, 2);
    tracker.action(other, 'favorite', false);
    tracker.action(other, 'like', true);
    advance(30_000);
    const ended = tracker.close();

    expect(ended?.reason).toBe('left');
    expect(sink.trackMomentAction).toHaveBeenCalledWith(
      expect.objectContaining({action: 'continue', new_reciter: false}),
    );
    expect(sink.trackMomentsSessionEnded).toHaveBeenCalledWith({
      cards_seen: 3,
      duration_ms: 30_000,
      conversions: 1,
      new_reciters_seen: 2,
    });
  });

  it('sends nothing after closing', () => {
    const {tracker, sink} = setup();
    tracker.start();
    tracker.close();
    tracker.activate(card('r1'), 0);
    tracker.action(card('r1'), 'share');
    tracker.close();
    expect(sink.trackMomentAction).not.toHaveBeenCalled();
    expect(sink.trackMomentsSessionEnded).toHaveBeenCalledTimes(1);
  });
});
// @ai-end
