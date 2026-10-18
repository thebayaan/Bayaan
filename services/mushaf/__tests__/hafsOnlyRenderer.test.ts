// @ai-generated
/**
 * Mushaf 1440 (qcf_v2) draws Hafs only, so the settings store pins the
 * rewayah to Hafs there. The DigitalKhatt data service must never serve
 * another rewayah while that pin holds: after a later switch back to a
 * DigitalKhatt font the mushaf would draw that rewayah's text and verse
 * numbers under a "Hafs" header (and the switch could even announce
 * "Now reading Warsh").
 *
 * Real settings store, real data service, real selection flow
 * (components/sheets/rewayahSelection.ts); only expo-sqlite is faked, with
 * expo-sqlite 56's native rules (import is a no-op when the file exists,
 * opening a missing file creates an empty one, delete refuses open or missing
 * files). Every words DB holds the same word slots with text tagged by its
 * rewayah (H1.. for Hafs, W1.. for Warsh, ...), and reads can be held (gates)
 * or delayed by a seeded number of event-loop turns.
 */
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {MushafRenderer} from '@/store/mushafSettingsStore';

interface FakeSqlite {
  files: Map<string, string>; // on-device name -> base
  open: Map<string, number>;
  gates: Map<string, Promise<void>>;
  broken: Set<string>; // bases whose reads always fail
  delay: (() => number) | null; // event-loop turns before each read
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

jest.mock('expo-sqlite', () => {
  const state: FakeSqlite = {
    files: new Map(),
    open: new Map(),
    gates: new Map(),
    broken: new Set(),
    delay: null,
  };
  const TAG: Record<string, string> = {
    dk_words: 'H',
    dk_words_warsh: 'W',
    dk_words_qaloon: 'Q',
    dk_words_shouba: 'S',
    dk_words_bazzi: 'B',
    dk_words_qumbul: 'K',
    dk_words_doori: 'D',
    dk_words_soosi: 'O',
  };
  const LOCATIONS = ['1:1:1', '1:1:2', '1:2:1', '1:2:2', '2:1:1', '2:1:2'];
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  const openCount = (name: string) => state.open.get(name) ?? 0;
  return {
    __fake: state,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      if (!state.files.has(name)) state.files.set(name, '');
      state.open.set(name, openCount(name) + 1);
      let closed = false;
      return {
        async getFirstAsync(sql: string) {
          const base = state.files.get(name);
          if (!base) return null;
          const table = /name='(\w+)'/.exec(sql)?.[1];
          return table === (base === 'dk_layout' ? 'pages' : 'words')
            ? {name: table}
            : null;
        },
        async getAllAsync(sql: string) {
          const base = state.files.get(name);
          if (!base) throw new Error('no such table');
          const held = state.gates.get(base);
          if (held) await held;
          const turns = state.delay ? state.delay() : 0;
          for (let i = 0; i < turns; i++) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          if (state.broken.has(base)) {
            throw new Error('database disk image is malformed');
          }
          if (sql.includes('FROM pages')) {
            return [
              {
                page_number: 1,
                line_number: 1,
                line_type: 'ayah',
                is_centered: 0,
                first_word_id: 1,
                last_word_id: 4,
                surah_number: 1,
              },
              {
                page_number: 2,
                line_number: 1,
                line_type: 'ayah',
                is_centered: 0,
                first_word_id: 5,
                last_word_id: 6,
                surah_number: 2,
              },
            ];
          }
          return LOCATIONS.map((location, i) => ({
            id: i + 1,
            text: `${TAG[base]}${i + 1}`,
            location,
          }));
        },
        async closeAsync() {
          if (closed) throw new Error('already closed');
          closed = true;
          state.open.set(name, openCount(name) - 1);
          if (openCount(name) <= 0) state.open.delete(name);
        },
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      if (state.files.has(name)) return;
      state.files.set(name, baseOf(name));
    },
    async deleteDatabaseAsync(name: string) {
      if (openCount(name) > 0) throw new Error(`${name} is open`);
      if (!state.files.has(name)) throw new Error(`${name} not found`);
      state.files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async () => {
    const sqlite = jest.requireMock('expo-sqlite') as {__fake: FakeSqlite};
    return [...sqlite.__fake.files.keys()];
  }),
}));

type ServiceModule = typeof import('../DigitalKhattDataService');
type StoreModule = typeof import('@/store/mushafSettingsStore');
type SelectionModule = typeof import('@/components/sheets/rewayahSelection');

interface App {
  fake: FakeSqlite;
  service: ServiceModule['digitalKhattDataService'];
  serviceModule: ServiceModule;
  store: StoreModule['useMushafSettingsStore'];
  selection: SelectionModule;
  showToast: jest.Mock;
}

const TAGS: Record<string, string> = {
  hafs: 'H',
  warsh: 'W',
  qalun: 'Q',
  shubah: 'S',
  'al-bazzi': 'B',
  qunbul: 'K',
  'al-duri-abi-amr': 'D',
  'al-susi': 'O',
};
const IDS = Object.keys(TAGS) as RewayahId[];
const VERSE_IDS: Record<string, number[]> = {
  '1:1': [1, 2],
  '1:2': [3, 4],
  '2:1': [5, 6],
};

/** The text a verse has in `rewayah`'s words DB. */
function expected(rewayah: string, verseKey: string): string {
  return VERSE_IDS[verseKey].map(id => `${TAGS[rewayah]}${id}`).join(' ');
}

/** A fresh app: new module registry, real store, real service singleton. */
function launch(
  settings: {rewayah?: RewayahId; mushafRenderer?: MushafRenderer} = {},
): App {
  jest.resetModules();
  const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqlite}).__fake;
  const storeModule = require('@/store/mushafSettingsStore') as StoreModule;
  const renderer = settings.mushafRenderer ?? 'dk_v2';
  storeModule.useMushafSettingsStore.setState({
    rewayah: settings.rewayah ?? 'hafs',
    mushafRenderer: renderer,
    uthmaniFont: renderer === 'dk_v1' ? 'v1' : 'v2',
    rewayahFallbackFrom: null,
    showRewayahDiffs: true,
  });
  const serviceModule = require('../DigitalKhattDataService') as ServiceModule;
  return {
    fake,
    service: serviceModule.digitalKhattDataService,
    serviceModule,
    store: storeModule.useMushafSettingsStore,
    selection: require('@/components/sheets/rewayahSelection'),
    showToast: (
      jest.requireMock('@/utils/toastUtils') as {showToast: jest.Mock}
    ).showToast,
  };
}

