import type {Reciter, Rewayah} from '../types/reciter';

const rewayah = (
  id: string,
  surahs: number[],
  name = 'Hafs A an Asim',
): Rewayah =>
  ({
    id,
    reciter_id: 'r1',
    name,
    style: 'murattal',
    server: `https://cdn/${id}/`,
    source_type: 'mp3quran',
    surah_total: surahs.length,
    surah_list: surahs,
    mp3quran_read_id: null,
    qdc_reciter_id: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  }) as Rewayah;

const reciter = (id: string, name: string, rewayat: Rewayah[]): Reciter =>
  ({id, name, rewayat}) as unknown as Reciter;

const catalog: Reciter[] = [
  reciter('r1', 'Alafasy', [rewayah('w1', [1, 2, 3]), rewayah('w2', [1, 2])]),
  reciter('r2', 'Husary', [rewayah('h1', [18, 36])]),
  reciter('r3', 'Unknown voice', []),
];

const fetchRewayat = jest.fn(async (id: string) => {
  return catalog.find(r => r.id === id)?.rewayat ?? [];
});

jest.mock('./tvDataService', () => {
  const actual = jest.requireActual('./tvDataService');
  return {
    ...actual,
    getCachedReciters: () => catalog,
    getCachedRewayat: (id: string) => {
      const found = catalog.find(r => r.id === id)?.rewayat ?? [];
      return found.length > 0 ? found : null;
    },
    fetchRewayat: (id: string) => fetchRewayat(id),
  };
});

import {
  OFFLINE_MESSAGE,
  isCurrentTrack,
  openPlayer,
  playOrOpen,
  shuffled,
  voiceForSurah,
} from './playbackRouting';
import {useNavStore} from '../store/navStore';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import type {AudioEngine, EngineEvent} from './audioEngine';

