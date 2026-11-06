# Adhkar Content Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the adhkar content correct and make the fix reach existing installs. The work covers five things:
- separate Morning and Evening lists, with real evening rows;
- the corrected Quranic audio mapping;
- the repeat-count, translation and text fixes from the 2026-10-12 audit;
- a Play All that never freezes;
- widgets that use the per-period lists.

**Architecture:**
- **Data.** `data/adhkar.json` stays the single content source. An idempotent script (`scripts/adhkar-content/apply-content-fixes.ts`) applies every fix and is checked by jest. It reads the six evening texts from the reviewed spec document.
- **Lists.** A new top-level `super_category_dhikr_ids` key holds the ordered Morning and Evening lists. It is seeded into a new `super_categories.dhikr_ids` column; existing installs get the column through an `ALTER TABLE` migration. `AdhkarService.getAdhkarForSuperCategory` follows the list when one is present.
- **Upgrade.** `ADHKAR_DATA_VERSION` goes from 5 to 6, which reseeds the content tables on existing installs. User tables (`dhikr_favorites`, `dhikr_counts`) are untouched, and every existing dhikr id stays stable.
- **Version guard.** A per-version SHA-256 fixture fails jest whenever `data/adhkar.json` changes without a recorded fingerprint.
- **Widgets.** The widget generator builds the period counts from the same lists, and the featured adhkar are validated against them.

**Tech Stack:**
- Expo SDK 57 / React Native, TypeScript strict
- expo-sqlite (better-sqlite3 adapter in jest), zustand, expo-audio
- jest (jest-expo preset), tsx scripts, ffmpeg (one-off audio merge)
- Swift script checks, Kotlin unit tests (widgets)

**Spec:** the inputs below are the spec. There is no separate design doc; the user approved the scope in conversation on 2026-10-12.
- `docs/superpowers/specs/2026-10-12-evening-adhkar-texts.md`: the six evening texts, approved by Osman on 2026-10-12. It is the machine-read single source for those rows.
- The audit reports (read-only, outside the repo): `/private/tmp/claude-501/-Users-osmansaeday-orca-workspaces-Bayaan-widgets/c0503663-a396-4272-91ae-d9723ef577f3/scratchpad/adhkar-audit/`, files `00-summary.md`, `01-morning-evening.md`, `02-text-integrity.md` (+ `text/issues.csv`), `03-audio-files.md`, `04-audio-content.md` and `05-data-flow.md`. The audit ran on the `widgets` worktree; every path and line in this plan was re-checked against `origin/develop` at `cf27ed02`.

## Global Constraints

- **Branch:** `fix/adhkar-content` in worktree `/Users/osmansaeday/orca/workspaces/Bayaan/adhkar-content`, based on `origin/develop`. The PR targets `develop`.
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`). Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1
  ```
- **No em dashes.** Never use an em dash (U+2014) anywhere: code, comments, JSON, docs or commit messages. Use a period, comma, colon, semicolon, parentheses or a spaced hyphen. Before each commit, run `git diff --cached | grep -n $'\xe2\x80\x94'`; it must print nothing.
- **TypeScript:** strict mode.
  - No `any`, no `as` casts, no `as const`.
  - Explicit parameter and return types on exported functions.
  - Use the `function` keyword for pure functions.
  - Use type guards for JSON input (`unknown` first).
  - Early returns.
- **Must pass clean before a task is done:**
  - `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit`
  - `npx prettier --write <changed .ts/.tsx files>`. Prettier ignores `*.json` and `*.md` (see `.prettierignore`), so never run it on those.
  - The jest suites for the touched areas.
- **Stable ids.** Never rename, renumber, reuse or delete an existing dhikr id: `dhikr_favorites` and `dhikr_counts` reference them. The new ids are exactly `evening-77`, `evening-78`, `evening-80`, `evening-81`, `evening-89` and `evening-90`.
- **The reseed must preserve user tables.** `dhikr_favorites` and `dhikr_counts` must come through a version 5 to 6 upgrade byte-equal. This is proven by `services/database/__tests__/upgrade.golden.test.ts` against all four golden fixtures.
- **Do not touch unrelated code:** no drive-by refactors, docstrings or formatting changes in files you only read.
- **Native builds:** none are needed. The only native step is the Android widget unit tests (Task 4): `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest`.
- **Digital Khatt.** Quran text in the UI must use Digital Khatt (project rule), but changing adhkar rendering is out of scope here. Do not touch the reader's fonts.
- **Text sources.** The six evening texts come only from the spec document's `json evening-row` blocks. Do not edit their Arabic or English anywhere else. Other text fixes use the exact strings given in this plan, each with its published source.
- **Run commands from the worktree root.** Jest is `npx jest <paths>`; never `npm test`, which runs in watch mode.

## Review Focus

1. **Manual swipe in Play All.** The user swipes onto a row that has no audio while Play All is running (for example `evening-80` in the Evening list). Play All should pause on that row, not freeze with the play state stuck on and not jump past the row. Pinned by the `goToIndex` test in Task 7.
2. **Play All from a row without audio.** Play All starts on a list whose first row has no audio. Playback should start at the first row that has audio, and the reader should open on that row, not on row 0. Pinned by the `startPlayAll` test in Task 7 and the navigation change in the two list screens.
3. **Short clip at the end of the queue.** A clip shorter than 2 s is the last item in a Play All queue (for example the 99 Names list). Play All should stop cleanly instead of hanging. Pinned by the `isTrackFinished` tests in Task 8.
4. **Saved items across the upgrade.** An existing install has bookmarks or tasbeeh counts on rows whose text or count this PR changes (83, 77, 255). After the upgrade, Saved still lists them, with the new text, and the counts are unchanged. Pinned by the golden reseed test in Task 3 and the existing favorites and counts test.
5. **Tasbeeh widget picker.** The picker gains rows because counts are fixed (83, 106, 119 and 148 join). It must not offer a non-dhikr instruction (114, "spit on your left"), must show clean text for 119, and must keep the ids users may already have configured (69 and 72). Pinned by the `TASBEEH_ADHKAR` list test in Task 5.

---

## File Structure

New files:

| Path | Responsibility |
|---|---|
| `services/database/adhkarDataVersion.ts` | `ADHKAR_DATA_VERSION` constant plus the version log. Pure, so node scripts can import it without expo-sqlite. |
| `services/database/__tests__/fixtures/adhkar-data-fingerprints.json` | SHA-256 of `data/adhkar.json` per data version. |
| `services/database/__tests__/adhkarDataVersion.test.ts` | Fails when the data changes without a recorded fingerprint. |
| `services/database/__tests__/adhkarSuperLists.test.ts` | DB layer: `dhikr_ids` column, migration, ordered fetch. |
| `scripts/adhkar-content/dataFingerprint.ts` | Hash helpers shared by the test and the writer script. |
| `scripts/adhkar-content/write-data-fingerprint.ts` | CLI: records the fingerprint for the current version. |
| `scripts/adhkar-content/eveningRows.ts` | Parses the `json evening-row` blocks from the spec document. |
| `scripts/adhkar-content/adhkarFixes.ts` | Pure, idempotent content fixes on a typed copy of `data/adhkar.json`. |
| `scripts/adhkar-content/apply-content-fixes.ts` | CLI: applies all fixes and writes `data/adhkar.json`. |
| `scripts/__tests__/adhkarFixes.test.ts` | Round-trip, idempotence (data and spec in sync) and parser tests. |
| `services/adhkar/__tests__/adhkarSeed.test.ts` | Data-level assertions on the committed `data/adhkar.json`. |
| `services/adhkar/__tests__/AdhkarService.lists.test.ts` | Service grouping with a mocked DB (list order, fallback). |
| `services/adhkar/__tests__/AdhkarService.periods.test.ts` | Fresh-install integration test over the real JSON. |
| `services/adhkar/__tests__/adhkarAudioAssets.test.ts` | Every audio file referenced, every reference bundled. |
| `store/__tests__/adhkarPlayAllStore.test.ts` | Play All skipping rows without audio. |
| `utils/adhkarTrackEnd.ts` | Pure end-of-track rule. |
| `utils/__tests__/adhkarTrackEnd.test.ts` | Tests for the rule. |
| `assets/audio/adhkar/adhkar_quranic_16.mp3` | quranic-16 audio, made by merging the two half clips. |

Modified files:

| Path | Change |
|---|---|
| `services/database/AdhkarDatabaseService.ts` | Imports the version; `dhikr_ids` column plus migration; seeds the lists; `getAdhkarByIds`; `dhikrIds` in the super category mappers. |
| `services/adhkar/AdhkarService.ts` | Passes the lists to the seed; list-ordered `getAdhkarForSuperCategory`. |
| `types/adhkar.ts` | `SuperCategory.dhikrIds`; `AdhkarSeedData.super_category_dhikr_ids`. |
| `data/adhkar.json` | Written by the fix script only. Never hand-edit it. |
| `services/database/__tests__/upgrade.golden.test.ts` | Reseeded-table exemption plus a reseed assertion test. |
| `services/widgets/buildCatalog.ts` | Excludes the instruction-only row 114 from the tasbeeh catalog. |
| `services/widgets/__tests__/buildCatalog.test.ts` | New tasbeeh list. |
| `utils/adhkarAudio.ts` | Removes the 6 unreferenced files; adds the merged clip. |
| `assets/audio/adhkar/` | Deletes `adhkar_72.mp3`, `adhkar_149.mp3`, `adhkar_282.mp3`, `adhkar_283.mp3`, `adhkar_296.mp3` and `adhkar_304.mp3`. |
| `store/adhkarPlayAllStore.ts` | Skips rows without audio; `startPlayAll` returns the index it started at. |
| `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` | Navigates to the index Play All actually started at. |
| `app/(tabs)/(a.home)/adhkar/saved/index.tsx` | Same. |
| `components/adhkar/AdhkarAudioControls.tsx` | No-audio layout when the file is not bundled (not only when it is null). |
| `components/adhkar/AdhkarAudioProvider.tsx` | End detection through `isTrackFinished`. |
| `services/widgets/widgetStaticData.ts` | Periods built from the lists; `parseAdhkarSeedLists`. |
| `scripts/generate-widget-data.ts` | Passes the lists. |
| `data/widgets/adhkar-periods.json` | Drops `categoryId`; drops 94 from the evening featured list. |
| `targets/widgets/adhkar-periods.json` | Regenerated. |
| `modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json` | Regenerated. |
| `services/widgets/__tests__/contentStaticData.test.ts` | Updated for the new signature and counts. |
| `scripts/check-widget-content.sh` | Counts 23 and 21; 94 not in the evening featured list. |
| `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt` | Same assertions as the Swift check. |

---

### Task 1: Data version guard

**Files:**
- Create: `services/database/adhkarDataVersion.ts`
- Create: `scripts/adhkar-content/dataFingerprint.ts`
- Create: `scripts/adhkar-content/write-data-fingerprint.ts`
- Create: `services/database/__tests__/fixtures/adhkar-data-fingerprints.json`
- Create: `services/database/__tests__/adhkarDataVersion.test.ts`
- Modify: `services/database/AdhkarDatabaseService.ts:1-11` (import) and `:75-81` (version block)

**Interfaces:**
- Produces:
  - `ADHKAR_DATA_VERSION: number` (from `services/database/adhkarDataVersion.ts`)
  - `sha256(content: string): string`
  - `readFingerprints(root: string): Record<string, string>`
  - `adhkarDataFingerprint(root: string): string`
  - `FINGERPRINTS_PATH: string`
  - CLI `npx tsx scripts/adhkar-content/write-data-fingerprint.ts`
  - Later tasks run the CLI after every `data/adhkar.json` change.

- [ ] **Step 1: Write the failing test**

Create `services/database/__tests__/adhkarDataVersion.test.ts`:

```ts
// services/database/__tests__/adhkarDataVersion.test.ts
// data/adhkar.json reaches existing installs only through a reseed, and the
// reseed runs only when ADHKAR_DATA_VERSION goes up. This test fails when the
// file changes without a fingerprint recorded for the current version.
import path from 'path';
import {ADHKAR_DATA_VERSION} from '../adhkarDataVersion';
import {
  adhkarDataFingerprint,
  readFingerprints,
} from '@/scripts/adhkar-content/dataFingerprint';

const root = path.resolve(__dirname, '../../..');

describe('adhkar data version', () => {
  const fingerprints = readFingerprints(root);

  it('records the current version as the latest one', () => {
    const versions = Object.keys(fingerprints).map(Number);
    expect(Math.max(...versions)).toBe(ADHKAR_DATA_VERSION);
  });

  it('matches data/adhkar.json (after a data change: bump ADHKAR_DATA_VERSION once per release, then run npx tsx scripts/adhkar-content/write-data-fingerprint.ts)', () => {
    expect(adhkarDataFingerprint(root)).toBe(
      fingerprints[String(ADHKAR_DATA_VERSION)],
    );
  });

  it('gives every version different content', () => {
    const hashes = Object.values(fingerprints);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest services/database/__tests__/adhkarDataVersion.test.ts`
Expected: FAIL, "Cannot find module '../adhkarDataVersion'".

- [ ] **Step 3: Create the version module**

Create `services/database/adhkarDataVersion.ts`:

```ts
// services/database/adhkarDataVersion.ts
// Data version: increment when data/adhkar.json or the super category seed
// changes, to trigger a re-seed on existing installs. Kept free of imports so
// node scripts (scripts/adhkar-content) can read it.
// Version 1: Initial adhkar data (267 items)
// Version 2: Added Quranic Duas (40 items, total 307)
// Version 3: Fixed audio file naming (dua_X.mp3 -> adhkar_X.mp3)
// Version 4: Added 99 Names of Allah (99 items, total 406)
// Version 5: Balanced "Other" section bento grid (left=14, right=14)
export const ADHKAR_DATA_VERSION = 5;
```

In `services/database/AdhkarDatabaseService.ts`, add this import after the `import type {...} from '../../types/adhkar';` block (line 11):

```ts
import {ADHKAR_DATA_VERSION} from './adhkarDataVersion';
```

Then replace lines 75-81 (the comment block and `const DATA_VERSION = 5;`) with:

```ts
// History and bump rules: services/database/adhkarDataVersion.ts
const DATA_VERSION = ADHKAR_DATA_VERSION;
```

- [ ] **Step 4: Create the fingerprint helpers and the writer**

Create `scripts/adhkar-content/dataFingerprint.ts`:

```ts
// scripts/adhkar-content/dataFingerprint.ts
// SHA-256 of data/adhkar.json, recorded per ADHKAR_DATA_VERSION in
// services/database/__tests__/fixtures/adhkar-data-fingerprints.json.
// No '@/' imports: tsx scripts import this file.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ADHKAR_DATA_PATH = 'data/adhkar.json';
export const FINGERPRINTS_PATH =
  'services/database/__tests__/fixtures/adhkar-data-fingerprints.json';

export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function readFingerprints(root: string): Record<string, string> {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(path.join(root, FINGERPRINTS_PATH), 'utf8'),
  );
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${FINGERPRINTS_PATH} must be an object`);
  }
  const entries: [string, unknown][] = Object.entries(parsed);
  const out: Record<string, string> = {};
  for (const [version, hash] of entries) {
    if (typeof hash !== 'string') {
      throw new Error(`${FINGERPRINTS_PATH}: version ${version} is not a hash`);
    }
    out[version] = hash;
  }
  return out;
}

