// @ai-generated
/**
 * useRewayahVerseUnits against the real DigitalKhattDataService (expo-sqlite
 * faked). The service keeps only ONE idle side copy of a rewayah other than
 * the mushaf's, so every surface showing a rewayah's verse units retains it
 * while mounted. Surfaces showing two such rewayat at once (Bookmarks or
 * Notes list rows saved in Warsh and in al-Bazzi on a Hafs mushaf, the
 * mushaf search's bookmark chips, the player list of a track in another
 * rewayah) then keep both: each words DB is read once and every label
 * settles. Without the retain, each load evicted the other rewayah, whose
 * surface loaded it again on the next cache change, for as long as the
 * screen stayed mounted (labels flickering between blank and the number).
 *
 * The units service is a stand-in with the real one's contract (units exist
 * exactly while the rewayah's words are in memory), returning the units of
 * the fixture's real Release 1 slots.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text, View} from 'react-native';

import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {useSavedVerseDescription} from '@/hooks/useSavedVerseDescription';
import {BookmarkItem} from '@/components/collection/BookmarkItem';
import {
  BookmarkChips,
  warmBookmarkCache,
} from '@/components/mushaf/BookmarkChips';
import {DigitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {SavedVerseRef} from '@/services/verse-annotations/unitAnnotations';
import {
  fixtureUnits,
  unitOf,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import type {VerseBookmark} from '@/types/verse-annotations';

interface FakeSqlite {
  files: Set<string>;
  /** Words / layout DB bases in the order their rows were read. */
  reads: string[];
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The hooks read the app's singleton; each test installs its own instance.
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

// The real service's contract, with builds that take no time: units exist
// exactly while the rewayah's words are in memory (the real service builds
// them after interactions once requested, and drops them with the words).
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => {
  const dk = () =>
    (
      jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
        digitalKhattDataService: {
          isRewayahReady(r: string): boolean;
          getRewayahLoadState(r: string): string;
        };
      }
    ).digitalKhattDataService;
  const units = (r: string): unknown =>
    jest
      .requireActual(
        '@/services/verse-annotations/__fixtures__/verseUnitsTestData',
      )
      .fixtureUnits(r);
  return {
    rewayahVerseUnitsService: jest
      .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
      .verseUnitsServiceStub({
        peek: (r: string) => (dk().isRewayahReady(r) ? units(r) : null),
        status: (r: string) => dk().getRewayahLoadState(r),
      }),
  };
});

jest.mock('expo-sqlite', () => {
  const state: FakeSqlite = {files: new Set(), reads: []};
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
          state.reads.push(base);
          // A load loop (what these tests guard against) reads the same DB
          // over and over and starves the test's timers: from the fourth
          // read on, a read never completes, so a loop stops and the read
          // counts show it.
          if (state.reads.filter(b => b === base).length > 3) {
            return new Promise(() => undefined);
          }
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
          return [
            {id: 1, text: `${base}-1`, location: '1:1:1'},
            {id: 2, text: `${base}-2`, location: '1:1:2'},
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

// The visual dependencies of the real list items. SkiaVerseText draws with
// Skia: its stand-in makes the same words-hook call the real one makes for
// the props it gets (a given text or given words read nothing).
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => {
    const {useRewayahWords} = jest.requireActual('@/hooks/useRewayahWords');
    const {useMushafSettingsStore} = jest.requireActual(
      '@/store/mushafSettingsStore',
    );
    function SkiaVerseTextStandIn(props: {
      text?: string;
      words?: unknown;
      verseKey?: string;
      rewayah?: string;
    }) {
      const mushafRewayah = useMushafSettingsStore(
        (s: {rewayah: string}) => s.rewayah,
      );
      useRewayahWords(
        props.text !== undefined || props.words
          ? null
          : (props.verseKey ?? null),
        props.rewayah ?? mushafRewayah,
      );
      return null;
    }
    return {__esModule: true, default: SkiaVerseTextStandIn};
  },
);
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {card: '#fff', text: '#111', textSecondary: '#666'},
      fonts: {medium: 'Medium', regular: 'Regular'},
    },
  }),
}));

const mockBookmarks: VerseBookmark[] = [];
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAllBookmarks: () => Promise.resolve(mockBookmarks),
  },
}));

