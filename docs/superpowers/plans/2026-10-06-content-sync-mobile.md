# Content Sync Mobile Implementation Plan (Sub-project A, device side, tafsir first)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic device-side content engine that keeps installed content in step with the backend manifest (silent updates, automatic purge on withdrawal), and move tafsir onto it so the app no longer calls unauthenticated `api.quran.com` and no longer bundles Ibn Kathir.

**Architecture:** `services/content/` holds a pure engine (`runContentCheck`, `installResource`, `removeResource`) that depends on four injected ports: a backend API client, a local registry (`content.db`), per-kind installers, and a network probe. The tafsir installer parses QF snapshots into the existing `tafaseer.db` rows, so the tafsir reader is unchanged. A foreground hook runs the check at most daily and always after 7 days.

**Tech Stack:** Expo SDK 56, React Native, TypeScript strict, Zustand, `expo-sqlite`, `expo-crypto`, `@react-native-community/netinfo`, `burnt` toasts via `utils/toastUtils.ts`, Jest (`jest-expo` preset).

**Spec:** `docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md`. Read sections 3, 6.6, 7, 8, 10, 11a. The backend contract this plan consumes is implemented by `docs/superpowers/plans/2026-10-06-content-sync-backend.md`.

**Repo / branch:** `thebayaan/Bayaan`, new branch `feat/content-sync-tafsir` from `origin/develop`. PR targets `develop`.

**Scope note:** The translation half of spec 7.7 (AlQuranCloud crosswalk, removing bundled Saheeh, QF footnote rendering) ships with sub-project C, because installing translations from QF needs the picker, identifier and footnote work that C owns. This plan builds the engine generically and completes tafsir end to end. The spec is updated accordingly in Task 0.

## Global Constraints

- Backend endpoints: `GET {base}/v1/content/manifest?kinds=tafsir` and `GET {base}/v1/content/resources/{encodeURIComponent(key)}/download`, header `Authorization: Bearer ${EXPO_PUBLIC_BAYAAN_API_KEY}`.
- `{base}` is `branding.contentApiBase ?? process.env.EXPO_PUBLIC_BAYAAN_API_URL`. If both are unset, the engine is a no-op.
- Manifest `format` must be `1`; unknown formats are ignored (no purge).
- Supported QF `upstream_schema_version` for tafsir: `{1}`.
- Integrity: `sha256` in the manifest/download ticket is the lowercase hex SHA-256 of the **decompressed** envelope text. Verify with `Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text)` before parsing.
- Cadence: check on app foreground when the last successful check is older than 24 hours; always when older than 7 days. Never more than once per 24 hours otherwise.
- Updates larger than 5,000,000 bytes wait for Wi-Fi. Withdrawals apply immediately.
- Per-resource failure backoff: 1 hour, 6 hours, then 24 hours (cap).
- Purge only after a successful `200` manifest. A network error, non-200, `304`, malformed body, or `paused: true` never removes anything.
- Withdrawn tafsir fallback: another installed tafsir, else `null` (existing empty state). The selection in `useTafseerStore` must actually change.
- Notice copy: `"{name} was withdrawn by its publisher via Quran Foundation."` shown once per key.
- Tafsir keys are `qf:tafsirs:{id}`; the existing tafsir `identifier` in `tafaseer.db` stays the bare QF id string (for example `"169"`).
- Auto-install on first launch: `qf:tafsirs:169` once, over any network, unless the user removed it.
- Forks: if `branding.tafsirProvider` is set, tafsir downloads keep using it (RFC-009) and the engine does not manage tafsir.
- TypeScript strict, no `any`, no `as` casts except at JSON boundaries behind type guards, `function` keyword for pure functions, no new classes.
- No em dashes anywhere. Commits: conventional, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before finishing: `npx tsc --noEmit`, `npx prettier --write` on changed files, `npx jest` all green.

## Review Focus

1. **Android does not transparently decompress the presigned R2 response** (the object is stored with `Content-Encoding: gzip`). Expected: the SHA check fails, the update is rejected and retried with backoff, the old copy keeps working. Task 5's `installResource` test shows a SHA mismatch is rejected without installing and backs off; manual QA in Task 9 must confirm a real download succeeds on a physical Android device and iOS.
2. **The app is killed in the middle of an install.** Expected: the previous tafsir rows remain (single SQLite transaction) and the registry version is unchanged, so the next check reinstalls. Task 5 tests that a failing installer leaves the registry version untouched.
3. **A manifest arrives that is valid JSON but empty or truncated** (for example `resources: []` after a backend bug). Expected: purge everything only if the backend says so explicitly; an empty list from a valid `200` is honored, but a body that fails the shape guard is ignored. Task 2 tests the shape guard (`isManifest`); Task 5 tests that error, 304 and paused manifests purge nothing.
4. **The user deletes the auto-installed Ibn Kathir.** Expected: it never comes back automatically, even after reinstalling an update or a new manifest. Task 7 tests that `user_removed` blocks auto-install.
5. **The selected tafsir is withdrawn while the tafsir sheet is open.** Expected: the selection switches to a fallback and the sheet shows the fallback or empty state on next render instead of crashing. Task 6 tests the store update; Task 9 manual QA covers the open-sheet case.

---

## File Structure

| File | Responsibility |
|---|---|
| `types/content.ts` | Manifest, ticket, envelope, registry row and installer types |
| `services/content/contentApi.ts` | Backend client: manifest (ETag), download ticket, fetch text |
| `services/content/contentRegistry.ts` | `content.db`: `content_local` and `content_state` tables |
| `services/content/tafsirSnapshot.ts` | Pure parser: QF tafsir snapshot to `TafseerVerse[]` |
| `services/content/contentEngine.ts` | Pure engine: compare, update, purge, backoff, install, remove |
| `services/content/tafsirInstaller.ts` | Tafsir installer: writes `tafaseer.db`, withdrawal fallback |
| `services/content/contentNotices.ts` | One-time withdrawal toasts |
| `services/content/contentSync.ts` | Wires real ports, foreground hook, public API used by stores |
| `services/content/legacyMigration.ts` | One-time migration of existing tafsir downloads |
| `config/branding.d.ts` (modify) | `contentApiBase?: string` slot |
| `services/analytics/events.ts`, `AnalyticsService.ts` (modify) | Three content events |
| `store/tafseerStore.ts` (modify) | Downloads and deletes go through the engine |
| `services/AppInitializer.ts`, `services/tafseer/TafseerDbService.ts` (modify) | Remove bundled Ibn Kathir import |
| `data/ibn-kathir-tafseer-compact.json` (delete) | Bundled QF content removed |
| `app/_layout.tsx` (modify) | Start content sync after app init |

---

### Task 0: Branch and spec scope note

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md`

- [ ] **Step 1: Create the branch**

```bash
git fetch origin
git checkout -b feat/content-sync-tafsir origin/develop
```

- [ ] **Step 2: Add the scope note to the spec**

At the end of spec section 7.7, add:

```md
**Delivery split (2026-10-06):** the tafsir half of this section ships with the first mobile plan (`docs/superpowers/plans/2026-10-06-content-sync-mobile.md`). The translation half (AlQuranCloud crosswalk, removing bundled Saheeh, QF footnote rendering, translation installer) ships with sub-project C, because installing translations from QF depends on C's picker, identifier and footnote work. Until C lands, translations keep downloading from AlQuranCloud (not a QF endpoint) and bundled Saheeh remains.
```

Also change the branding slot name in spec 7.3 from `contentManifestEndpoint` to `contentApiBase` (a base URL used for both manifest and download).

- [ ] **Step 3: Commit**

```bash
npx prettier --write docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md
git add docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md
git commit -m "docs: split content sync mobile delivery into tafsir first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Types and branding slot

**Files:**
- Create: `types/content.ts`
- Modify: `config/branding.d.ts`

**Interfaces:**
- Produces (`types/content.ts`):
  ```ts
  export type ContentKind = 'tafsir' | 'translation';
  export interface ContentMeta { name?: string; author?: string | null; language?: string; direction?: 'ltr' | 'rtl'; slug?: string; attribution?: string }
  export interface ManifestEntry { key: string; kind: ContentKind; source: string; version: number; status: 'active' | 'withdrawn'; upstream_schema_version?: number; bytes?: number; sha256?: string; meta?: ContentMeta; withdrawn_reason?: string | null }
  export interface Manifest { format: 1; generated_at: string; paused: boolean; resources: ManifestEntry[] }
  export interface DownloadTicket { url: string; version: number; sha256: string; bytes: number; expires_at: string }
  export interface QfSnapshot { resource_group: string; resource_id: number; schema_version: number; records: Array<Record<string, unknown>> }
  export interface ContentEnvelope { envelope: 1; key: string; version: number; source: string; fetched_at: string; snapshot: QfSnapshot }
  export interface LocalContentRow { key: string; kind: ContentKind; version: number; sha256: string | null; upstream_schema_version: number | null; installed_at: number | null; legacy: boolean; user_removed: boolean; failures: number; next_retry_at: number | null; withdrawal_notified: boolean; name: string | null }
  export interface WithdrawalNotice { key: string; name: string }
  export interface ContentInstaller {
    kind: ContentKind;
    supportsSchemaVersion(version: number): boolean;
    install(key: string, envelope: ContentEnvelope, meta: ContentMeta | undefined): Promise<void>;
    remove(key: string): Promise<void>;
    onWithdrawn(key: string): Promise<void>;
  }
  ```
- Produces (`config/branding.d.ts`): optional `contentApiBase?: string`.

- [ ] **Step 1: Create `types/content.ts`**

Write the file with exactly the declarations listed above, adding a header comment: `// Content freshness layer (spec 2026-10-05). Shapes match the backend manifest and envelope.`

- [ ] **Step 2: Add the branding slot**

