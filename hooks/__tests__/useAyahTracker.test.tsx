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
import {useTimestampStore} from '@/store/timestampStore';
import {useReciterStore} from '@/store/reciterStore';
import {RECITERS} from '@/data/reciterData';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';
import {findAyahTimestamp, getTrackedVerseKeys} from '@/utils/timestampUtils';
import type {MappedAyahTrackingState} from '@/utils/timestampNumbering';

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
});