const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqlite}).__fake;
const holder = (
  jest.requireMock('@/services/mushaf/DigitalKhattDataService') as {
    __holder: {current: DigitalKhattDataService | null};
  }
).__holder;

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

function service(): DigitalKhattDataService {
  if (!holder.current) throw new Error('no service');
  return holder.current;
}

/** Reads of one words DB (by its file base, e.g. 'dk_words_warsh'). */
const reads = (base: string) => fake.reads.filter(b => b === base).length;

async function flush(rounds: number): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/**
 * Lets loads, cache notifications and effects run. A surface that reloads
 * evicted words would read its DB again within a few rounds; 200 rounds
 * leave such a loop dozens of turns.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await flush(200);
  });
}

function mount(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    // The renderer's own React types differ from the app's.
    renderer = TestRenderer.create(element as never);
  });
  return renderer;
}

/** Every string drawn in a Text (except the surah-name glyph), in order. */
function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(n => n.type === (Text as never))
    .filter(t => StyleSheet.flatten(t.props.style)?.fontFamily !== 'SurahNames')
    .map(t => {
      const children = t.props.children as unknown;
      return Array.isArray(children)
        ? children.join('')
        : String(children ?? '');
    })
    .filter(Boolean);
}

/** A surface showing `rewayah`'s verse units; logs its status per render. */
function ShowsUnits({rewayah, log}: {rewayah: RewayahId; log: string[]}) {
  log.push(`${rewayah}:${useRewayahVerseUnits(rewayah).status}`);
  return null;
}

/** A collection row's label (BookmarkItem / NoteItem / chip label path). */
function RowLabel({row, log}: {row: SavedVerseRef; log: string[]}) {
  const description = useSavedVerseDescription(row);
  log.push(
    `${row.rewayahId}:${description.kind === 'units' ? description.label : description.kind}`,
  );
  return null;
}

/** Whether a rewayah's log went back to `stale` after its first `settled`. */
function flickered(log: string[], settled: string, stale: string): boolean {
  const first = log.indexOf(settled);
  return first === -1 || log.slice(first).includes(stale);
}

let spies: jest.SpyInstance[] = [];

beforeEach(async () => {
  fake.files.clear();
  fake.reads.length = 0;
  mockBookmarks.length = 0;
  spies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    // react-test-renderer prints a deprecation notice under React 19.
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  // A Hafs mushaf: Warsh and al-Bazzi are side copies.
  const instance = new DigitalKhattDataService();
  holder.current = instance;
  await instance.initialize();
  fake.reads.length = 0;
});

afterEach(async () => {
  await flush(5);
  for (const spy of spies) spy.mockRestore();
});