In `config/branding.d.ts`, next to `catalogVersionEndpoint`, add:

```ts
  /**
   * Base URL for the content freshness API (manifest and downloads).
   * Absent: Bayaan's backend (`EXPO_PUBLIC_BAYAAN_API_URL`). Forks point
   * this at their own backend, or leave it unset to reuse Bayaan's.
   * No trailing slash.
   */
  contentApiBase?: string;
```

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
npx prettier --write types/content.ts config/branding.d.ts
git add types/content.ts config/branding.d.ts
git commit -m "feat(content): add content sync types and branding slot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend content API client

**Files:**
- Create: `services/content/contentApi.ts`
- Test: `services/content/__tests__/contentApi.test.ts`

**Interfaces:**
- Consumes: types (Task 1).
- Produces:
  ```ts
  export type ManifestResult = { status: 'ok'; manifest: Manifest; etag: string | null } | { status: 'not_modified' } | { status: 'error'; reason: string };
  export interface ContentApi {
    fetchManifest(kinds: ContentKind[], etag: string | null): Promise<ManifestResult>;
    getDownloadTicket(key: string): Promise<DownloadTicket>;
    fetchText(url: string): Promise<string>;
  }
  export function isManifest(value: unknown): value is Manifest;
  export function createContentApi(base: string, apiKey: string, fetchImpl?: typeof fetch): ContentApi;
  export function resolveContentApiBase(): string | null;
  ```

- [ ] **Step 1: Write the failing tests**

`services/content/__tests__/contentApi.test.ts`:

```ts
import {createContentApi, isManifest} from '../contentApi';

const manifest = {
  format: 1,
  generated_at: '2026-10-06T00:00:00Z',
  paused: false,
  resources: [
    {key: 'qf:tafsirs:169', kind: 'tafsir', source: 'qf', version: 2, status: 'active', upstream_schema_version: 1, bytes: 3600000, sha256: 'a'.repeat(64), meta: {name: 'Ibn Kathir'}},
  ],
};

function respond(body: unknown, init: ResponseInit = {}) {
  return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), init));
}

describe('isManifest', () => {
  it('accepts a valid manifest and rejects malformed ones', () => {
    expect(isManifest(manifest)).toBe(true);
    expect(isManifest({...manifest, format: 2})).toBe(false);
    expect(isManifest({...manifest, resources: 'x'})).toBe(false);
    expect(isManifest({...manifest, resources: [{key: 'k'}]})).toBe(false);
    expect(isManifest(null)).toBe(false);
  });
});

describe('createContentApi', () => {
  it('sends the API key and kinds, and returns the ETag', async () => {
    const fetchImpl = jest.fn(() => respond(manifest, {status: 200, headers: {ETag: '"e1"'}}));
    const api = createContentApi('https://api.test', 'key-1', fetchImpl as unknown as typeof fetch);
    const result = await api.fetchManifest(['tafsir'], null);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/v1/content/manifest?kinds=tafsir', expect.objectContaining({headers: {Authorization: 'Bearer key-1'}}));
    expect(result).toEqual({status: 'ok', manifest, etag: '"e1"'});
  });

  it('sends If-None-Match and maps 304', async () => {
    const fetchImpl = jest.fn(() => respond('', {status: 304}));
    const api = createContentApi('https://api.test', 'k', fetchImpl as unknown as typeof fetch);
    expect(await api.fetchManifest(['tafsir'], '"e1"')).toEqual({status: 'not_modified'});
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({headers: {Authorization: 'Bearer k', 'If-None-Match': '"e1"'}}));
  });

  it('maps errors and malformed bodies to error results', async () => {
    const api500 = createContentApi('https://api.test', 'k', jest.fn(() => respond('x', {status: 500})) as unknown as typeof fetch);
    expect(await api500.fetchManifest(['tafsir'], null)).toEqual({status: 'error', reason: 'http_500'});
    const apiBad = createContentApi('https://api.test', 'k', jest.fn(() => respond({format: 1})) as unknown as typeof fetch);
    expect(await apiBad.fetchManifest(['tafsir'], null)).toEqual({status: 'error', reason: 'malformed'});
    const apiThrow = createContentApi('https://api.test', 'k', jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    expect(await apiThrow.fetchManifest(['tafsir'], null)).toEqual({status: 'error', reason: 'network'});
  });

  it('gets a download ticket for an encoded key', async () => {
    const ticket = {url: 'https://r2.test/x', version: 2, sha256: 'b'.repeat(64), bytes: 10, expires_at: 'z'};
    const fetchImpl = jest.fn(() => respond({data: ticket}));
    const api = createContentApi('https://api.test', 'k', fetchImpl as unknown as typeof fetch);
    expect(await api.getDownloadTicket('qf:tafsirs:169')).toEqual(ticket);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/v1/content/resources/qf%3Atafsirs%3A169/download', expect.anything());
  });

  it('throws when the ticket request fails', async () => {
    const api = createContentApi('https://api.test', 'k', jest.fn(() => respond('', {status: 404})) as unknown as typeof fetch);
    await expect(api.getDownloadTicket('qf:tafsirs:1')).rejects.toThrow('download_ticket_404');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest services/content/__tests__/contentApi.test.ts`
Expected: FAIL, cannot find module `../contentApi`.

- [ ] **Step 3: Implement `services/content/contentApi.ts`**

```ts
import branding from '@/config/branding';
import type {ContentKind, DownloadTicket, Manifest, ManifestEntry} from '@/types/content';

const MANIFEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export type ManifestResult =
  | {status: 'ok'; manifest: Manifest; etag: string | null}
  | {status: 'not_modified'}
  | {status: 'error'; reason: string};

export interface ContentApi {
  fetchManifest(kinds: ContentKind[], etag: string | null): Promise<ManifestResult>;
  getDownloadTicket(key: string): Promise<DownloadTicket>;
  fetchText(url: string): Promise<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown): value is ManifestEntry {
  if (!isRecord(value)) return false;
  if (typeof value.key !== 'string' || typeof value.kind !== 'string' || typeof value.version !== 'number') return false;
  if (value.status === 'withdrawn') return true;
  return value.status === 'active' && typeof value.sha256 === 'string' && typeof value.bytes === 'number';
}

export function isManifest(value: unknown): value is Manifest {
  return (
    isRecord(value) &&
    value.format === 1 &&
    typeof value.paused === 'boolean' &&
    Array.isArray(value.resources) &&
    value.resources.every(isEntry)
  );
}

function isTicket(value: unknown): value is DownloadTicket {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.version === 'number' &&
    typeof value.sha256 === 'string' &&
    typeof value.bytes === 'number'
  );
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function resolveContentApiBase(): string | null {
  const base = branding.contentApiBase ?? process.env.EXPO_PUBLIC_BAYAAN_API_URL;
  return base ? base.replace(/\/+$/, '') : null;
}

export function createContentApi(base: string, apiKey: string, fetchImpl: typeof fetch = fetch): ContentApi {
  const auth = {Authorization: `Bearer ${apiKey}`};
  return {
    async fetchManifest(kinds, etag) {
      try {
        const response = await withTimeout(MANIFEST_TIMEOUT_MS, signal =>
          fetchImpl(`${base}/v1/content/manifest?kinds=${kinds.join(',')}`, {
            headers: etag ? {...auth, 'If-None-Match': etag} : auth,
            signal,
          }),
        );
        if (response.status === 304) return {status: 'not_modified'};
        if (!response.ok) return {status: 'error', reason: `http_${response.status}`};
        const body: unknown = await response.json();
        if (!isManifest(body)) return {status: 'error', reason: 'malformed'};
        return {status: 'ok', manifest: body, etag: response.headers.get('ETag')};
      } catch {
        return {status: 'error', reason: 'network'};
      }
    },
    async getDownloadTicket(key) {
      const response = await withTimeout(MANIFEST_TIMEOUT_MS, signal =>
        fetchImpl(`${base}/v1/content/resources/${encodeURIComponent(key)}/download`, {headers: auth, signal}),
      );
      if (!response.ok) throw new Error(`download_ticket_${response.status}`);
      const body: unknown = await response.json();
      if (!isRecord(body) || !isTicket(body.data)) throw new Error('download_ticket_malformed');
      return body.data;
    },
    async fetchText(url) {
      // The R2 object carries Content-Encoding: gzip; the native HTTP stack decompresses it.
      const response = await withTimeout(DOWNLOAD_TIMEOUT_MS, signal => fetchImpl(url, {signal}));
      if (!response.ok) throw new Error(`download_${response.status}`);
      return response.text();
    },
  };
}
```

- [ ] **Step 4: Run, typecheck, commit**

Run: `npx jest services/content/__tests__/contentApi.test.ts && npx tsc --noEmit`
Expected: PASS (6 tests).

```bash
npx prettier --write services/content/contentApi.ts services/content/__tests__/contentApi.test.ts
git add services/content/contentApi.ts services/content/__tests__/contentApi.test.ts
git commit -m "feat(content): add content manifest and download client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Local registry (`content.db`)

**Files:**
- Create: `services/content/contentRegistry.ts`
- Test: `services/content/__tests__/contentRegistry.test.ts`

**Interfaces:**
- Consumes: `LocalContentRow` (Task 1).
- Produces:
  ```ts
  export interface ContentState { manifestEtag: string | null; lastCheckedAt: number | null; migratedAt: number | null; autoInstallDone: boolean }
  export interface ContentRegistry {
    list(): Promise<LocalContentRow[]>;
    get(key: string): Promise<LocalContentRow | null>;
    upsert(row: LocalContentRow): Promise<void>;
    delete(key: string): Promise<void>;
    getState(): Promise<ContentState>;
    setState(patch: Partial<ContentState>): Promise<void>;
  }
  export function emptyRow(key: string, kind: ContentKind): LocalContentRow;
  export function createSqliteContentRegistry(open?: () => Promise<SQLiteDatabase>): ContentRegistry;
  export function createMemoryContentRegistry(): ContentRegistry; // used by engine tests
  ```

- [ ] **Step 1: Write the failing test**

`services/content/__tests__/contentRegistry.test.ts`:

```ts
import {createMemoryContentRegistry, createSqliteContentRegistry, emptyRow} from '../contentRegistry';

