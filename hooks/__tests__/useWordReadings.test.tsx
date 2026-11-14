// @ai-generated
/**
 * useWordReadings over a WordReadingsService whose reader serves real rows
 * of the bundled index (wordReadingsFixture.json): loading, then ready;
 * a failed read, then retry; a word over two DK slots.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

import {
  useWordReadings,
  type WordReadingsResult,
} from '@/hooks/useWordReadings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The hook reads the app's singleton: here one over a fake reader whose
// verse reads wait for release() and fail while `fail` is set.
jest.mock('@/services/mushaf/WordReadingsService', () => {
  const actual = jest.requireActual('@/services/mushaf/WordReadingsService');
  const fixture = jest.requireActual(
    '@/services/mushaf/__fixtures__/wordReadingsFixture.json',
  ) as {
    info: {key: string; value: string}[];
    words: {
      verseKey: string;
      position: number;
      wordId: number;
      data: string | null;
    }[];
  };
  const {parseReadingsInfo} = jest.requireActual(
    '@/services/mushaf/wordReadingsFormat',
  );
  const control = {
    fail: false,
    reads: [] as string[],
    held: null as Promise<void> | null,
    release: () => undefined as void,
    hold() {
      control.held = new Promise<void>(resolve => {
        control.release = () => {
          control.held = null;
          resolve();
        };
      });
    },
  };
  const reader = {
    readInfo: async () => fixture.info,
    readVerse: async (verseKey: string) => {
      control.reads.push(verseKey);
      if (control.held) await control.held;
      if (control.fail) throw new Error('database disk image is malformed');
      return fixture.words
        .filter(w => w.verseKey === verseKey && w.data !== null)
        .map(w => ({position: w.position, word_id: w.wordId, data: w.data}));
    },
  };
  const inputs = parseReadingsInfo(fixture.info).inputs;
  return {
    ...actual,
    wordReadingsService: new actual.WordReadingsService(reader, {
      expectedInputs: () => inputs,
    }),
    __control: control,
  };
});

const control = (
  jest.requireMock('@/services/mushaf/WordReadingsService') as {
    __control: {
      fail: boolean;
      reads: string[];
      hold(): void;
      release(): void;
    };
  }
).__control;

let latest: WordReadingsResult | null = null;

function Probe({verseKey, wbw}: {verseKey: string; wbw: number}) {
  latest = useWordReadings(verseKey, wbw);
  return null;
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

let renderer: TestRenderer.ReactTestRenderer | null = null;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  latest = null;
  control.fail = false;
  control.reads.length = 0;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  warnSpy.mockRestore();
});

it('is loading, then ready with the word and its DK positions', async () => {
  control.hold();
  act(() => {
    renderer = TestRenderer.create(<Probe verseKey="1:4" wbw={1} />);
  });
  expect(latest).toEqual({status: 'loading'});
  control.release();
  await flush();
  expect(latest?.status).toBe('ready');
  if (latest?.status !== 'ready') return;
  expect(latest.dkPositions).toEqual([1]);
  expect(latest.readings.groups.map(g => g.kind)).toEqual([
    'asHafs',
    'differs',
  ]);
  expect(control.reads).toEqual(['1:4']);

  // Another word of the same verse comes from the cache.
  act(() => renderer?.update(<Probe verseKey="1:4" wbw={2} />));
  expect(latest?.status).toBe('ready');
  expect(control.reads).toEqual(['1:4']);
});

it('maps a word-by-word word over two DK slots', async () => {
  act(() => {
    renderer = TestRenderer.create(<Probe verseKey="2:181" wbw={3} />);
  });
  await flush();
  expect(latest?.status).toBe('ready');
  if (latest?.status !== 'ready') return;
  expect(latest.dkPositions).toEqual([3, 4]);
  expect(latest.readings.alike).toBe(true);
});

it('reports an error with retry, and retry recovers', async () => {
  control.fail = true;
  act(() => {
    renderer = TestRenderer.create(<Probe verseKey="2:9" wbw={6} />);
  });
  await flush();
  expect(latest?.status).toBe('error');
  const reads = control.reads.length;

  control.fail = false;
  if (latest?.status !== 'error') return;
  const {retry} = latest;
  act(() => retry());
  await flush();
  expect(latest?.status).toBe('ready');
  expect(control.reads.length).toBe(reads + 1);
});
