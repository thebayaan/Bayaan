import {
  footerChips,
  nextInCycle,
  nextRepeatChoice,
  pauseLabel,
  SLEEP_CYCLE,
  sleepLabel,
  SPEED_CYCLE,
  repeatLabel,
  timesLabel,
  checkVerseRepeat,
  itemKey,
  sleepLeftLabel,
  startVerseRepeatSync,
  useListeningStore,
  verseRepeatAtEnd,
} from './listeningStore';
import {useTVPlayerStore} from './tvPlayerStore';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';
import type {VerseTimeline} from '../services/verseTimeline';

describe('nextRepeatChoice', () => {
  it('steps off → verse 3× → verse ∞ → surah → off', () => {
    let choice = useListeningStore.getState().repeat;
    const labels: string[] = [];
    for (let i = 0; i < 5; i++) {
      choice = nextRepeatChoice(choice, true);
      labels.push(repeatLabel(choice));
    }
    expect(labels).toEqual([
      'Verse · 3×',
      'Verse · ∞',
      'Surah',
      'Off',
      'Verse · 3×',
    ]);
  });

  it('skips verse repeat when the recitation has no timings', () => {
    expect(nextRepeatChoice({kind: 'off'}, false)).toEqual({kind: 'surah'});
    expect(nextRepeatChoice({kind: 'surah'}, false)).toEqual({kind: 'off'});
  });
});

describe('setRepeat', () => {
  afterEach(() => useListeningStore.getState().reset());

  it('maps surah repeat onto the player', () => {
    useListeningStore.getState().setRepeat({kind: 'surah'}, 4);
    expect(useTVPlayerStore.getState().repeat).toBe('one');
    expect(useListeningStore.getState().verseRepeat).toBeNull();
  });

  it('starts a verse repeat on the current verse', () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 4);
    expect(useTVPlayerStore.getState().repeat).toBe('off');
    expect(useListeningStore.getState().verseRepeat).toEqual({
      ayah: 4,
      times: 3,
      played: 0,
    });
  });
});

describe('setRepeatTimes', () => {
  afterEach(() => useListeningStore.getState().reset());

  it('changes the count without restarting the repeat', () => {
    const store = useListeningStore.getState();
    store.setRepeat({kind: 'verse', times: 3}, 4);
    store.setVerseRepeat({ayah: 4, times: 3, played: 2});
    useListeningStore.getState().setRepeatTimes(10);
    expect(useListeningStore.getState().repeat).toEqual({
      kind: 'verse',
      times: 10,
    });
    expect(useListeningStore.getState().verseRepeat).toEqual({
      ayah: 4,
      times: 10,
      played: 2,
    });
  });
});

describe('panels', () => {
  afterEach(() => useListeningStore.getState().reset());

  it('closes the open panel when the tray lowers', () => {
    const store = useListeningStore.getState();
    store.setTrayOpen(true);
    store.setPanel('onScreen');
    useListeningStore.getState().setTrayOpen(false);
    expect(useListeningStore.getState().panel).toBeNull();
  });
});

describe('cycles', () => {
  it('steps speed up and wraps to the slowest', () => {
    expect(nextInCycle(SPEED_CYCLE, 1)).toBe(1.25);
    expect(nextInCycle(SPEED_CYCLE, 2)).toBe(0.5);
    expect(nextInCycle(SPEED_CYCLE, 1.1)).toBe(0.5);
  });

  it('steps the sleep timer through to end of surah and off', () => {
    const labels = [0, 15, 30, 60, -1].map(m =>
      sleepLabel(nextInCycle(SLEEP_CYCLE, m)),
    );
    expect(labels).toEqual([
      '15 min',
      '30 min',
      '60 min',
      'End of surah',
      'Off',
    ]);
  });
});

describe('repeat choices on the player', () => {
  it('maps queue repeat onto repeat all, and back off', () => {
    useListeningStore.getState().setRepeat({kind: 'queue'}, 0);
    expect(useTVPlayerStore.getState().repeat).toBe('all');
    expect(repeatLabel({kind: 'queue'})).toBe('Queue');
    useListeningStore.getState().setRepeat({kind: 'off'}, 0);
    expect(useTVPlayerStore.getState().repeat).toBe('off');
  });
});

