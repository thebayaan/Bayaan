/**
 * Main-player follow-along (useAyahTracker) with rewayah-numbered timings:
 * the published verse is the Hafs verse being recited, nothing is published
 * while the numbering resolves or when it cannot be established, and the
 * numbering is registered for "Play from here" (findAyahTimestamp).
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

const mockPosition = {sec: 0};

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      playback: {state: 'idle'},
      queue: {tracks: [], currentIndex: 0},
    })),
  };
});

jest.mock('@/data/reciterData', () => {
  const catalog = jest
    .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
    .fixtureCatalog();
  // A recitation in a rewayah without bundled text or verse map
  catalog.push({
    id: 'reciter-unmapped',
    name: 'Test Reciter Unmapped',
    date: null,
    image_url: null,
    rewayat: [
      {
        id: 'unmapped-set',
        reciter_id: 'reciter-unmapped',
        name: "Hesham A'n Ibn Amer",
        style: 'murattal',
        server: 'https://audio.example.com/unmapped',
        surah_total: 114,
        surah_list: [],
        source_type: 'test',
        created_at: '2026-01-01',
        has_timestamps: true,
      },
    ],
  });
  return {RECITERS: catalog};
});

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async (set: string, surah: number) =>
      jest
        .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
        // the unmapped set reuses real Madani-numbered timings; the late set
        // (absent from the catalog) reuses Hafs timings
        .loadTimings(
          (
            {'unmapped-set': 'warsh-14', 'late-set': 'hafs-clean'} as Record<
              string,
              string
            >
          )[set] ?? set,
          surah,
        ),
    ),
  },
}));

jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {getCurrentTime: () => mockPosition.sec},
}));

import {useAyahTracker} from '../useAyahTracker';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  selectVerseTrackingUnavailable, // @ai
  useTimestampStore,
} from '@/store/timestampStore';
import {useReciterStore} from '@/store/reciterStore';
import {RECITERS} from '@/data/reciterData';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import {
  findAyahTimestamp,
  getPlayFromHereTarget, // @ai
  getTrackedVerseKeys,
} from '@/utils/timestampUtils';
import {
  selectTrackedVerseKeysId, // @ai
  type MappedAyahTrackingState,
} from '@/utils/timestampNumbering';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  useAyahTracker();
  return null;
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function startTrack(set: string, surah: number) {
  const reciter = RECITERS.find(r => r.rewayat.some(rw => rw.id === set));
  (usePlayerStore as unknown as {setState: (s: object) => void}).setState({
    playback: {state: 'playing'},
    queue: {
      tracks: [
        {
          rewayatId: set,
          reciterId: reciter?.id ?? 'unknown-reciter',
          surahId: String(surah),
        },
      ],
      currentIndex: 0,
    },
  });
  await act(async () => {
    await useTimestampStore.getState().loadTimestampsForSurah(set, surah);
  });
  await act(async () => {
    renderer = TestRenderer.create(<Harness />);
  });
  await flush();
}

// @ai-start
const setPlayer = (state: object) =>
  (usePlayerStore as unknown as {setState: (s: object) => void}).setState(
    state,
  );
// @ai-end

async function tickAt(ms: number) {
  mockPosition.sec = ms / 1000;
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
}

const current = () =>
  useTimestampStore.getState().currentAyah as MappedAyahTrackingState | null;

const timings = () => useTimestampStore.getState().currentSurahTimestamps!;

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

beforeEach(() => {
  useReciterStore.setState({isInitialized: true});
  timingNumberingService.reset();
  useTimestampStore.getState().clearCurrentTimestamps();
  mockPosition.sec = 0;
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = null;
});

describe('useAyahTracker', () => {
  it('Warsh (rewayah-numbered): publishes the Hafs verses being recited', async () => {
    await startTrack('warsh-14', 2);
    const t = loadTimings('warsh-14', 2)!;
    await tickAt(t[3].timestampFrom + 50); // Warsh 2:4
    expect(current()).toMatchObject({
      surahNumber: 2,
      ayahNumber: 5,
      verseKey: '2:5',
      verseKeys: ['2:5'],
      reciterVerseKey: '2:4',
    });
    await tickAt(t[0].timestampFrom + 50); // Warsh 2:1
    expect(current()?.verseKey).toBe('2:1');
    expect(getTrackedVerseKeys(current())).toEqual(['2:1', '2:2']);
    await tickAt(t[284].timestampFrom + 50); // Warsh 2:285
    expect(current()?.verseKey).toBe('2:286');
  });

  it('registers the numbering for "Play from here"', async () => {
    await startTrack('warsh-14', 2);
    expect(findAyahTimestamp(timings(), 286)?.ayahNumber).toBe(285);
    expect(findAyahTimestamp(timings(), 5)?.ayahNumber).toBe(4);
  });

  it('publishes nothing until a set-level vote resolves (al-Fatihah)', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const voteSpy = jest
      .spyOn(timingNumberingService, 'getSetClass')
      .mockImplementation(async () => {
        await gate;
        return 'riwayah';
      });
    await startTrack('warsh-14', 1);
    const t = loadTimings('warsh-14', 1)!;
    await tickAt(t[0].timestampFrom + 50);
    expect(current()).toBeNull();
    expect(findAyahTimestamp(timings(), 2)).toBeNull();
    release?.();
    await flush();
    await tickAt(t[0].timestampFrom + 60);
    expect(current()?.verseKeys).toEqual(['1:2']);
    expect(findAyahTimestamp(timings(), 2)?.ayahNumber).toBe(1);
    voteSpy.mockRestore();
  });

  it('al-Duri 269 al-Mulk: no highlight and no seek target', async () => {
    await startTrack('doori-269', 67);
    for (const e of loadTimings('doori-269', 67)!) {
      await tickAt(e.timestampFrom + 50);
      expect(current()).toBeNull();
    }
    expect(findAyahTimestamp(timings(), 5)).toBeNull();
  });

  it('a rewayah without a verse map is never treated as Hafs', async () => {
    // resolver falls back to Hafs for display; numbering must not
    await startTrack('unmapped-set', 2);
    await tickAt(loadTimings('warsh-14', 2)![3].timestampFrom + 50);
    expect(current()).toBeNull();
  });

  it('waits for the catalog before deciding an unknown rewayat id', async () => {
    useReciterStore.setState({isInitialized: false});
    await startTrack('late-set', 2);
    const t = loadTimings('hafs-clean', 2)!;
    await tickAt(t[4].timestampFrom + 50);
    expect(current()).toBeNull();
    expect(findAyahTimestamp(timings(), 5)).toBeNull();
    // catalog loaded, set still unknown: Hafs count -> identity
    await act(async () => {
      useReciterStore.setState({isInitialized: true});
    });
    await flush();
    await tickAt(t[4].timestampFrom + 60);
    expect(current()?.verseKey).toBe('2:5');
  });

  // @ai-start
  it('"Play from here" writing only the tapped verse is completed to every recited Hafs verse', async () => {
    await startTrack('warsh-14', 2);
    const t = loadTimings('warsh-14', 2)!;
    await tickAt(t[0].timestampFrom + 50); // Warsh 2:1 = Hafs 2:1 + 2:2
    expect(getTrackedVerseKeys(current())).toEqual(['2:1', '2:2']);
    // The verse-actions sheet seeks to the entry and writes the tapped key
    await act(async () => {
      useTimestampStore.getState().setCurrentAyah({
        surahNumber: 2,
        ayahNumber: 1,
        verseKey: '2:2',
        timestampFrom: t[0].timestampFrom,
        timestampTo: t[0].timestampTo,
      });
    });
    expect(getTrackedVerseKeys(current())).toEqual(['2:2']);
    await tickAt(t[0].timestampFrom + 60); // same entry, next tick
    expect(current()).toMatchObject({
      verseKey: '2:1',
      verseKeys: ['2:1', '2:2'],
      reciterVerseKey: '2:1',
    });
  });

  it('Hafs: an external write is replaced by the same single verse', async () => {
    await startTrack('hafs-clean', 2);
    const t = loadTimings('hafs-clean', 2)!;
    await tickAt(t[4].timestampFrom + 50);
    await act(async () => {
      useTimestampStore.getState().setCurrentAyah({
        surahNumber: 2,
        ayahNumber: 5,
        verseKey: '2:5',
        timestampFrom: t[4].timestampFrom,
        timestampTo: t[4].timestampTo,
      });
    });
    await tickAt(t[4].timestampFrom + 60);
    expect(current()).toMatchObject({verseKey: '2:5', verseKeys: ['2:5']});
    // what the verse list highlights did not change
    expect(selectTrackedVerseKeysId(useTimestampStore.getState())).toBe('2:5');
  });
  // @ai-end

  // @ai-start
  describe('"Play from here" while its seek lands', () => {
    /** Every verse key published from now on, in order. */
    function recordPublished() {
      const keys: (string | null)[] = [];
      const unsubscribe = useTimestampStore.subscribe((s, prev) => {
        if (s.currentAyah !== prev.currentAyah) {
          keys.push(s.currentAyah?.verseKey ?? null);
        }
      });
      return {keys, unsubscribe};
    }

    /** The verse-actions sheet: seek (still in flight) and publish. */
    async function playFromHere(hafsKey: string) {
      const target = getPlayFromHereTarget(timings(), hafsKey);
      if (target.status !== 'ready') throw new Error(target.status);
      await act(async () => {
        useTimestampStore.getState().setCurrentAyah(target.tracking);
      });
      return target;
    }

    it('Hafs: the verse being left is not published again', async () => {
      await startTrack('hafs-clean', 2);
      const t = loadTimings('hafs-clean', 2)!;
      await tickAt(t[9].timestampFrom + 50);
      expect(current()?.verseKey).toBe('2:10');
      const published = recordPublished();
      await playFromHere('2:50');
      // the native position still reports 2:10 for a few ticks
      await tickAt(t[9].timestampFrom + 250);
      await tickAt(t[9].timestampFrom + 450);
      expect(current()?.verseKey).toBe('2:50');
      // the seek lands, then the reciter moves on
      await tickAt(t[49].timestampFrom + 50);
      expect(current()).toMatchObject({verseKey: '2:50', verseKeys: ['2:50']});
      await tickAt(t[50].timestampFrom + 50);
      published.unsubscribe();
      expect(published.keys).not.toContain('2:10');
      expect(published.keys[0]).toBe('2:50');
      expect(published.keys[published.keys.length - 1]).toBe('2:51');
    });

    it('Warsh: no flash back to the reciter verse being left', async () => {
      await startTrack('warsh-14', 2);
      const t = loadTimings('warsh-14', 2)!;
      await tickAt(t[9].timestampFrom + 50); // Warsh 2:10 = Hafs 2:11
      expect(current()?.verseKey).toBe('2:11');
      const published = recordPublished();
      const target = await playFromHere('2:2'); // Warsh 2:1 = Hafs 2:1 + 2:2
      await tickAt(t[9].timestampFrom + 250);
      expect(getTrackedVerseKeys(current())).toEqual(['2:1', '2:2']);
      await tickAt(target.status === 'ready' ? target.entry.timestampFrom : 0);
      expect(getTrackedVerseKeys(current())).toEqual(['2:1', '2:2']);
      published.unsubscribe();
      expect(published.keys).not.toContain('2:11');
    });

    it('started while paused: the first tick does not publish the old verse', async () => {
      await startTrack('hafs-clean', 2);
      const t = loadTimings('hafs-clean', 2)!;
      await tickAt(t[9].timestampFrom + 50);
      await act(async () => {
        setPlayer({playback: {state: 'paused'}});
      });
      await playFromHere('2:50');
      // the sheet starts playback; the native seek has not landed yet
      await act(async () => {
        setPlayer({playback: {state: 'playing'}});
      });
      await tickAt(t[9].timestampFrom + 250);
      expect(current()?.verseKey).toBe('2:50');
      await tickAt(t[49].timestampFrom + 50);
      expect(current()?.verseKey).toBe('2:50');
    });

    it('a seek that never lands gives way to the verse actually recited', async () => {
      await startTrack('hafs-clean', 2);
      const t = loadTimings('hafs-clean', 2)!;
      await tickAt(t[9].timestampFrom + 50);
      await playFromHere('2:50');
      for (let i = 1; i <= 20; i++) {
        await tickAt(t[9].timestampFrom + 50 + i * 20);
      }
      expect(current()).toMatchObject({verseKey: '2:10', verseKeys: ['2:10']});
    });
  });
  // @ai-end

  it('Hafs recitations are unchanged', async () => {
    await startTrack('hafs-clean', 2);
    for (const e of loadTimings('hafs-clean', 2)!.slice(0, 40)) {
      await tickAt(e.timestampFrom + 50);
      expect(current()).toMatchObject({
        surahNumber: 2,
        ayahNumber: e.ayahNumber,
        verseKey: `2:${e.ayahNumber}`,
        timestampFrom: e.timestampFrom,
        timestampTo: e.timestampTo,
      });
    }
    expect(findAyahTimestamp(timings(), 286)?.ayahNumber).toBe(286);
  });

  // @ai-start
  describe('tells the player when verse tracking is unavailable', () => {
    const unavailable = () =>
      selectVerseTrackingUnavailable(useTimestampStore.getState());

    beforeEach(() => {
      // every fixture set has timestamps: follow-along is offered for it
      useTimestampStore.getState().loadFollowAlongRegistry();
      useTimestampStore.setState({followAlongEnabled: true});
    });

    it('al-Duri 269 al-Mulk (numbering disabled): unavailable', async () => {
      await startTrack('doori-269', 67);
      expect(unavailable()).toBe(true);
      // follow-along switched off: nothing to say
      await act(async () => {
        useTimestampStore.getState().toggleFollowAlong();
      });
      expect(unavailable()).toBe(false);
    });

    it('a surah whose timings could not be loaded: unavailable', async () => {
      await startTrack('hafs-clean', 3); // no such fixture: the load fails
      expect(useTimestampStore.getState().timestampLoadStatus).toBe('failed');
      expect(unavailable()).toBe(true);
    });

    it('tracked recitations (Hafs and rewayah-numbered): available', async () => {
      await startTrack('hafs-clean', 2);
      expect(unavailable()).toBe(false);
      await act(async () => {
        renderer?.unmount();
      });
      await startTrack('warsh-14', 2);
      expect(unavailable()).toBe(false);
    });

    it('nothing is said while the numbering is still being resolved', async () => {
      let release: (() => void) | undefined;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const voteSpy = jest
        .spyOn(timingNumberingService, 'getSetClass')
        .mockImplementation(async () => {
          await gate;
          return 'unknown';
        });
      await startTrack('warsh-14', 1);
      expect(unavailable()).toBe(false);
      release?.();
      await flush();
      // the vote was inconclusive: al-Fatihah cannot be followed
      expect(unavailable()).toBe(true);
      voteSpy.mockRestore();
    });

    it('a reciter without follow-along support says nothing', async () => {
      useTimestampStore.setState({supportedRewayatIds: new Set<string>()});
      await startTrack('doori-269', 67);
      expect(unavailable()).toBe(false);
    });
  });
  // @ai-end
});
