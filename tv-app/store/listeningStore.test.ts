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
  useListeningStore,
} from './listeningStore';
import {useTVPlayerStore} from './tvPlayerStore';

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

  it('hides a sleep choice once the timer has run out', () => {
    expect(footerChips({...base, sleepOn: false, sleepChoice: 30})).toEqual([]);
  });
});