describe('memory registry', () => {
  it('upserts, lists, deletes and patches state', async () => {
    const registry = createMemoryContentRegistry();
    await registry.upsert({...emptyRow('qf:tafsirs:169', 'tafsir'), version: 2});
    expect((await registry.get('qf:tafsirs:169'))?.version).toBe(2);
    expect(await registry.list()).toHaveLength(1);
    await registry.delete('qf:tafsirs:169');
    expect(await registry.get('qf:tafsirs:169')).toBeNull();
    expect(await registry.getState()).toEqual({manifestEtag: null, lastCheckedAt: null, migratedAt: null, autoInstallDone: false});
    await registry.setState({lastCheckedAt: 5});
    expect((await registry.getState()).lastCheckedAt).toBe(5);
  });
});

describe('sqlite registry', () => {
  it('creates tables and maps rows to booleans', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const getAllAsync = jest.fn().mockResolvedValue([
      {key: 'qf:tafsirs:169', kind: 'tafsir', version: 3, sha256: 's', upstream_schema_version: 1, installed_at: 9, legacy: 0, user_removed: 1, failures: 0, next_retry_at: null, withdrawal_notified: 0, name: 'Ibn Kathir'},
    ]);
    const getFirstAsync = jest.fn().mockResolvedValue({manifest_etag: '"e"', last_checked_at: 7, migrated_at: null, auto_install_done: 1});
    const db = {execAsync, runAsync, getAllAsync, getFirstAsync};
    const registry = createSqliteContentRegistry(() => Promise.resolve(db as never));

    const rows = await registry.list();
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS content_local'));
    expect(rows[0]).toMatchObject({version: 3, legacy: false, user_removed: true, withdrawal_notified: false});
    expect(await registry.getState()).toEqual({manifestEtag: '"e"', lastCheckedAt: 7, migratedAt: null, autoInstallDone: true});

    await registry.upsert(rows[0]);
    expect(runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO content_local'), expect.arrayContaining(['qf:tafsirs:169', 3, 1]));
  });
});
```

The single `as never` in the test stubs the `SQLiteDatabase` type for a fake object; it lives only in the test.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest services/content/__tests__/contentRegistry.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `services/content/contentRegistry.ts`**

```ts
import * as SQLite from 'expo-sqlite';
import type {ContentKind, LocalContentRow} from '@/types/content';

export interface ContentState {
  manifestEtag: string | null;
  lastCheckedAt: number | null;
  migratedAt: number | null;
  autoInstallDone: boolean;
}

export interface ContentRegistry {
  list(): Promise<LocalContentRow[]>;
  get(key: string): Promise<LocalContentRow | null>;
  upsert(row: LocalContentRow): Promise<void>;
  delete(key: string): Promise<void>;
  getState(): Promise<ContentState>;
  setState(patch: Partial<ContentState>): Promise<void>;
}

type Db = Pick<SQLite.SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'>;

const EMPTY_STATE: ContentState = {manifestEtag: null, lastCheckedAt: null, migratedAt: null, autoInstallDone: false};

export function emptyRow(key: string, kind: ContentKind): LocalContentRow {
  return {
    key, kind, version: 0, sha256: null, upstream_schema_version: null, installed_at: null,
    legacy: false, user_removed: false, failures: 0, next_retry_at: null, withdrawal_notified: false, name: null,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS content_local (
  key TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  upstream_schema_version INTEGER,
  installed_at INTEGER,
  legacy INTEGER NOT NULL DEFAULT 0,
  user_removed INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,
  withdrawal_notified INTEGER NOT NULL DEFAULT 0,
  name TEXT
);
CREATE TABLE IF NOT EXISTS content_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  manifest_etag TEXT,
  last_checked_at INTEGER,
  migrated_at INTEGER,
  auto_install_done INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO content_state (id) VALUES (1);
`;

interface RawRow {
  key: string; kind: string; version: number; sha256: string | null; upstream_schema_version: number | null;
  installed_at: number | null; legacy: number; user_removed: number; failures: number; next_retry_at: number | null;
  withdrawal_notified: number; name: string | null;
}

function fromRaw(raw: RawRow): LocalContentRow {
  return {
    key: raw.key,
    kind: raw.kind === 'translation' ? 'translation' : 'tafsir',
    version: raw.version,
    sha256: raw.sha256,
    upstream_schema_version: raw.upstream_schema_version,
    installed_at: raw.installed_at,
    legacy: raw.legacy === 1,
    user_removed: raw.user_removed === 1,
    failures: raw.failures,
    next_retry_at: raw.next_retry_at,
    withdrawal_notified: raw.withdrawal_notified === 1,
    name: raw.name,
  };
}

export function createSqliteContentRegistry(
  open: () => Promise<Db> = () => SQLite.openDatabaseAsync('content.db'),
): ContentRegistry {
  let ready: Promise<Db> | null = null;
  function db(): Promise<Db> {
    ready ??= open().then(async opened => {
      await opened.execAsync(SCHEMA);
      return opened;
    });
    return ready;
  }
  return {
    async list() {
      const rows = (await (await db()).getAllAsync('SELECT * FROM content_local')) as RawRow[];
      return rows.map(fromRaw);
    },
    async get(key) {
      const rows = (await (await db()).getAllAsync('SELECT * FROM content_local WHERE key = ?', [key])) as RawRow[];
      return rows[0] ? fromRaw(rows[0]) : null;
    },
    async upsert(row) {
      await (await db()).runAsync(
        `INSERT OR REPLACE INTO content_local
         (key, kind, version, sha256, upstream_schema_version, installed_at, legacy, user_removed, failures, next_retry_at, withdrawal_notified, name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.key, row.kind, row.version, row.sha256, row.upstream_schema_version, row.installed_at,
          row.legacy ? 1 : 0, row.user_removed ? 1 : 0, row.failures, row.next_retry_at, row.withdrawal_notified ? 1 : 0, row.name],
      );
    },
    async delete(key) {
      await (await db()).runAsync('DELETE FROM content_local WHERE key = ?', [key]);
    },
    async getState() {
      const raw = (await (await db()).getFirstAsync('SELECT * FROM content_state WHERE id = 1')) as {
        manifest_etag: string | null; last_checked_at: number | null; migrated_at: number | null; auto_install_done: number;
      } | null;
      if (!raw) return {...EMPTY_STATE};
      return {manifestEtag: raw.manifest_etag, lastCheckedAt: raw.last_checked_at, migratedAt: raw.migrated_at, autoInstallDone: raw.auto_install_done === 1};
    },
    async setState(patch) {
      const next = {...(await this.getState()), ...patch};
      await (await db()).runAsync(
        'UPDATE content_state SET manifest_etag = ?, last_checked_at = ?, migrated_at = ?, auto_install_done = ? WHERE id = 1',
        [next.manifestEtag, next.lastCheckedAt, next.migratedAt, next.autoInstallDone ? 1 : 0],
      );
    },
  };
}

export function createMemoryContentRegistry(): ContentRegistry {
  const rows = new Map<string, LocalContentRow>();
  let state: ContentState = {...EMPTY_STATE};
  return {
    async list() { return [...rows.values()].map(row => ({...row})); },
    async get(key) { const row = rows.get(key); return row ? {...row} : null; },
    async upsert(row) { rows.set(row.key, {...row}); },
    async delete(key) { rows.delete(key); },
    async getState() { return {...state}; },
    async setState(patch) { state = {...state, ...patch}; },
  };
}
```

The `as RawRow[]` and the state object cast are the SQLite JSON boundary, matching the existing pattern in `TafseerDbService.ts`.

- [ ] **Step 4: Run, typecheck, commit**

Run: `npx jest services/content/__tests__/contentRegistry.test.ts && npx tsc --noEmit`
Expected: PASS (2 tests).

```bash
npx prettier --write services/content/contentRegistry.ts services/content/__tests__/contentRegistry.test.ts
git add services/content/contentRegistry.ts services/content/__tests__/contentRegistry.test.ts
git commit -m "feat(content): add local content registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: QF tafsir snapshot parser

**Files:**
- Create: `services/content/tafsirSnapshot.ts`
- Test: `services/content/__tests__/tafsirSnapshot.test.ts`

