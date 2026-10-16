import type {NowPlayingActivityState, WidgetNowPlaying} from 'bayaan-widgets';
import {
  MULK_TRACK,
  YASIN_TRACK,
  nowPlayingSnapshot,
} from '@/test-utils/widgetSnapshots';
import {
  ENDED_GRACE_MS,
  INITIAL_ACTIVITY_MEMORY,
  PAUSED_STALE_MS,
  activityNeedsUpdate,
  activityStateFromSnapshot,
  activityTrackKey,
  afterEnd,
  afterStart,
  afterUpdate,
  planActivity,
  staleAtFor,
  type ActivityMemory,
} from '../planActivity';

function stateOf(
  np: Partial<WidgetNowPlaying>,
  generatedAt = 1_000_000,
): NowPlayingActivityState {
  const s = activityStateFromSnapshot(
    nowPlayingSnapshot(np, generatedAt),
    null,
    generatedAt,
  );
  if (!s) throw new Error('expected a state');
  return s;
}

function liveWith(last: NowPlayingActivityState): ActivityMemory {
  return {live: true, last, suppressedTrack: null};
}

const AYAH = {number: 3, count: 110, text: 'x'};

describe('activityStateFromSnapshot', () => {
  it('maps the playing track and anchors at generatedAt', () => {
    expect(
      activityStateFromSnapshot(
        nowPlayingSnapshot({}, 1_000_000),
        AYAH,
        1_000_000,
      ),
    ).toEqual({
      surahId: 18,
      surahName: 'Al-Kahf',
      reciterName: 'Mishary Alafasy',
      artworkFile: 'surah-18.jpg',
      isPlaying: true,
      positionSec: 100,
      durationSec: 1800,
      rate: 1,
      anchorAt: 1_000_000,
      ayah: AYAH,
    });
  });

  it('is null with nothing loaded or a finished paused track', () => {
    expect(activityStateFromSnapshot(nowPlayingSnapshot(null), null, 0)).toBe(
      null,
    );
    expect(
      activityStateFromSnapshot(
        nowPlayingSnapshot({isPlaying: false, positionSec: 1799.5}),
        null,
        1_000_000,
      ),
    ).toBe(null);
  });

  it('is null for a playing track at or past its end, even if isPlaying', () => {
    const atEnd = nowPlayingSnapshot({positionSec: 1800}, 1_000_000);
    expect(activityStateFromSnapshot(atEnd, null, 1_000_000)).toBe(null);
    // Extrapolated: 100 s at the anchor, 1700 s later it is over.
    const playing = nowPlayingSnapshot({}, 1_000_000);
    expect(activityStateFromSnapshot(playing, null, 1_000_000)).not.toBe(null);
    expect(activityStateFromSnapshot(playing, null, 2_700_000)).toBe(null);
    // Faster rate reaches the end sooner.
    const fast = nowPlayingSnapshot({rate: 2}, 1_000_000);
    expect(activityStateFromSnapshot(fast, null, 1_000_000 + 850_000)).toBe(
      null,
    );
  });

  it('keeps a paused track that is not at the end', () => {
    expect(stateOf({isPlaying: false, positionSec: 1700}).isPlaying).toBe(
      false,
    );
  });
});

describe('activityNeedsUpdate', () => {
  const base = stateOf({});

  it('ignores normal progress ticks and small drift', () => {
    expect(
      activityNeedsUpdate(base, stateOf({positionSec: 110}, 1_010_000)),
    ).toBe(false);
    expect(
      activityNeedsUpdate(base, stateOf({positionSec: 111}, 1_010_000)),
    ).toBe(false);
  });

  it('updates on a seek, pause, track, artwork, rate or ayah change', () => {
    expect(
      activityNeedsUpdate(base, stateOf({positionSec: 200}, 1_010_000)),
    ).toBe(true);
    expect(activityNeedsUpdate(base, stateOf({isPlaying: false}))).toBe(true);
    expect(activityNeedsUpdate(base, stateOf({track: YASIN_TRACK}))).toBe(true);
    expect(
      activityNeedsUpdate(base, {...base, artworkFile: 'reciter-r1.jpg'}),
    ).toBe(true);
    expect(activityNeedsUpdate(base, stateOf({rate: 1.5}))).toBe(true);
    expect(activityNeedsUpdate(base, {...base, ayah: AYAH})).toBe(true);
  });

  it('updates when the paused position moves', () => {
    const paused = stateOf({isPlaying: false, positionSec: 300});
    expect(
      activityNeedsUpdate(
        paused,
        stateOf({isPlaying: false, positionSec: 500}),
      ),
    ).toBe(true);
  });
});