describe('resumePanel', () => {
  it('is handed back once', () => {
    useListeningStore.getState().setResumePanel('save');
    expect(useListeningStore.getState().takeResumePanel()).toBe('save');
    expect(useListeningStore.getState().takeResumePanel()).toBeNull();
  });
});

describe('labels', () => {
  it('names repeat counts and pauses', () => {
    expect([3, Infinity].map(timesLabel)).toEqual(['3×', '∞']);
    expect([0, 2000].map(pauseLabel)).toEqual(['None', '2 s']);
  });
});

describe('footerChips', () => {
  const base = {
    repeat: {kind: 'off'} as const,
    speed: 1,
    ambient: null,
    sleepOn: false,
    sleepChoice: 0,
  };

  it('is empty when nothing is changed', () => {
    expect(footerChips(base)).toEqual([]);
  });

  it('lists repeat, speed, ambience and sleep in tray order', () => {
    expect(
      footerChips({
        repeat: {kind: 'verse', times: 3},
        speed: 1.25,
        ambient: 'Rain',
        sleepOn: true,
        sleepChoice: 30,
      }),
    ).toEqual(['Repeat verse 3×', '1.25×', 'Rain', 'Sleep 30 min']);
  });

  it('names endless verse repeat, surah repeat and end-of-surah sleep', () => {
    expect(
      footerChips({...base, repeat: {kind: 'verse', times: Infinity}}),
    ).toEqual(['Repeat verse']);
    expect(footerChips({...base, repeat: {kind: 'surah'}})).toEqual([
      'Repeat surah',
    ]);
    expect(footerChips({...base, sleepOn: true, sleepChoice: -1})).toEqual([
      'Sleep at end of surah',
    ]);
  });

  it('writes speed as the tray does, and names queue repeat', () => {
    expect(footerChips({...base, speed: 2})).toEqual(['2.0×']);
    expect(footerChips({...base, repeat: {kind: 'queue'}})).toEqual([
      'Repeat queue',
    ]);
  });

  it('counts a running sleep timer down', () => {
    expect(
      footerChips({
        ...base,
        sleepOn: true,
        sleepChoice: 30,
        sleepLeftMs: 299000,
      }),
    ).toEqual(['Sleep · 5 min left']);
    expect(sleepLeftLabel(42 * 1000)).toBe('0:42 left');
    expect(sleepLeftLabel(60 * 1000)).toBe('1 min left');
    expect(sleepLeftLabel(61 * 1000)).toBe('2 min left');
    expect(sleepLeftLabel(-5)).toBe('0:00 left');
  });

  it('hides a sleep choice once the timer has run out', () => {
    expect(footerChips({...base, sleepOn: false, sleepChoice: 30})).toEqual([]);
  });
});

