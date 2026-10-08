// @ai-generated
/**
 * Delivery of the bundled Digital Khatt DBs when the device copy cannot be
 * made or read as is:
 * - low storage: an upgrade from a release that used unversioned copies
 *   (dk_words.db, dk_words_<id>.db) must still import the current
 *   content-addressed copies, by deleting the copies this build never opens
 *   first; a failed copy never stays on disk, and when nothing can be loaded
 *   the error is explicit;
 * - damaged copies: a copy that still opens but returns rows with NULL
 *   fields (what real SQLite returns for a copy cut short inside its last
 *   page) is deleted and re-imported on the main path, as on the side path.
 *
 * expo-sqlite is a fake with expo-sqlite 56's native rules (import is a
 * no-op when the file exists and leaves a partial file when the copy runs out
 * of space, opening a missing file creates an empty one, delete refuses open
 * or missing files) over a disk of file sizes with an optional quota.
 */
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  DigitalKhattDataService,
  getCurrentDbNamesByBase,
} from '../DigitalKhattDataService';

type FileState = 'ok' | 'empty' | 'partial' | 'damaged';

interface FakeFile {
  base: string;
  bytes: number;
  state: FileState;
  old: boolean; // content an older release imported
}

interface FakeDisk {
  files: Map<string, FakeFile>;
  open: Map<string, number>;
  log: string[];
  violations: string[];
  quota: number | null; // bytes the SQLite directory may use
  importErrors: Map<string, number>; // base -> imports that fail (no space used)
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));

jest.mock('expo-sqlite', () => {
  const disk: FakeDisk = {
    files: new Map(),
    open: new Map(),
    log: [],
    violations: [],
    quota: null,
    importErrors: new Map(),
  };
  const SIZE: Record<string, number> = {
    dk_words: 3518464,
    dk_layout: 241664,
    dk_words_shouba: 3547136,
    dk_words_bazzi: 4063232,
    dk_words_qumbul: 4059136,
    dk_words_warsh: 4145152,
    dk_words_qaloon: 3977216,
    dk_words_doori: 3964928,
    dk_words_soosi: 4042752,
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
  const used = () =>
    [...disk.files.values()].reduce((sum, file) => sum + file.bytes, 0);
  const openCount = (name: string) => disk.open.get(name) ?? 0;
  const malformed = () => new Error('database disk image is malformed');

  function wordRows(file: FakeFile) {
    const tag = `${file.old ? 'old-' : ''}${TAG[file.base] ?? '?'}`;
    const rows: {id: unknown; text: unknown; location: unknown}[] =
      LOCATIONS.map((location, i) => ({
        id: i + 1,
        text: `${tag}${i + 1}`,
        location,
      }));
    if (file.state === 'damaged') {
      // A copy cut short inside its last page: every row comes back, the
      // last ones with NULL fields.
      rows[rows.length - 1] = {id: null, text: null, location: null};
      rows[rows.length - 2] = {id: 5, text: null, location: null};
    }
    return rows;
  }

  function pageRows(file: FakeFile) {
    const rows: Record<string, unknown>[] = [
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
    if (file.state === 'damaged') {
      rows[1] = {
        page_number: null,
        line_number: null,
        line_type: null,
        is_centered: null,
        first_word_id: null,
        last_word_id: null,
        surah_number: null,
      };
    }
    return rows;
  }

  return {
    __disk: disk,
    __size: SIZE,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      disk.log.push(`open:${name}`);
      if (!disk.files.has(name)) {
        disk.files.set(name, {
          base: baseOf(name),
          bytes: 0,
          state: 'empty',
          old: false,
        });
      }
      disk.open.set(name, openCount(name) + 1);
      let closed = false;
      return {
        async getFirstAsync(sql: string) {
          const file = disk.files.get(name);
          if (!file || file.state === 'empty') return null;
          if (file.state === 'partial') throw malformed();
          const table = /name='(\w+)'/.exec(sql)?.[1];
          return table === (file.base === 'dk_layout' ? 'pages' : 'words')
            ? {name: table}
            : null;
        },
        async getAllAsync(sql: string) {
          const file = disk.files.get(name);
          if (!file || file.state === 'empty') {
            throw new Error('no such table');
          }
          if (file.state === 'partial') throw malformed();
          disk.log.push(`read:${name}`);
          return sql.includes('FROM pages') ? pageRows(file) : wordRows(file);
        },
        async closeAsync() {
          if (closed) throw new Error('already closed');
          closed = true;
          disk.open.set(name, openCount(name) - 1);
          if (openCount(name) <= 0) disk.open.delete(name);
        },
      };
    },
    async importDatabaseFromAssetAsync(
      name: string,
      source: {assetId: unknown},
    ) {
      disk.log.push(`import:${name}`);
      if (disk.files.has(name)) return; // native: no-op when the file exists
      if (source?.assetId === undefined) throw new Error('missing assetId');
      const base = baseOf(name);
      const failures = disk.importErrors.get(base) ?? 0;
      if (failures > 0) {
        disk.importErrors.set(base, failures - 1);
        throw new Error('simulated I/O error');
      }
      const size = SIZE[base];
      if (disk.quota !== null && used() + size > disk.quota) {
        // The native copy stops when the disk is full and leaves what it
        // wrote (whole blocks) behind.
        const room = Math.max(0, disk.quota - used());
        const partial = room - (room % 4096);
        disk.files.set(name, {
          base,
          bytes: partial,
          state: partial > 0 ? 'partial' : 'empty',
          old: false,
        });
        throw new Error('ENOSPC: No space left on device');
      }
      disk.files.set(name, {base, bytes: size, state: 'ok', old: false});
    },
    async deleteDatabaseAsync(name: string) {
      disk.log.push(`delete:${name}`);
      if (openCount(name) > 0) {
        disk.violations.push(name);
        throw new Error(`DeleteDatabaseException: ${name} is open`);
      }
      if (!disk.files.has(name)) {
        throw new Error(`DatabaseNotFoundException: ${name}`);
      }
      disk.files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async (uri: string) => {
    if (uri !== 'file:///data/user/0/app.test/files/SQLite/') {
      throw new Error(`unexpected directory ${uri}`);
    }
    const sqlite = jest.requireMock('expo-sqlite') as {__disk: FakeDisk};
    return [...sqlite.__disk.files.keys()];
  }),
}));

interface Launch {
  service: DigitalKhattDataService;
  initResult: string;
}

const {__disk: disk, __size: SIZE} = jest.requireMock('expo-sqlite') as {
  __disk: FakeDisk;
  __size: Record<string, number>;
};

async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/** A new app process: a new data service, settings as saved, initialize(). */
async function launchApp(saved: RewayahId = 'hafs'): Promise<Launch> {
  useMushafSettingsStore.setState({
    rewayah: saved,
    mushafRenderer: 'dk_v2',
    uthmaniFont: 'v2',
    rewayahFallbackFrom: null,
  });
  const service = new DigitalKhattDataService();
  const initResult = await service.initialize().then(
    () => 'ok',
    (error: Error) => error.message,
  );
  await flush();
  return {service, initResult};
}

/** The current content-addressed on-device name of `base`. */
function current(base: string): string {
  const name = getCurrentDbNamesByBase().get(base);
  if (!name) throw new Error(`no current name for ${base}`);
  return name;
}

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  disk.files.clear();
  disk.open.clear();
  disk.log.length = 0;
  disk.violations.length = 0;
  disk.quota = null;
  disk.importErrors.clear();
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
});

