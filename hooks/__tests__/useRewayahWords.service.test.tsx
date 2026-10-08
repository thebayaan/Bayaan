// @ai-generated
/**
 * useRewayahWords against the real DigitalKhattDataService (expo-sqlite
 * faked): a surface that shows a rewayah's words (the player's verse rows)
 * keeps them while the mushaf switches away.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

import {
  useRewayahWords,
  type RewayahWordsResult,
} from '@/hooks/useRewayahWords';
import {DigitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface FakeSqlite {
  files: Set<string>;
  broken: Set<string>;
  reads: string[];
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The hook reads the app's singleton; each test installs its own instance.
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  const actual = jest.requireActual(
    '@/services/mushaf/DigitalKhattDataService',
  );
  const holder: {current: unknown} = {current: null};
  const mocked = Object.assign({}, actual, {__holder: holder});
  Object.defineProperty(mocked, 'digitalKhattDataService', {
    enumerable: true,
    get: () => holder.current,
  });
  return mocked;
});

jest.mock('expo-sqlite', () => {
  const state: FakeSqlite = {
    files: new Set(),
    broken: new Set(),
    reads: [],
  };
  const TAG: Record<string, string> = {
    dk_words: 'H',
    dk_words_warsh: 'W',
    dk_words_qaloon: 'Q',
    dk_words_shouba: 'S',
    dk_words_bazzi: 'B',
  };
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  return {
    __fake: state,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      const base = baseOf(name);
      return {
        async getFirstAsync(sql: string) {
          if (!state.files.has(name)) return null;
          return {name: /name='(\w+)'/.exec(sql)?.[1]};
        },
        async getAllAsync(sql: string) {
          if (state.broken.has(base)) {
            throw new Error('database disk image is malformed');
          }
          state.reads.push(base);
          if (sql.includes('FROM pages')) {
            return [
              {
                page_number: 1,
                line_number: 1,
                line_type: 'ayah',
                is_centered: 0,
                first_word_id: 1,
                last_word_id: 2,
                surah_number: 1,
              },
            ];
          }
          const tag = TAG[base] ?? '?';
          return [
            {id: 1, text: `${tag}1`, location: '1:1:1'},
            {id: 2, text: `${tag}2`, location: '1:1:2'},
          ];
        },
        closeAsync: async () => undefined,
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      state.files.add(name);
    },
    async deleteDatabaseAsync(name: string) {
      state.files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async () => []),
}));

const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqlite}).__fake;
const holder = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __holder: {current: DigitalKhattDataService | null};
  }
).__holder;

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/** A verse row showing `rewayah`'s words, recording every render. */
function showVerse(rewayah: RewayahId) {
  const renders: RewayahWordsResult[] = [];
  function Row(): null {
    renders.push(useRewayahWords('1:1', rewayah));
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<Row />);
  });
  return {
    latest: () => renders[renders.length - 1],
    renders,
    unmount: () => act(() => renderer?.unmount()),
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await flush();
  });
}

let now = 0;
let spies: jest.SpyInstance[] = [];

beforeEach(async () => {
  fake.files.clear();
  fake.broken.clear();
  fake.reads.length = 0;
  // Every test starts long after the previous one (retry intervals).
  now += 10 * 60 * 1000;
  spies = [
    jest.spyOn(Date, 'now').mockImplementation(() => now),
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    // react-test-renderer prints a deprecation notice under React 19.
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  const instance = new DigitalKhattDataService();
  holder.current = instance;
  await instance.initialize();
});

afterEach(async () => {
  await flush();
  for (const spy of spies) spy.mockRestore();
});

function service(): DigitalKhattDataService {
  if (!holder.current) throw new Error('no service');
  return holder.current;
}

describe('a surface showing a rewayah', () => {
  it('keeps its words while the mushaf switches away, again and again', async () => {
    await service().switchRewayah('warsh');
    const row = showVerse('warsh');
    expect(row.latest()).toMatchObject({status: 'ready'});

    await act(async () => {
      await service().switchRewayah('qalun');
      await service().switchRewayah('shubah');
      await service().switchRewayah('al-bazzi');
    });
    await settle();

    expect(row.latest().words.map(w => w.text)).toEqual(['W1', 'W2']);
    // It never dropped back to loading, and Warsh was read only once.
    expect(row.renders.map(r => r.status)).not.toContain('loading');
    expect(fake.reads.filter(base => base === 'dk_words_warsh')).toHaveLength(
      1,
    );
    row.unmount();
  });
});