// Holds every read of `base` until the returned function is called.
function gate(fake: FakeSqlite, base: string): () => void {
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = () => {
      fake.gates.delete(base);
      resolve();
    };
  });
  fake.gates.set(base, held);
  return release;
}

async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

function nowReadingToasts(app: App): unknown[][] {
  return app.showToast.mock.calls.filter(call => call[0] === 'Now reading');
}

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
});

afterEach(async () => {
  await flush();
  for (const spy of consoleSpies) spy.mockRestore();
});

describe('a rewayah switch still loading when Mushaf 1440 is chosen', () => {
  it('never lands under the Hafs label, even when the store is pinned directly', async () => {
    const app = launch();
    await app.service.initialize();
    const release = gate(app.fake, 'dk_words_warsh');

    // The reader taps Warsh; its words are still loading...
    const pick = app.selection.chooseMushafRewayah('warsh');
    await flush();
    expect(app.service.pendingRewayah).toBe('warsh');
    expect(app.store.getState().rewayah).toBe('hafs');

    // ...when Mushaf 1440 pins the store to Hafs (what the font row did
    // before: the store still named Hafs, so it only set the renderer).
    app.store.getState().setMushafRenderer('qcf_v2');
    release();
    const outcome = await pick;
    await flush();

    expect(outcome).toEqual({kind: 'superseded'});
    expect(nowReadingToasts(app)).toEqual([]);
    expect(app.service.rewayah).toBe('hafs');
    expect(app.service.isSwitching).toBe(false);
    expect(app.store.getState()).toMatchObject({
      rewayah: 'hafs',
      mushafRenderer: 'qcf_v2',
    });

    // Back to a DigitalKhatt font: Hafs text under the Hafs label.
    app.store.getState().setMushafRenderer('dk_v2');
    expect(app.store.getState().rewayah).toBe('hafs');
    expect(app.service.rewayah).toBe('hafs');
    expect(app.service.getVerseText('1:2')).toBe(expected('hafs', '1:2'));
    expect(app.service.getLineText(app.service.getPageLines(1)[0])).toBe(
      'H1 H2 H3 H4',
    );
    expect(app.service.getLayoutIdentityKey()).toMatch(/^hafs@/);
  });

  it('is superseded at once when Mushaf 1440 is chosen from the font list', async () => {
    const app = launch();
    await app.service.initialize();
    const release = gate(app.fake, 'dk_words_warsh');
    const pick = app.selection.chooseMushafRewayah('warsh');
    await flush();

    const font = await app.selection.selectMushafRenderer('qcf_v2');
    expect(font).toEqual({kind: 'switched', renderer: 'qcf_v2'});
    // The Warsh tap is overtaken before its load even finishes.
    expect(await pick).toEqual({kind: 'superseded'});
    expect(app.service.pendingRewayah).toBeNull();

    release();
    await flush();
    expect(nowReadingToasts(app)).toEqual([]);
    expect(app.service.rewayah).toBe('hafs');
    expect(app.store.getState()).toMatchObject({
      rewayah: 'hafs',
      mushafRenderer: 'qcf_v2',
    });
  });
});

