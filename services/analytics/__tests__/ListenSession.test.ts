// @ai-generated
import {ListenSession, ListenSessionEvents} from '../ListenSession';

const TRACK = {
  surahId: 2,
  reciterId: 'reciter-1',
  reciterName: 'Reciter One',
  rewayahId: 'hafs',
};
const DURATION_MS = 600_000;

let now = 0;
let events: {[K in keyof ListenSessionEvents]: jest.Mock};
let session: ListenSession;

/** The event names in order, without the totals. */
function sent(): string[] {
  return Object.entries(events)
    .filter(([name]) => name !== 'listened')
    .flatMap(([name, mock]) =>
      mock.mock.invocationCallOrder.map(order => ({name, order})),
    )
    .sort((a, b) => a.order - b.order)
    .map(({name}) => name);
}

function totals(): number {
  return events.listened.mock.calls.reduce((sum, [ms]) => sum + ms, 0);
}

function at(positionMs: number, didJustFinish = false) {
  return {positionMs, durationMs: DURATION_MS, didJustFinish};
}

beforeEach(() => {
  now = 1_000_000;
  events = {
    started: jest.fn(),
    paused: jest.fn(),
    resumed: jest.fn(),
    completed: jest.fn(),
    skipped: jest.fn(),
    listened: jest.fn(),
  };
  session = new ListenSession(events, () => now);
});

describe('start', () => {
  it('sends playback_started with source queue', () => {
    session.start(TRACK, 5000);
    expect(events.started).toHaveBeenCalledWith({
      surah_id: 2,
      reciter_id: 'reciter-1',
      reciter_name: 'Reciter One',
      rewayah_id: 'hafs',
      source: 'queue',
      position_ms: 5000,
    });
    expect(session.isOpen).toBe(true);
  });

  it('says autoplay after a completion that goes on, once', () => {
    session.start(TRACK, 0);
    session.end('completed', {durationMs: DURATION_MS, autoplayNext: true});
    session.start(TRACK, 0);
    session.end('skipped', {direction: 'next', positionMs: 0});
    session.start(TRACK, 0);
    expect(events.started.mock.calls.map(([p]) => p.source)).toEqual([
      'queue',
      'autoplay',
      'queue',
    ]);
  });

  it('says queue after the last track of a queue completed', () => {
    session.start(TRACK, 0);
    session.end('completed', {durationMs: DURATION_MS, autoplayNext: false});
    session.start(TRACK, 0);
    expect(events.started.mock.calls[1][0].source).toBe('queue');
  });

  // The next track was held paused or failed to load: the queue did not go
  // on by itself, and the listener starts it later.
  it('says queue when the autoplay after a completion was called off', () => {
    session.start(TRACK, 0);
    session.end('completed', {durationMs: DURATION_MS, autoplayNext: true});
    session.cancelAutoplay();
    session.start(TRACK, 0);
    expect(events.started.mock.calls[1][0].source).toBe('queue');
  });

  it('ends an open session first, without an event, and keeps its time', () => {
    session.start(TRACK, 0);
    now += 30_000;
    session.start({...TRACK, surahId: 3}, 0);
    expect(sent()).toEqual(['started', 'started']);
    expect(totals()).toBe(30_000);
  });
});