**Interfaces:**
- Consumes: `QfSnapshot` (Task 1), `TafseerVerse` from `@/types/tafseer`.
- Produces: `export function parseTafsirSnapshot(snapshot: QfSnapshot): TafseerVerse[];`
- Rules (same output contract as today's `QuranComTafsirProvider.fetchChapterTafseer`, so `getTafseerForVerse` is unchanged): sort records by `verse_id`; a record with non-empty trimmed `text` starts a group; following empty-text records join the current group; every member is emitted with the leader's text, `groupVerseKey` = leader `verse_key`, `fromAyah` = leader ayah, `toAyah` = last member ayah. Empty records before any leader are dropped. Records without a valid `verse_key` are skipped.

- [ ] **Step 1: Write the failing tests**

`services/content/__tests__/tafsirSnapshot.test.ts`:

```ts
import {parseTafsirSnapshot} from '../tafsirSnapshot';

function snapshot(records: Array<Record<string, unknown>>) {
  return {resource_group: 'tafsirs', resource_id: 169, schema_version: 1, records};
}

describe('parseTafsirSnapshot', () => {
  it('maps single-verse rows', () => {
    const verses = parseTafsirSnapshot(snapshot([
      {verse_id: 1, verse_key: '1:1', text: '<p>One</p>'},
      {verse_id: 2, verse_key: '1:2', text: '<p>Two</p>'},
    ]));
    expect(verses).toEqual([
      {surahNumber: 1, ayahNumber: 1, verseKey: '1:1', text: '<p>One</p>', groupVerseKey: '1:1', fromAyah: 1, toAyah: 1},
      {surahNumber: 1, ayahNumber: 2, verseKey: '1:2', text: '<p>Two</p>', groupVerseKey: '1:2', fromAyah: 2, toAyah: 2},
    ]);
  });

  it('folds empty continuation rows into the leader group, in verse order', () => {
    const verses = parseTafsirSnapshot(snapshot([
      {verse_id: 16, verse_key: '2:9', text: ''},
      {verse_id: 15, verse_key: '2:8', text: '<p>Group</p>'},
      {verse_id: 17, verse_key: '2:10', text: null},
      {verse_id: 18, verse_key: '2:11', text: '<p>Next</p>'},
    ]));
    expect(verses.map(v => [v.verseKey, v.text, v.groupVerseKey, v.fromAyah, v.toAyah])).toEqual([
      ['2:8', '<p>Group</p>', '2:8', 8, 10],
      ['2:9', '<p>Group</p>', '2:8', 8, 10],
      ['2:10', '<p>Group</p>', '2:8', 8, 10],
      ['2:11', '<p>Next</p>', '2:11', 11, 11],
    ]);
  });

  it('drops leading empty rows and invalid keys', () => {
    const verses = parseTafsirSnapshot(snapshot([
      {verse_id: 1, verse_key: '1:1', text: ''},
      {verse_id: 2, verse_key: 'bad', text: '<p>x</p>'},
      {verse_id: 3, verse_key: '1:3', text: '<p>ok</p>'},
    ]));
    expect(verses.map(v => v.verseKey)).toEqual(['1:3']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest services/content/__tests__/tafsirSnapshot.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `services/content/tafsirSnapshot.ts`**

```ts
import type {QfSnapshot} from '@/types/content';
import type {TafseerVerse} from '@/types/tafseer';

const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;

interface Row {
  verseId: number;
  verseKey: string;
  surah: number;
  ayah: number;
  text: string;
}

function toRow(record: Record<string, unknown>): Row | null {
  const key = record.verse_key;
  if (typeof key !== 'string') return null;
  const match = VERSE_KEY.exec(key);
  if (!match) return null;
  return {
    verseId: typeof record.verse_id === 'number' ? record.verse_id : 0,
    verseKey: key,
    surah: Number(match[1]),
    ayah: Number(match[2]),
    text: typeof record.text === 'string' ? record.text : '',
  };
}

// Same output contract as QuranComTafsirProvider: every member of a verse group
// carries the leader's text and range, so getTafseerForVerse stays unchanged.
export function parseTafsirSnapshot(snapshot: QfSnapshot): TafseerVerse[] {
  const rows = snapshot.records
    .map(toRow)
    .filter((row): row is Row => row !== null)
    .sort((a, b) => a.verseId - b.verseId);

  const groups: {leader: Row; members: Row[]}[] = [];
  for (const row of rows) {
    if (row.text.trim()) groups.push({leader: row, members: [row]});
    else if (groups.length > 0) groups[groups.length - 1].members.push(row);
  }

  const verses: TafseerVerse[] = [];
  for (const {leader, members} of groups) {
    const toAyah = members[members.length - 1].ayah;
    for (const member of members) {
      verses.push({
        surahNumber: member.surah,
        ayahNumber: member.ayah,
        verseKey: member.verseKey,
        text: leader.text,
        groupVerseKey: leader.verseKey,
        fromAyah: leader.ayah,
        toAyah,
      });
    }
  }
  return verses;
}
```

- [ ] **Step 4: Run, typecheck, commit**

Run: `npx jest services/content/__tests__/tafsirSnapshot.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests).

```bash
npx prettier --write services/content/tafsirSnapshot.ts services/content/__tests__/tafsirSnapshot.test.ts
git add services/content/tafsirSnapshot.ts services/content/__tests__/tafsirSnapshot.test.ts
git commit -m "feat(content): parse QF tafsir snapshots into tafseer rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Content engine

**Files:**
- Create: `services/content/contentEngine.ts`
- Test: `services/content/__tests__/contentEngine.test.ts`

**Interfaces:**
- Consumes: `ContentApi` (Task 2), `ContentRegistry`, `emptyRow` (Task 3), types (Task 1).
- Produces:
  ```ts
  export interface EngineDeps {
    api: ContentApi;
    registry: ContentRegistry;
    installers: Partial<Record<ContentKind, ContentInstaller>>;
    isOnWifi: () => Promise<boolean>;
    sha256: (text: string) => Promise<string>;
    now: () => number;
    notify: (notice: WithdrawalNotice) => void;
    track: (event: 'applied' | 'withdrawn' | 'failed', props: { key: string; version: number; reason?: string }) => void;
  }
  export const DAY_MS = 86_400_000;
  export const WIFI_THRESHOLD_BYTES = 5_000_000;
  export const BACKOFF_MS = [3_600_000, 21_600_000, 86_400_000];
  export type CheckOutcome = 'skipped_recent' | 'not_modified' | 'error' | 'paused' | 'applied';
  export async function runContentCheck(deps: EngineDeps, opts?: { force?: boolean }): Promise<CheckOutcome>;
  export async function installResource(deps: EngineDeps, key: string, kind: ContentKind, reason: 'user' | 'auto'): Promise<void>;
  export async function removeResource(deps: EngineDeps, key: string): Promise<void>;
  ```
- Behavior:
  - `runContentCheck`: skip if `lastCheckedAt` is within 24h and not forced (but always run if older than 7 days, which the 24h rule already implies). Fetch manifest for the kinds that have installers, passing the stored ETag. `not_modified` updates `lastCheckedAt`. `error` changes nothing. `ok` stores ETag and `lastCheckedAt`; if `paused`, stop. Otherwise for each local row of a managed kind: manifest entry missing or `withdrawn` means purge (installer `remove` + `onWithdrawn`, `notify` once, registry delete, track `withdrawn`); `user_removed` rows are only kept as markers and skipped; active entry with newer `version` (or `legacy`) and supported schema and backoff elapsed is updated via `installResource` unless `bytes > 5,000,000` and not on Wi-Fi.
  - `installResource`: get ticket, fetch text, verify sha (mismatch throws), parse JSON, check `envelope === 1` and key match, check schema support, call installer `install`, then upsert registry with ticket version and sha, clearing `legacy`, `failures`, `next_retry_at`, `user_removed`. On any failure: increment `failures`, set `next_retry_at` from `BACKOFF_MS`, track `failed`, rethrow when `reason === 'user'`.
  - `removeResource`: installer `remove`, then mark `user_removed = true` and `version = 0` (row kept as a marker so auto-install never repeats).

- [ ] **Step 1: Write the failing tests**

`services/content/__tests__/contentEngine.test.ts`:

```ts
import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {BACKOFF_MS, installResource, removeResource, runContentCheck, type EngineDeps} from '../contentEngine';
import type {ContentApi, ManifestResult} from '../contentApi';
import type {ContentEnvelope, ContentInstaller, Manifest} from '@/types/content';

const KEY = 'qf:tafsirs:169';

function envelope(version: number): ContentEnvelope {
  return {envelope: 1, key: KEY, version, source: 'qf', fetched_at: 'x', snapshot: {resource_group: 'tafsirs', resource_id: 169, schema_version: 1, records: []}};
}

function manifest(entries: Manifest['resources'], paused = false): ManifestResult {
  return {status: 'ok', manifest: {format: 1, generated_at: 'x', paused, resources: entries}, etag: '"e"'};
}

function active(version: number, bytes = 1000) {
  return {key: KEY, kind: 'tafsir' as const, source: 'qf', version, status: 'active' as const, upstream_schema_version: 1, bytes, sha256: `sha-v${version}`, meta: {name: 'Ibn Kathir'}};
}

function setup(result: ManifestResult) {
  const registry = createMemoryContentRegistry();
  const installer: jest.Mocked<ContentInstaller> = {
    kind: 'tafsir',
    supportsSchemaVersion: jest.fn((v: number) => v === 1),
    install: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    onWithdrawn: jest.fn().mockResolvedValue(undefined),
  };
  let served = 2;
  const api: jest.Mocked<ContentApi> = {
    fetchManifest: jest.fn().mockResolvedValue(result),
    getDownloadTicket: jest.fn(async () => ({url: 'u', version: served, sha256: `sha-v${served}`, bytes: 1000, expires_at: 'x'})),
    fetchText: jest.fn(async () => JSON.stringify(envelope(served))),
  };
  let now = 1_000_000_000_000;
  const deps: EngineDeps = {
    api, registry, installers: {tafsir: installer},
    isOnWifi: jest.fn().mockResolvedValue(true),
    sha256: jest.fn(async (text: string) => `sha-v${(JSON.parse(text) as ContentEnvelope).version}`),
    now: () => now,
    notify: jest.fn(),
    track: jest.fn(),
  };
  return {deps, registry, installer, api, setServed: (v: number) => { served = v; }, advance: (ms: number) => { now += ms; }};
}