afterEach(async () => {
  await flush();
  for (const spy of consoleSpies) spy.mockRestore();
  // The service never tries to delete a DB that is open.
  expect(disk.violations).toEqual([]);
});

describe('damaged copies', () => {
  function plantDamaged(base: string): string {
    const name = current(base);
    disk.files.set(name, {
      base,
      bytes: SIZE[base],
      state: 'damaged',
      old: false,
    });
    return name;
  }

  it('repairs a damaged Hafs copy at startup instead of failing on every launch', async () => {
    const name = plantDamaged('dk_words');

    const app = await launchApp('hafs');

    expect(app.initResult).toBe('ok');
    expect(app.service.getVerseText('2:1')).toBe('H5 H6');
    expect(disk.log).toContain(`delete:${name}`);
    expect(disk.log.filter(e => e === `import:${name}`).length).toBeGreaterThan(
      0,
    );
    expect(disk.files.get(name)?.state).toBe('ok');
  });

  it('repairs a damaged copy of the saved rewayah instead of falling back to Hafs', async () => {
    plantDamaged('dk_words_warsh');

    const app = await launchApp('warsh');

    expect(app.initResult).toBe('ok');
    expect(app.service.rewayah).toBe('warsh');
    expect(app.service.getVerseText('2:1')).toBe('W5 W6');
    expect(useMushafSettingsStore.getState().rewayahFallbackFrom).toBeNull();
  });

  it('repairs a damaged copy on a switch, as the side load does', async () => {
    const app = await launchApp('hafs');
    const warsh = plantDamaged('dk_words_warsh');

    await app.service.switchRewayah('warsh');
    expect(app.service.rewayah).toBe('warsh');
    expect(app.service.getVerseText('2:1')).toBe('W5 W6');
    expect(disk.files.get(warsh)?.state).toBe('ok');

    const qalun = plantDamaged('dk_words_qaloon');
    await app.service.ensureRewayahLoaded('qalun');
    expect(app.service.tryGetVerseText('2:1', 'qalun')).toBe('Q5 Q6');
    expect(disk.files.get(qalun)?.state).toBe('ok');
  });

  it('repairs a damaged layout copy', async () => {
    const name = plantDamaged('dk_layout');

    const app = await launchApp('hafs');

    expect(app.initResult).toBe('ok');
    expect(app.service.getPageLines(2)).toHaveLength(1);
    expect(disk.files.get(name)?.state).toBe('ok');
  });
});