export function adhkarDataFingerprint(root: string): string {
  return sha256(fs.readFileSync(path.join(root, ADHKAR_DATA_PATH), 'utf8'));
}
```

Create `scripts/adhkar-content/write-data-fingerprint.ts`:

```ts
// scripts/adhkar-content/write-data-fingerprint.ts
// Records the SHA-256 of data/adhkar.json for the current ADHKAR_DATA_VERSION.
// Bump ADHKAR_DATA_VERSION once per release that changes the data, then run:
//   npx tsx scripts/adhkar-content/write-data-fingerprint.ts
import fs from 'fs';
import path from 'path';
import {ADHKAR_DATA_VERSION} from '../../services/database/adhkarDataVersion';
import {
  FINGERPRINTS_PATH,
  adhkarDataFingerprint,
  readFingerprints,
} from './dataFingerprint';

const root = path.resolve(__dirname, '../..');

function main(): void {
  const fingerprints = readFingerprints(root);
  const hash = adhkarDataFingerprint(root);
  const current = String(ADHKAR_DATA_VERSION);
  for (const [version, existing] of Object.entries(fingerprints)) {
    if (version !== current && existing === hash) {
      throw new Error(
        `data/adhkar.json is unchanged since version ${version}; do not bump without a data change`,
      );
    }
  }
  const next = {...fingerprints, [current]: hash};
  fs.writeFileSync(
    path.join(root, FINGERPRINTS_PATH),
    `${JSON.stringify(next, null, 2)}\n`,
  );
  console.log(`[adhkar] version ${current} fingerprint ${hash}`);
}

main();
```

Create `services/database/__tests__/fixtures/adhkar-data-fingerprints.json`. This is the hash of `data/adhkar.json` on `origin/develop` at `cf27ed02`; verify it with `shasum -a 256 data/adhkar.json`:

```json
{
  "5": "bc0598781799ad7d5a055e919990a0da828c8b8ebff8dbf4d3d4cd9b80405677"
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest services/database/__tests__/adhkarDataVersion.test.ts services/database/__tests__/upgrade.golden.test.ts`
Expected: PASS (3 tests in the new file, all golden tests green; nothing reseeds yet).

Run: `npx tsx scripts/adhkar-content/write-data-fingerprint.ts`
Expected: prints `[adhkar] version 5 fingerprint bc0598...` and leaves the fixture unchanged (check with `git diff --stat` on the fixture).

- [ ] **Step 6: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write services/database/adhkarDataVersion.ts services/database/AdhkarDatabaseService.ts scripts/adhkar-content/dataFingerprint.ts scripts/adhkar-content/write-data-fingerprint.ts services/database/__tests__/adhkarDataVersion.test.ts
git add services/database/adhkarDataVersion.ts services/database/AdhkarDatabaseService.ts scripts/adhkar-content services/database/__tests__/adhkarDataVersion.test.ts services/database/__tests__/fixtures/adhkar-data-fingerprints.json
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "test(adhkar): fail when adhkar data changes without a data version fingerprint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 2: Ordered dhikr list per super category (schema, seed, service)

**Files:**
- Modify: `types/adhkar.ts` (`SuperCategory`, `AdhkarSeedData`)
- Modify: `services/database/AdhkarDatabaseService.ts`: `SuperCategoryRow` (:57-67), `createTables` super_categories block (:180-193), the three super category mappers (`getAllSuperCategories`, `getSuperCategoriesBySection`, `getSuperCategory`), `seedSuperCategories` (:653 and :1038-1057), plus a new `getAdhkarByIds`
- Modify: `services/adhkar/AdhkarService.ts`: the seed import (:11), `initialize` (:39-54) and `getAdhkarForSuperCategory` (:183-224)
- Modify: `services/database/__tests__/upgrade.golden.test.ts`: the `ADDED` map (:87-91)
- Create: `services/database/__tests__/adhkarSuperLists.test.ts`
- Create: `services/adhkar/__tests__/AdhkarService.lists.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `SuperCategory.dhikrIds: string[] | null`
  - `AdhkarSeedData.super_category_dhikr_ids?: Record<string, string[]>`
  - `adhkarDatabaseService.seedSuperCategories(dhikrIdsBySuperId?: Readonly<Record<string, readonly string[]>>): Promise<void>`
  - `adhkarDatabaseService.getAdhkarByIds(ids: readonly string[]): Promise<Dhikr[]>`, which returns rows in the order of `ids` and skips unknown ids
  - `adhkarService.getAdhkarForSuperCategory(superId)` follows `dhikrIds` when it is non-null, grouping consecutive rows by category; otherwise its behavior is unchanged

- [ ] **Step 1: Write the failing DB-layer test**

Create `services/database/__tests__/adhkarSuperLists.test.ts`:

```ts
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {openDatabaseAsync, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {adhkarDatabaseService} from '../AdhkarDatabaseService';
import type {AdhkarSeedData} from '@/types/adhkar';

function row(
  id: string,
  orderIndex: number,
): AdhkarSeedData['adhkar'][number] {
  return {
    id,
    category_id: '27',
    arabic: `((${id}))`,
    translation: null,
    transliteration: null,
    instruction: null,
    repeat_count: 1,
    audio_file: null,
    order_index: orderIndex,
  };
}

const seed: AdhkarSeedData = {
  categories: [
    {
      id: '27',
      title: 'Words of remembrance for morning and evening',
      broad_tags: ['daily'],
      dhikr_count: 3,
    },
  ],
  adhkar: [row('1', 0), row('2', 1), row('evening-1', 2)],
};

afterEach(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

describe('super category dhikr lists', () => {
  it('stores an ordered list per super category and null elsewhere', async () => {
    await adhkarDatabaseService.initialize();
    await adhkarDatabaseService.seedDatabase(seed);
    await adhkarDatabaseService.seedSuperCategories({
      'evening-adhkar': ['evening-1', '1'],
    });
    const evening = await adhkarDatabaseService.getSuperCategory('evening-adhkar');
    expect(evening?.dhikrIds).toEqual(['evening-1', '1']);
    const morning = await adhkarDatabaseService.getSuperCategory('morning-adhkar');
    expect(morning?.dhikrIds).toBeNull();
    const all = await adhkarDatabaseService.getAllSuperCategories();
    expect(all.find(s => s.id === 'evening-adhkar')?.dhikrIds).toEqual([
      'evening-1',
      '1',
    ]);
    const main = await adhkarDatabaseService.getSuperCategoriesBySection('main');
    expect(main.find(s => s.id === 'salah')?.dhikrIds).toBeNull();
  });

  it('returns adhkar in the requested order and skips unknown ids', async () => {
    await adhkarDatabaseService.initialize();
    await adhkarDatabaseService.seedDatabase(seed);
    const adhkar = await adhkarDatabaseService.getAdhkarByIds([
      'evening-1',
      'missing',
      '1',
    ]);
    expect(adhkar.map(d => d.id)).toEqual(['evening-1', '1']);
    expect(await adhkarDatabaseService.getAdhkarByIds([])).toEqual([]);
  });

  it('adds dhikr_ids to a super_categories table created before version 6', async () => {
    const db = await openDatabaseAsync('adhkar.db');
    await db.execAsync(`
      CREATE TABLE super_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        arabic_title TEXT,
        color TEXT NOT NULL,
        height_multiplier REAL DEFAULT 1,
        column TEXT DEFAULT 'left',
        sort_order INTEGER DEFAULT 0,
        section TEXT DEFAULT 'main',
        category_ids TEXT NOT NULL
      );
      INSERT INTO super_categories (id, title, color, category_ids)
      VALUES ('morning-adhkar', 'Morning', '#F59E0B', '["27"]');
    `);
    await adhkarDatabaseService.initialize();
    const columns = await db.getAllAsync<{name: string}>(
      'PRAGMA table_info(super_categories)',
    );
    expect(columns.map(c => c.name)).toContain('dhikr_ids');
    const morning = await adhkarDatabaseService.getSuperCategory('morning-adhkar');
    expect(morning?.categoryIds).toEqual(['27']);
    expect(morning?.dhikrIds).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing service test**

Create `services/adhkar/__tests__/AdhkarService.lists.test.ts`:

```ts
jest.mock('@/services/database/AdhkarDatabaseService', () => ({
  adhkarDatabaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    needsReseed: jest.fn().mockResolvedValue(false),
    isDatabaseSeeded: jest.fn().mockResolvedValue(true),
    areSuperCategoriesSeeded: jest.fn().mockResolvedValue(true),
    seedDatabase: jest.fn().mockResolvedValue(undefined),
    seedSuperCategories: jest.fn().mockResolvedValue(undefined),
    updateDataVersion: jest.fn().mockResolvedValue(undefined),
    getSuperCategory: jest.fn(),
    getAllCategories: jest.fn(),
    getAdhkarByIds: jest.fn(),
    getAdhkarByCategoryIds: jest.fn(),
  },
}));
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import {adhkarService} from '../AdhkarService';
import type {AdhkarCategory, Dhikr, SuperCategory} from '@/types/adhkar';

function dhikr(id: string, categoryId: string): Dhikr {
  return {
    id,
    categoryId,
    arabic: id,
    translation: null,
    transliteration: null,
    instruction: null,
    repeatCount: 1,
    audioFile: null,
    sortOrder: 0,
  };
}

function superCategory(dhikrIds: string[] | null): SuperCategory {
  return {
    id: 'evening-adhkar',
    title: 'Evening',
    arabicTitle: null,
    color: '#4F46E5',
    heightMultiplier: 1,
    column: 'right',
    sortOrder: 1,
    section: 'main',
    categoryIds: ['27'],
    dhikrIds,
  };
}

const categories: AdhkarCategory[] = [
  {id: '27', title: 'Morning and evening', dhikrCount: 3, broadTags: []},
  {id: '28', title: 'Before sleeping', dhikrCount: 1, broadTags: []},
];