describe('staleAtFor', () => {
  it('is the wall end plus grace while playing, at the playback rate', () => {
    const s = stateOf({positionSec: 900, rate: 1.5});
    expect(staleAtFor(s, 0)).toBe(1_000_000 + 600_000 + ENDED_GRACE_MS);
  });

  it('is now plus 15 minutes while paused', () => {
    expect(staleAtFor(stateOf({isPlaying: false}), 5_000)).toBe(
      5_000 + PAUSED_STALE_MS,
    );
  });
});

describe('planActivity', () => {
  it('starts only for a playing, unsuppressed track', () => {
    const playing = stateOf({});
    expect(planActivity(INITIAL_ACTIVITY_MEMORY, playing, 0)).toEqual({
      kind: 'start',
      state: playing,
      staleAt: staleAtFor(playing, 0),
    });
    expect(
      planActivity(INITIAL_ACTIVITY_MEMORY, stateOf({isPlaying: false}), 0)
        .kind,
    ).toBe('none');
    const suppressed: ActivityMemory = {
      ...INITIAL_ACTIVITY_MEMORY,
      suppressedTrack: activityTrackKey(playing),
    };
    expect(planActivity(suppressed, playing, 0).kind).toBe('none');
    expect(planActivity(suppressed, stateOf({track: MULK_TRACK}), 0).kind).toBe(
      'start',
    );
  });

  it('updates a live activity only when needed', () => {
    const base = stateOf({});
    expect(
      planActivity(liveWith(base), stateOf({positionSec: 110}, 1_010_000), 0)
        .kind,
    ).toBe('none');
    expect(
      planActivity(liveWith(base), stateOf({isPlaying: false}), 0).kind,
    ).toBe('update');
  });

  it('turns rapid track changes into updates of the one activity', () => {
    let memory = liveWith(stateOf({}));
    for (const track of [YASIN_TRACK, MULK_TRACK, YASIN_TRACK]) {
      const next = stateOf({track});
      const plan = planActivity(memory, next, 0);
      expect(plan.kind).toBe('update');
      memory = afterUpdate(memory, next, true);
    }
  });

  it('ends a live activity whose playing track reached the end', () => {
    const live = liveWith(stateOf({}));
    const finished = activityStateFromSnapshot(
      nowPlayingSnapshot({positionSec: 1800}),
      null,
      1_000_000,
    );
    expect(planActivity(live, finished, 0)).toEqual({kind: 'end'});
  });

  it('does not start for a playing track at the end', () => {
    const finished = activityStateFromSnapshot(
      nowPlayingSnapshot({positionSec: 1800}),
      null,
      1_000_000,
    );
    expect(planActivity(INITIAL_ACTIVITY_MEMORY, finished, 0)).toEqual({
      kind: 'none',
    });
  });

  it('ends when nothing is loaded', () => {
    expect(planActivity(liveWith(stateOf({})), null, 0)).toEqual({kind: 'end'});
    expect(planActivity(INITIAL_ACTIVITY_MEMORY, null, 0)).toEqual({
      kind: 'none',
    });
  });
});

describe('memory transitions', () => {
  const s = stateOf({});

  it('goes live after started or updated', () => {
    for (const result of ['started', 'updated'] as const) {
      expect(afterStart(INITIAL_ACTIVITY_MEMORY, s, result)).toEqual({
        live: true,
        last: s,
        suppressedTrack: null,
      });
    }
  });

  it('retries a deferred start later without suppressing', () => {
    expect(afterStart(INITIAL_ACTIVITY_MEMORY, s, 'deferred')).toEqual(
      INITIAL_ACTIVITY_MEMORY,
    );
  });

  it('suppresses the track after a disabled or failed start', () => {
    for (const result of [
      'disabled',
      'error',
      'invalid',
      'unsupported',
      'unavailable',
    ] as const) {
      expect(afterStart(INITIAL_ACTIVITY_MEMORY, s, result)).toEqual({
        live: false,
        last: null,
        suppressedTrack: activityTrackKey(s),
      });
    }
  });

  it('suppresses the track when an update finds the activity gone', () => {
    expect(afterUpdate(liveWith(s), s, false)).toEqual({
      live: false,
      last: null,
      suppressedTrack: activityTrackKey(s),
    });
    const next = stateOf({isPlaying: false});
    expect(afterUpdate(liveWith(s), next, true)).toEqual(liveWith(next));
  });

  it('forgets everything after an end', () => {
    expect(afterEnd()).toEqual(INITIAL_ACTIVITY_MEMORY);
  });
});