describe('runContentCheck', () => {
  it('updates an installed resource to a newer version', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    expect(await runContentCheck(deps)).toBe('applied');
    expect(installer.install).toHaveBeenCalledTimes(1);
    expect((await registry.get(KEY))?.version).toBe(2);
    expect(deps.track).toHaveBeenCalledWith('applied', {key: KEY, version: 2});
  });

  it('does nothing when versions match, and skips within 24 hours', async () => {
    const {deps, registry, installer, api, advance} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 2});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    advance(60_000);
    expect(await runContentCheck(deps)).toBe('skipped_recent');
    expect(api.fetchManifest).toHaveBeenCalledTimes(1);
  });

  it('purges a withdrawn or missing resource, falls back and notifies once', async () => {
    const {deps, registry, installer} = setup(manifest([{key: KEY, kind: 'tafsir', source: 'qf', version: 2, status: 'withdrawn', withdrawn_reason: 'copyright_holder_request'}]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1, name: 'Ibn Kathir'});
    await registry.upsert({...emptyRow('qf:tafsirs:5', 'tafsir'), version: 1, name: 'Gone'});
    await runContentCheck(deps);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(installer.remove).toHaveBeenCalledWith('qf:tafsirs:5');
    expect(installer.onWithdrawn).toHaveBeenCalledTimes(2);
    expect(deps.notify).toHaveBeenCalledWith({key: KEY, name: 'Ibn Kathir'});
    expect(await registry.list()).toEqual([]);
  });

  it('never purges on error, 304, malformed manifest, or pause', async () => {
    for (const result of [
      {status: 'error', reason: 'network'} as ManifestResult,
      {status: 'not_modified'} as ManifestResult,
      manifest([], true),
    ]) {
      const {deps, registry, installer} = setup(result);
      await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
      await runContentCheck(deps, {force: true});
      expect(installer.remove).not.toHaveBeenCalled();
      expect(await registry.get(KEY)).not.toBeNull();
    }
  });

  it('keeps the current copy when the schema is unsupported', async () => {
    const {deps, registry, installer} = setup(manifest([{...active(2), upstream_schema_version: 2}]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    expect((await registry.get(KEY))?.version).toBe(1);
  });

  it('waits for Wi-Fi for large updates', async () => {
    const {deps, registry, installer} = setup(manifest([active(2, 6_000_000)]));
    (deps.isOnWifi as jest.Mock).mockResolvedValue(false);
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
  });

  it('replaces legacy rows even at the same version', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 0, legacy: true});
    await runContentCheck(deps);
    expect(installer.install).toHaveBeenCalled();
    expect((await registry.get(KEY))?.legacy).toBe(false);
  });

  it('leaves user-removed markers alone', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), user_removed: true});
    await runContentCheck(deps);
    expect(installer.install).not.toHaveBeenCalled();
    expect(installer.remove).not.toHaveBeenCalled();
  });
});

describe('installResource', () => {
  it('rejects a sha mismatch without installing and backs off', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    (deps.sha256 as jest.Mock).mockResolvedValue('wrong');
    await expect(installResource(deps, KEY, 'tafsir', 'user')).rejects.toThrow('sha_mismatch');
    expect(installer.install).not.toHaveBeenCalled();
    const row = await registry.get(KEY);
    expect(row?.failures).toBe(1);
    expect(row?.next_retry_at).toBe(deps.now() + BACKOFF_MS[0]);
  });

  it('keeps the registry version when the installer fails mid-install', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1});
    installer.install.mockRejectedValueOnce(new Error('disk full'));
    await installResource(deps, KEY, 'tafsir', 'auto');
    expect((await registry.get(KEY))?.version).toBe(1);
  });

  it('respects backoff on the next check', async () => {
    const {deps, registry, installer, advance} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 1, failures: 1, next_retry_at: deps.now() + BACKOFF_MS[0]});
    await runContentCheck(deps, {force: true});
    expect(installer.install).not.toHaveBeenCalled();
    advance(BACKOFF_MS[0] + 1);
    await runContentCheck(deps, {force: true});
    expect(installer.install).toHaveBeenCalled();
  });
});