describe('getAdhkarForSuperCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(adhkarDatabaseService.getAllCategories).mockResolvedValue(
      categories,
    );
  });

  it('follows the explicit list order and groups consecutive categories', async () => {
    jest
      .mocked(adhkarDatabaseService.getSuperCategory)
      .mockResolvedValue(superCategory(['75', 'evening-77', '106', '97']));
    jest
      .mocked(adhkarDatabaseService.getAdhkarByIds)
      .mockResolvedValue([
        dhikr('75', '27'),
        dhikr('evening-77', '27'),
        dhikr('106', '28'),
        dhikr('97', '27'),
      ]);
    const result = await adhkarService.getAdhkarForSuperCategory('evening-adhkar');
    expect(adhkarDatabaseService.getAdhkarByIds).toHaveBeenCalledWith([
      '75',
      'evening-77',
      '106',
      '97',
    ]);
    expect(
      result?.categoryGroups.map(g => [g.categoryId, g.adhkar.map(d => d.id)]),
    ).toEqual([
      ['27', ['75', 'evening-77']],
      ['28', ['106']],
      ['27', ['97']],
    ]);
    expect(adhkarDatabaseService.getAdhkarByCategoryIds).not.toHaveBeenCalled();
  });

  it('falls back to category membership when there is no list', async () => {
    jest
      .mocked(adhkarDatabaseService.getSuperCategory)
      .mockResolvedValue(superCategory(null));
    jest
      .mocked(adhkarDatabaseService.getAdhkarByCategoryIds)
      .mockResolvedValue([dhikr('75', '27'), dhikr('76', '27')]);
    const result = await adhkarService.getAdhkarForSuperCategory('evening-adhkar');
    expect(result?.categoryGroups).toEqual([
      {
        categoryId: '27',
        categoryTitle: 'Morning and evening',
        adhkar: [dhikr('75', '27'), dhikr('76', '27')],
      },
    ]);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx jest services/database/__tests__/adhkarSuperLists.test.ts services/adhkar/__tests__/AdhkarService.lists.test.ts`
Expected: FAIL. TypeScript/jest errors: `dhikrIds` does not exist on `SuperCategory`, and `getAdhkarByIds` is not a function.

- [ ] **Step 4: Update the types**

In `types/adhkar.ts`, add to `SuperCategory` after `categoryIds: string[]; // References to adhkar_categories.id`:

```ts
  // Explicit ordered dhikr list (morning and evening differ inside category
  // 27). null: every dhikr of categoryIds, in category order.
  dhikrIds: string[] | null;
```

In `AdhkarSeedData`, add after the `adhkar: Array<{...}>;` member:

```ts
  // Ordered dhikr ids per super category id (seeded into
  // super_categories.dhikr_ids). Super categories not listed show their
  // categories in full.
  super_category_dhikr_ids?: Record<string, string[]>;
```

- [ ] **Step 5: Update the database service**

In `services/database/AdhkarDatabaseService.ts`:

(a) Add a member to `SuperCategoryRow` after `category_ids: string; // JSON array stored as string`:

```ts
  dhikr_ids: string | null; // JSON array of dhikr ids, or NULL (version 6)
```

(b) Add these module-level functions after `function esc(...) {...}`:

```ts
/** Parse super_categories.dhikr_ids (JSON array of ids) or return null. */
function parseDhikrIds(value: string | null): string[] | null {
  if (value === null) return null;
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return null;
  const items: unknown[] = parsed;
  const ids: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') return null;
    ids.push(item);
  }
  return ids;
}
```

(c) In `createTables`, replace the super_categories `CREATE TABLE` statement with the version below (it adds `dhikr_ids TEXT`), followed by the migration:

```ts
    // Create super_categories table (Life With Allah-style groupings)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS super_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        arabic_title TEXT,
        color TEXT NOT NULL,
        height_multiplier REAL DEFAULT 1,
        column TEXT DEFAULT 'left',
        sort_order INTEGER DEFAULT 0,
        section TEXT DEFAULT 'main',
        category_ids TEXT NOT NULL,
        dhikr_ids TEXT
      );
    `);

    // Data version 6 added dhikr_ids. CREATE TABLE IF NOT EXISTS does not add
    // columns to a table an older release created, so add it explicitly.
    const superColumns = await this.db.getAllAsync<{name: string}>(
      'PRAGMA table_info(super_categories)',
    );
    if (!superColumns.some(column => column.name === 'dhikr_ids')) {
      await this.db.execAsync(
        'ALTER TABLE super_categories ADD COLUMN dhikr_ids TEXT;',
      );
    }
```

(d) In each of the three mappers (`getAllSuperCategories`, `getSuperCategoriesBySection`, `getSuperCategory`), add this line after `categoryIds: JSON.parse(row.category_ids),`:

```ts
      dhikrIds: parseDhikrIds(row.dhikr_ids),
```

(e) Add this method after `getAdhkarByCategoryIds`:

```ts
  // Get adhkar by id, in the order of `ids` (unknown ids are skipped)
  async getAdhkarByIds(ids: readonly string[]): Promise<Dhikr[]> {
    if (!this.db) throw new Error('Database not initialized');
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<DhikrRow>(
      `SELECT * FROM adhkar WHERE id IN (${placeholders})`,
      [...ids],
    );
    const byId = new Map(rows.map(row => [row.id, row]));
    const result: Dhikr[] = [];
    for (const id of ids) {
      const dhikr = byId.get(id);
      if (!dhikr) continue;
      result.push({
        id: dhikr.id,
        categoryId: dhikr.category_id,
        arabic: dhikr.arabic,
        translation: dhikr.translation,
        transliteration: dhikr.transliteration,
        instruction: dhikr.instruction,
        repeatCount: dhikr.repeat_count,
        audioFile: dhikr.audio_file,
        sortOrder: dhikr.sort_order,
      });
    }
    return result;
  }
```

(f) Change the `seedSuperCategories` signature from `async seedSuperCategories(): Promise<void> {` to:

```ts
  async seedSuperCategories(
    dhikrIdsBySuperId: Readonly<Record<string, readonly string[]>> = {},
  ): Promise<void> {
```

Then replace the `superValues` builder and the insert at the end of the method (the `// Clear and batch insert all super categories` block) with:

```ts
    // Clear and batch insert all super categories
    const superValues = allSuperCategories
      .map(cat => {
        const dhikrIds = dhikrIdsBySuperId[cat.id];
        return `(${esc(cat.id)}, ${esc(cat.title)}, ${esc(
          cat.arabic_title,
        )}, ${esc(cat.color)}, ${cat.height_multiplier}, ${esc(cat.column)}, ${
          cat.sort_order
        }, ${esc(cat.section)}, ${esc(JSON.stringify(cat.category_ids))}, ${
          dhikrIds ? esc(JSON.stringify(dhikrIds)) : 'NULL'
        })`;
      })
      .join(',\n');

    await db.execAsync(`
      DELETE FROM super_categories;
      INSERT INTO super_categories (id, title, arabic_title, color, height_multiplier, column, sort_order, section, category_ids, dhikr_ids)
      VALUES ${superValues};
    `);
```

- [ ] **Step 6: Update the service**

In `services/adhkar/AdhkarService.ts`, add this line below `import adhkarSeedData from '@/data/adhkar.json';`:

```ts
const seedData: AdhkarSeedData = adhkarSeedData;
```

In `initialize`, replace

```ts
          await adhkarDatabaseService.seedDatabase(
            adhkarSeedData as AdhkarSeedData,
          );
```

with

```ts
          await adhkarDatabaseService.seedDatabase(seedData);
```

and replace `await adhkarDatabaseService.seedSuperCategories();` with:

```ts
          await adhkarDatabaseService.seedSuperCategories(
            seedData.super_category_dhikr_ids ?? {},
          );
```

Add this interface and function above `class AdhkarService {`:

```ts
interface SuperCategoryGroup {
  categoryId: string;
  categoryTitle: string;
  adhkar: Dhikr[];
}

// Keeps list order; starts a new group whenever the category changes.
function groupConsecutiveByCategory(
  adhkar: Dhikr[],
  categories: AdhkarCategory[],
): SuperCategoryGroup[] {
  const groups: SuperCategoryGroup[] = [];
  for (const dhikr of adhkar) {
    const last = groups[groups.length - 1];
    if (last && last.categoryId === dhikr.categoryId) {
      last.adhkar.push(dhikr);
      continue;
    }
    const category = categories.find(c => c.id === dhikr.categoryId);
    if (!category) continue;
    groups.push({
      categoryId: category.id,
      categoryTitle: category.title,
      adhkar: [dhikr],
    });
  }
  return groups;
}
```

In `getAdhkarForSuperCategory`, insert this directly after `const allCategories = await adhkarDatabaseService.getAllCategories();`:

```ts
    // Explicit ordered list (morning and evening): follow it exactly
    if (superCategory.dhikrIds) {
      const listed = await adhkarDatabaseService.getAdhkarByIds(
        superCategory.dhikrIds,
      );
      return {
        superCategory,
        categoryGroups: groupConsecutiveByCategory(listed, allCategories),
      };
    }
```

- [ ] **Step 7: Allow the new column in the golden upgrade test**

In `services/database/__tests__/upgrade.golden.test.ts`, add this entry to the `ADDED` map (after `'verse-annotations.db/highlights.rewayah_id': 'hafs',`):

```ts
  // Data version 6 ALTERs super_categories; pre-existing rows get NULL.
  'adhkar.db/super_categories.dhikr_ids': null,
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest services/database services/adhkar`
Expected: PASS. The new tests pass, the golden tests pass on all four tags (no reseed yet; the column is added with NULL), and `adhkarDataVersion` passes.

- [ ] **Step 9: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write types/adhkar.ts services/database/AdhkarDatabaseService.ts services/adhkar/AdhkarService.ts services/database/__tests__/upgrade.golden.test.ts services/database/__tests__/adhkarSuperLists.test.ts services/adhkar/__tests__/AdhkarService.lists.test.ts
git add types/adhkar.ts services/database/AdhkarDatabaseService.ts services/adhkar/AdhkarService.ts services/database/__tests__/upgrade.golden.test.ts services/database/__tests__/adhkarSuperLists.test.ts services/adhkar/__tests__/AdhkarService.lists.test.ts
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "feat(adhkar): support an ordered dhikr list per super category

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 3: Separate Morning and Evening content (evening rows, lists, version 6)

**Files:**
- Read (single source, do not edit here): `docs/superpowers/specs/2026-10-12-evening-adhkar-texts.md`
- Create: `scripts/adhkar-content/eveningRows.ts`
- Create: `scripts/adhkar-content/adhkarFixes.ts`
- Create: `scripts/adhkar-content/apply-content-fixes.ts`
- Create: `scripts/__tests__/adhkarFixes.test.ts`
- Create: `services/adhkar/__tests__/adhkarSeed.test.ts`
- Create: `services/adhkar/__tests__/AdhkarService.periods.test.ts`
- Modify: `data/adhkar.json` (written by the script only)
- Modify: `services/database/adhkarDataVersion.ts` (5 to 6)
- Modify: `services/database/__tests__/fixtures/adhkar-data-fingerprints.json` (written by the script)
- Modify: `services/database/__tests__/upgrade.golden.test.ts`

**Interfaces:**
- Consumes:
  - `AdhkarSeedData.super_category_dhikr_ids` and `seedSuperCategories(lists)` (Task 2)
  - `write-data-fingerprint.ts` (Task 1)
- Produces:
  - `EVENING_TEXTS_DOC: string`
  - `interface EveningRow {id; morningId; arabic; translation; transliteration: string | null; repeatCount: number}`
  - `parseEveningRows(markdown: string): EveningRow[]`
  - `interface SeedRow`, `interface SeedFile`
  - `parseSeedFile(value: unknown): SeedFile`
  - `serializeSeedFile(seed: SeedFile): string`
  - `applyAllFixes(seed: SeedFile, eveningMarkdown: string): SeedFile`
  - `MORNING_LIST`, `EVENING_LIST: readonly string[]`
  - `FIX_STEPS: Array<(seed: SeedFile, eveningMarkdown: string) => SeedFile>`. Tasks 5 and 6 add one step each.
  - The `super_category_dhikr_ids` key in `data/adhkar.json` (Task 4 reads it).

- [ ] **Step 1: Write the failing script tests**

Create `scripts/__tests__/adhkarFixes.test.ts`:

```ts
// scripts/__tests__/adhkarFixes.test.ts
import fs from 'fs';
import path from 'path';
import {
  applyAllFixes,
  parseSeedFile,
  serializeSeedFile,
} from '../adhkar-content/adhkarFixes';
import {
  EVENING_TEXTS_DOC,
  parseEveningRows,
} from '../adhkar-content/eveningRows';

const root = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function block(body: string): string {
  return ['```json evening-row', body, '```'].join('\n');
}

const goodRow = JSON.stringify({
  id: 'evening-77',
  morning_id: '77',
  arabic: 'أَمْسَيْنَا',
  translation: 'We have entered the evening.',
  transliteration: null,
  repeat_count: 1,
});

describe('parseEveningRows', () => {
  it('reads every json evening-row block and ignores other code blocks', () => {
    const md = [
      '# Doc',
      '```json',
      '{"id": "not-a-row"}',
      '```',
      block(goodRow),
    ].join('\n');
    expect(parseEveningRows(md)).toEqual([
      {
        id: 'evening-77',
        morningId: '77',
        arabic: 'أَمْسَيْنَا',
        translation: 'We have entered the evening.',
        transliteration: null,
        repeatCount: 1,
      },
    ]);
  });

  it('rejects an id that does not match its morning row', () => {
    const bad = goodRow.replace('"evening-77"', '"evening-78"');
    expect(() => parseEveningRows(block(bad))).toThrow('evening-77');
  });

  it('rejects empty text and a non-positive repeat count', () => {
    expect(() =>
      parseEveningRows(block(goodRow.replace('أَمْسَيْنَا', ' '))),
    ).toThrow('empty');
    expect(() =>
      parseEveningRows(block(goodRow.replace('"repeat_count":1', '"repeat_count":0'))),
    ).toThrow('repeat_count');
  });

  it('reads the six reviewed rows from the spec document', () => {
    expect(parseEveningRows(read(EVENING_TEXTS_DOC)).map(r => r.id)).toEqual([
      'evening-77',
      'evening-78',
      'evening-80',
      'evening-81',
      'evening-89',
      'evening-90',
    ]);
  });
});

describe('adhkar content fixes', () => {
  const raw = read('data/adhkar.json');
  const parsed: unknown = JSON.parse(raw);
  const seed = parseSeedFile(parsed);

  it('round-trips data/adhkar.json byte for byte', () => {
    expect(serializeSeedFile(seed)).toBe(raw);
  });

  it('are applied to data/adhkar.json (run npx tsx scripts/adhkar-content/apply-content-fixes.ts)', () => {
    expect(serializeSeedFile(applyAllFixes(seed, read(EVENING_TEXTS_DOC)))).toBe(
      raw,
    );
  });
});
```

- [ ] **Step 2: Write the failing data test**

Create `services/adhkar/__tests__/adhkarSeed.test.ts`. Tasks 5 and 6 append `describe` blocks to this file.

```ts
// services/adhkar/__tests__/adhkarSeed.test.ts
// Assertions on the committed data/adhkar.json. The file is written by
// scripts/adhkar-content/apply-content-fixes.ts; never hand-edit it.
import fs from 'fs';
import path from 'path';
import adhkarSeed from '@/data/adhkar.json';
import {
  EVENING_TEXTS_DOC,
  parseEveningRows,
} from '@/scripts/adhkar-content/eveningRows';

const root = path.resolve(__dirname, '../../..');
const rows = adhkarSeed.adhkar;
const byId = new Map(rows.map(r => [r.id, r]));

function row(id: string): (typeof rows)[number] {
  const found = byId.get(id);
  if (!found) throw new Error(`missing dhikr ${id}`);
  return found;
}

function range(prefix: string, from: number, to: number): string[] {
  return Array.from({length: to - from + 1}, (_, i) => `${prefix}${from + i}`);
}

const LEGACY_IDS = [
  ...range('', 1, 267),
  ...range('quranic-', 1, 40),
  ...range('name-', 1, 99),
];
const EVENING_IDS = [
  'evening-77',
  'evening-78',
  'evening-80',
  'evening-81',
  'evening-89',
  'evening-90',
];
const MORNING = [
  '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86',
  '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '98',
];
const EVENING = [
  '75', '76', 'evening-77', 'evening-78', '79', 'evening-80', 'evening-81',
  '82', '83', '84', '85', '86', '87', '88', 'evening-89', 'evening-90', '91',
  '92', '96', '97', '98',
];

describe('dhikr ids', () => {
  it('keeps every pre-existing id and adds only the six evening rows', () => {
    const ids = rows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...LEGACY_IDS, ...EVENING_IDS].sort());
  });

  it('keeps each category dhikr_count equal to its rows', () => {
    for (const category of adhkarSeed.categories) {
      expect({
        id: category.id,
        count: rows.filter(r => r.category_id === category.id).length,
      }).toEqual({id: category.id, count: category.dhikr_count});
    }
  });
});

describe('morning and evening lists', () => {
  const lists = adhkarSeed.super_category_dhikr_ids;

  it('lists the morning adhkar without evening-only ones', () => {
    expect(lists['morning-adhkar']).toEqual(MORNING);
  });

  it('lists the evening adhkar with evening wording and without morning-only ones', () => {
    expect(lists['evening-adhkar']).toEqual(EVENING);
  });

  it('only lists ids that exist', () => {
    for (const id of [...MORNING, ...EVENING]) expect(byId.has(id)).toBe(true);
  });
});

describe('evening rows', () => {
  const reviewed = parseEveningRows(
    fs.readFileSync(path.join(root, EVENING_TEXTS_DOC), 'utf8'),
  );

  it('match the reviewed spec document exactly', () => {
    expect(reviewed).toHaveLength(6);
    reviewed.forEach((spec, index) => {
      const r = row(spec.id);
      expect(r).toEqual({
        id: spec.id,
        category_id: '27',
        category_name: 'Words of remembrance for morning and evening',
        arabic: `((${spec.arabic}))`,
        translation: spec.translation,
        transliteration: spec.transliteration,
        instruction: null,
        repeat_count: spec.repeatCount,
        audio_url: null,
        order_index: 24 + index,
        audio_file: null,
      });
    });
  });
});

describe('morning variant rows', () => {
  const variants = ['77', '78', '80', '81', '89', '90'];

  it('no longer carry the evening notes', () => {
    for (const id of variants) {
      const r = row(id);
      expect({id, arabic: r.arabic.includes('وإذا أمسى')}).toEqual({
        id,
        arabic: false,
      });
      for (const text of [r.translation, r.instruction]) {
        expect({id, text}).not.toEqual({
          id,
          text: expect.stringMatching(
            /In the evening:|For the evening|Note: for the evening|likewise, one says/,
          ),
        });
      }
      expect({id, translit: r.transliteration ?? ''}).not.toEqual({
        id,
        translit: expect.stringContaining('widha amsa'),
      });
    }
  });

  it('keeps the morning text itself', () => {
    expect(row('77').arabic.startsWith('((أَصْبَحْنَا')).toBe(true);
    expect(row('80').arabic.endsWith('(أربعَ مَرَّاتٍ).')).toBe(true);
    expect(row('78').translation).toBe(
      '(O Allah, by your leave we have reached the morning and by Your leave we have reached the evening, by Your leave we live and die and unto You is our resurrection.)',
    );
    expect(row('77').instruction).toBe('');
  });
});
```

Create `services/adhkar/__tests__/AdhkarService.periods.test.ts`:

```ts
// Fresh install over the real data/adhkar.json: the screens' data path.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {resetDatabases} from '@/test-utils/mockExpoSqlite';
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import adhkarSeed from '@/data/adhkar.json';
import {adhkarService} from '../AdhkarService';