describe('playingChanged', () => {
  it('sends playback_paused with the listened segment', () => {
    session.start(TRACK, 0);
    now += 40_000;
    session.playingChanged(false, at(40_000));
    expect(events.paused).toHaveBeenCalledWith({
      surah_id: 2,
      reciter_id: 'reciter-1',
      reciter_name: 'Reciter One',
      position_ms: 40_000,
      listened_ms: 40_000,
    });
  });

  it('sends playback_resumed only after a real pause', () => {
    session.start(TRACK, 0);
    session.playingChanged(true, at(0));
    expect(events.resumed).not.toHaveBeenCalled();

    session.playingChanged(false, at(10_000));
    session.playingChanged(true, at(10_000));
    expect(sent()).toEqual(['started', 'paused', 'resumed']);
  });

  it('treats didJustFinish as the track end, not a pause', () => {
    session.start(TRACK, 0);
    now += DURATION_MS;
    session.playingChanged(false, at(DURATION_MS, true));
    expect(events.paused).not.toHaveBeenCalled();
    expect(totals()).toBe(DURATION_MS);
  });

  it('treats a stop while it buffers as a stall: the segment closes, and nothing is sent', () => {
    session.start(TRACK, 0);
    now += 10_000;
    session.playingChanged(false, {...at(10_000), isBuffering: true});
    expect(totals()).toBe(10_000);
    now += 600_000;
    session.playingChanged(true, at(10_000));
    now += 10_000;
    session.playingChanged(false, at(20_000));
    expect(sent()).toEqual(['started', 'paused']);
    expect(events.paused.mock.calls[0][0].listened_ms).toBe(10_000);
    expect(totals()).toBe(20_000);
  });

  it('closes the segment while it buffers with playing true, as on Android, and sends nothing', () => {
    session.start(TRACK, 0);
    now += 10_000;
    session.playingChanged(true, {...at(10_000), isBuffering: true});
    expect(totals()).toBe(10_000);
    now += 20_000;
    session.playingChanged(true, at(10_000));
    now += 5000;
    session.end('skipped', {direction: 'next', positionMs: 15_000});
    expect(sent()).toEqual(['started', 'skipped']);
    expect(events.skipped.mock.calls[0][0].listened_ms).toBe(15_000);
  });

  it('a pause during an Android stall sends nothing, and its late stop adds no time', () => {
    session.start(TRACK, 0);
    now += 10_000;
    session.playingChanged(true, {...at(10_000), isBuffering: true});
    now += 30_000; // the stall, then the pause; its stop comes without isBuffering
    session.playingChanged(false, at(10_000));
    now += 60_000;
    session.playingChanged(true, at(10_000));
    now += 10_000;
    session.playingChanged(false, at(20_000));
    expect(sent()).toEqual(['started', 'paused']);
    expect(events.paused.mock.calls[0][0].listened_ms).toBe(10_000);
    expect(totals()).toBe(20_000);
  });

  it('opens no segment at a start while it buffers', () => {
    session.playingChanged(true, {...at(0), isBuffering: true});
    session.start(TRACK, 0);
    now += 5000;
    session.playingChanged(true, at(0));
    now += 10_000;
    session.playingChanged(false, at(10_000));
    expect(events.paused.mock.calls[0][0].listened_ms).toBe(10_000);
    expect(totals()).toBe(10_000);
  });

  it('treats a stop in the last 2 s as the track end, not a pause', () => {
    session.start(TRACK, 0);
    session.playingChanged(false, at(DURATION_MS - 1500));
    session.playingChanged(true, at(DURATION_MS - 1500));
    expect(sent()).toEqual(['started']);
  });

  it('treats a stop 2 s before the end as a pause', () => {
    session.start(TRACK, 0);
    session.playingChanged(false, at(DURATION_MS - 2000));
    expect(sent()).toEqual(['started', 'paused']);
  });

  it('does nothing without a session, or for an edge it already has', () => {
    session.playingChanged(false, at(0));
    session.playingChanged(true, at(0));
    session.start(TRACK, 0);
    session.playingChanged(true, at(0));
    session.playingChanged(false, at(1000));
    session.playingChanged(false, at(1000));
    expect(sent()).toEqual(['started', 'paused']);
  });
});

describe('end', () => {
  it('completed sends the whole listened time, and the totals get each segment once', () => {
    session.start(TRACK, 0);
    now += 50_000;
    session.playingChanged(false, at(50_000));
    now += 600_000; // a 10-minute pause
    session.playingChanged(true, at(50_000));
    now += 49_000;
    session.playingChanged(false, at(99_000, true));
    session.end('completed', {durationMs: 99_000, autoplayNext: true});

    expect(events.paused.mock.calls[0][0].listened_ms).toBe(50_000);
    expect(events.completed).toHaveBeenCalledWith({
      surah_id: 2,
      reciter_id: 'reciter-1',
      reciter_name: 'Reciter One',
      duration_ms: 99_000,
      listened_ms: 99_000,
      completion_pct: 100,
    });
    expect(events.listened.mock.calls.map(([ms]) => ms)).toEqual([
      50_000, 49_000,
    ]);
  });

  it('skipped closes the open segment and sends the listened time', () => {
    session.start(TRACK, 0);
    now += 20_000;
    session.end('skipped', {direction: 'prev', positionMs: 20_000});
    expect(events.skipped).toHaveBeenCalledWith({
      surah_id: 2,
      reciter_id: 'reciter-1',
      reciter_name: 'Reciter One',
      position_ms: 20_000,
      listened_ms: 20_000,
      direction: 'prev',
    });
    expect(totals()).toBe(20_000);
    expect(session.isOpen).toBe(false);
  });

  it('a session ends once: the skip after a completion sends nothing', () => {
    session.start(TRACK, 0);
    now += 10_000;
    session.end('completed', {durationMs: DURATION_MS, autoplayNext: true});
    now += 1000;
    session.end('skipped', {direction: 'next', positionMs: DURATION_MS});
    session.end('replaced');
    session.playingChanged(true, at(0));
    session.playingChanged(false, at(1000));
    expect(sent()).toEqual(['started', 'completed']);
    expect(totals()).toBe(10_000);
  });

  it('replaced sends nothing and keeps the time of the open segment', () => {
    session.start(TRACK, 0);
    now += 15_000;
    session.end('replaced');
    expect(sent()).toEqual(['started']);
    expect(totals()).toBe(15_000);
  });

  it('a paused session that ends adds no more time', () => {
    session.start(TRACK, 0);
    now += 5000;
    session.playingChanged(false, at(5000));
    now += 60_000;
    session.end('skipped', {direction: 'next', positionMs: 5000});
    expect(events.skipped.mock.calls[0][0].listened_ms).toBe(5000);
    expect(totals()).toBe(5000);
  });
});