describe('removeResource', () => {
  it('removes data and keeps a user_removed marker', async () => {
    const {deps, registry, installer} = setup(manifest([active(2)]));
    await registry.upsert({...emptyRow(KEY, 'tafsir'), version: 2});
    await removeResource(deps, KEY);
    expect(installer.remove).toHaveBeenCalledWith(KEY);
    expect(await registry.get(KEY)).toMatchObject({user_removed: true, version: 0});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest services/content/__tests__/contentEngine.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `services/content/contentEngine.ts`**

```ts
import type {ContentApi} from './contentApi';
import {emptyRow, type ContentRegistry} from './contentRegistry';
import type {ContentEnvelope, ContentInstaller, ContentKind, LocalContentRow, ManifestEntry, WithdrawalNotice} from '@/types/content';

export const DAY_MS = 86_400_000;
export const WIFI_THRESHOLD_BYTES = 5_000_000;
export const BACKOFF_MS = [3_600_000, 21_600_000, 86_400_000];

export interface EngineDeps {
  api: ContentApi;
  registry: ContentRegistry;
  installers: Partial<Record<ContentKind, ContentInstaller>>;
  isOnWifi: () => Promise<boolean>;
  sha256: (text: string) => Promise<string>;
  now: () => number;
  notify: (notice: WithdrawalNotice) => void;
  track: (event: 'applied' | 'withdrawn' | 'failed', props: {key: string; version: number; reason?: string}) => void;
}

export type CheckOutcome = 'skipped_recent' | 'not_modified' | 'error' | 'paused' | 'applied';

function isEnvelope(value: unknown): value is ContentEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.envelope === 1 && typeof candidate.key === 'string' && typeof candidate.snapshot === 'object' && candidate.snapshot !== null;
}

function backoffFor(failures: number): number {
  return BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1];
}

async function recordFailure(deps: EngineDeps, key: string, kind: ContentKind, reason: string): Promise<void> {
  const row = (await deps.registry.get(key)) ?? emptyRow(key, kind);
  const failures = row.failures + 1;
  await deps.registry.upsert({...row, failures, next_retry_at: deps.now() + backoffFor(failures)});
  deps.track('failed', {key, version: row.version, reason});
}

export async function installResource(deps: EngineDeps, key: string, kind: ContentKind, reason: 'user' | 'auto'): Promise<void> {
  const installer = deps.installers[kind];
  if (!installer) throw new Error(`no_installer_${kind}`);
  try {
    const ticket = await deps.api.getDownloadTicket(key);
    const text = await deps.api.fetchText(ticket.url);
    if ((await deps.sha256(text)) !== ticket.sha256) throw new Error('sha_mismatch');
    const parsed: unknown = JSON.parse(text);
    if (!isEnvelope(parsed) || parsed.key !== key) throw new Error('envelope_mismatch');
    if (!installer.supportsSchemaVersion(parsed.snapshot.schema_version)) throw new Error('unsupported_schema');
    const previous = (await deps.registry.get(key)) ?? emptyRow(key, kind);
    await installer.install(key, parsed, undefined);
    await deps.registry.upsert({
      ...previous,
      version: ticket.version,
      sha256: ticket.sha256,
      upstream_schema_version: parsed.snapshot.schema_version,
      installed_at: deps.now(),
      legacy: false,
      user_removed: false,
      failures: 0,
      next_retry_at: null,
    });
    deps.track('applied', {key, version: ticket.version});
  } catch (error) {
    await recordFailure(deps, key, kind, error instanceof Error ? error.message : 'unknown');
    if (reason === 'user') throw error;
  }
}

export async function removeResource(deps: EngineDeps, key: string): Promise<void> {
  const row = await deps.registry.get(key);
  const kind: ContentKind = row?.kind ?? (key.startsWith('qf:translations:') ? 'translation' : 'tafsir');
  await deps.installers[kind]?.remove(key);
  await deps.registry.upsert({...(row ?? emptyRow(key, kind)), version: 0, sha256: null, user_removed: true, legacy: false});
}

async function purge(deps: EngineDeps, row: LocalContentRow, entry: ManifestEntry | undefined): Promise<void> {
  const installer = deps.installers[row.kind];
  if (!installer) return;
  await installer.remove(row.key);
  await installer.onWithdrawn(row.key);
  if (!row.withdrawal_notified) deps.notify({key: row.key, name: row.name ?? entry?.meta?.name ?? row.key});
  await deps.registry.delete(row.key);
  deps.track('withdrawn', {key: row.key, version: row.version, reason: entry?.withdrawn_reason ?? 'absent'});
}

export async function runContentCheck(deps: EngineDeps, opts: {force?: boolean} = {}): Promise<CheckOutcome> {
  const state = await deps.registry.getState();
  if (!opts.force && state.lastCheckedAt !== null && deps.now() - state.lastCheckedAt < DAY_MS) return 'skipped_recent';

  const kinds = (Object.keys(deps.installers) as ContentKind[]).filter(kind => deps.installers[kind]);
  const result = await deps.api.fetchManifest(kinds, state.manifestEtag);
  if (result.status === 'error') return 'error';
  if (result.status === 'not_modified') {
    await deps.registry.setState({lastCheckedAt: deps.now()});
    return 'not_modified';
  }
  await deps.registry.setState({manifestEtag: result.etag, lastCheckedAt: deps.now()});
  if (result.manifest.paused) return 'paused';

  const entries = new Map(result.manifest.resources.map(entry => [entry.key, entry]));
  const onWifi = await deps.isOnWifi();
  for (const row of await deps.registry.list()) {
    const installer = deps.installers[row.kind];
    if (!installer || row.user_removed) continue;
    const entry = entries.get(row.key);
    if (!entry || entry.status === 'withdrawn') {
      await purge(deps, row, entry);
      continue;
    }
    const needsUpdate = row.legacy || entry.version > row.version;
    const schemaOk = installer.supportsSchemaVersion(entry.upstream_schema_version ?? 1);
    const backoffOver = row.next_retry_at === null || row.next_retry_at <= deps.now();
    const networkOk = onWifi || (entry.bytes ?? 0) <= WIFI_THRESHOLD_BYTES;
    if (needsUpdate && schemaOk && backoffOver && networkOk) {
      await deps.registry.upsert({...row, name: entry.meta?.name ?? row.name});
      await installResource(deps, row.key, row.kind, 'auto');
    }
  }
  return 'applied';
}
```

The `as ContentKind[]` on `Object.keys` and the `Record<string, unknown>` narrowing in `isEnvelope` are the only casts; both sit at boundaries the type system cannot express.

- [ ] **Step 4: Run, typecheck, commit**

Run: `npx jest services/content/__tests__/contentEngine.test.ts && npx tsc --noEmit`
Expected: PASS (12 tests).

```bash
npx prettier --write services/content/contentEngine.ts services/content/__tests__/contentEngine.test.ts
git add services/content/contentEngine.ts services/content/__tests__/contentEngine.test.ts
git commit -m "feat(content): add content engine for updates, purges and backoff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tafsir installer, notices and analytics

**Files:**
- Create: `services/content/tafsirInstaller.ts`
- Create: `services/content/contentNotices.ts`
- Modify: `services/analytics/events.ts`, `services/analytics/AnalyticsService.ts`
- Test: `services/content/__tests__/tafsirInstaller.test.ts`

**Interfaces:**
- Consumes: `parseTafsirSnapshot` (Task 4), `tafseerDbService` (`saveTafseer`, `deleteTafseer`), `useTafseerStore` (`getState().selectedTafseerId`, `setSelectedTafseerId`, `loadDownloadedMeta`), `showToast` from `@/utils/toastUtils`.
- Produces:
  ```ts
  export function tafsirIdFromKey(key: string): string; // 'qf:tafsirs:169' -> '169'
  export function createTafsirInstaller(deps?: { db?: Pick<typeof tafseerDbService, 'saveTafseer' | 'deleteTafseer' | 'getDownloadedTafaseer'>; store?: typeof useTafseerStore }): ContentInstaller;
  export function showWithdrawalNotice(notice: WithdrawalNotice): void;
  // analytics
  ANALYTICS_EVENTS.CONTENT_UPDATE_APPLIED = 'content_update_applied'
  ANALYTICS_EVENTS.CONTENT_WITHDRAWN = 'content_withdrawn'
  ANALYTICS_EVENTS.CONTENT_UPDATE_FAILED = 'content_update_failed'
  analyticsService.trackContentEvent(event: 'applied' | 'withdrawn' | 'failed', props: { key: string; version: number; reason?: string }): void
  ```
- Install metadata: `saveTafseer(id, meta?.name ?? existingName ?? \`Tafsir ${id}\`, meta?.name ?? ..., meta?.language ?? 'English', meta?.direction ?? 'ltr', verses)`. The engine passes `undefined` meta today; the installer reads the existing metadata name from `getDownloadedTafaseer()` when present so names survive updates. (Sub-project C passes manifest meta.)

- [ ] **Step 1: Write the failing tests**

`services/content/__tests__/tafsirInstaller.test.ts`:

```ts
import {createTafsirInstaller, tafsirIdFromKey} from '../tafsirInstaller';
import type {ContentEnvelope} from '@/types/content';

function makeStore(selected: string | null) {
  const state = {
    selectedTafseerId: selected,
    setSelectedTafseerId: jest.fn((id: string | null) => { state.selectedTafseerId = id; }),
    loadDownloadedMeta: jest.fn().mockResolvedValue(undefined),
  };
  return {getState: () => state, state};
}

function makeDb(downloaded: Array<{identifier: string; name: string}>) {
  return {
    saveTafseer: jest.fn().mockResolvedValue(undefined),
    deleteTafseer: jest.fn().mockResolvedValue(undefined),
    getDownloadedTafaseer: jest.fn().mockResolvedValue(downloaded),
  };
}

const envelope: ContentEnvelope = {
  envelope: 1, key: 'qf:tafsirs:169', version: 2, source: 'qf', fetched_at: 'x',
  snapshot: {resource_group: 'tafsirs', resource_id: 169, schema_version: 1, records: [{verse_id: 1, verse_key: '1:1', text: '<p>a</p>'}]},
};

describe('tafsir installer', () => {
  it('maps keys to tafsir ids', () => {
    expect(tafsirIdFromKey('qf:tafsirs:169')).toBe('169');
  });

  it('installs parsed rows under the bare id and keeps the existing name', async () => {
    const db = makeDb([{identifier: '169', name: 'Ibn Kathir (Abridged)'}]);
    const store = makeStore('169');
    const installer = createTafsirInstaller({db: db as never, store: store as never});
    await installer.install('qf:tafsirs:169', envelope, undefined);
    expect(db.saveTafseer).toHaveBeenCalledWith('169', 'Ibn Kathir (Abridged)', 'Ibn Kathir (Abridged)', 'English', 'ltr', [
      expect.objectContaining({verseKey: '1:1', text: '<p>a</p>'}),
    ]);
    expect(store.state.loadDownloadedMeta).toHaveBeenCalled();
  });

  it('falls back to another installed tafsir when the selected one is withdrawn', async () => {
    const db = makeDb([{identifier: '16', name: 'Muyassar'}]);
    const store = makeStore('169');
    const installer = createTafsirInstaller({db: db as never, store: store as never});
    await installer.remove('qf:tafsirs:169');
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(db.deleteTafseer).toHaveBeenCalledWith('169');
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledWith('16');
  });

  it('clears the selection when nothing else is installed', async () => {
    const store = makeStore('169');
    const installer = createTafsirInstaller({db: makeDb([]) as never, store: store as never});
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(store.state.setSelectedTafseerId).toHaveBeenCalledWith(null);
  });

  it('leaves an unrelated selection alone', async () => {
    const store = makeStore('16');
    const installer = createTafsirInstaller({db: makeDb([{identifier: '16', name: 'x'}]) as never, store: store as never});
    await installer.onWithdrawn('qf:tafsirs:169');
    expect(store.state.setSelectedTafseerId).not.toHaveBeenCalled();
  });

  it('supports only schema version 1', () => {
    const installer = createTafsirInstaller({db: makeDb([]) as never, store: makeStore(null) as never});
    expect(installer.supportsSchemaVersion(1)).toBe(true);
    expect(installer.supportsSchemaVersion(2)).toBe(false);
  });
});
```

The `as never` casts stub the real singletons' types in tests only.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest services/content/__tests__/tafsirInstaller.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the installer**

`services/content/tafsirInstaller.ts`:

```ts
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {useTafseerStore} from '@/store/tafseerStore';
import type {ContentInstaller} from '@/types/content';
import {parseTafsirSnapshot} from './tafsirSnapshot';

type TafsirDb = Pick<typeof tafseerDbService, 'saveTafseer' | 'deleteTafseer' | 'getDownloadedTafaseer'>;

export function tafsirIdFromKey(key: string): string {
  return key.slice(key.lastIndexOf(':') + 1);
}

export function createTafsirInstaller(
  deps: {db?: TafsirDb; store?: typeof useTafseerStore} = {},
): ContentInstaller {
  const db = deps.db ?? tafseerDbService;
  const store = deps.store ?? useTafseerStore;
  return {
    kind: 'tafsir',
    supportsSchemaVersion: version => version === 1,
    async install(key, envelope, meta) {
      const id = tafsirIdFromKey(key);
      const existing = (await db.getDownloadedTafaseer()).find(item => item.identifier === id);
      const name = meta?.name ?? existing?.name ?? `Tafsir ${id}`;
      await db.saveTafseer(id, name, name, meta?.language ?? 'English', meta?.direction ?? 'ltr', parseTafsirSnapshot(envelope.snapshot));
      await store.getState().loadDownloadedMeta();
    },
    async remove(key) {
      await db.deleteTafseer(tafsirIdFromKey(key));
      await store.getState().loadDownloadedMeta();
    },
    async onWithdrawn(key) {
      const id = tafsirIdFromKey(key);
      const state = store.getState();
      if (state.selectedTafseerId !== id) return;
      const remaining = (await db.getDownloadedTafaseer()).filter(item => item.identifier !== id);
      state.setSelectedTafseerId(remaining[0]?.identifier ?? null);
    },
  };
}
```

Check `getDownloadedTafaseer()`'s return field names in `TafseerDbService.ts` (the conventions report shows `identifier` and `name`); adjust the property names if they differ.

- [ ] **Step 4: Implement notices and analytics**

`services/content/contentNotices.ts`:

```ts
import {showToast} from '@/utils/toastUtils';
import type {WithdrawalNotice} from '@/types/content';

export function showWithdrawalNotice(notice: WithdrawalNotice): void {
  showToast('Content removed', `${notice.name} was withdrawn by its publisher via Quran Foundation.`, 'none');
}
```

The "once per key" guarantee comes from the engine: it notifies during the purge that deletes the registry row, and a deleted row is never purged again.

In `services/analytics/events.ts`, add to `ANALYTICS_EVENTS`:

```ts
  CONTENT_UPDATE_APPLIED: 'content_update_applied',
  CONTENT_WITHDRAWN: 'content_withdrawn',
  CONTENT_UPDATE_FAILED: 'content_update_failed',
```

and the props type:

```ts
export interface ContentEventProps {
  key: string;
  version: number;
  reason?: string;
}
```

In `services/analytics/AnalyticsService.ts`, next to `trackDownloadCompleted`, add:

```ts
  trackContentEvent(event: 'applied' | 'withdrawn' | 'failed', props: ContentEventProps): void {
    const name =
      event === 'applied'
        ? ANALYTICS_EVENTS.CONTENT_UPDATE_APPLIED
        : event === 'withdrawn'
          ? ANALYTICS_EVENTS.CONTENT_WITHDRAWN
          : ANALYTICS_EVENTS.CONTENT_UPDATE_FAILED;
    this.capture(name, {key: props.key, version: props.version, reason: props.reason ?? null});
  }
```

- [ ] **Step 5: Run, typecheck, commit**

Run: `npx jest services/content/__tests__/tafsirInstaller.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests).

```bash
npx prettier --write services/content/tafsirInstaller.ts services/content/contentNotices.ts services/analytics/events.ts services/analytics/AnalyticsService.ts services/content/__tests__/tafsirInstaller.test.ts
git add services/content/tafsirInstaller.ts services/content/contentNotices.ts services/analytics/events.ts services/analytics/AnalyticsService.ts services/content/__tests__/tafsirInstaller.test.ts
git commit -m "feat(content): add tafsir installer with withdrawal fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wiring, legacy migration and first-launch install

**Files:**
- Create: `services/content/legacyMigration.ts`
- Create: `services/content/contentSync.ts`
- Test: `services/content/__tests__/legacyMigration.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  ```ts
  // legacyMigration.ts
  export const AUTO_INSTALL_KEY = 'qf:tafsirs:169';
  export async function migrateLegacyContent(registry: ContentRegistry, legacyTafsirIds: string[], now: number): Promise<number>;
  export async function maybeAutoInstall(deps: EngineDeps): Promise<boolean>;
  // contentSync.ts
  export function isEngineManagingTafsir(): boolean; // false when branding.tafsirProvider is set or no API base
  export async function initContentSync(): Promise<void>;
  export function teardownContentSync(): void;
  export async function installContent(key: string): Promise<void>; // user-initiated
  export async function removeContent(key: string): Promise<void>;
  ```
- `migrateLegacyContent`: runs once (`state.migratedAt === null`); for every legacy tafsir id creates `qf:tafsirs:{id}` with `version 0, legacy true`; sets `migratedAt`. Returns the number migrated.
- `maybeAutoInstall`: if `state.autoInstallDone` is false and the registry has no `qf:tafsirs:169` row (or a row with `user_removed` false and `version 0` that is not legacy), call `installResource(deps, AUTO_INSTALL_KEY, 'tafsir', 'auto')`; set `autoInstallDone = true` only after a successful install (registry version > 0), so a failed first attempt retries on the next foreground. A `user_removed` row always returns false.
- `initContentSync`: if not managing tafsir, return. Build real deps (`createContentApi(base, process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? '')`, `createSqliteContentRegistry()`, `{tafsir: createTafsirInstaller()}`, NetInfo Wi-Fi probe, `Crypto.digestStringAsync`, `Date.now`, `showWithdrawalNotice`, `analyticsService.trackContentEvent`). Run migration with `tafseerDbService.getDownloadedTafaseer()` ids, then `maybeAutoInstall`, then `runContentCheck`. Subscribe to `AppState` `active` to repeat `maybeAutoInstall` + `runContentCheck` (the 24h gate lives in the engine). Serialize runs with a module-level promise so foreground events never overlap.

- [ ] **Step 1: Write the failing tests**

`services/content/__tests__/legacyMigration.test.ts`:

```ts
import {createMemoryContentRegistry, emptyRow} from '../contentRegistry';
import {AUTO_INSTALL_KEY, maybeAutoInstall, migrateLegacyContent} from '../legacyMigration';
import type {EngineDeps} from '../contentEngine';

function deps(registry = createMemoryContentRegistry(), installOk = true): EngineDeps {
  return {
    api: {
      fetchManifest: jest.fn(),
      getDownloadTicket: jest.fn(async () => ({url: 'u', version: 3, sha256: 's', bytes: 1, expires_at: 'x'})),
      fetchText: jest.fn(async () => JSON.stringify({envelope: 1, key: AUTO_INSTALL_KEY, version: 3, source: 'qf', fetched_at: 'x', snapshot: {resource_group: 'tafsirs', resource_id: 169, schema_version: 1, records: []}})),
    },
    registry,
    installers: {
      tafsir: {
        kind: 'tafsir',
        supportsSchemaVersion: () => true,
        install: installOk ? jest.fn().mockResolvedValue(undefined) : jest.fn().mockRejectedValue(new Error('offline')),
        remove: jest.fn(),
        onWithdrawn: jest.fn(),
      },
    },
    isOnWifi: jest.fn().mockResolvedValue(false),
    sha256: jest.fn().mockResolvedValue('s'),
    now: () => 1000,
    notify: jest.fn(),
    track: jest.fn(),
  };
}

describe('migrateLegacyContent', () => {
  it('marks existing tafsirs as legacy version 0, once', async () => {
    const registry = createMemoryContentRegistry();
    expect(await migrateLegacyContent(registry, ['169', '16'], 5)).toBe(2);
    expect(await registry.get('qf:tafsirs:169')).toMatchObject({version: 0, legacy: true});
    expect(await migrateLegacyContent(registry, ['999'], 6)).toBe(0);
    expect(await registry.get('qf:tafsirs:999')).toBeNull();
  });
});

describe('maybeAutoInstall', () => {
  it('installs Ibn Kathir on a fresh install, even off Wi-Fi', async () => {
    const d = deps();
    expect(await maybeAutoInstall(d)).toBe(true);
    expect((await d.registry.get(AUTO_INSTALL_KEY))?.version).toBe(3);
    expect((await d.registry.getState()).autoInstallDone).toBe(true);
  });

  it('never reinstalls after the user removed it', async () => {
    const d = deps();
    await d.registry.upsert({...emptyRow(AUTO_INSTALL_KEY, 'tafsir'), user_removed: true});
    expect(await maybeAutoInstall(d)).toBe(false);
    expect(d.api.getDownloadTicket).not.toHaveBeenCalled();
  });

  it('does not run when a legacy copy exists (the check replaces it)', async () => {
    const d = deps();
    await d.registry.upsert({...emptyRow(AUTO_INSTALL_KEY, 'tafsir'), legacy: true});
    expect(await maybeAutoInstall(d)).toBe(false);
  });

  it('retries on the next run if the first attempt fails', async () => {
    const d = deps(createMemoryContentRegistry(), false);
    expect(await maybeAutoInstall(d)).toBe(false);
    expect((await d.registry.getState()).autoInstallDone).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest services/content/__tests__/legacyMigration.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `services/content/legacyMigration.ts`**

```ts
import {installResource, type EngineDeps} from './contentEngine';
import {emptyRow, type ContentRegistry} from './contentRegistry';

export const AUTO_INSTALL_KEY = 'qf:tafsirs:169';

export async function migrateLegacyContent(registry: ContentRegistry, legacyTafsirIds: string[], now: number): Promise<number> {
  const state = await registry.getState();
  if (state.migratedAt !== null) return 0;
  let migrated = 0;
  for (const id of legacyTafsirIds) {
    const key = `qf:tafsirs:${id}`;
    if (await registry.get(key)) continue;
    await registry.upsert({...emptyRow(key, 'tafsir'), legacy: true});
    migrated++;
  }
  await registry.setState({migratedAt: now});
  return migrated;
}

export async function maybeAutoInstall(deps: EngineDeps): Promise<boolean> {
  const state = await deps.registry.getState();
  if (state.autoInstallDone) return false;
  const row = await deps.registry.get(AUTO_INSTALL_KEY);
  if (row && (row.user_removed || row.legacy || row.version > 0)) return false;
  await installResource(deps, AUTO_INSTALL_KEY, 'tafsir', 'auto');
  const installed = await deps.registry.get(AUTO_INSTALL_KEY);
  if (!installed || installed.version === 0) return false;
  await deps.registry.setState({autoInstallDone: true});
  return true;
}
```

- [ ] **Step 4: Implement `services/content/contentSync.ts`**

```ts
import {AppState, type AppStateStatus, type NativeEventSubscription} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import branding from '@/config/branding';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {createContentApi, resolveContentApiBase} from './contentApi';
import {installResource, removeResource, runContentCheck, type EngineDeps} from './contentEngine';
import {showWithdrawalNotice} from './contentNotices';
import {createSqliteContentRegistry} from './contentRegistry';
import {maybeAutoInstall, migrateLegacyContent} from './legacyMigration';
import {createTafsirInstaller} from './tafsirInstaller';

let deps: EngineDeps | null = null;
let subscription: NativeEventSubscription | null = null;
let running: Promise<void> = Promise.resolve();

export function isEngineManagingTafsir(): boolean {
  return !branding.tafsirProvider && resolveContentApiBase() !== null;
}

function buildDeps(base: string): EngineDeps {
  return {
    api: createContentApi(base, process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? ''),
    registry: createSqliteContentRegistry(),
    installers: {tafsir: createTafsirInstaller()},
    isOnWifi: async () => {
      const state = await NetInfo.fetch();
      return state.type === 'wifi' || state.details?.isConnectionExpensive === false;
    },
    sha256: text => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
    now: Date.now,
    notify: showWithdrawalNotice,
    track: (event, props) => analyticsService.trackContentEvent(event, props),
  };
}

function serialize(task: () => Promise<void>): Promise<void> {
  running = running.then(task, task).catch(() => undefined);
  return running;
}

async function cycle(active: EngineDeps): Promise<void> {
  await maybeAutoInstall(active);
  await runContentCheck(active);
}

export async function initContentSync(): Promise<void> {
  const base = resolveContentApiBase();
  if (deps || !base || !isEngineManagingTafsir()) return;
  const active = buildDeps(base);
  deps = active;
  await serialize(async () => {
    const legacy = (await tafseerDbService.getDownloadedTafaseer()).map(item => item.identifier);
    await migrateLegacyContent(active.registry, legacy, active.now());
    await cycle(active);
  });
  subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status === 'active') void serialize(() => cycle(active));
  });
}

export function teardownContentSync(): void {
  subscription?.remove();
  subscription = null;
  deps = null;
}

export async function installContent(key: string): Promise<void> {
  if (!deps) throw new Error('content_sync_unavailable');
  const active = deps;
  let failure: unknown = null;
  await serialize(async () => {
    try {
      await installResource(active, key, 'tafsir', 'user');
    } catch (error) {
      failure = error;
    }
  });
  if (failure) throw failure;
}

export async function removeContent(key: string): Promise<void> {
  if (!deps) return;
  const active = deps;
  await serialize(() => removeResource(active, key));
}
```

`installContent` currently assumes tafsir keys; sub-project C generalizes it by kind.

- [ ] **Step 5: Run, typecheck, commit**

Run: `npx jest services/content && npx tsc --noEmit`
Expected: all content tests PASS (4 new in this file).

```bash
npx prettier --write services/content/legacyMigration.ts services/content/contentSync.ts services/content/__tests__/legacyMigration.test.ts
git add services/content/legacyMigration.ts services/content/contentSync.ts services/content/__tests__/legacyMigration.test.ts
git commit -m "feat(content): wire content sync with legacy migration and Ibn Kathir auto-install

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Route tafsir downloads through the engine and remove bundled Ibn Kathir

**Files:**
- Modify: `store/tafseerStore.ts` (`downloadTafseer`, `deleteTafseer`)
- Modify: `services/AppInitializer.ts` (remove `importBundledIbnKathir()` call)
- Modify: `services/tafseer/TafseerDbService.ts` (delete `importBundledIbnKathir` method)
- Delete: `data/ibn-kathir-tafseer-compact.json`
- Modify: `app/_layout.tsx` (call `initContentSync()` after `appInitializer.initialize()`)
- Test: `store/__tests__/tafseerStore.contentSync.test.ts`

**Interfaces:**
- Consumes: `installContent`, `removeContent`, `isEngineManagingTafsir` (Task 7).
- Store behavior: when `isEngineManagingTafsir()` is true, `downloadTafseer(edition)` calls `installContent(\`qf:tafsirs:${edition.identifier}\`)` (progress set to 1 on success), and `deleteTafseer(id)` calls `removeContent(\`qf:tafsirs:${id}\`)` before its existing selection logic. Otherwise the existing RFC-009 provider path is used unchanged.

- [ ] **Step 1: Read the current store**

Open `store/tafseerStore.ts` and note the exact `downloadTafseer` and `deleteTafseer` bodies (the conventions report: one download at a time via `downloadingId`, progress `0..1`, on error reset and rethrow; `deleteTafseer` reselects `meta[0].identifier` or `null`).

- [ ] **Step 2: Write the failing test**

`store/__tests__/tafseerStore.contentSync.test.ts`:

```ts
const mockInstall = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(undefined);
let mockManaging = true;

jest.mock('@/services/content/contentSync', () => ({
  installContent: (key: string) => mockInstall(key),
  removeContent: (key: string) => mockRemove(key),
  isEngineManagingTafsir: () => mockManaging,
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({
  tafseerDbService: {
    getDownloadedTafaseer: jest.fn().mockResolvedValue([]),
    deleteTafseer: jest.fn().mockResolvedValue(undefined),
    saveTafseer: jest.fn(),
  },
}));
const mockFetchFull = jest.fn();
jest.mock('@/services/tafseer/TafseerApiService', () => ({
  tafseerApiService: {fetchFullTafseer: (...args: unknown[]) => mockFetchFull(...args)},
}));

import {useTafseerStore} from '../tafseerStore';

const edition = {identifier: '169', name: 'Ibn Kathir', englishName: 'Ibn Kathir', language: 'English', format: 'text', type: 'tafsir', direction: 'ltr'};

describe('tafseerStore with content sync', () => {
  beforeEach(() => { mockInstall.mockClear(); mockRemove.mockClear(); mockFetchFull.mockClear(); mockManaging = true; });

  it('downloads through the content engine and never calls the legacy provider', async () => {
    await useTafseerStore.getState().downloadTafseer(edition as never);
    expect(mockInstall).toHaveBeenCalledWith('qf:tafsirs:169');
    expect(mockFetchFull).not.toHaveBeenCalled();
  });

  it('deletes through the content engine', async () => {
    await useTafseerStore.getState().deleteTafseer('169');
    expect(mockRemove).toHaveBeenCalledWith('qf:tafsirs:169');
  });

  it('uses the fork provider when the engine is not managing tafsir', async () => {
    mockManaging = false;
    mockFetchFull.mockResolvedValue({edition, verses: []});
    await useTafseerStore.getState().downloadTafseer(edition as never);
    expect(mockFetchFull).toHaveBeenCalled();
    expect(mockInstall).not.toHaveBeenCalled();
  });
});
```

Match the `edition` object to the actual `TafseerEdition` type in `types/tafseer.ts`; the `as never` stays test-only.

- [ ] **Step 3: Run to verify it fails**

Run: `npx jest store/__tests__/tafseerStore.contentSync.test.ts`
Expected: FAIL, `installContent` not called.

- [ ] **Step 4: Change the store**

In `store/tafseerStore.ts`, add `import {installContent, isEngineManagingTafsir, removeContent} from '@/services/content/contentSync';`. Inside `downloadTafseer`, after the existing `downloadingId` guard and progress reset, branch:

```ts
      if (isEngineManagingTafsir()) {
        await installContent(`qf:tafsirs:${edition.identifier}`);
        set({downloadProgress: 1});
      } else {
        // existing provider path, unchanged (fetchFullTafseer + saveTafseer)
      }
```

Keep the existing `try/catch/finally`, metadata reload, and auto-select-when-nothing-selected behavior around both branches. In `deleteTafseer`, before the existing DB delete:

```ts
      if (isEngineManagingTafsir()) {
        await removeContent(`qf:tafsirs:${id}`);
      } else {
        await tafseerDbService.deleteTafseer(id);
      }
```

Then keep the existing reselection logic.

- [ ] **Step 5: Remove the bundled Ibn Kathir**

- In `services/AppInitializer.ts`, delete the `await tafseerDbService.importBundledIbnKathir();` line (the "Tafseer DB" service keeps `initialize()` and `loadDownloadedMeta()`).
- In `services/tafseer/TafseerDbService.ts`, delete the `importBundledIbnKathir` method.
- Delete the file: `git rm data/ibn-kathir-tafseer-compact.json`.
- Run `git grep -n "ibn-kathir-tafseer-compact\|importBundledIbnKathir"` and confirm no references remain.

- [ ] **Step 6: Start content sync at launch**

In `app/_layout.tsx`, right after the `await appInitializer.initialize()` call (around line 288), add:

```ts
      void initContentSync().catch(error => {
        console.warn('[ContentSync] init failed', error);
      });
```

with `import {initContentSync} from '@/services/content/contentSync';`. It must not block the splash screen.

- [ ] **Step 7: Run everything and commit**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites PASS. If an existing test referenced `importBundledIbnKathir`, update it to the new behavior (bundled import removed) rather than deleting coverage.

```bash
npx prettier --write store/tafseerStore.ts services/AppInitializer.ts services/tafseer/TafseerDbService.ts app/_layout.tsx store/__tests__/tafseerStore.contentSync.test.ts
git add -A store/tafseerStore.ts services/AppInitializer.ts services/tafseer/TafseerDbService.ts app/_layout.tsx store/__tests__/tafseerStore.contentSync.test.ts data/ibn-kathir-tafseer-compact.json
git commit -m "feat(content): download tafsir via QF content sync and stop bundling Ibn Kathir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verification, manual QA and PR

**Files:** none new.

- [ ] **Step 1: Confirm no runtime call to api.quran.com remains on the Bayaan path**

Run: `git grep -n "api.quran.com" -- ':!scripts' ':!docs' ':!**/__tests__/**'`
Expected: only `services/tafseer/QuranComTafsirProvider.ts` (kept as the RFC-009 default for forks with no content API; Bayaan never reaches it because `isEngineManagingTafsir()` is true). Note this in the PR.

- [ ] **Step 2: Full checks**

Run: `npx tsc --noEmit && npx jest`
Expected: clean typecheck, all suites green.

- [ ] **Step 3: Manual QA on a physical iOS device and a physical Android device**

Prerequisite: the backend from the backend plan is deployed to a staging or production environment, its sync has run, and the app's `EXPO_PUBLIC_BAYAAN_API_URL` points at it. Check off each:

- [ ] Fresh install: Ibn Kathir appears without user action within a minute of first launch, on cellular and on Wi-Fi.
- [ ] The tafsir sheet shows grouped verses correctly (open 2:8 and 2:9; both show the same group text and range).
- [ ] Download a second tafsir from Settings, then delete it: it disappears, and Ibn Kathir stays selected.
- [ ] Delete Ibn Kathir, force-quit, relaunch, foreground several times: it does not return.
- [ ] Upgrade path: install the current App Store build, open tafsir (bundled Ibn Kathir), then install this build: the copy is replaced from QF (check `content_update_applied` in PostHog or the dev log).
- [ ] Airplane mode at launch: nothing is removed, tafsir still opens.
- [ ] Kill the app during a large tafsir download: on relaunch the previous content still works and the update completes later.
- [ ] Staging withdrawal: `POST /admin/content/qf%3Atafsirs%3A169/withdraw` with `CONTENT_ADMIN_QA_ENABLED=true`, then force a check (relaunch after clearing app data's `content_state.last_checked_at`, or wait 24h): Ibn Kathir is removed, the selection falls back, and the notice "Ibn Kathir ... was withdrawn by its publisher via Quran Foundation." appears once. Restore it afterwards.
- [ ] With the tafsir sheet open during the withdrawal: the app does not crash, the sheet shows the fallback or empty state when reopened.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/content-sync-tafsir
gh pr create --draft --base develop --title "feat(content): tafsir via QF Content Sync and device content engine" --body "Implements the device half of docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md for tafsir (plan: docs/superpowers/plans/2026-10-06-content-sync-mobile.md). Depends on the backend content sync PR being deployed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