afterAll(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

async function listIds(superId: string): Promise<string[]> {
  const data = await adhkarService.getAdhkarForSuperCategory(superId);
  expect(data?.categoryGroups).toHaveLength(1);
  return data?.categoryGroups.flatMap(g => g.adhkar.map(d => d.id)) ?? [];
}

describe('morning and evening on a fresh install', () => {
  it('serves the morning list', async () => {
    expect(await listIds('morning-adhkar')).toEqual(
      adhkarSeed.super_category_dhikr_ids['morning-adhkar'],
    );
  });

  it('serves the evening list with the evening wording', async () => {
    expect(await listIds('evening-adhkar')).toEqual(
      adhkarSeed.super_category_dhikr_ids['evening-adhkar'],
    );
    const evening77 = await adhkarService.getDhikr('evening-77');
    expect(evening77?.arabic.startsWith('((أَمْسَيْنَا')).toBe(true);
    expect(evening77?.audioFile).toBeNull();
  });

  it('leaves other super categories on category membership', async () => {
    const salah = await adhkarService.getSuperCategory('salah');
    expect(salah?.dhikrIds).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest scripts/__tests__/adhkarFixes.test.ts services/adhkar/__tests__/adhkarSeed.test.ts services/adhkar/__tests__/AdhkarService.periods.test.ts`
Expected: FAIL. `scripts/adhkar-content/eveningRows` is not found, and `super_category_dhikr_ids` does not exist on the JSON type.

- [ ] **Step 4: Create the evening-row parser**

Create `scripts/adhkar-content/eveningRows.ts`:

```ts
// scripts/adhkar-content/eveningRows.ts
// Reads the six evening rows from the reviewed spec document, which is their
// single source. Edit the json evening-row blocks there, then run
//   npx tsx scripts/adhkar-content/apply-content-fixes.ts
// No '@/' imports: tsx scripts import this file.

export const EVENING_TEXTS_DOC =
  'docs/superpowers/specs/2026-10-12-evening-adhkar-texts.md';

export interface EveningRow {
  id: string;
  morningId: string;
  arabic: string;
  translation: string;
  transliteration: string | null;
  repeatCount: number;
}

const BLOCK = /```json evening-row\n([\s\S]*?)\n```/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toEveningRow(value: unknown): EveningRow {
  if (!isRecord(value)) throw new Error('evening-row block must be an object');
  const {id, morning_id, arabic, translation, transliteration, repeat_count} =
    value;
  if (
    typeof id !== 'string' ||
    typeof morning_id !== 'string' ||
    typeof arabic !== 'string' ||
    typeof translation !== 'string' ||
    !(transliteration === null || typeof transliteration === 'string') ||
    typeof repeat_count !== 'number'
  ) {
    throw new Error(`malformed evening-row block: ${JSON.stringify(value)}`);
  }
  if (id !== `evening-${morning_id}`) {
    throw new Error(`evening row ${id} must be named evening-${morning_id}`);
  }
  if (arabic.trim() === '' || translation.trim() === '') {
    throw new Error(`evening row ${id} has empty text`);
  }
  if (!Number.isInteger(repeat_count) || repeat_count < 1) {
    throw new Error(`evening row ${id} has an invalid repeat_count`);
  }
  return {
    id,
    morningId: morning_id,
    arabic,
    translation,
    transliteration,
    repeatCount: repeat_count,
  };
}

export function parseEveningRows(markdown: string): EveningRow[] {
  const rows: EveningRow[] = [];
  for (const match of markdown.matchAll(BLOCK)) {
    const parsed: unknown = JSON.parse(match[1]);
    rows.push(toEveningRow(parsed));
  }
  return rows;
}
```

- [ ] **Step 5: Create the fixes module**

Create `scripts/adhkar-content/adhkarFixes.ts`:

```ts
// scripts/adhkar-content/adhkarFixes.ts
// Content fixes for data/adhkar.json (adhkar audit, 2026-10-12). Every step
// is idempotent: applyAllFixes(fixed) equals fixed, which jest checks against
// the committed file (scripts/__tests__/adhkarFixes.test.ts).
// No '@/' imports: tsx scripts import this file.
import {parseEveningRows} from './eveningRows';
import type {EveningRow} from './eveningRows';

export interface SeedRow {
  id: string;
  category_id: string;
  category_name: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
  repeat_count: number;
  audio_url: string | null;
  order_index: number;
  audio_file: string | null;
}

export type SeedCategory = Record<string, unknown> & {
  id: string;
  dhikr_count: number;
};

export interface SeedFile {
  categories: SeedCategory[];
  adhkar: SeedRow[];
  meta: unknown;
  super_category_dhikr_ids?: Record<string, string[]>;
}

export type FixStep = (seed: SeedFile, eveningMarkdown: string) => SeedFile;

// Key order of every row in data/adhkar.json; kept so the file round-trips.
const ROW_KEYS = [
  'id',
  'category_id',
  'category_name',
  'arabic',
  'translation',
  'transliteration',
  'instruction',
  'repeat_count',
  'audio_url',
  'order_index',
  'audio_file',
];

export const MORNING_AND_EVENING_CATEGORY = '27';
// Morning rows whose evening wording only lived in a bracketed note.
export const EVENING_VARIANT_IDS: readonly string[] = [
  '77',
  '78',
  '80',
  '81',
  '89',
  '90',
];
const FIRST_EVENING_ORDER_INDEX = 24;

// Hisn al-Muslim order. 93, 94, 95 are morning only; 97 is evening only.
export const MORNING_LIST: readonly string[] = [
  '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86',
  '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '98',
];
export const EVENING_LIST: readonly string[] = [
  '75', '76', 'evening-77', 'evening-78', '79', 'evening-80', 'evening-81',
  '82', '83', '84', '85', '86', '87', '88', 'evening-89', 'evening-90', '91',
  '92', '96', '97', '98',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function toSeedRow(value: unknown): SeedRow {
  if (!isRecord(value)) throw new Error('adhkar row must be an object');
  const {
    id,
    category_id,
    category_name,
    arabic,
    translation,
    transliteration,
    instruction,
    repeat_count,
    audio_url,
    order_index,
    audio_file,
  } = value;
  if (
    typeof id !== 'string' ||
    typeof category_id !== 'string' ||
    typeof category_name !== 'string' ||
    typeof arabic !== 'string' ||
    !isNullableString(translation) ||
    !isNullableString(transliteration) ||
    !isNullableString(instruction) ||
    typeof repeat_count !== 'number' ||
    !isNullableString(audio_url) ||
    typeof order_index !== 'number' ||
    !isNullableString(audio_file)
  ) {
    throw new Error(`malformed adhkar row ${String(id)}`);
  }
  const keys = Object.keys(value).join(',');
  if (keys !== ROW_KEYS.join(',')) {
    throw new Error(`adhkar row ${id} has unexpected keys: ${keys}`);
  }
  return {
    id,
    category_id,
    category_name,
    arabic,
    translation,
    transliteration,
    instruction,
    repeat_count,
    audio_url,
    order_index,
    audio_file,
  };
}

function toSeedCategory(value: unknown): SeedCategory {
  if (!isRecord(value)) throw new Error('category must be an object');
  const {id, dhikr_count} = value;
  if (typeof id !== 'string' || typeof dhikr_count !== 'number') {
    throw new Error(`malformed category ${String(id)}`);
  }
  return {...value, id, dhikr_count};
}

function toLists(value: unknown): Record<string, string[]> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('super_category_dhikr_ids is malformed');
  const entries: [string, unknown][] = Object.entries(value);
  const lists: Record<string, string[]> = {};
  for (const [superId, list] of entries) {
    if (!Array.isArray(list)) throw new Error(`${superId} list is malformed`);
    const items: unknown[] = list;
    lists[superId] = items.map(item => {
      if (typeof item !== 'string') throw new Error(`${superId} has a non-id`);
      return item;
    });
  }
  return lists;
}

export function parseSeedFile(value: unknown): SeedFile {
  if (
    !isRecord(value) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.adhkar)
  ) {
    throw new Error('data/adhkar.json is malformed');
  }
  const categories: unknown[] = value.categories;
  const adhkar: unknown[] = value.adhkar;
  const seed: SeedFile = {
    categories: categories.map(toSeedCategory),
    adhkar: adhkar.map(toSeedRow),
    meta: value.meta,
  };
  const lists = toLists(value.super_category_dhikr_ids);
  if (lists) seed.super_category_dhikr_ids = lists;
  return seed;
}

// data/adhkar.json is 2-space JSON without a trailing newline.
export function serializeSeedFile(seed: SeedFile): string {
  return JSON.stringify(seed, null, 2);
}

// ---- Morning and evening ---------------------------------------------------

// Where the evening note starts in each field of a morning variant row. The
// note always runs to the end of the field.
const EVENING_NOTE_START = {
  arabic: /\s*\[\s*وإذا أمسى/,
  translation: /\s*(\[In the evening:\]|\[For the evening|\(Note: for the evening)/,
  transliteration: /\s+widha amsa qal:/,
  instruction: /\s*(\[In the evening:\]|\[For the evening|\(Note: for the evening)/,
};

function cutAt(value: string, marker: RegExp): string {
  const index = value.search(marker);
  return index < 0 ? value : value.slice(0, index).trimEnd();
}

function cutNullableAt(value: string | null, marker: RegExp): string | null {
  return value === null ? null : cutAt(value, marker);
}

export function stripEveningNotes(seed: SeedFile): SeedFile {
  const variants = new Set(EVENING_VARIANT_IDS);
  return {
    ...seed,
    adhkar: seed.adhkar.map(row => {
      if (!variants.has(row.id)) return row;
      return {
        ...row,
        arabic: cutAt(row.arabic, EVENING_NOTE_START.arabic),
        translation: cutNullableAt(
          row.translation,
          EVENING_NOTE_START.translation,
        ),
        transliteration: cutNullableAt(
          row.transliteration,
          EVENING_NOTE_START.transliteration,
        ),
        // Row 77's instruction is the source's mixed morning/evening
        // transliteration ("...likewise, one says in the morning: Amsayna");
        // the curated morning transliteration stays in `transliteration`.
        instruction:
          row.id === '77'
            ? ''
            : cutNullableAt(row.instruction, EVENING_NOTE_START.instruction),
      };
    }),
  };
}

export function applyEveningRows(
  seed: SeedFile,
  eveningRows: readonly EveningRow[],
): SeedFile {
  const expected = EVENING_VARIANT_IDS.map(id => `evening-${id}`);
  const got = eveningRows.map(row => row.id);
  if (got.join(',') !== expected.join(',')) {
    throw new Error(
      `expected evening rows ${expected.join(', ')}, got ${got.join(', ')}`,
    );
  }
  const categoryName = seed.adhkar.find(
    row => row.category_id === MORNING_AND_EVENING_CATEGORY,
  )?.category_name;
  if (!categoryName) throw new Error('category 27 has no rows');
  const built: SeedRow[] = eveningRows.map((row, index) => ({
    id: row.id,
    category_id: MORNING_AND_EVENING_CATEGORY,
    category_name: categoryName,
    arabic: `((${row.arabic}))`,
    translation: row.translation,
    transliteration: row.transliteration,
    instruction: null,
    repeat_count: row.repeatCount,
    audio_url: null,
    order_index: FIRST_EVENING_ORDER_INDEX + index,
    audio_file: null,
  }));
  const eveningIds = new Set(expected);
  const rest = seed.adhkar.filter(row => !eveningIds.has(row.id));
  const lastMorningEvening = rest.findLastIndex(
    row => row.category_id === MORNING_AND_EVENING_CATEGORY,
  );
  return {
    ...seed,
    adhkar: [
      ...rest.slice(0, lastMorningEvening + 1),
      ...built,
      ...rest.slice(lastMorningEvening + 1),
    ],
  };
}

export function setPeriodLists(seed: SeedFile): SeedFile {
  return {
    ...seed,
    super_category_dhikr_ids: {
      'morning-adhkar': [...MORNING_LIST],
      'evening-adhkar': [...EVENING_LIST],
    },
  };
}

export function recountCategories(seed: SeedFile): SeedFile {
  return {
    ...seed,
    categories: seed.categories.map(category => ({
      ...category,
      dhikr_count: seed.adhkar.filter(row => row.category_id === category.id)
        .length,
    })),
  };
}

// Tasks append their steps before recountCategories, which must stay last.
export const FIX_STEPS: FixStep[] = [
  seed => stripEveningNotes(seed),
  (seed, eveningMarkdown) =>
    applyEveningRows(seed, parseEveningRows(eveningMarkdown)),
  seed => setPeriodLists(seed),
  seed => recountCategories(seed),
];

export function applyAllFixes(seed: SeedFile, eveningMarkdown: string): SeedFile {
  return FIX_STEPS.reduce((current, step) => step(current, eveningMarkdown), seed);
}
```

- [ ] **Step 6: Create the apply script and run it**

Create `scripts/adhkar-content/apply-content-fixes.ts`:

```ts
// scripts/adhkar-content/apply-content-fixes.ts
// Applies the adhkar content fixes to data/adhkar.json. Idempotent.
//   npx tsx scripts/adhkar-content/apply-content-fixes.ts
// Then record the fingerprint:
//   npx tsx scripts/adhkar-content/write-data-fingerprint.ts
import fs from 'fs';
import path from 'path';
import {applyAllFixes, parseSeedFile, serializeSeedFile} from './adhkarFixes';
import {EVENING_TEXTS_DOC} from './eveningRows';

const root = path.resolve(__dirname, '../..');
const dataPath = path.join(root, 'data/adhkar.json');

function main(): void {
  const before = fs.readFileSync(dataPath, 'utf8');
  const parsed: unknown = JSON.parse(before);
  const markdown = fs.readFileSync(path.join(root, EVENING_TEXTS_DOC), 'utf8');
  const after = serializeSeedFile(applyAllFixes(parseSeedFile(parsed), markdown));
  if (after === before) {
    console.log('[adhkar] data/adhkar.json is already up to date');
    return;
  }
  fs.writeFileSync(dataPath, after);
  console.log('[adhkar] wrote data/adhkar.json');
}

main();
```

Run: `npx tsx scripts/adhkar-content/apply-content-fixes.ts`
Expected: `[adhkar] wrote data/adhkar.json`. A second run prints `already up to date`.

Run: `git diff --stat data/adhkar.json`
Expected: one file changed. Only these parts change:
- category 27 `dhikr_count` (24 to 30);
- six new rows after row 98;
- rows 77, 78, 80, 81, 89 and 90;
- a new `super_category_dhikr_ids` key at the end.

- [ ] **Step 7: Bump the data version and record the fingerprint**

In `services/database/adhkarDataVersion.ts`, add this line below the Version 5 comment and change the constant:

```ts
// Version 6: Morning/evening split (6 evening rows, per-period dhikr lists,
//            super_categories.dhikr_ids), text, count and audio fixes
export const ADHKAR_DATA_VERSION = 6;
```

Run: `npx tsx scripts/adhkar-content/write-data-fingerprint.ts`
Expected: `[adhkar] version 6 fingerprint <hash>`, and the fixture gains a `"6"` entry.

- [ ] **Step 8: Teach the golden upgrade test about the reseed**

In `services/database/__tests__/upgrade.golden.test.ts`:

(a) Add these imports after the existing imports (after the `RewayahIdentity` import):

```ts
import adhkarSeed from '@/data/adhkar.json';
import {ADHKAR_DATA_VERSION} from '../adhkarDataVersion';
```

(b) Add this constant after `const TOLERATED_TABLES = [...]`:

```ts
// Bundled content tables AdhkarService wipes and reinserts when
// ADHKAR_DATA_VERSION goes up. Not user data: the reseed test below asserts
// them instead of the generic row-preservation checks. User tables
// (dhikr_favorites, dhikr_counts) are not in this list.
const RESEEDED_TABLES = [
  'adhkar.db/adhkar',
  'adhkar.db/adhkar_categories',
  'adhkar.db/adhkar_tags',
  'adhkar.db/category_tags',
  'adhkar.db/super_categories',
  'adhkar.db/adhkar_meta',
];
```

(c) Remove the `'adhkar.db/super_categories.dhikr_ids': null,` entry, and its comment, that Task 2 added to `ADDED`: super_categories is now covered by `RESEEDED_TABLES`.

(d) In `it('keeps the row count of every golden table', ...)`, add this line directly after the `if (TOLERATED_TABLES.includes(dumpKey)) {...}` block:

```ts
      if (RESEEDED_TABLES.includes(dumpKey)) continue;
```

(e) In `it('preserves every pre-existing row and column, except documented mappings', ...)`, change `if (TOLERATED_TABLES.includes(key)) continue;` to:

```ts
      if (TOLERATED_TABLES.includes(key) || RESEEDED_TABLES.includes(key)) {
        continue;
      }
```

(f) Add this test directly after `it('keeps adhkar favorites and tasbeeh counts', ...)`:

```ts
  it('reseeds adhkar content for the new data version and keeps every dhikr id', () => {
    const version = after['adhkar.db/adhkar_meta'].rows.find(
      r => r.key === 'data_version',
    );
    expect(version?.value).toBe(String(ADHKAR_DATA_VERSION));

    const afterIds = after['adhkar.db/adhkar'].rows.map(r => String(r.id));
    expect([...afterIds].sort()).toEqual(
      adhkarSeed.adhkar.map(a => a.id).sort(),
    );
    const kept = new Set(afterIds);
    for (const r of before['adhkar.db/adhkar'].rows) {
      const id = String(r.id);
      expect({id, kept: kept.has(id)}).toEqual({id, kept: true});
    }

    expect(after['adhkar.db/adhkar_categories'].rows).toHaveLength(
      adhkarSeed.categories.length,
    );
    const supers = after['adhkar.db/super_categories'].rows;
    expect(supers).toHaveLength(
      before['adhkar.db/super_categories'].rows.length,
    );
    const lists = new Map(supers.map(r => [String(r.id), r.dhikr_ids]));
    expect(lists.get('morning-adhkar')).toBe(
      JSON.stringify(adhkarSeed.super_category_dhikr_ids['morning-adhkar']),
    );
    expect(lists.get('evening-adhkar')).toBe(
      JSON.stringify(adhkarSeed.super_category_dhikr_ids['evening-adhkar']),
    );
    expect(lists.get('salah')).toBeNull();
  });
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx jest scripts/__tests__/adhkarFixes.test.ts services/adhkar services/database`
Expected: PASS. That includes:
- all four golden tags: favorites and counts unchanged, and the reseed test green;
- `adhkarDataVersion`: the version 6 fingerprint matches;
- `adhkarSeed`;
- `AdhkarService.periods`.

Run: `npx jest services/widgets`
Expected: FAIL in `contentStaticData.test.ts` ("matches the sources"). The generated widget files still count category 27, which now has 30 rows. Task 4, the next task, fixes this. Do not regenerate the widget data in this task.

- [ ] **Step 10: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write scripts/adhkar-content/eveningRows.ts scripts/adhkar-content/adhkarFixes.ts scripts/adhkar-content/apply-content-fixes.ts scripts/__tests__/adhkarFixes.test.ts services/adhkar/__tests__/adhkarSeed.test.ts services/adhkar/__tests__/AdhkarService.periods.test.ts services/database/adhkarDataVersion.ts services/database/__tests__/upgrade.golden.test.ts
git add scripts/adhkar-content scripts/__tests__/adhkarFixes.test.ts services/adhkar/__tests__ services/database data/adhkar.json
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "fix(adhkar): give the evening list its own wording and drop wrong-period adhkar

Adds evening rows for Hisn 77, 78, 80, 81, 89 and 90 from the reviewed spec,
removes the bracketed evening notes from the morning rows, lists 93-95 in the
morning only and 97 in the evening only, and bumps the adhkar data version to
6 so existing installs reseed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

Note: Prettier will reflow `MORNING_LIST`, `EVENING_LIST`, `MORNING` and `EVENING` one id per line. That is fine.

---

### Task 4: Widgets use the per-period lists

**Files:**
- Modify: `services/widgets/widgetStaticData.ts`: `AdhkarPeriodData.count` comment (:163), `AdhkarPeriodSource` (:172-178), `isPeriodSource` (:241-250), a new `parseAdhkarSeedLists`, and `buildAdhkarPeriods` (:309-344)
- Modify: `scripts/generate-widget-data.ts` (:13-22 imports, :84-91)
- Modify: `data/widgets/adhkar-periods.json`
- Modify (regenerated): `targets/widgets/adhkar-periods.json` and `modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json`
- Modify: `services/widgets/__tests__/contentStaticData.test.ts`
- Modify: `scripts/check-widget-content.sh:37-38`
- Modify: `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt:47-49`

**Interfaces:**
- Consumes: the `super_category_dhikr_ids` key in `data/adhkar.json` (Task 3).
- Produces:
  - `type AdhkarSeedLists = Record<string, string[]>`
  - `parseAdhkarSeedLists(seed: unknown): AdhkarSeedLists`
  - `buildAdhkarPeriods(source, seed: AdhkarSeedRow[], lists: AdhkarSeedLists): AdhkarPeriods`
  - The generated JSON shape is unchanged (`period`, `superId`, `title`, `arabicTitle`, `count`, `featured`), so the Swift and Kotlin decoders need no changes.

- [ ] **Step 1: Write the failing tests**

In `services/widgets/__tests__/contentStaticData.test.ts`:

(a) Add `parseAdhkarSeedLists,` to the import list from `'../widgetStaticData'`.

(b) In `function periods(...)`, delete both `categoryId: '27',` lines.

(c) Add this constant after `function periods(...) {...}`:

```ts
const lists = {
  'morning-adhkar': ['1', '2', '4', '9'],
  'evening-adhkar': ['2', '1'],
};
```

(d) Replace the whole `describe('buildAdhkarPeriods', () => {...});` block with:

```ts
describe('buildAdhkarPeriods', () => {
  it('cleans featured adhkar and counts the period list', () => {
    const out = buildAdhkarPeriods(periods(['1'], ['2', '1']), seed, lists);
    expect(out.morning).toEqual({
      period: 'morning',
      superId: 'morning-adhkar',
      title: 'Morning Adhkar',
      arabicTitle: 'أذكار الصباح',
      count: 4,
      featured: [
        {
          id: '1',
          arabic: 'سُبْحَانَ اللَّهِ',
          translation: 'Glory be to Allah.',
          repeatCount: 3,
        },
      ],
    });
    expect(out.evening.count).toBe(2);
    expect(out.evening.featured.map(f => f.id)).toEqual(['2', '1']);
    expect(out.evening.featured[0].translation).toBeNull();
  });

  it('rejects ids outside the period list, text without (( )), and empty lists', () => {
    expect(() => buildAdhkarPeriods(periods(['3'], ['1']), seed, lists)).toThrow(
      'not in the morning-adhkar list',
    );
    expect(() => buildAdhkarPeriods(periods(['4'], ['1']), seed, lists)).toThrow(
      'no (( )) text',
    );
    expect(() => buildAdhkarPeriods(periods([], ['1']), seed, lists)).toThrow(
      'no featured adhkar',
    );
    expect(() =>
      buildAdhkarPeriods(periods(['1'], ['1']), seed, {
        'morning-adhkar': ['1'],
      }),
    ).toThrow('no dhikr list for evening-adhkar');
  });

  it('rejects text longer than 180 characters', () => {
    const long = [
      ...seed,
      {
        id: '9',
        category_id: '27',
        arabic: `((${'ا'.repeat(181)}))`,
        translation: null,
        repeat_count: 1,
      },
    ];
    expect(() => buildAdhkarPeriods(periods(['9'], ['1']), long, lists)).toThrow(
      'too long',
    );
  });
});
```

(e) In `describe('source guards', ...)`, add these lines inside the `it(...)` body, after `expect(parseAdhkarSeed({adhkar: 'nope'})).toEqual([]);`:

```ts
    const committed = parseAdhkarSeedLists(readJson('data/adhkar.json'));
    expect(committed['morning-adhkar']).toHaveLength(23);
    expect(committed['evening-adhkar']).toHaveLength(21);
    expect(parseAdhkarSeedLists({})).toEqual({});
    expect(
      parseAdhkarSeedLists({super_category_dhikr_ids: {x: [1]}}),
    ).toEqual({});
```

(f) In `it('matches the sources (run npm run generate:widget-data after editing them)', ...)`, replace

```ts
    const expected = buildAdhkarPeriods(
      source,
      parseAdhkarSeed(readJson('data/adhkar.json')),
    );
    expect(readJson(`${ios}/adhkar-periods.json`)).toEqual(expected);
    expect(expected.morning.count).toBe(24);
```

with

```ts
    const adhkarSeed = readJson('data/adhkar.json');
    const seedLists = parseAdhkarSeedLists(adhkarSeed);
    const expected = buildAdhkarPeriods(
      source,
      parseAdhkarSeed(adhkarSeed),
      seedLists,
    );
    expect(readJson(`${ios}/adhkar-periods.json`)).toEqual(expected);
    expect(expected.morning.count).toBe(23);
    expect(expected.evening.count).toBe(21);
    for (const f of expected.evening.featured) {
      expect(seedLists['evening-adhkar']).toContain(f.id);
    }
    expect(expected.evening.featured.map(f => f.id)).not.toContain('94');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest services/widgets/__tests__/contentStaticData.test.ts`
Expected: FAIL. `parseAdhkarSeedLists` is not exported, `buildAdhkarPeriods` takes 2 arguments, and the source guard rejects the test periods because `categoryId` is gone.

- [ ] **Step 3: Implement the generator changes**

In `services/widgets/widgetStaticData.ts`:

(a) In `AdhkarPeriodData`, change `count: number; // adhkar in the category` to:

```ts
  count: number; // adhkar in the period's dhikr list
```

(b) Delete the `categoryId: string;` line from `AdhkarPeriodSource`, and the `typeof value.categoryId === 'string' &&` line from `isPeriodSource`.

(c) Add this after `export function parseAdhkarSeed(...) {...}`:

```ts
// Ordered dhikr ids per super category (data/adhkar.json
// super_category_dhikr_ids); the same lists the app's screens use.
export type AdhkarSeedLists = Record<string, string[]>;

export function parseAdhkarSeedLists(seed: unknown): AdhkarSeedLists {
  const raw = isObject(seed) ? seed.super_category_dhikr_ids : undefined;
  if (!isObject(raw)) return {};
  const lists: AdhkarSeedLists = {};
  for (const [superId, ids] of Object.entries(raw)) {
    if (isStringList(ids)) lists[superId] = ids;
  }
  return lists;
}
```

(d) Replace `buildAdhkarPeriods` with:

```ts
export function buildAdhkarPeriods(
  source: Record<AdhkarPeriodName, AdhkarPeriodSource>,
  seed: AdhkarSeedRow[],
  lists: AdhkarSeedLists,
): AdhkarPeriods {
  function period(name: AdhkarPeriodName): AdhkarPeriodData {
    const src = source[name];
    const ids = lists[src.superId];
    if (!ids || ids.length === 0) {
      throw new Error(`${name}: no dhikr list for ${src.superId}`);
    }
    if (src.featured.length === 0) {
      throw new Error(`${name} has no featured adhkar`);
    }
    const featured = src.featured.map(id => {
      if (!ids.includes(id)) {
        throw new Error(`${name}: dhikr ${id} is not in the ${src.superId} list`);
      }
      const row = seed.find(d => d.id === id);
      if (!row) throw new Error(`${name}: dhikr ${id} is missing from the seed`);
      const arabic = tasbeehDisplayText(row.arabic);
      if (!arabic) throw new Error(`${name}: dhikr ${id} has no (( )) text`);
      if (arabic.length > MAX_FEATURED_DHIKR_CHARS) {
        throw new Error(`${name}: dhikr ${id} is too long`);
      }
      return {
        id,
        arabic,
        translation: tasbeehTranslation(row.translation),
        repeatCount: row.repeat_count,
      };
    });
    return {
      period: name,
      superId: src.superId,
      title: src.title,
      arabicTitle: src.arabicTitle,
      count: ids.length,
      featured,
    };
  }
  return {morning: period('morning'), evening: period('evening')};
}
```

In `scripts/generate-widget-data.ts`:
- add `parseAdhkarSeedLists,` to the import list from `'../services/widgets/widgetStaticData'`;
- replace

```ts
  const adhkarPeriods = buildAdhkarPeriods(
    periodSource,
    parseAdhkarSeed(readJson('data/adhkar.json')),
  );
```

with

```ts
  const adhkarSeed = readJson('data/adhkar.json');
  const adhkarPeriods = buildAdhkarPeriods(
    periodSource,
    parseAdhkarSeed(adhkarSeed),
    parseAdhkarSeedLists(adhkarSeed),
  );
```

Replace `data/widgets/adhkar-periods.json` with the version below. `categoryId` is gone, and 94 (morning only, said after Fajr) leaves the evening list:

```json
{
  "morning": {
    "superId": "morning-adhkar",
    "title": "Morning Adhkar",
    "arabicTitle": "أذكار الصباح",
    "featured": ["83", "86", "87", "88", "91", "92", "94", "95", "96", "98"]
  },
  "evening": {
    "superId": "evening-adhkar",
    "title": "Evening Adhkar",
    "arabicTitle": "أذكار المساء",
    "featured": ["83", "86", "87", "88", "91", "92", "96", "97", "98"]
  }
}
```

- [ ] **Step 4: Regenerate the widget data**

Run: `npm run generate:widget-data`
Expected: `[generate-widget-data] 390 ayat, 114 surahs, 8 occasions, 2 adhkar periods`.

Run: `git diff --stat targets/widgets modules/bayaan-widgets/android/src/main/assets/widgets`
Expected: only the two `adhkar-periods.json` files change. Morning `count` goes to 23 and evening to 21, and the evening featured list loses 94. If `ayat.json`, `surahs.json`, `occasions.json` or `SurahCatalog.swift` also change, stop and report it: that would mean drift unrelated to this task.

- [ ] **Step 5: Update the native checks**

In `scripts/check-widget-content.sh`, replace lines 37-38 with:

```swift
precondition(adhkar.morning.count == 23 && adhkar.evening.count == 21 && adhkar.morning.superId == "morning-adhkar" && adhkar.evening.superId == "evening-adhkar", "adhkar periods")
precondition(adhkar.data(for: .evening).featured.contains { $0.id == "97" } && !adhkar.morning.featured.contains { $0.id == "97" } && !adhkar.evening.featured.contains { $0.id == "94" }, "adhkar featured split")
```

In `modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt`, in `parsesGeneratedStaticData`, replace `assertEquals(24, adhkar.morning.count)` with:

```kotlin
    assertEquals(23, adhkar.morning.count)
    assertEquals(21, adhkar.evening.count)
    assertTrue(adhkar.evening.featured.none { it.id == "94" })
```

- [ ] **Step 6: Run all the widget checks**

Run: `npx jest services/widgets modules/bayaan-widgets config`
Expected: PASS.

Run: `bash scripts/check-widget-content.sh && bash scripts/check-widget-fixtures.sh`
Expected: both exit 0.

Run: `cd android && ./gradlew :bayaan-widgets:testDebugUnitTest && cd ..`
Expected: BUILD SUCCESSFUL, with `ContentLogicTest` passing.

- [ ] **Step 7: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write services/widgets/widgetStaticData.ts scripts/generate-widget-data.ts services/widgets/__tests__/contentStaticData.test.ts
git add services/widgets/widgetStaticData.ts scripts/generate-widget-data.ts services/widgets/__tests__/contentStaticData.test.ts data/widgets/adhkar-periods.json targets/widgets/adhkar-periods.json modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json scripts/check-widget-content.sh modules/bayaan-widgets/android/src/test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "fix(widgets): build the morning and evening adhkar widgets from the period lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 5: Text, count and translation fixes

**Files:**
- Modify: `scripts/adhkar-content/adhkarFixes.ts` (adds `TEXT_FIXES`, `applyTextFixes` and a step)
- Modify: `services/adhkar/__tests__/adhkarSeed.test.ts` (appends a block)
- Modify: `services/widgets/buildCatalog.ts:16-17` and `:54-60` (row 114 exclusion)
- Modify: `services/widgets/__tests__/buildCatalog.test.ts:64-80` (new tasbeeh list)
- Modify: `data/adhkar.json` and the fingerprint fixture (both written by scripts)
- Modify (regenerated): `targets/widgets/adhkar-periods.json` and `modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json` (the featured items show the fixed count of 83 and the fixed translation of 86)

**Interfaces:**
- Consumes: `FIX_STEPS`, `SeedFile` and `SeedRow` from Task 3; `npm run generate:widget-data` from Task 4.
- Produces:
  - `TEXT_FIXES: Readonly<Record<string, RowPatch>>`
  - `applyTextFixes(seed: SeedFile): SeedFile`
  - `TASBEEH_ADHKAR` ids become `83, 86, 87, 91, 92, 93, 94, 96, 97, 98, 106, 33, 41, 69, 72, 119, 148`

Sources for every fixed string:
- **hisnmuslim.com API**, http://www.hisnmuslim.com/api/en/<chapter>.json and /api/ar/<chapter>.json.
  - hisnmuslim has the same error as the app for 255, 185, 86 and 134. Those rows therefore use the sunnah.com English instead.
- **Row 255:** Muslim 2693, https://sunnah.com/muslim:2693, English verbatim. Its Arabic matches the row word for word.
- **Row 185:** Muslim 1431, https://sunnah.com/muslim:1431, English verbatim.
- **Row 86:** Abu Dawud 5088, https://sunnah.com/abudawud:5088, English verbatim, plus the row's own count note "(three times)".
- **Row 134:** no published English renders the plural, so this is a one-word correction.
  - The text is the hisnmuslim English with "His Messenger" changed to "His Messengers": رُسُلِهِ is plural.
  - Muslim 134b (https://sunnah.com/muslim:134b) notes that the word "رسله" was added.
- **Row 133:** hisnmuslim en/40 `LANGUAGE_ARABIC_TRANSLATED_TEXT`, verbatim. It moves from `instruction` to `translation`.
- **Row 61:** hisnmuslim en/24 transliteration, verbatim, without its outer parentheses.
- **Row 267:** hisnmuslim ar/132 `ARABIC_TEXT`, verbatim.
  - The Whisper transcript of `adhkar_267.mp3` (audit `asr/transcripts.jsonl`) has the same wording, including فَخَلُّوهُمْ and وَأَغْلِقُوا.
  - Bukhari 5623 has فَحُلُّوهُمْ and فَأَغْلِقُوا. The row keeps the Hisn wording because the bundled audio recites it.
  - The ` – ` marks in the source are en dashes (U+2013), not em dashes.
- **quranic-35:** the rest of 40:9 is appended to the Arabic, in the row's own Imlaei spelling style (Tanzil "simple" text, https://tanzil.net, 40:9). The translation's last sentence is replaced with Saheeh International 40:9, from `data/SaheehInternational.translation-with-footnote-tags.json` key `40:9`, minus its stray trailing quote. This makes the text cover what `adhkar_302.mp3` recites (audit 04, section C).
- **Repeat counts** come from the count written in each row's own Arabic and English (audit 02):
  - 83: 7 (سَبْعَ مَرّاتٍ)
  - 148: 7
  - 119: 3
  - 130: 3
  - 195: 100
  - 114: 3
  - 106: 33. This follows row 69's model (33 per phrase), so the two 33/33/34 rows agree. 69 keeps 33, because users may already have it configured in the Tasbeeh widget.
- **Row 119:** besides the count, the stray trailing `))` after `[رَبِّ الْمَلاَئِكَةِ وَالرُّوحِ]` is removed. Without this, the tasbeeh catalog (which row 119 joins once its count is 3) would show broken text.

- [ ] **Step 1: Write the failing tests**

Append to `services/adhkar/__tests__/adhkarSeed.test.ts`:

```ts
import {tasbeehDisplayText} from '@/services/widgets/dhikrText';

describe('text, count and translation fixes', () => {
  it('uses the repeat count written in the text', () => {
    const counts: Record<string, number> = {
      '83': 7,
      '148': 7,
      '119': 3,
      '130': 3,
      '195': 100,
      '114': 3,
      '106': 33,
      '69': 33,
    };
    for (const [id, count] of Object.entries(counts)) {
      expect({id, count: row(id).repeat_count}).toEqual({id, count});
    }
  });

  it('pairs each Arabic text with its own translation', () => {
    expect(row('255').translation).toContain('ten times');
    expect(row('255').translation).toContain('four slaves');
    expect(row('255').instruction).toBe('');
    expect(row('185').translation).toBe(
      'If any one of you is invited, he should accept (the invitation). In case he is fasting, he should pray (in order to bless the inmates of the house), and if he is not fasting he should eat.',
    );
    expect(row('185').instruction).toBe('');
    expect(row('86').translation).toContain('the Hearer, the Knower');
    expect(row('86').translation).not.toContain('All-Seeing');
    expect(row('134').translation).toContain('His Messengers');
    expect(row('133').translation).toBe(
      '(Say:) I seek refuge in Allah. (Then you should desist from doing what you are in doubt about.)',
    );
    expect(row('61').transliteration).toBe(
      'Allahumma innee as-alukal-jannah, wa-aAAoothu bika minan-nar.',
    );
  });

  it('fills the missing and truncated Arabic', () => {
    expect(row('267').arabic).toContain('إِذَا كَانَ جُنْحُ اللَّيْلِ');
    expect(row('267').arabic.endsWith('مَصَابِيحَكُمْ)).')).toBe(true);
    expect(row('quranic-35').arabic.endsWith('الْفَوْزُ الْعَظِيمُ')).toBe(true);
    expect(row('quranic-35').translation).toContain(
      'And that is the great attainment.',
    );
  });

  it('gives row 119 a clean dhikr text for the tasbeeh widget', () => {
    const text = tasbeehDisplayText(row('119').arabic);
    expect(text).not.toBeNull();
    expect(text).not.toContain(')');
    expect(text?.split(' ')).toHaveLength(3);
  });
});
```

Then move the new `import {tasbeehDisplayText} ...` line up to the import block at the top of the file. Prettier does not move imports for you, and ESLint flags imports in the middle of a file.

In `services/widgets/__tests__/buildCatalog.test.ts`, replace the `it('picks the 13 repeatable adhkar from the seed', () => {` header and its `toEqual([...])` id list (lines 65-80) with:

```ts
  it('picks the 17 repeatable adhkar from the seed', () => {
    expect(TASBEEH_ADHKAR.map(d => d.id)).toEqual([
      '83',
      '86',
      '87',
      '91',
      '92',
      '93',
      '94',
      '96',
      '97',
      '98',
      '106',
      '33',
      '41',
      '69',
      '72',
      '119',
      '148',
    ]);
```

Leave the rest of that test body as it is. Then add this test inside the same `describe('tasbeeh adhkar', ...)` block:

```ts
  it('skips rows whose count is an instruction, not a dhikr', () => {
    expect(
      tasbeehAdhkar([
        {
          id: '114',
          arabic: '((يَنْفُثُ عَنْ يَسَارِهِ)) (ثلاثاً).',
          translation: null,
          repeat_count: 3,
        },
      ]),
    ).toEqual([]);
  });
```

If `tasbeehAdhkar` is not yet imported in that test file, add it to the existing `import {...} from '../buildCatalog'` list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest services/adhkar/__tests__/adhkarSeed.test.ts services/widgets/__tests__/buildCatalog.test.ts`
Expected: FAIL. The counts are still 1 (for example 83), the translations are unchanged, the tasbeeh list differs, and the 114 row is included.

- [ ] **Step 3: Add the text fixes**

In `scripts/adhkar-content/adhkarFixes.ts`, add this block after `recountCategories`:

```ts
// ---- Text, count and translation fixes --------------------------------------

export interface RowPatch {
  arabic?: string;
  translation?: string | null;
  transliteration?: string | null;
  instruction?: string | null;
  repeat_count?: number;
}

// Exact values; sources are listed in the adhkar content fix plan (Task 5).
export const TEXT_FIXES: Readonly<Record<string, RowPatch>> = {
  '83': {repeat_count: 7},
  '148': {repeat_count: 7},
  '119': {
    repeat_count: 3,
    arabic: "((سُبْحَانَ المَلِكِ القُدُّوسِ)) ثلاثَ مرَّاتٍ والثَّالِثَةُ يَجْهَرُ بها ويَمُدُّ بها صَوتَهُ يقولُ: [رَبِّ الْمَلاَئِكَةِ وَالرُّوحِ].",
  },
  '130': {repeat_count: 3},
  '195': {repeat_count: 100},
  '114': {repeat_count: 3},
  '106': {repeat_count: 33},
  '255': {
    translation:
      'He who uttered:" There is no god but Allah, the One, having no partner with Him, His is the Sovereignty and all praise is due to Him and He is Potent over everything" ten times, he is like one who emancipated four slaves from the progeny of Isma\'il.',
    instruction: '',
  },
  '185': {
    translation:
      'If any one of you is invited, he should accept (the invitation). In case he is fasting, he should pray (in order to bless the inmates of the house), and if he is not fasting he should eat.',
    instruction: '',
  },
  '86': {
    translation:
      'In the name of Allah, when Whose name is mentioned nothing on Earth or in Heaven can cause harm, and He is the Hearer, the Knower (three times)',
  },
  '134': {
    translation: '(He should say: (I have believed in Allah and His Messengers.))',
  },
  '133': {
    translation:
      '(Say:) I seek refuge in Allah. (Then you should desist from doing what you are in doubt about.)',
    instruction: '',
  },
  '61': {
    transliteration:
      'Allahumma innee as-alukal-jannah, wa-aAAoothu bika minan-nar.',
  },
  '267': {
    arabic: "قَالَ النَّبِيُّ صلى الله عليه وسلم ((إِذَا كَانَ جُنْحُ اللَّيْلِ – أَوْ أَمْسَيْتُم – فَـكُفُّوا صِبْيانَـكُم، فَإِنَّ الشَّيَاطِينَ تَنْتَشِرُ حِينَئِذٍ، فَإِذَا ذَهَبَ سَاعَةٌ مِنَ اللَّيلِ فَخَلُّوهُمْ، وَأَغْلِقُوا الأَبْوَابَ وَاذْكُرُوا اسْمَ اللَّهِ؛ فَإِنَّ الشَّيطَانَ لاَ يَفْتَحُ بَاباً مُغلَقاً، وَأَوْكُوا قِرَبَكُمْ، وَاذْكُرُوا اسْمَ اللَّهِ، وَخَمِّرُوا آنِيَتَكُم، وَاذْكُرُوا اسْمَ اللَّهِ، وَلَوْ أَنْ تَعْرُضُوا عَلَيْهَا شَيْئاً، وَأَطْفِئُوا مَصَابِيحَكُمْ)).",
  },
  'quranic-35': {
    arabic: "رَبَّنَا وَأَدْخِلْهُمْ جَنَّاتِ عَدْنٍ الَّتِي وَعَدْتَهُمْ وَمَنْ صَلَحَ مِنْ آبَائِهِمْ وَأَزْوَاجِهِمْ وَذُرِّيَّاتِهِمْ إِنَّكَ أَنْتَ الْعَزِيزُ الْحَكِيمُ وَقِهِمُ السَّيِّئَاتِ وَمَنْ تَقِ السَّيِّئَاتِ يَوْمَئِذٍ فَقَدْ رَحِمْتَهُ وَذَلِكَ هُوَ الْفَوْزُ الْعَظِيمُ",
    translation:
      'Our Lord, and admit them to gardens of perpetual residence which You have promised them and whoever was righteous among their fathers, their spouses and their offspring. Indeed, it is You who is the Exalted in Might, the Wise. And protect them from the evil consequences [of their deeds]. And he whom You protect from evil consequences that Day - You will have given him mercy. And that is the great attainment.',
  },
};

export function applyTextFixes(seed: SeedFile): SeedFile {
  return {
    ...seed,
    adhkar: seed.adhkar.map(row =>
      Object.hasOwn(TEXT_FIXES, row.id) ? {...row, ...TEXT_FIXES[row.id]} : row,
    ),
  };
}
```

Then insert the step into `FIX_STEPS`, directly before `seed => recountCategories(seed),`:

```ts
  seed => applyTextFixes(seed),
```

- [ ] **Step 4: Exclude the instruction-only row from the tasbeeh catalog**

In `services/widgets/buildCatalog.ts`, add this after `const MAX_DHIKR_CHARS = 180;`:

```ts
// Rows whose repeat count belongs to an instruction rather than a dhikr to
// recite (114: "spit on your left three times" after a bad dream).
const NOT_RECITED_IDS: ReadonlySet<string> = new Set(['114']);
```

In `tasbeehAdhkar`, change `if (d.repeat_count <= 1) continue;` to:

```ts
    if (d.repeat_count <= 1 || NOT_RECITED_IDS.has(d.id)) continue;
```

- [ ] **Step 5: Apply, fingerprint, run the tests**

Run: `npx tsx scripts/adhkar-content/apply-content-fixes.ts`
Expected: `[adhkar] wrote data/adhkar.json`.

Run: `npx tsx scripts/adhkar-content/write-data-fingerprint.ts`
Expected: the version 6 fingerprint is updated. ADHKAR_DATA_VERSION stays 6: one bump per release.

Run: `npm run generate:widget-data`
Expected: only the two `adhkar-periods.json` files change. Featured item 83 now has `"repeatCount":7`, and item 86's translation now reads "In the name of Allah, when Whose name is mentioned nothing on Earth or in Heaven can cause harm, and He is the Hearer, the Knower".

Run: `npx jest scripts/__tests__/adhkarFixes.test.ts services/adhkar services/database services/widgets`
Expected: PASS.

Run: `bash scripts/check-widget-content.sh`
Expected: exit 0.

- [ ] **Step 6: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write scripts/adhkar-content/adhkarFixes.ts services/adhkar/__tests__/adhkarSeed.test.ts services/widgets/buildCatalog.ts services/widgets/__tests__/buildCatalog.test.ts
git add scripts/adhkar-content/adhkarFixes.ts services/adhkar/__tests__/adhkarSeed.test.ts services/widgets/buildCatalog.ts services/widgets/__tests__/buildCatalog.test.ts data/adhkar.json services/database/__tests__/fixtures/adhkar-data-fingerprints.json targets/widgets/adhkar-periods.json modules/bayaan-widgets/android/src/main/assets/widgets/adhkar-periods.json
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "fix(adhkar): correct repeat counts, mistranslations and missing adhkar text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 6: Correct the audio mapping

**Files:**
- Create: `assets/audio/adhkar/adhkar_quranic_16.mp3` (ffmpeg merge of 282 and 283)
- Delete: `assets/audio/adhkar/adhkar_72.mp3`, `adhkar_149.mp3`, `adhkar_282.mp3`, `adhkar_283.mp3`, `adhkar_296.mp3` and `adhkar_304.mp3`
- Modify: `utils/adhkarAudio.ts`: header comment (:8), map lines 87, 164, 298, 299, 312 and 320
- Modify: `scripts/adhkar-content/adhkarFixes.ts` (adds `AUDIO_FIXES`, `applyAudioFixes` and a step)
- Create: `services/adhkar/__tests__/adhkarAudioAssets.test.ts`
- Modify: `services/adhkar/__tests__/adhkarSeed.test.ts` (appends a block)
- Modify: `data/adhkar.json` and the fingerprint fixture (both written by scripts)

**Interfaces:**
- Consumes: `FIX_STEPS` (Task 3).
- Produces:
  - `AUDIO_FIXES: Readonly<Record<string, string | null>>`
  - `applyAudioFixes(seed: SeedFile): SeedFile`
  - Rows with `audio_file: null`: 72, 149, quranic-5, quranic-30, quranic-40 and the six evening rows. Task 7 makes Play All skip them. Superseded by the Task 6 addenda (2026-10-12/13): every row now has audio.

The mapping is from audit `04-audio-content.md`, section A, where two Whisper models agree. It applies to these rows:

| Row | Before | After | Reason |
|---|---|---|---|
| quranic-5 | adhkar_272 | null | No clip recites 2:285 |
| quranic-6 to quranic-15 | 273 to 282 | 272 to 281 | The block was shifted by one |
| quranic-16 | 283 (second half only) | adhkar_quranic_16 | 282 + 283 merged |
| quranic-29 | 296 (Taha 20:45, in no row) | 297 | 297 recites 23:109 |
| quranic-30 | 297 | null | No clip recites 23:118 |
| quranic-37 | 304 (tail of quranic-36) | 305 | |
| quranic-38 | 305 | 306 | |
| quranic-39 | 306 | 307 | |
| quranic-40 | 307 | null | No clip recites 66:11 |
| 72 | adhkar_72 (copy of 73) | null | Upstream duplicate (audit 03) |
| 149 | adhkar_149 (copy of 49) | null | Upstream duplicate (audit 03) |

For quranic-16 the plan merges the two clips into one file instead of playing them in sequence. A merged file needs no player or queue changes, and seek, loop and Play All keep working as they do for every other row.

- [ ] **Step 1: Write the failing tests**

Create `services/adhkar/__tests__/adhkarAudioAssets.test.ts`:

```ts
// Every bundled adhkar clip is used by a row, and every row's clip is bundled.
import fs from 'fs';
import path from 'path';
import adhkarSeed from '@/data/adhkar.json';

const root = path.resolve(__dirname, '../../..');
const AUDIO_DIR = 'assets/audio/adhkar';

// Parsed from the source so the test needs no asset transform.
function mappedFiles(): Map<string, string> {
  const source = fs.readFileSync(path.join(root, 'utils/adhkarAudio.ts'), 'utf8');
  const entries = [
    ...source.matchAll(
      /'([^']+\.mp3)': require\('@\/assets\/audio\/adhkar\/([^']+)'\)/g,
    ),
  ];
  return new Map(entries.map(m => [m[1], m[2]]));
}

describe('adhkar audio assets', () => {
  const map = mappedFiles();
  const referenced = new Set(
    adhkarSeed.adhkar.flatMap(r => (r.audio_file ? [r.audio_file] : [])),
  );

  it('maps every key to the file of the same name, which exists', () => {
    expect(map.size).toBeGreaterThan(0);
    for (const [key, file] of map) {
      expect(file).toBe(key);
      expect(fs.existsSync(path.join(root, AUDIO_DIR, file))).toBe(true);
    }
  });

  it('bundles exactly the clips that rows reference', () => {
    expect([...map.keys()].sort()).toEqual([...referenced].sort());
  });

  it('ships no unmapped mp3 in the asset folder', () => {
    const onDisk = fs
      .readdirSync(path.join(root, AUDIO_DIR))
      .filter(f => f.endsWith('.mp3'));
    expect(onDisk.sort()).toEqual([...map.keys()].sort());
  });
});
```

Append to `services/adhkar/__tests__/adhkarSeed.test.ts`:

```ts
describe('audio mapping', () => {
  it('points each Quranic dua at the clip that recites it', () => {
    const expected: Record<string, string | null> = {
      'quranic-4': 'adhkar_271.mp3',
      'quranic-5': null,
      'quranic-6': 'adhkar_272.mp3',
      'quranic-7': 'adhkar_273.mp3',
      'quranic-8': 'adhkar_274.mp3',
      'quranic-9': 'adhkar_275.mp3',
      'quranic-10': 'adhkar_276.mp3',
      'quranic-11': 'adhkar_277.mp3',
      'quranic-12': 'adhkar_278.mp3',
      'quranic-13': 'adhkar_279.mp3',
      'quranic-14': 'adhkar_280.mp3',
      'quranic-15': 'adhkar_281.mp3',
      'quranic-16': 'adhkar_quranic_16.mp3',
      'quranic-17': 'adhkar_284.mp3',
      'quranic-28': 'adhkar_295.mp3',
      'quranic-29': 'adhkar_297.mp3',
      'quranic-30': null,
      'quranic-31': 'adhkar_298.mp3',
      'quranic-36': 'adhkar_303.mp3',
      'quranic-37': 'adhkar_305.mp3',
      'quranic-38': 'adhkar_306.mp3',
      'quranic-39': 'adhkar_307.mp3',
      'quranic-40': null,
    };
    for (const [id, file] of Object.entries(expected)) {
      expect({id, file: row(id).audio_file}).toEqual({id, file});
    }
  });

  it('drops the two clips that recite a different dua', () => {
    expect(row('72').audio_file).toBeNull();
    expect(row('149').audio_file).toBeNull();
    expect(row('73').audio_file).toBe('adhkar_73.mp3');
    expect(row('49').audio_file).toBe('adhkar_49.mp3');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest services/adhkar/__tests__/adhkarAudioAssets.test.ts services/adhkar/__tests__/adhkarSeed.test.ts`
Expected: FAIL. quranic-6 still maps to `adhkar_273.mp3`, row 72 is not null, and the map has no `adhkar_quranic_16.mp3`.

- [ ] **Step 3: Merge the quranic-16 clip**

Both source clips are MP3, 44.1 kHz mono, 128 kbps (21.13 s and 14.79 s).

```bash
ffmpeg -y -v error \
  -i assets/audio/adhkar/adhkar_282.mp3 -i assets/audio/adhkar/adhkar_283.mp3 \
  -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[a]" -map "[a]" -map_metadata -1 \
  -c:a libmp3lame -b:a 128k -ar 44100 -ac 1 \
  assets/audio/adhkar/adhkar_quranic_16.mp3
ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/adhkar/adhkar_quranic_16.mp3
```

Expected: a duration between 35.8 and 36.0 seconds. Listen once (`afplay assets/audio/adhkar/adhkar_quranic_16.mp3`): it should recite all of 3:193, "رَبَّنَا إِنَّنَا سَمِعْنَا مُنَادِيًا ... وَتَوَفَّنَا مَعَ الْأَبْرَارِ", with no gap or click at the join.

- [ ] **Step 4: Add the audio fixes and apply them**

In `scripts/adhkar-content/adhkarFixes.ts`, add this block after `applyTextFixes`:

```ts
// ---- Audio mapping (audit 04, section A; audit 03 for 72 and 149) ----------

export const AUDIO_FIXES: Readonly<Record<string, string | null>> = {
  'quranic-5': null,
  'quranic-6': 'adhkar_272.mp3',
  'quranic-7': 'adhkar_273.mp3',
  'quranic-8': 'adhkar_274.mp3',
  'quranic-9': 'adhkar_275.mp3',
  'quranic-10': 'adhkar_276.mp3',
  'quranic-11': 'adhkar_277.mp3',
  'quranic-12': 'adhkar_278.mp3',
  'quranic-13': 'adhkar_279.mp3',
  'quranic-14': 'adhkar_280.mp3',
  'quranic-15': 'adhkar_281.mp3',
  'quranic-16': 'adhkar_quranic_16.mp3',
  'quranic-29': 'adhkar_297.mp3',
  'quranic-30': null,
  'quranic-37': 'adhkar_305.mp3',
  'quranic-38': 'adhkar_306.mp3',
  'quranic-39': 'adhkar_307.mp3',
  'quranic-40': null,
  '72': null,
  '149': null,
};

export function applyAudioFixes(seed: SeedFile): SeedFile {
  return {
    ...seed,
    adhkar: seed.adhkar.map(row =>
      Object.hasOwn(AUDIO_FIXES, row.id)
        ? {...row, audio_file: AUDIO_FIXES[row.id]}
        : row,
    ),
  };
}
```

Insert the step into `FIX_STEPS`, directly before `seed => recountCategories(seed),`:

```ts
  seed => applyAudioFixes(seed),
```

Run: `npx tsx scripts/adhkar-content/apply-content-fixes.ts`
Expected: `[adhkar] wrote data/adhkar.json`.

- [ ] **Step 5: Update the bundle map and remove the unreferenced clips**

In `utils/adhkarAudio.ts`:

1. Change header line 8 from `* Contains mappings for all 406 dhikr audio files (267 adhkar + 40 Quranic duas + 99 Names of Allah).` to:
   ```ts
    * Contains a mapping for every audio file a dhikr row references (rows with no correct recording have audio_file null).
   ```
2. Delete these six lines:
   - `'adhkar_72.mp3': require('@/assets/audio/adhkar/adhkar_72.mp3'),`
   - `'adhkar_149.mp3': require('@/assets/audio/adhkar/adhkar_149.mp3'),`
   - `'adhkar_282.mp3': require('@/assets/audio/adhkar/adhkar_282.mp3'),`
   - `'adhkar_283.mp3': require('@/assets/audio/adhkar/adhkar_283.mp3'),`
   - `'adhkar_296.mp3': require('@/assets/audio/adhkar/adhkar_296.mp3'),`
   - `'adhkar_304.mp3': require('@/assets/audio/adhkar/adhkar_304.mp3'),`
3. Add this line directly after `'adhkar_281.mp3': require('@/assets/audio/adhkar/adhkar_281.mp3'),`:
   ```ts
     'adhkar_quranic_16.mp3': require('@/assets/audio/adhkar/adhkar_quranic_16.mp3'),
   ```

Then confirm that nothing else references the removed files, and remove them:

```bash
grep -rn "adhkar_72\.mp3\|adhkar_149\.mp3\|adhkar_282\.mp3\|adhkar_283\.mp3\|adhkar_296\.mp3\|adhkar_304\.mp3" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.js' . | grep -v node_modules
```

Expected: no output. If there is output, stop and report it instead of deleting.

```bash
git rm assets/audio/adhkar/adhkar_72.mp3 assets/audio/adhkar/adhkar_149.mp3 assets/audio/adhkar/adhkar_282.mp3 assets/audio/adhkar/adhkar_283.mp3 assets/audio/adhkar/adhkar_296.mp3 assets/audio/adhkar/adhkar_304.mp3
```

- [ ] **Step 6: Fingerprint and run the tests**

Run: `npx tsx scripts/adhkar-content/write-data-fingerprint.ts`
Expected: the version 6 fingerprint is updated.

Run: `npx jest scripts/__tests__/adhkarFixes.test.ts services/adhkar services/database`
Expected: PASS.

- [ ] **Step 7: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write scripts/adhkar-content/adhkarFixes.ts utils/adhkarAudio.ts services/adhkar/__tests__/adhkarAudioAssets.test.ts services/adhkar/__tests__/adhkarSeed.test.ts
git add scripts/adhkar-content/adhkarFixes.ts utils/adhkarAudio.ts services/adhkar/__tests__ data/adhkar.json services/database/__tests__/fixtures/adhkar-data-fingerprints.json assets/audio/adhkar/adhkar_quranic_16.mp3
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "fix(adhkar): play the right clip for each Quranic dua and drop wrong recordings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

Note: `scripts/upload-adhkar-audio.ts` mirrors the clips to R2. It is not needed for the app, which bundles the audio. Uploading `adhkar_quranic_16.mp3` is a separate decision; see Notes.

---

### Task 7: Play All skips rows without audio

**Files:**
- Modify: `store/adhkarPlayAllStore.ts` (imports, interface, `startPlayAll`, `advanceToNext`, `goToIndex`, `play`)
- Modify: `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx` (`handlePlayAll`, :199-247)
- Modify: `app/(tabs)/(a.home)/adhkar/saved/index.tsx` (`handlePlayAll`, :78-99)
- Modify: `components/adhkar/AdhkarAudioControls.tsx` (the `if (!audioFile)` branch, :131)
- Create: `store/__tests__/adhkarPlayAllStore.test.ts`

**Interfaces:**
- Consumes: `hasAudio(audioFile: string | null): boolean` from `utils/adhkarAudio.ts` (existing).
- Produces:
  - `nextPlayableIndex(queue: readonly Dhikr[], from: number): number`
  - `startPlayAll(...)` now returns `number`: the index playback starts at, or `-1` when no row in the list has audio.
- Invariant: when `isPlaying` is true, the current row has audio.

- [ ] **Step 1: Write the failing test**

Create `store/__tests__/adhkarPlayAllStore.test.ts`:

```ts
jest.mock('@/utils/adhkarAudio', () => ({
  hasAudio: (file: string | null) => file !== null && file.startsWith('ok'),
  getAudioSource: (file: string | null) =>
    file !== null && file.startsWith('ok') ? 1 : null,
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({playback: {state: 'idle'}, pause: jest.fn()}),
  },
}));
import {nextPlayableIndex, useAdhkarPlayAllStore} from '../adhkarPlayAllStore';
import type {Dhikr} from '@/types/adhkar';

function dhikr(id: string, audioFile: string | null): Dhikr {
  return {
    id,
    categoryId: '27',
    arabic: id,
    translation: null,
    transliteration: null,
    instruction: null,
    repeatCount: 1,
    audioFile,
    sortOrder: 0,
  };
}

// b has no audio; c names a file that is not bundled.
const queue = [
  dhikr('a', 'ok_a.mp3'),
  dhikr('b', null),
  dhikr('c', 'missing.mp3'),
  dhikr('d', 'ok_d.mp3'),
];

function state(): ReturnType<typeof useAdhkarPlayAllStore.getState> {
  return useAdhkarPlayAllStore.getState();
}

beforeEach(() => state().stopPlayAll());

describe('nextPlayableIndex', () => {
  it('finds the first row with bundled audio at or after an index', () => {
    expect(nextPlayableIndex(queue, 0)).toBe(0);
    expect(nextPlayableIndex(queue, 1)).toBe(3);
    expect(nextPlayableIndex(queue, 4)).toBe(-1);
    expect(nextPlayableIndex([dhikr('x', null)], 0)).toBe(-1);
  });
});

describe('Play All with rows without audio', () => {
  it('starts at the first playable row and reports where', () => {
    const start = state().startPlayAll(queue.slice(1), 0, 'evening', 'evening-adhkar');
    expect(start).toBe(2);
    expect(state().currentIndex).toBe(2);
    expect(state().isPlaying).toBe(true);
  });

  it('does not start when no row has audio', () => {
    expect(
      state().startPlayAll([dhikr('x', null)], 0, 'other', 'x'),
    ).toBe(-1);
    expect(state().isPlayAllMode).toBe(false);
  });

  it('skips rows without audio when a track ends, and stops at the end', () => {
    state().startPlayAll(queue, 0, 'evening', 'evening-adhkar');
    expect(state().advanceToNext()).toBe(true);
    expect(state().currentIndex).toBe(3);
    expect(state().advanceToNext()).toBe(false);
    expect(state().isPlayAllMode).toBe(false);
  });

  it('pauses instead of freezing when the user swipes onto a row without audio', () => {
    state().startPlayAll(queue, 0, 'evening', 'evening-adhkar');
    state().goToIndex(1);
    expect(state().currentIndex).toBe(1);
    expect(state().isPlaying).toBe(false);
    state().goToIndex(3);
    expect(state().currentIndex).toBe(3);
    expect(state().isPlaying).toBe(false);
  });

  it('play on a row without audio moves on to the next playable row', () => {
    state().startPlayAll(queue, 0, 'evening', 'evening-adhkar');
    state().goToIndex(1);
    state().play();
    expect(state().currentIndex).toBe(3);
    expect(state().isPlaying).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest store/__tests__/adhkarPlayAllStore.test.ts`
Expected: FAIL. `nextPlayableIndex` is not exported, and `startPlayAll` returns `undefined`.

- [ ] **Step 3: Implement the store changes**

In `store/adhkarPlayAllStore.ts`:

(a) Add this import after `import {usePlayerStore} from '@/services/player/store/playerStore';`:

```ts
import {hasAudio} from '@/utils/adhkarAudio';
```

(b) Add this function after `type SourceType = ...;`:

```ts
/** First index at or after `from` whose dhikr has bundled audio, or -1. */
export function nextPlayableIndex(queue: readonly Dhikr[], from: number): number {
  for (let i = Math.max(0, from); i < queue.length; i++) {
    if (hasAudio(queue[i].audioFile)) return i;
  }
  return -1;
}
```

(c) In `AdhkarPlayAllActions`, replace the `startPlayAll` member with:

```ts
  // Start Play All with a list of adhkar. Returns the index playback starts
  // at (the first row with audio at or after startIndex), or -1 if none.
  startPlayAll: (
    adhkarList: Dhikr[],
    startIndex: number,
    sourceType: SourceType,
    sourceId: string,
  ) => number;
```

(d) Replace the `startPlayAll` implementation with:

```ts
  startPlayAll: (adhkarList, startIndex, sourceType, sourceId) => {
    const first = nextPlayableIndex(
      adhkarList,
      Math.min(startIndex, adhkarList.length - 1),
    );
    if (first < 0) return -1;

    // Stop single-dhikr playback
    useAdhkarAudioStore.getState().pause();

    // Pause main Quran player if it's playing
    const mainPlayerState = usePlayerStore.getState();
    if (mainPlayerState.playback.state === 'playing') {
      mainPlayerState.pause();
    }

    set({
      isPlayAllMode: true,
      queue: adhkarList,
      currentIndex: first,
      sourceType,
      sourceId,
      isPlaying: true,
    });
    return first;
  },
```

(e) Replace the `advanceToNext` implementation with:

```ts
  advanceToNext: () => {
    const {queue, currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode) return false;

    // Rows without audio are skipped; they have nothing to play.
    const next = nextPlayableIndex(queue, currentIndex + 1);
    if (next >= 0) {
      set({currentIndex: next});
      return true;
    }
    // End of queue - stop Play All
    get().stopPlayAll();
    return false;
  },
```

(f) Replace the `goToIndex` implementation with:

```ts
  goToIndex: index => {
    const {queue, isPlayAllMode} = get();
    if (!isPlayAllMode) return;

    if (index >= 0 && index < queue.length) {
      // A row without audio cannot play: pause there instead of leaving the
      // player waiting on a track that never starts.
      if (hasAudio(queue[index].audioFile)) {
        set({currentIndex: index});
      } else {
        set({currentIndex: index, isPlaying: false});
      }
    }
  },
```

(g) Replace the `play` implementation with:

```ts
  play: () => {
    const {isPlayAllMode, queue, currentIndex} = get();
    if (!isPlayAllMode) return;

    const playable = nextPlayableIndex(queue, currentIndex);
    if (playable < 0) {
      get().stopPlayAll();
      return;
    }

    // Pause main Quran player if it's playing
    const mainPlayerState = usePlayerStore.getState();
    if (mainPlayerState.playback.state === 'playing') {
      mainPlayerState.pause();
    }

    set({currentIndex: playable, isPlaying: true});
  },
```

- [ ] **Step 4: Navigate to the index Play All started at**

In `app/(tabs)/(a.home)/adhkar/[superId]/index.tsx`, in `handlePlayAll`, replace the block from `startPlayAll(allAdhkarForPlayAll, 0, sourceType, superId);` through the end of the `router.push({...});` call with:

```ts
    const startIndex = startPlayAll(allAdhkarForPlayAll, 0, sourceType, superId);
    if (startIndex < 0) return;

    // Navigate to reader at the first dhikr that has audio
    const firstDhikr = allAdhkarForPlayAll[startIndex];
    const firstGroup = categoryGroups.find(group =>
      group.adhkar.some(d => d.id === firstDhikr.id),
    );
    const firstCategoryTitle = firstGroup
      ? shortenCategoryTitle(firstGroup.categoryTitle)
      : '';

    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {
        superId,
        dhikrId: firstDhikr.id,
        globalIndex: String(startIndex),
        categoryShortTitle: firstCategoryTitle,
        superCategoryTitle: superCategory?.title,
        playAll: 'true',
      },
    });
```

In `app/(tabs)/(a.home)/adhkar/saved/index.tsx`, in `handlePlayAll`, replace the block from `startPlayAll(adhkarList, 0, 'saved', 'saved');` through the end of the `router.push({...});` call with:

```ts
    const startIndex = startPlayAll(adhkarList, 0, 'saved', 'saved');
    if (startIndex < 0) return;

    // Navigate to reader at the first dhikr that has audio
    const firstDhikr = adhkarList[startIndex];
    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/saved/[dhikrId]',
      params: {
        dhikrId: firstDhikr.id,
        globalIndex: String(startIndex),
        playAll: 'true',
      },
    });
```

- [ ] **Step 5: Hide play for rows whose clip is not bundled**

`AdhkarAudioControls` already shows the no-audio layout (muted icon, disabled repeat button) when `audioFile` is null. Make it also do so when the name is set but the file is not bundled.

In `components/adhkar/AdhkarAudioControls.tsx`:
- add `import {hasAudio} from '@/utils/adhkarAudio';` to the imports;
- change `if (!audioFile) {` (the `// No audio available` branch) to:

```ts
      if (!hasAudio(audioFile)) {
```

There is no new automated test for this one-line change: the component needs the theme, reanimated and slider providers. Task 9 covers it by hand.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest store/__tests__/adhkarPlayAllStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write store/adhkarPlayAllStore.ts store/__tests__/adhkarPlayAllStore.test.ts "app/(tabs)/(a.home)/adhkar/[superId]/index.tsx" "app/(tabs)/(a.home)/adhkar/saved/index.tsx" components/adhkar/AdhkarAudioControls.tsx
git add store/adhkarPlayAllStore.ts store/__tests__/adhkarPlayAllStore.test.ts "app/(tabs)/(a.home)/adhkar/[superId]/index.tsx" "app/(tabs)/(a.home)/adhkar/saved/index.tsx" components/adhkar/AdhkarAudioControls.tsx
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "fix(adhkar): skip adhkar without audio in Play All instead of freezing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 8: Play All no longer stalls on clips under 2 seconds

**Files:**
- Create: `utils/adhkarTrackEnd.ts`
- Create: `utils/__tests__/adhkarTrackEnd.test.ts`
- Modify: `components/adhkar/AdhkarAudioProvider.tsx`: imports (:10-15) and the end-detection effect (:139-186)

**Interfaces:**
- Produces:
  - `interface TrackEndStatus {currentTime: number; duration: number; playing: boolean; didJustFinish: boolean}`
  - `minimumPlayTimeMs(durationSec: number): number`
  - `isTrackFinished(status: TrackEndStatus, elapsedMs: number): boolean`

Today the provider treats a track as finished only after more than 2000 ms of wall time. The 31 clips shorter than 2 s (mostly Names of Allah, plus row 241 at 1.93 s; audit 03) can send their final status before that, after which no further update arrives and Play All hangs. The guard is meant to ignore stale status from the previous track, so it is now capped at half the clip's duration. The rule also accepts expo-audio's `didJustFinish`.

- [ ] **Step 1: Write the failing test**

Create `utils/__tests__/adhkarTrackEnd.test.ts`:

```ts
import {isTrackFinished, minimumPlayTimeMs} from '../adhkarTrackEnd';

describe('minimumPlayTimeMs', () => {
  it('waits 2 s for long or unknown tracks and half the length of short ones', () => {
    expect(minimumPlayTimeMs(30)).toBe(2000);
    expect(minimumPlayTimeMs(0)).toBe(2000);
    expect(minimumPlayTimeMs(1.05)).toBe(525);
    expect(minimumPlayTimeMs(1.93)).toBe(965);
  });
});

describe('isTrackFinished', () => {
  const ended = {currentTime: 1.05, duration: 1.05, playing: false, didJustFinish: false};

  it('finishes a 1.05 s clip whose final status arrives at 1.1 s', () => {
    expect(isTrackFinished(ended, 1100)).toBe(true);
  });

  it('ignores a stale ended status right after the track changes', () => {
    expect(isTrackFinished(ended, 100)).toBe(false);
    expect(
      isTrackFinished({currentTime: 30, duration: 30, playing: false, didJustFinish: false}, 1500),
    ).toBe(false);
  });

  it('accepts didJustFinish even when currentTime lags behind', () => {
    expect(
      isTrackFinished({currentTime: 0.9, duration: 1.05, playing: false, didJustFinish: true}, 1100),
    ).toBe(true);
  });

  it('does not finish a track that is still playing or paused midway', () => {
    expect(
      isTrackFinished({currentTime: 1.05, duration: 1.05, playing: true, didJustFinish: false}, 3000),
    ).toBe(false);
    expect(
      isTrackFinished({currentTime: 10, duration: 30, playing: false, didJustFinish: false}, 12000),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest utils/__tests__/adhkarTrackEnd.test.ts`
Expected: FAIL, "Cannot find module '../adhkarTrackEnd'".

- [ ] **Step 3: Implement the rule**

Create `utils/adhkarTrackEnd.ts`:

```ts
// utils/adhkarTrackEnd.ts
// When an adhkar track counts as finished (Play All advances, single mode
// rewinds). The wall-time guard ignores a stale "ended" status left over from
// the previous track, but it must stay shorter than the clip itself: the 99
// Names clips run 1 to 2 seconds.

export interface TrackEndStatus {
  currentTime: number;
  duration: number;
  playing: boolean;
  didJustFinish: boolean;
}

const MAX_GUARD_MS = 2000;

export function minimumPlayTimeMs(durationSec: number): number {
  if (durationSec <= 0) return MAX_GUARD_MS;
  return Math.min(MAX_GUARD_MS, durationSec * 500);
}

export function isTrackFinished(
  status: TrackEndStatus,
  elapsedMs: number,
): boolean {
  if (elapsedMs < minimumPlayTimeMs(status.duration)) return false;
  if (status.didJustFinish) return true;
  return (
    status.duration > 0 &&
    status.currentTime >= status.duration - 0.1 &&
    !status.playing
  );
}
```

- [ ] **Step 4: Use it in the provider**

In `components/adhkar/AdhkarAudioProvider.tsx`, add this import after `import {getAudioSource} from '@/utils/adhkarAudio';`:

```ts
import {isTrackFinished} from '@/utils/adhkarTrackEnd';
```

In the end-detection effect, replace everything from `const currentTime = status.currentTime ?? 0;` through the closing `) {` of the `if (` condition. That is, these lines:

```ts
    const currentTime = status.currentTime ?? 0;
    const duration = status.duration ?? 0;

    // Ensure the track has been playing for at least 2 seconds
    // This prevents false triggers during track transitions when status may have stale values
    const timeSinceStart = Date.now() - trackStartTime.current;
    const minimumPlayTime = 2000; // 2 seconds

    if (
      duration > 0 &&
      currentTime >= duration - 0.1 &&
      !status.playing &&
      timeSinceStart > minimumPlayTime
    ) {
```

with:

```ts
    // The time guard skips stale status from the previous track; it scales
    // down for clips shorter than 4 s (see utils/adhkarTrackEnd.ts).
    const finished = isTrackFinished(
      {
        currentTime: status.currentTime ?? 0,
        duration: status.duration ?? 0,
        playing: status.playing,
        didJustFinish: status.didJustFinish,
      },
      Date.now() - trackStartTime.current,
    );

    if (finished) {
```

Leave the body of the `if` (`hasHandledEnd.current = true; ...`) unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest utils/__tests__/adhkarTrackEnd.test.ts store/__tests__/adhkarPlayAllStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck, format, commit**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
npx prettier --write utils/adhkarTrackEnd.ts utils/__tests__/adhkarTrackEnd.test.ts components/adhkar/AdhkarAudioProvider.tsx
git add utils/adhkarTrackEnd.ts utils/__tests__/adhkarTrackEnd.test.ts components/adhkar/AdhkarAudioProvider.tsx
git diff --cached | grep -n $'\xe2\x80\x94' || true
git commit -m "fix(adhkar): advance Play All after clips shorter than two seconds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011eqXmha1bR7cUTY365d9K1"
```

---

### Task 9: Whole-branch verification

**Files:** none changed, unless a check fails. In that case, fix the issue in the task that owns the file and re-run.

- [ ] **Step 1: Run every touched suite together**

Run: `npx jest services/database services/adhkar services/widgets store utils scripts/__tests__ modules/bayaan-widgets config`
Expected: PASS, no skipped suites.

- [ ] **Step 2: Typecheck, format check, no em dashes**

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
git diff --name-only origin/develop -- '*.ts' '*.tsx' | xargs npx prettier --check
git diff origin/develop | grep -n $'\xe2\x80\x94' || echo "no em dashes"
```

Expected: tsc prints nothing, prettier says "All matched files use Prettier code style!", and the last command prints `no em dashes`.

- [ ] **Step 3: Confirm the data is in sync and idempotent**

```bash
npx tsx scripts/adhkar-content/apply-content-fixes.ts
npx tsx scripts/adhkar-content/write-data-fingerprint.ts
npm run generate:widget-data
git status --short
```

Expected:
- the apply script prints `already up to date`;
- the fingerprint script prints the same hash as in the fixture;
- the widget generator leaves no diff;
- `git status --short` is empty.

- [ ] **Step 4: Manual QA on a simulator**

Per project memory, prefer the cloud simulator build from PR #333 over local native builds. A JS-only Metro run against an existing dev client is fine.

1. **Upgrade path.** Install the current develop build and open Adhkar so data version 5 is seeded. Save rows 77 and 83, and count a few taps on a Tasbeeh widget for 91. Then load this branch. Expected:
   - Saved still shows 77 (now without the bracketed evening note) and 83 (badge "Recite 7 times");
   - the tasbeeh count is kept.
2. **Morning:** 23 items. 97 is absent; 93, 94 and 95 are present.
3. **Evening:** 21 items. The third item starts "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ"; 93, 94 and 95 are absent; 97 is present. Superseded by the Task 6 addenda (2026-10-12/13): every row now has audio.
4. **Play All on Evening.** Play All on Evening plays every row in Alafasy's voice; swipe by hand to 82 mid-play and Play All continues from there.
5. **Play All on 99 Names.** It runs through to the end without stalling on short names (for example name-67, about 1.05 s).
6. **Quranic Duas.** quranic-6 plays "ربنا لا تؤاخذنا إن نسينا أو أخطأنا". quranic-16 plays the full 3:193. quranic-5, quranic-30 and quranic-40 now play.
7. **Widgets** (needs a native build; do this only in the release build pass): the evening adhkar widget never shows 94, and the count reads 21.

- [ ] **Step 5: Hand off**

Hand off to the controller. The controller pushes and opens the PR against `develop` with the PR footer from the session attribution. The PR description must:
- link the spec document;
- say that the six evening texts are awaiting Osman's review, and that nothing ships before it.

---

## Notes

**Out of scope (a separate, later PR):**
1. The 99 Names meanings rewrite (machine-translated from French; name-50 is still French).
2. The transliteration overhaul: 149 machine-romanized and 31 truncated rows, plus the 205 rows that show a transliteration in the "instruction" slot. This includes extending quranic-35's transliteration to the new end of 40:9, and transliterations for evening-77, evening-80, evening-81 and evening-90.
3. Rendering of the `(( ))` markers and bracketed alternatives in the reader, copy and share.
4. Digital Khatt (SkiaVerseText) for Quran text inside adhkar (Ayat al-Kursi, the Quls, the 40 Quranic duas).
5. Loudness normalization and peak limiting (207 clips above 0 dBFS; rows 72, 73 and 143 about 6 LU quiet), and re-encoding name-67 (AAC in an .mp3 file).
6. Sourcing new audio: evening recordings, plus quranic-5, quranic-30, quranic-40, row 72 and row 149. Superseded by the Task 6 addenda (2026-10-12/13): every row now has audio.

**Also deferred:**
- Making `seedDatabase` transactional (audit 05, B3).
- Reaching the orphan category 132, home of row 267 (no super category lists it).
- Row 114's missing four steps in Arabic.
- Row 197 ("وَلَكَ" only).
- The partial audio for quranic-26 and quranic-33.
- The narrator intro on row 75's audio.
- The stale `meta` block in `data/adhkar.json`.
- Per-period tasbeeh counts (`dhikr_counts` is keyed by `dhikr_id`, so shared rows share one daily count).

**R2 mirror:** `scripts/upload-adhkar-audio.ts` mirrors `assets/audio/adhkar` to `cdn.thebayaan.com/adkhar/`. The app does not read from it. Upload `adhkar_quranic_16.mp3` only if the web or TV app later uses that mirror.

**Session widget branch:** `feat/adhkar-session-widget` (not on develop) builds the session `items` from category 27. After this PR merges, that branch must build `items` and `count` from `super_category_dhikr_ids` through `parseAdhkarSeedLists`. Otherwise the evening session shows the evening rows mixed in with the morning ones.

**Bumping the data version:** `ADHKAR_DATA_VERSION` is bumped once in this PR. Tasks 5 and 6 refresh the version 6 fingerprint, and they must not bump again before the release.
