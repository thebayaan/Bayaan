// @ai-generated
/**
 * Main-player follow-along band in the verse rows' own verses
 * (useTrackedUnitKeys, verse-units contract 4.2), driven by the real
 * follow-along tracker (useAyahTracker) on real timing files:
 *  - Warsh-numbered timings, Warsh rows: exactly the verse being recited, so
 *    the band moves at Warsh 1:6 / 1:7 inside Hafs 1:7;
 *  - rows of another rewayah, or Hafs-numbered timings: every verse holding
 *    a word of what is recited;
 *  - Hafs rows: the tracked Hafs keys, unchanged;
 *  - rows whose verse units are not available: no band.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const mockPosition = {sec: 0};
const mockUnitsUnavailable = new Set<string>();

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      playback: {state: 'idle'},
      queue: {tracks: [], currentIndex: 0},
    })),
  };
});

jest.mock('@/data/reciterData', () => ({
  RECITERS: jest
    .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
    .fixtureCatalog(),
}));

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {
    getTimestampsForSurah: jest.fn(async (set: string, surah: number) =>
      jest
        .requireActual('@/services/timestamps/__fixtures__/timingFixtures')
        .loadTimings(set, surah),
    ),
  },
}));

jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

jest.mock('@/services/audio/ExpoAudioService', () => ({
  expoAudioService: {getCurrentTime: () => mockPosition.sec},
}));

jest.mock('@/utils/playbackVerseUnits', () => ({
  canShowRewayahVerses: (rewayah: string) =>
    rewayah === 'hafs' || !mockUnitsUnavailable.has(rewayah),
}));

import {useAyahTracker, useTrackedUnitKeys} from '../useAyahTracker';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTimestampStore} from '@/store/timestampStore';
import {useReciterStore} from '@/store/reciterStore';
import {RECITERS} from '@/data/reciterData';
import {timingNumberingService} from '@/services/timestamps/TimingNumberingService';
import {loadTimings} from '@/services/timestamps/__fixtures__/timingFixtures';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const ROWS: RewayahId[] = ['warsh', 'al-duri-abi-amr', 'hafs'];
const seen: Record<string, (readonly string[])[]> = {};

function Harness() {
  useAyahTracker();
  for (const rewayah of ROWS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    (seen[rewayah] ??= []).push(useTrackedUnitKeys(rewayah));
  }
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

const last = (rewayah: RewayahId) => {
  const list = seen[rewayah] ?? [];
  return list[list.length - 1];
};

const entryStart = (set: string, surah: number, ayah: number) =>
  loadTimings(set, surah)!.find(e => e.ayahNumber === ayah)!.timestampFrom;

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

beforeEach(() => {
  for (const key of Object.keys(seen)) delete seen[key];
  mockUnitsUnavailable.clear();
  timingNumberingService.reset();
  useTimestampStore.getState().clearCurrentTimestamps();
  useReciterStore.setState({isInitialized: true});
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = null;
});

describe('useTrackedUnitKeys', () => {
  it('Warsh timings: Warsh rows light Warsh 1:6, then Warsh 1:7, inside Hafs 1:7', async () => {
    await startTrack('warsh-14', 1);
    await tickAt(entryStart('warsh-14', 1, 6) + 50);
    expect(last('warsh')).toEqual(['1:6']);
    expect(last('al-duri-abi-amr')).toEqual(['1:6', '1:7']);
    expect(last('hafs')).toEqual(['1:7']);
    await tickAt(entryStart('warsh-14', 1, 7) + 50);
    expect(last('warsh')).toEqual(['1:7']);
    expect(last('al-duri-abi-amr')).toEqual(['1:6', '1:7']);
    expect(last('hafs')).toEqual(['1:7']);
  });

  it('Hafs-numbered Warsh timings light every Warsh verse of the Hafs verse', async () => {
    await startTrack('warsh-134', 1);
    await tickAt(entryStart('warsh-134', 1, 1) + 50);
    // the basmala is no verse in the Madani count
    expect(last('warsh')).toEqual([]);
    expect(last('hafs')).toEqual(['1:1']);
    await tickAt(entryStart('warsh-134', 1, 7) + 50);
    expect(last('warsh')).toEqual(['1:6', '1:7']);
    expect(last('hafs')).toEqual(['1:7']);
  });

  it('Hafs timings: Hafs rows get exactly the tracked Hafs keys', async () => {
    await startTrack('hafs-clean', 112);
    for (const ayah of [1, 2, 3, 4]) {
      await tickAt(entryStart('hafs-clean', 112, ayah) + 50);
      expect(last('hafs')).toEqual([`112:${ayah}`]);
    }
  });

  it('no band for rows whose verse units are not available', async () => {
    mockUnitsUnavailable.add('warsh');
    await startTrack('warsh-14', 1);
    await tickAt(entryStart('warsh-14', 1, 6) + 50);
    expect(last('warsh')).toEqual([]);
    expect(last('hafs')).toEqual(['1:7']);
  });
});