describe('while Mushaf 1440 pins Hafs', () => {
  it('refuses a switch to another rewayah instead of committing it', async () => {
    const app = launch({mushafRenderer: 'qcf_v2'});
    await app.service.initialize();
    const listener = jest.fn();
    app.service.onRewayahChange(listener);

    const outcome = await app.service
      .switchRewayah('warsh')
      .then(() => 'committed')
      .catch((error: unknown) => error);
    await flush();

    expect(app.serviceModule.isRewayahSwitchSuperseded(outcome)).toBe(true);
    expect(app.service.rewayah).toBe('hafs');
    expect(app.service.getVerseText('1:1')).toBe(expected('hafs', '1:1'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('is never pinned from the store while another rewayah is shown', async () => {
    const app = launch({rewayah: 'warsh'});
    await app.service.initialize();

    app.store.getState().setMushafRenderer('qcf_v2');
    await flush();

    expect(app.store.getState()).toMatchObject({
      rewayah: 'warsh',
      mushafRenderer: 'dk_v2',
    });
    expect(app.service.rewayah).toBe('warsh');
  });

  it('brings the data service back to Hafs whichever path pinned the store', async () => {
    const app = launch({rewayah: 'warsh'});
    await app.service.initialize();
    expect(app.service.rewayah).toBe('warsh');

    // e.g. settings written as a whole (rehydrated) rather than by a tap.
    app.store.setState({mushafRenderer: 'qcf_v2', rewayah: 'hafs'});
    await flush();

    expect(app.service.rewayah).toBe('hafs');
    expect(app.service.getVerseText('1:1')).toBe(expected('hafs', '1:1'));
    expect(app.store.getState().rewayah).toBe('hafs');
  });
});

describe('choosing a font (selectMushafRenderer)', () => {
  it('moves a non-Hafs reader to Hafs before Mushaf 1440 is shown', async () => {
    const app = launch({rewayah: 'warsh'});
    await app.service.initialize();

    await expect(app.selection.selectMushafRenderer('qcf_v2')).resolves.toEqual(
      {kind: 'switched', renderer: 'qcf_v2'},
    );
    expect(app.service.rewayah).toBe('hafs');
    expect(app.store.getState()).toMatchObject({
      rewayah: 'hafs',
      mushafRenderer: 'qcf_v2',
    });
  });

  it('keeps the font and the rewayah when Hafs cannot be loaded for Mushaf 1440', async () => {
    const app = launch({rewayah: 'warsh'});
    await app.service.initialize();
    app.fake.broken.add('dk_words');

    const outcome = await app.selection.chooseMushafRenderer('qcf_v2');

    expect(outcome).toEqual({kind: 'failed'});
    expect(app.showToast).toHaveBeenCalledWith(
      "Couldn't switch to Mushaf 1440",
      'Please try again.',
      'error',
    );
    expect(app.service.rewayah).toBe('warsh');
    expect(app.store.getState()).toMatchObject({
      rewayah: 'warsh',
      mushafRenderer: 'dk_v2',
    });
  });

  it('lets the latest font tap win over a Mushaf 1440 tap still loading Hafs', async () => {
    const app = launch({rewayah: 'warsh'});
    await app.service.initialize();
    const release = gate(app.fake, 'dk_words');

    const toQcf = app.selection.selectMushafRenderer('qcf_v2');
    await flush();
    await expect(app.selection.selectMushafRenderer('dk_v1')).resolves.toEqual({
      kind: 'switched',
      renderer: 'dk_v1',
    });
    release();

    await expect(toQcf).resolves.toEqual({kind: 'superseded'});
    await flush();
    expect(app.store.getState().mushafRenderer).toBe('dk_v1');
    expect(app.store.getState().rewayah).toBe(app.service.rewayah);
  });

  it('leaves a Hafs reader exactly as before (no data-service switch)', async () => {
    const app = launch();
    await app.service.initialize();
    const switchSpy = jest.spyOn(app.service, 'switchRewayah');

    await app.selection.selectMushafRenderer('qcf_v2');
    await app.selection.selectMushafRenderer('dk_indopak');

    expect(switchSpy).not.toHaveBeenCalled();
    expect(app.store.getState()).toMatchObject({
      rewayah: 'hafs',
      mushafRenderer: 'dk_indopak',
    });
  });
});

// Port of the verifiers' switch stress: random rapid rewayah taps, font
// taps (the real font-row flow) and side loads, with random read latency.
// Invariants, checked at every cache notification, store change and step:
//  I1 initialized and not under Mushaf 1440: the store names the rewayah the
//     main cache serves;
//  I2 every main-cache read is the served rewayah's own text;
//  I3 tryGetVerseText(vk, r) is null or r's own text, never another's;
//  I4 once everything settles, store and service agree and nothing loads;
//  I5 the layout identity names the served rewayah.
describe.each([
  ['with Mushaf 1440', ['dk_v1', 'dk_v2', 'qcf_v2']],
  ['with IndoPak', ['dk_v1', 'dk_v2', 'dk_indopak']],
] as const)('switch stress %s', (_label, renderers) => {
  // Seeded linear congruential generator (exact in doubles: < 2^53).
  function rng(seed: number): () => number {
    let s = seed % 4294967296;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('seed %i', async seed => {
    const rand = rng(seed);
    const pick = <T>(list: readonly T[]): T =>
      list[Math.floor(rand() * list.length)];
    const app = launch({rewayah: pick(IDS)});
    app.fake.delay = () => Math.floor(rand() * 8);
    const {service, store} = app;

    const violations = new Set<string>();
    const check = (where: string) => {
      if (!service.initialized) return;
      const served = service.rewayah;
      const settings = store.getState();
      if (settings.mushafRenderer !== 'qcf_v2' && settings.rewayah !== served) {
        violations.add(
          `I1 ${where}: store=${settings.rewayah} served=${served}`,
        );
      }
      for (const verseKey of Object.keys(VERSE_IDS)) {
        if (service.getVerseText(verseKey) !== expected(served, verseKey)) {
          violations.add(`I2 ${where}: ${verseKey} is not ${served}'s text`);
        }
      }
      for (const id of IDS) {
        const text = service.tryGetVerseText('1:2', id);
        if (text !== null && text !== expected(id, '1:2')) {
          violations.add(`I3 ${where}: ${id} read another rewayah's text`);
        }
      }
      const key = service.getLayoutIdentityKey();
      if (key && !key.startsWith(`${served}@`)) {
        violations.add(`I5 ${where}: ${key} while serving ${served}`);
      }
    };
    service.subscribeCacheChanges(() => check('cache change'));
    store.subscribe(() => check('store change'));

    const ops: Promise<unknown>[] = [
      service.initialize().catch(() => undefined),
    ];
    for (let i = 0; i < 40; i++) {
      const r = rand();
      if (r < 0.5) {
        // Biased to Hafs: the race needs the store on Hafs while another
        // rewayah is still loading.
        const id = rand() < 0.4 ? 'hafs' : pick(IDS);
        ops.push(app.selection.selectMushafRewayah(id));
      } else if (r < 0.65) {
        ops.push(service.ensureRewayahLoaded(pick(IDS)).catch(() => null));
      } else {
        ops.push(app.selection.selectMushafRenderer(pick(renderers)));
      }
      const turns = Math.floor(rand() * 3);
      for (let t = 0; t < turns; t++) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      check(`step ${i}`);
    }
    await Promise.all(ops);
    await flush(20);
    check('settled');
    if (store.getState().rewayah !== service.rewayah) {
      violations.add(
        `I4 store=${store.getState().rewayah} served=${service.rewayah}`,
      );
    }
    if (service.isSwitching) violations.add('I4 still switching');
    expect([...violations]).toEqual([]);
  });
});