function makeEngine(): AudioEngine & {emit: (e: EngineEvent) => void} {
  let listener: ((e: EngineEvent) => void) | null = null;
  return {
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
}

let engine: ReturnType<typeof makeEngine>;

beforeEach(() => {
  useTVPlayerStore.getState().reset();
  useNavStore.getState().reset();
  engine = makeEngine();
  useTVPlayerStore.getState().setEngine(engine);
  fetchRewayat.mockClear();
});

const stack = () => useNavStore.getState().stack;
const current = () => {
  const s = useTVPlayerStore.getState();
  return s.queue[s.currentIndex];
};

describe('playOrOpen', () => {
  it('opens the player before the audio has loaded, then plays', async () => {
    const done = playOrOpen({reciterId: 'r1', surahNumber: 2});
    // Synchronously: player open, showing the surah loading.
    expect(stack()).toEqual([{screen: 'nowPlaying'}]);
    expect(useTVPlayerStore.getState().status).toBe('loading');
    expect(current()?.title).toBeTruthy();
    await expect(done).resolves.toBe(true);
    expect(engine.load).toHaveBeenCalledWith('https://cdn/w1/002.mp3');
    expect(current()?.surahNumber).toBe(2);
    expect(useTVPlayerStore.getState().queue).toHaveLength(3);
  });

  it('the track already playing only opens the player, with no reload', async () => {
    await playOrOpen({reciterId: 'r1', surahNumber: 2});
    useNavStore.getState().pop();
    (engine.load as jest.Mock).mockClear();
    await playOrOpen({reciterId: 'r1', surahNumber: 2, startSeconds: 40});
    expect(engine.load).not.toHaveBeenCalled();
    expect(engine.seek).not.toHaveBeenCalled();
    expect(stack()).toEqual([{screen: 'nowPlaying'}]);
  });

  it('a double press loads once and stacks one player', async () => {
    const first = playOrOpen({reciterId: 'r1', surahNumber: 1});
    const second = playOrOpen({reciterId: 'r1', surahNumber: 1});
    await Promise.all([first, second]);
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(stack()).toEqual([{screen: 'nowPlaying'}]);
  });

  it('a newer press wins over one still loading', async () => {
    let release: () => void = () => {};
    (engine.load as jest.Mock).mockImplementationOnce(
      () => new Promise<void>(r => (release = r)),
    );
    const first = playOrOpen({reciterId: 'r1', surahNumber: 1});
    // Let the first request reach engine.load.
    await new Promise(r => setTimeout(r, 0));
    const second = playOrOpen({reciterId: 'r2', surahNumber: 18});
    await second;
    release();
    await expect(first).resolves.toBe(false);
    expect(current()?.reciterId).toBe('r2');
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('resumes at startSeconds, seeking before it plays', async () => {
    await playOrOpen({
      reciterId: 'r1',
      rewayahId: 'w1',
      surahNumber: 3,
      startSeconds: 95,
    });
    expect(engine.seek).toHaveBeenCalledWith(95);
    const seekOrder = (engine.seek as jest.Mock).mock.invocationCallOrder[0];
    const playOrder = (engine.play as jest.Mock).mock.invocationCallOrder[0];
    expect(seekOrder).toBeLessThan(playOrder);
  });

  it('keeps the asked-for rewayah when it has the surah', async () => {
    await playOrOpen({reciterId: 'r1', rewayahId: 'w2', surahNumber: 1});
    expect(current()?.rewayahId).toBe('w2');
  });

  it('a position from another rewayah is not applied', async () => {
    await playOrOpen({
      reciterId: 'r1',
      rewayahId: 'w2',
      surahNumber: 3,
      startSeconds: 50,
    });
    expect(current()?.rewayahId).toBe('w1');
    expect(engine.seek).not.toHaveBeenCalled();
  });

  it('shuffle plays the requested surah first and turns shuffle on', async () => {
    await playOrOpen({reciterId: 'r1', surahNumber: 3, shuffle: true});
    const s = useTVPlayerStore.getState();
    expect(s.shuffle).toBe(true);
    expect(s.currentIndex).toBe(0);
    expect(current()?.surahNumber).toBe(3);
  });

  it('a later surah choice plays in order again', async () => {
    await playOrOpen({reciterId: 'r1', surahNumber: 3, shuffle: true});
    await playOrOpen({reciterId: 'r2', surahNumber: 18});
    expect(useTVPlayerStore.getState().shuffle).toBe(false);
  });

  it('plays a mixed queue (a playlist) from the chosen item', async () => {
    const queue = [
      {reciterId: 'r2', surahNumber: 36},
      {reciterId: 'r1', rewayahId: 'w1', surahNumber: 2},
      {reciterId: 'r3', surahNumber: 1},
    ];
    await playOrOpen({...queue[1], queue});
    const s = useTVPlayerStore.getState();
    // r3 has no recitations: left out.
    expect(s.queue.map(q => `${q.reciterId}:${q.surahNumber}`)).toEqual([
      'r2:36',
      'r1:2',
    ]);
    expect(s.currentIndex).toBe(1);
  });

  it('a surah the reciter lacks shows an error in the player', async () => {
    await expect(playOrOpen({reciterId: 'r2', surahNumber: 2})).resolves.toBe(
      false,
    );
    const s = useTVPlayerStore.getState();
    expect(stack()).toEqual([{screen: 'nowPlaying'}]);
    expect(s.status).toBe('error');
    expect(s.lastError).toMatch(/Husary has no recording/);
    expect(engine.load).not.toHaveBeenCalled();
  });

  it('no recitations at all reads as offline, and Try again looks again', async () => {
    await playOrOpen({reciterId: 'r3', surahNumber: 1});
    expect(useTVPlayerStore.getState().lastError).toBe(OFFLINE_MESSAGE);
    fetchRewayat.mockClear();
    await useTVPlayerStore.getState().retry();
    await new Promise(r => setTimeout(r, 0));
    expect(fetchRewayat).toHaveBeenCalledWith('r3');
  });

  it('pressing a failed track again retries it', async () => {
    await playOrOpen({reciterId: 'r3', surahNumber: 1});
    fetchRewayat.mockClear();
    await playOrOpen({reciterId: 'r3', surahNumber: 1});
    await new Promise(r => setTimeout(r, 0));
    expect(fetchRewayat).toHaveBeenCalledTimes(1);
  });

  it('an unknown reciter shows an error rather than doing nothing', async () => {
    await playOrOpen({reciterId: 'nobody', surahNumber: 1});
    expect(useTVPlayerStore.getState().status).toBe('error');
    expect(stack()).toEqual([{screen: 'nowPlaying'}]);
  });

  it('pressing the finished track plays it again', async () => {
    await playOrOpen({reciterId: 'r2', surahNumber: 36});
    engine.emit({
      status: 'playing',
      positionSeconds: 59.8,
      durationSeconds: 60,
    });
    engine.emit({status: 'idle', positionSeconds: 60, durationSeconds: 60});
    expect(useTVPlayerStore.getState().finished).toBe(true);
    (engine.seek as jest.Mock).mockClear();
    await playOrOpen({reciterId: 'r2', surahNumber: 36});
    expect(engine.seek).toHaveBeenCalledWith(0);
    expect(useTVPlayerStore.getState().finished).toBe(false);
  });

  it('isCurrentTrack ignores the rewayah when the request names none', async () => {
    await playOrOpen({reciterId: 'r1', rewayahId: 'w2', surahNumber: 1});
    expect(isCurrentTrack({reciterId: 'r1', surahNumber: 1})).toBe(true);
    expect(
      isCurrentTrack({reciterId: 'r1', rewayahId: 'w1', surahNumber: 1}),
    ).toBe(false);
  });
});

describe('openPlayer', () => {
  it('pops back to a player deeper in the stack', () => {
    useNavStore.getState().push({screen: 'nowPlaying'});
    useNavStore.getState().push({screen: 'reciterDetail', reciterId: 'r1'});
    openPlayer();
    expect(stack()).toEqual([{screen: 'nowPlaying'}]);
  });
});

describe('voiceForSurah', () => {
  it('takes the first candidate who has the surah', () => {
    expect(voiceForSurah(catalog, 18)).toEqual({
      reciterId: 'r2',
      rewayahId: 'h1',
      surahNumber: 18,
    });
  });

  it('is null when nobody has it', () => {
    expect(voiceForSurah(catalog.slice(0, 2), 114)).toBeNull();
  });

  it('uses the first candidate when nothing is known about it yet', () => {
    expect(voiceForSurah([catalog[2], catalog[0]], 1)).toEqual({
      reciterId: 'r3',
      surahNumber: 1,
    });
  });
});

describe('shuffled', () => {
  it('keeps every item and puts the chosen one first', () => {
    const items = [1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 10; i++) {
      const out = shuffled(items, 4);
      expect(out[0]).toBe(5);
      expect([...out].sort()).toEqual(items);
    }
  });
});