describe('verse repeat, app-wide', () => {
  const tracks = [1, 2].map(n => ({
    reciterId: 'r1',
    rewayahId: 'w1',
    surahNumber: n,
    audioUrl: `https://x/00${n}.mp3`,
    title: `S${n}`,
    subtitle: 'Reciter',
  }));
  const timeline = {
    surahNumber: 1,
    verses: [
      {ayah: 1, fromMs: 0, toMs: 5000},
      {ayah: 2, fromMs: 5000, toMs: 10000},
      {ayah: 3, fromMs: 10000, toMs: 15000},
    ],
  };
  let engine: AudioEngine & {emit: (e: EngineEvent) => void};

  function at(seconds: number): void {
    engine.emit({
      status: 'playing',
      positionSeconds: seconds,
      durationSeconds: 60,
    });
  }

  let run = 0;

  beforeEach(async () => {
    jest.useFakeTimers();
    // Each test's clock starts well after the last one's seeks.
    jest.setSystemTime(Date.now() + ++run * 60 * 1000);
    useTVPlayerStore.getState().reset();
    useListeningStore.getState().reset();
    let listener: ((e: EngineEvent) => void) | null = null;
    engine = {
      load: jest.fn().mockResolvedValue(undefined),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      seek: jest.fn(),
      setRate: jest.fn(),
      setVolume: jest.fn(),
      destroy: jest.fn(),
      subscribe: cb => {
        listener = cb;
        return () => {
          listener = null;
        };
      },
      emit: e => listener?.(e),
    };
    useTVPlayerStore.getState().setEngine(engine);
    await useTVPlayerStore.getState().loadQueue(tracks, 0);
    useListeningStore
      .getState()
      .setTimeline(itemKey(tracks[0]), timeline as VerseTimeline);
    // Past the settle window of any earlier seek.
    jest.advanceTimersByTime(1000);
  });

  afterEach(() => {
    useTVPlayerStore.getState().reset();
    useListeningStore.getState().reset();
    jest.useRealTimers();
  });

  it('treats the opening (verse 0) as verse 1', () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 0);
    expect(useListeningStore.getState().verseRepeat?.ayah).toBe(1);
    expect(useListeningStore.getState().repeatKey).toBe(itemKey(tracks[0]));
  });

  it('sends playback back to the verse start until the count runs out', () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 2}, 2);
    at(10.2);
    checkVerseRepeat();
    expect(engine.seek).toHaveBeenLastCalledWith(5);
    expect(useListeningStore.getState().verseRepeat?.played).toBe(1);
    jest.advanceTimersByTime(1000);
    (engine.seek as jest.Mock).mockClear();
    at(10.2);
    checkVerseRepeat();
    expect(engine.seek).not.toHaveBeenCalled();
    expect(useListeningStore.getState().repeat).toEqual({kind: 'off'});
  });

  it('holds at the verse start for the pause between plays', () => {
    useListeningStore.getState().setRepeatPause(2000);
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 1);
    at(5.1);
    checkVerseRepeat();
    expect(useTVPlayerStore.getState().held).toBe(true);
    expect(engine.pause).toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(useTVPlayerStore.getState().held).toBe(false);
    expect(engine.play).toHaveBeenCalled();
  });

  it('keeps going while the player screen is away (store-driven)', () => {
    startVerseRepeatSync();
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 1);
    at(5.1);
    expect(engine.seek).toHaveBeenLastCalledWith(0);
  });

  it('ends when another surah starts, and leaves the choice alone otherwise', async () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 1);
    at(2);
    checkVerseRepeat();
    expect(useListeningStore.getState().verseRepeat).not.toBeNull();
    await useTVPlayerStore.getState().next();
    checkVerseRepeat();
    expect(useListeningStore.getState().verseRepeat).toBeNull();
    expect(useListeningStore.getState().repeat).toEqual({kind: 'off'});
  });

  it('repeats the last verse when the track ends on it', () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 3);
    const again = verseRepeatAtEnd();
    expect(again).toEqual({seconds: 10, holdMs: 0});
    expect(useListeningStore.getState().verseRepeat?.played).toBe(1);
  });

  it('lets the surah end once the last verse has had its plays', () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 2}, 3);
    expect(verseRepeatAtEnd()).not.toBeNull();
    expect(verseRepeatAtEnd()).toBeNull();
    expect(useListeningStore.getState().repeat).toEqual({kind: 'off'});
  });

  it('leaves the end alone for a repeat of another verse', () => {
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 1);
    expect(verseRepeatAtEnd()).toBeNull();
  });

  it('keeps the player on the surah when the end arrives mid-repeat', () => {
    startVerseRepeatSync();
    useListeningStore.getState().setRepeat({kind: 'verse', times: 3}, 3);
    at(14);
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(useTVPlayerStore.getState().currentIndex).toBe(0);
    expect(engine.seek).toHaveBeenLastCalledWith(10);
    expect(engine.play).toHaveBeenCalled();
  });
});

describe('resumePanel', () => {
  it('holds a panel for the player to reopen, until reset', () => {
    useListeningStore.getState().setResumePanel('save');
    expect(useListeningStore.getState().resumePanel).toBe('save');
    useListeningStore.getState().reset();
    expect(useListeningStore.getState().resumePanel).toBeNull();
  });
});