describe('surfaces showing two rewayat other than the mushaf’s', () => {
  it('keep both: each words DB is read once and stays in memory', async () => {
    const log: string[] = [];
    const renderer = mount(
      <>
        <ShowsUnits rewayah="warsh" log={log} />
        <ShowsUnits rewayah="al-bazzi" log={log} />
      </>,
    );
    await settle();

    expect(reads('dk_words_warsh')).toBe(1);
    expect(reads('dk_words_bazzi')).toBe(1);
    const warsh = log.filter(e => e.startsWith('warsh:'));
    const bazzi = log.filter(e => e.startsWith('al-bazzi:'));
    expect(warsh[warsh.length - 1]).toBe('warsh:ready');
    expect(bazzi[bazzi.length - 1]).toBe('al-bazzi:ready');
    expect(flickered(warsh, 'warsh:ready', 'warsh:loading')).toBe(false);
    expect(flickered(bazzi, 'al-bazzi:ready', 'al-bazzi:loading')).toBe(false);

    // A third rewayah read meanwhile (a share, the player) evicts neither.
    await act(async () => {
      await service().ensureRewayahLoaded('qalun');
      await flush(20);
    });
    expect(service().isRewayahReady('warsh')).toBe(true);
    expect(service().isRewayahReady('al-bazzi')).toBe(true);
    expect(reads('dk_words_warsh')).toBe(1);
    expect(reads('dk_words_bazzi')).toBe(1);

    // Once nothing shows them they are idle copies again, bounded as
    // before: the next copy loaded drops them.
    act(() => renderer.unmount());
    await act(async () => {
      await service().ensureRewayahLoaded('shubah');
      await flush(5);
    });
    expect(service().isRewayahReady('warsh')).toBe(false);
    expect(service().isRewayahReady('al-bazzi')).toBe(false);
    expect(service().isRewayahReady('shubah')).toBe(true);
  });

  it('collection row labels of both settle on their own numbers', async () => {
    const log: string[] = [];
    // Warsh 1:7 (the later part of Hafs 1:7) and al-Bazzi 1:7, as stored.
    const warshRow = {verseKey: '1:7:5', rewayahId: 'warsh'} as const;
    const bazziRow = {verseKey: '1:7', rewayahId: 'al-bazzi'} as const;
    const renderer = mount(
      <>
        <RowLabel row={warshRow} log={log} />
        <RowLabel row={bazziRow} log={log} />
      </>,
    );
    await settle();

    const warshLabel = `warsh:${unitOf(fixtureUnits('warsh'), '1:7').key}`;
    const bazziLabel = `al-bazzi:${unitOf(fixtureUnits('al-bazzi'), '1:7').key}`;
    const warsh = log.filter(e => e.startsWith('warsh:'));
    const bazzi = log.filter(e => e.startsWith('al-bazzi:'));
    expect(warsh[warsh.length - 1]).toBe(warshLabel);
    expect(bazzi[bazzi.length - 1]).toBe(bazziLabel);
    expect(flickered(warsh, warshLabel, 'warsh:loading')).toBe(false);
    expect(flickered(bazzi, bazziLabel, 'al-bazzi:loading')).toBe(false);
    expect(reads('dk_words_warsh')).toBe(1);
    expect(reads('dk_words_bazzi')).toBe(1);
    act(() => renderer.unmount());
  });

  it('the Bookmarks list: rows saved in Warsh and al-Bazzi on a Hafs mushaf', async () => {
    const noop = () => undefined;
    const renderer = mount(
      <>
        <BookmarkItem
          surahName="Al-Fatihah"
          surahNumber={1}
          ayahNumber={7}
          verseKey="1:7:5"
          rewayahId="warsh"
          onPress={noop}
          onOptionsPress={noop}
        />
        <BookmarkItem
          surahName="Al-Fatihah"
          surahNumber={1}
          ayahNumber={7}
          verseKey="1:7"
          rewayahId="al-bazzi"
          onPress={noop}
          onOptionsPress={noop}
        />
      </>,
    );
    // Give the previews their width (as a layout pass would).
    await act(async () => {
      await flush(5);
      for (const view of renderer.root.findAll(
        n => n.type === (View as never),
      )) {
        const onLayout = view.props.onLayout as
          | ((e: {nativeEvent: {layout: {width: number}}}) => void)
          | undefined;
        onLayout?.({nativeEvent: {layout: {width: 320}}});
      }
    });
    await settle();

    expect(reads('dk_words_warsh')).toBe(1);
    expect(reads('dk_words_bazzi')).toBe(1);
    // Each row names its own verse (rewayah pills from the release).
    expect(texts(renderer)).toEqual(['1:7', 'Warsh', '1:7', 'Al-Bazzi']);
    act(() => renderer.unmount());
  });

  it('the mushaf search’s bookmark chips', async () => {
    const bookmark = (
      id: string,
      verseKey: string,
      rewayahId: RewayahId,
    ): VerseBookmark => ({
      id,
      verseKey,
      surahNumber: 1,
      ayahNumber: 7,
      createdAt: 0,
      rewayahId,
    });
    mockBookmarks.push(
      bookmark('a', '1:7:5', 'warsh'),
      bookmark('b', '1:7', 'al-bazzi'),
    );
    await warmBookmarkCache();
    const renderer = mount(
      <BookmarkChips shownRewayah="hafs" onPress={() => undefined} />,
    );
    await settle();

    expect(reads('dk_words_warsh')).toBe(1);
    expect(reads('dk_words_bazzi')).toBe(1);
    expect(texts(renderer)).toEqual([
      'BOOKMARKS',
      'Al-Fatihah 1:7 · Warsh',
      'Al-Fatihah 1:7 · Al-Bazzi',
    ]);
    act(() => renderer.unmount());
  });
});
