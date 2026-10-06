# Content Sync Backend Implementation Plan (Sub-projects A + B, server side)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync every QF translation and tafsir into versioned, private R2 artifacts on an hourly schedule, and serve devices a manifest plus presigned downloads so they can always converge on the freshest version.

**Architecture:** A Railway cron runs `bun run content:sync`, which uses a confidential client-credentials token (`scope=content`) to walk QF Content Sync, validates each changed snapshot, wraps it verbatim in a Bayaan envelope, gzips it into a content-addressed R2 object and bumps a version row in Postgres. The API serves `GET /v1/content/manifest` (ETag/304) and `GET /v1/content/resources/:key/download` (10-minute presigned URL) behind the existing API-key middleware, plus admin endpoints for holds and QA.

**Tech Stack:** Bun 1.3.12, Hono 4, Drizzle ORM 0.45 + postgres-js, Zod 4, `Bun.S3Client` against Cloudflare R2, `bun test` with real Postgres.

**Spec:** `docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md` (in `thebayaan/Bayaan`). Read sections 3, 6, 8, 9, 10 and 11a before starting.

**Repo / branch:** `thebayaan/bayaan-backend`, new branch `feat/content-sync` from `origin/develop`. PR targets `develop`.

## Global Constraints

- QF production hosts: OAuth `https://oauth2.quran.foundation`, content `https://apis.quran.foundation/content/api/v4`. Pre-live: `https://prelive-oauth2.quran.foundation`, `https://apis-prelive.quran.foundation/content/api/v4`.
- Token request: HTTP Basic `client_id:client_secret`, body `grant_type=client_credentials&scope=content`. Never send the secret in the body (QF rejects it).
- Headers on every content call: `x-auth-token: <token>` and `x-client-id: <client id>`.
- Sync filter MUST be canonical: groups sorted alphabetically, `*` for all ids, joined with `;`, then URL-encoded. For this plan: `tafsirs:*;translations:*`.
- Credentials come only from env: `QF_CLIENT_ID`, `QF_CLIENT_SECRET`. Never log them, never return them, never commit them.
- R2 bucket is private (`bayaan-content`); objects are only reachable through presigned URLs.
- Object key format: `content/{kind}/{upstream_id}/{sha256}.json`, stored with `Content-Type: application/json` and `Content-Encoding: gzip`.
- `sha256` is computed over the **uncompressed** envelope JSON (UTF-8). Devices verify against the decompressed text.
- Envelope format version is `1`. Supported QF `schema_version` set is `{1}`.
- Drop guard threshold: a new snapshot whose `row_count` is more than 5% below the current published `row_count` is held.
- Withdrawn entries remain in the manifest for 90 days after `withdrawn_at`.
- Superseded R2 objects are deleted 30 days after being superseded.
- Presigned URL lifetime: 600 seconds.
- Follow repo conventions: snake_case columns, `uuid`/`text` keys, `timestamp(..., { withTimezone: true })`, one Hono instance per route file with default export, services own DB logic, errors from `src/lib/errors.ts`, responses via `src/lib/response.ts`.
- Coverage threshold is 0.8 per file (bunfig). Keep logic in `src/`; `scripts/` stays a thin wrapper.
- TypeScript strict, no `any`, avoid `as` casts except at JSON parse boundaries guarded by type guards. Use the `function` keyword for pure functions.
- No em dashes anywhere (code, comments, commits, docs).
- Commit messages: conventional commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The sync filter silently drops a group** (observed in production: `translations:*;tafsirs:*` unencoded returned no tafsirs). Expected: the job refuses to store a sync token after a bootstrap in which any filtered group produced zero resources, and alerts. Test owned by Task 7.
2. **QF returns a truncated or partial snapshot** (network cut mid-body, or an upstream bug). Expected: not published; the previous version keeps serving. Covered by validation (Task 5) and the drop guard (Task 6); Task 6 adds the explicit "5.1% drop is held, 4.9% drop publishes" boundary test.
3. **A device requests a download for a key that changed between manifest and download.** Expected: the download endpoint always presigns the current version and returns that version and sha, never a stale object. Test owned by Task 10.
4. **Two sync runs overlap** (Railway cron fires while a long bootstrap is still running). Expected: the second run exits immediately without touching state. Test owned by Task 7.
5. **QF temporarily omits a resource that later comes back** (`RESOURCE_DELETE` then `RESOURCE_CREATE`). Expected: withdrawn, then active again with a bumped version and cleared `withdrawn_at`. Test owned by Task 6.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/db/schema.ts` (modify) | `contentResources`, `contentSyncState`, `contentObjects` tables |
| `src/db/migrations/0003_*.sql` (generated) | Creates the three tables |
| `src/config/content.ts` | Reads and validates content sync env |
| `src/types/content.ts` | Shared types: QF mutation, snapshot, envelope, manifest entry |
| `src/lib/contentStorage.ts` | `ContentStorage` interface + R2 implementation |
| `src/services/qfContentClient.ts` | QF token, sync pages, snapshots, resource lists |
| `src/services/contentValidation.ts` | Snapshot validation rules |
| `src/services/contentPublisher.ts` | Envelope, hash, gzip, upload, version bump, hold, withdraw, object GC |
| `src/services/contentSyncJob.ts` | Lease, bootstrap/incremental walk, mutation handling, pending refetch |
| `src/services/contentManifest.ts` | Builds manifest + ETag; resolves downloads |
| `src/routes/v1/content.ts` | `/v1/content/manifest`, `/v1/content/resources/:key/download` |
| `src/routes/admin/content.ts` | Admin list, refetch, release, resync, QA withdraw/restore |
| `scripts/content-sync.ts` | Thin cron entrypoint with Sentry check-in |
| `scripts/content-smoke.ts` | Manual production smoke runner |
| `tests/helpers/contentFakes.ts` | `MemoryContentStorage`, `FakeQfContentClient` |
| `tests/fixtures/content.ts` | `makeContentResource`, snapshot builders |
| `tests/...` | Unit and integration tests per task |

---

### Task 1: Schema and migration

**Files:**
- Modify: `src/db/schema.ts` (append at end, before type exports if any)
- Create (generated): `src/db/migrations/0003_<generated>.sql`, `src/db/migrations/meta/0003_snapshot.json`, `src/db/migrations/meta/_journal.json` (entry added by drizzle-kit)
- Modify: `tests/helpers/db.ts` (`ALL_TABLES`)
- Create: `tests/fixtures/content.ts`
- Test: `tests/integration/db/contentSchema.test.ts`

**Interfaces:**
- Produces: tables `content_resources`, `content_sync_state`, `content_objects`; exported Drizzle tables `contentResources`, `contentSyncState`, `contentObjects`; types `ContentResourceRow`, `NewContentResourceRow`; fixture `makeContentResource(overrides?: Partial<NewContentResourceRow>): Promise<ContentResourceRow>`.

- [ ] **Step 1: Create the branch**

```bash
cd bayaan-backend
git fetch origin
git checkout -b feat/content-sync origin/develop
```

- [ ] **Step 2: Write the failing schema test**

`tests/integration/db/contentSchema.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contentResources, contentSyncState, contentObjects } from "@/db/schema";
import { makeContentResource } from "@tests/fixtures/content";

describe("content schema", () => {
  test("stores a resource with jsonb meta and defaults", async () => {
    const row = await makeContentResource({ key: "qf:translations:20" });
    expect(row.version).toBe(1);
    expect(row.status).toBe("active");
    expect(row.meta).toEqual({ name: "Test Translation", language: "en", direction: "ltr" });
    expect(row.pending_refetch).toBe(false);
  });

  test("sync state and object tables accept rows", async () => {
    await db.insert(contentSyncState).values({ source: "qf", resources_filter: "tafsirs:*;translations:*" });
    await db.insert(contentObjects).values({ object_key: "content/translation/20/abc.json", resource_key: "qf:translations:20" });
    const [state] = await db.select().from(contentSyncState).where(eq(contentSyncState.source, "qf"));
    expect(state.sync_token).toBeNull();
    const objects = await db.select().from(contentObjects);
    expect(objects[0].superseded_at).toBeNull();
  });

  test("key is the primary key", async () => {
    await makeContentResource({ key: "qf:tafsirs:169" });
    await expect(makeContentResource({ key: "qf:tafsirs:169" })).rejects.toThrow();
  });

  test("resources can be listed by status", async () => {
    await makeContentResource({ key: "qf:tafsirs:1", status: "withdrawn", withdrawn_at: new Date() });
    const rows = await db.select().from(contentResources).where(eq(contentResources.status, "withdrawn"));
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun test tests/integration/db/contentSchema.test.ts`
Expected: FAIL, cannot resolve `contentResources` / `@tests/fixtures/content`.

- [ ] **Step 4: Add the tables to `src/db/schema.ts`**

Add `jsonb` and `bigint` to the existing `drizzle-orm/pg-core` import, then append:

```ts
// Content freshness layer (spec 2026-10-05). One row per published resource,
// whatever its kind or source. `key` examples: qf:translations:20, qf:tafsirs:169.
export const contentResources = pgTable('content_resources', {
  key: text('key').primaryKey(),
  kind: text('kind').notNull(), // translation | tafsir
  source: text('source').notNull(), // qf | bayaan
  upstream_group: text('upstream_group').notNull(),
  upstream_id: integer('upstream_id').notNull(),
  version: integer('version').notNull().default(1),
  upstream_schema_version: integer('upstream_schema_version').notNull().default(1),
  status: text('status').notNull().default('active'), // active | withdrawn | held
  withdrawn_reason: text('withdrawn_reason'),
  withdrawn_at: timestamp('withdrawn_at', { withTimezone: true }),
  object_key: text('object_key'),
  sha256: text('sha256'),
  bytes: bigint('bytes', { mode: 'number' }),
  row_count: integer('row_count'),
  held_object_key: text('held_object_key'),
  held_sha256: text('held_sha256'),
  held_bytes: bigint('held_bytes', { mode: 'number' }),
  held_row_count: integer('held_row_count'),
  held_reason: text('held_reason'),
  meta: jsonb('meta').$type<ContentMeta>().notNull().default({}),
  pending_refetch: boolean('pending_refetch').notNull().default(false),
  pending_since: timestamp('pending_since', { withTimezone: true }),
  last_error: text('last_error'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('content_resources_kind_idx').on(t.kind),
  index('content_resources_status_idx').on(t.status),
  uniqueIndex('content_resources_upstream_idx').on(t.source, t.upstream_group, t.upstream_id),
]);

export interface ContentMeta {
  name?: string;
  author?: string | null;
  language?: string;
  direction?: 'ltr' | 'rtl';
  slug?: string;
  attribution?: string;
}

export const contentSyncState = pgTable('content_sync_state', {
  source: text('source').primaryKey(), // qf
  sync_token: text('sync_token'),
  resources_filter: text('resources_filter').notNull(),
  last_success_at: timestamp('last_success_at', { withTimezone: true }),
  last_attempt_at: timestamp('last_attempt_at', { withTimezone: true }),
  last_error: text('last_error'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Every R2 object we have published. superseded_at is set when a newer
// version replaces it; GC deletes objects 30 days after that.
export const contentObjects = pgTable('content_objects', {
  object_key: text('object_key').primaryKey(),
  resource_key: text('resource_key').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  superseded_at: timestamp('superseded_at', { withTimezone: true }),
}, (t) => [index('content_objects_superseded_idx').on(t.superseded_at)]);

export type ContentResourceRow = typeof contentResources.$inferSelect;
export type NewContentResourceRow = typeof contentResources.$inferInsert;
```

If `boolean`, `integer`, `index`, `uniqueIndex` are not already imported in `schema.ts`, add them to the same import.

- [ ] **Step 5: Generate the migration**

Run: `bun run db:generate`
Expected: a new `src/db/migrations/0003_<name>.sql` containing three `CREATE TABLE` statements and the indexes, plus `meta/0003_snapshot.json` and a new `_journal.json` entry with `"idx": 3`. Open the SQL and confirm it contains only these three tables (no drift from other tables). If drift appears, stop and report it; do not hand-edit other tables.

- [ ] **Step 6: Register the tables for test truncation**

In `tests/helpers/db.ts`, add `"content_resources"`, `"content_sync_state"`, `"content_objects"` to `ALL_TABLES`.

- [ ] **Step 7: Create the fixture**

`tests/fixtures/content.ts`:

```ts
import { db } from "@/db/client";
import { contentResources, type ContentResourceRow, type NewContentResourceRow } from "@/db/schema";

export async function makeContentResource(
  overrides: Partial<NewContentResourceRow> = {},
): Promise<ContentResourceRow> {
  const key = overrides.key ?? "qf:translations:20";
  const [, group, id] = key.split(":");
  const [row] = await db.insert(contentResources).values({
    key,
    kind: group === "tafsirs" ? "tafsir" : "translation",
    source: "qf",
    upstream_group: group,
    upstream_id: Number(id),
    object_key: `content/${group === "tafsirs" ? "tafsir" : "translation"}/${id}/sha.json`,
    sha256: "a".repeat(64),
    bytes: 1000,
    row_count: 6236,
    meta: { name: "Test Translation", language: "en", direction: "ltr" },
    ...overrides,
  }).returning();
  return row;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `bun test tests/integration/db/contentSchema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Typecheck and commit**

```bash
bunx tsc --noEmit
git add src/db/schema.ts src/db/migrations tests/helpers/db.ts tests/fixtures/content.ts tests/integration/db/contentSchema.test.ts
git commit -m "feat(content): add content registry tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content config

**Files:**
- Create: `src/config/content.ts`
- Modify: `.env.example`
- Test: `tests/unit/config/content.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ContentConfig {
    enabled: boolean;
    paused: boolean;
    adminQaEnabled: boolean;
    qf: { clientId: string; clientSecret: string; oauthBaseUrl: string; contentBaseUrl: string };
    r2: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string };
  }
  export function readContentConfig(env?: Record<string, string | undefined>): ContentConfig;
  export class ContentConfigError extends Error {}
  ```

- [ ] **Step 1: Write the failing test**

`tests/unit/config/content.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { ContentConfigError, readContentConfig } from "@/config/content";

const full = {
  CONTENT_SYNC_ENABLED: "true",
  QF_CLIENT_ID: "client-id",
  QF_CLIENT_SECRET: "super-secret-value",
  QF_OAUTH_BASE_URL: "https://oauth2.quran.foundation",
  QF_CONTENT_BASE_URL: "https://apis.quran.foundation/content/api/v4",
  CONTENT_R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  CONTENT_R2_BUCKET: "bayaan-content",
  CONTENT_R2_ACCESS_KEY_ID: "ak",
  CONTENT_R2_SECRET_ACCESS_KEY: "sk",
};

describe("readContentConfig", () => {
  test("disabled by default and requires nothing", () => {
    const config = readContentConfig({});
    expect(config.enabled).toBe(false);
    expect(config.paused).toBe(false);
  });

  test("reads a full enabled config", () => {
    const config = readContentConfig(full);
    expect(config.enabled).toBe(true);
    expect(config.qf.contentBaseUrl).toBe("https://apis.quran.foundation/content/api/v4");
    expect(config.r2.bucket).toBe("bayaan-content");
  });

  test("lists missing variable names without leaking values", () => {
    const { QF_CLIENT_ID: _id, CONTENT_R2_BUCKET: _b, ...partial } = full;
    try {
      readContentConfig(partial);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentConfigError);
      const message = (error as Error).message;
      expect(message).toContain("QF_CLIENT_ID");
      expect(message).toContain("CONTENT_R2_BUCKET");
      expect(message).not.toContain("super-secret-value");
    }
  });

  test("requires https for remote hosts", () => {
    expect(() => readContentConfig({ ...full, QF_CONTENT_BASE_URL: "http://apis.quran.foundation/content/api/v4" }))
      .toThrow("QF_CONTENT_BASE_URL");
  });

  test("rejects invalid boolean flags", () => {
    expect(() => readContentConfig({ ...full, CONTENT_SYNC_ENABLED: "yes" })).toThrow("CONTENT_SYNC_ENABLED");
  });

  test("paused and admin QA flags", () => {
    const config = readContentConfig({ ...full, CONTENT_SYNC_PAUSED: "true", CONTENT_ADMIN_QA_ENABLED: "true" });
    expect(config.paused).toBe(true);
    expect(config.adminQaEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/unit/config/content.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/config/content.ts`**

```ts
export interface ContentConfig {
  enabled: boolean;
  paused: boolean;
  adminQaEnabled: boolean;
  qf: { clientId: string; clientSecret: string; oauthBaseUrl: string; contentBaseUrl: string };
  r2: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string };
}

export class ContentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentConfigError";
  }
}

type Env = Record<string, string | undefined>;

function readFlag(env: Env, name: string): boolean {
  const value = env[name];
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ContentConfigError(`${name} must be "true" or "false"`);
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function readUrl(env: Env, name: string, missing: string[]): string {
  const value = env[name] ?? "";
  if (!value) {
    missing.push(name);
    return "";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContentConfigError(`${name} is not a valid URL`);
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new ContentConfigError(`${name} must use https`);
  }
  return value.replace(/\/+$/, "");
}

function readRequired(env: Env, name: string, missing: string[]): string {
  const value = env[name] ?? "";
  if (!value) missing.push(name);
  return value;
}

export function readContentConfig(env: Env = process.env): ContentConfig {
  const enabled = readFlag(env, "CONTENT_SYNC_ENABLED");
  const paused = readFlag(env, "CONTENT_SYNC_PAUSED");
  const adminQaEnabled = readFlag(env, "CONTENT_ADMIN_QA_ENABLED");
  const empty = {
    qf: { clientId: "", clientSecret: "", oauthBaseUrl: "", contentBaseUrl: "" },
    r2: { endpoint: "", bucket: "", accessKeyId: "", secretAccessKey: "" },
  };
  if (!enabled) return { enabled, paused, adminQaEnabled, ...empty };

  const missing: string[] = [];
  const config: ContentConfig = {
    enabled,
    paused,
    adminQaEnabled,
    qf: {
      clientId: readRequired(env, "QF_CLIENT_ID", missing),
      clientSecret: readRequired(env, "QF_CLIENT_SECRET", missing),
      oauthBaseUrl: readUrl(env, "QF_OAUTH_BASE_URL", missing),
      contentBaseUrl: readUrl(env, "QF_CONTENT_BASE_URL", missing),
    },
    r2: {
      endpoint: readUrl(env, "CONTENT_R2_ENDPOINT", missing),
      bucket: readRequired(env, "CONTENT_R2_BUCKET", missing),
      accessKeyId: readRequired(env, "CONTENT_R2_ACCESS_KEY_ID", missing),
      secretAccessKey: readRequired(env, "CONTENT_R2_SECRET_ACCESS_KEY", missing),
    },
  };
  if (missing.length > 0) {
    throw new ContentConfigError(`Content sync is enabled but these variables are missing: ${missing.join(", ")}`);
  }
  return config;
}
```

Note: `QF_CLIENT_ID`, `QF_CLIENT_SECRET` and `QF_OAUTH_BASE_URL` are the same names the QF user-sync PR (bayaan-backend#24) uses. Both features read the same production client, so do not rename them.

- [ ] **Step 4: Document the variables**

Append to `.env.example`:

```
# Content freshness layer (QF Content Sync). Disabled unless "true".
CONTENT_SYNC_ENABLED=false
CONTENT_SYNC_PAUSED=false
CONTENT_ADMIN_QA_ENABLED=false
QF_CLIENT_ID=
QF_CLIENT_SECRET=
QF_OAUTH_BASE_URL=https://oauth2.quran.foundation
QF_CONTENT_BASE_URL=https://apis.quran.foundation/content/api/v4
CONTENT_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CONTENT_R2_BUCKET=bayaan-content
CONTENT_R2_ACCESS_KEY_ID=
CONTENT_R2_SECRET_ACCESS_KEY=
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `bun test tests/unit/config/content.test.ts && bunx tsc --noEmit`
Expected: PASS (6 tests), no type errors.

```bash
git add src/config/content.ts .env.example tests/unit/config/content.test.ts
git commit -m "feat(content): add content sync configuration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared types and content storage

**Files:**
- Create: `src/types/content.ts`
- Create: `src/lib/contentStorage.ts`
- Create: `tests/helpers/contentFakes.ts` (storage part only in this task)
- Test: `tests/unit/lib/contentStorage.test.ts`

**Interfaces:**
- Produces (`src/types/content.ts`):
  ```ts
  export type ContentKind = "translation" | "tafsir";
  export type QfResourceGroup = "translations" | "tafsirs";
  export type QfMutationType = "RESOURCE_CREATE" | "RESOURCE_UPDATE" | "RESOURCE_DELETE" | "RESOURCE_INVALIDATE" | "ROW_CREATE" | "ROW_UPDATE" | "ROW_DELETE";
  export interface QfMutation { sequence: number; type: QfMutationType; resource_group: string; resource_id: number; snapshot_url: string | null; unavailable_reason: string | null; changed_at: string }
  export interface QfSyncPage { mutations: QfMutation[]; hasMore: boolean; nextPageUrl: string | null; nextSyncToken: string | null }
  export interface QfSnapshot { resource_group: string; resource_id: number; resource_content_id: number | null; schema_version: number; sync_sequence: number; records: Array<Record<string, unknown>> }
  export interface QfResourceListing { id: number; name: string; author_name: string | null; slug: string | null; language_name: string; translated_name?: { name: string; language_name: string } }
  export interface ContentEnvelope { envelope: 1; key: string; version: number; source: "qf"; fetched_at: string; snapshot: QfSnapshot }
  export const KIND_BY_GROUP: Record<QfResourceGroup, ContentKind>;
  export function contentKey(group: QfResourceGroup, id: number): string;
  export function isQfResourceGroup(value: string): value is QfResourceGroup;
  ```
- Produces (`src/lib/contentStorage.ts`):
  ```ts
  export interface ContentStorage {
    put(objectKey: string, gzippedBody: Uint8Array): Promise<void>;
    presign(objectKey: string, expiresInSeconds: number): string;
    delete(objectKey: string): Promise<void>;
  }
  export function createR2ContentStorage(config: ContentConfig["r2"]): ContentStorage;
  ```
- Produces (`tests/helpers/contentFakes.ts`): `class MemoryContentStorage implements ContentStorage` with `objects: Map<string, Uint8Array>` and `deleted: string[]`.

- [ ] **Step 1: Write the failing storage test**

`tests/unit/lib/contentStorage.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { createR2ContentStorage } from "@/lib/contentStorage";

let server: ReturnType<typeof Bun.serve> | null = null;
afterEach(() => { server?.stop(); server = null; });

describe("R2 content storage", () => {
  test("put sends gzip encoding and json content type", async () => {
    let seen: { method: string; path: string; encoding: string | null; type: string | null } | null = null;
    server = Bun.serve({
      port: 0,
      fetch(req) {
        seen = {
          method: req.method,
          path: new URL(req.url).pathname,
          encoding: req.headers.get("content-encoding"),
          type: req.headers.get("content-type"),
        };
        return new Response("", { status: 200, headers: { etag: '"x"' } });
      },
    });
    const storage = createR2ContentStorage({
      endpoint: `http://localhost:${server.port}`,
      bucket: "bayaan-content",
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
    await storage.put("content/translation/20/abc.json", Bun.gzipSync(new TextEncoder().encode("{}")));
    expect(seen).toEqual({
      method: "PUT",
      path: "/bayaan-content/content/translation/20/abc.json",
      encoding: "gzip",
      type: expect.stringContaining("application/json"),
    });
  });

  test("presign produces a time-limited GET url", () => {
    const storage = createR2ContentStorage({
      endpoint: "https://acct.r2.cloudflarestorage.com",
      bucket: "bayaan-content",
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
    const url = new URL(storage.presign("content/tafsir/169/def.json", 600));
    expect(url.pathname).toContain("content/tafsir/169/def.json");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/unit/lib/contentStorage.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the types**

`src/types/content.ts`:

```ts
export type ContentKind = "translation" | "tafsir";
export type QfResourceGroup = "translations" | "tafsirs";
export type QfMutationType =
  | "RESOURCE_CREATE"
  | "RESOURCE_UPDATE"
  | "RESOURCE_DELETE"
  | "RESOURCE_INVALIDATE"
  | "ROW_CREATE"
  | "ROW_UPDATE"
  | "ROW_DELETE";

export interface QfMutation {
  sequence: number;
  type: QfMutationType;
  resource_group: string;
  resource_id: number;
  snapshot_url: string | null;
  unavailable_reason: string | null;
  changed_at: string;
}

export interface QfSyncPage {
  mutations: QfMutation[];
  hasMore: boolean;
  nextPageUrl: string | null;
  nextSyncToken: string | null;
}

export interface QfSnapshot {
  resource_group: string;
  resource_id: number;
  resource_content_id: number | null;
  schema_version: number;
  sync_sequence: number;
  records: Array<Record<string, unknown>>;
}

export interface QfResourceListing {
  id: number;
  name: string;
  author_name: string | null;
  slug: string | null;
  language_name: string;
  translated_name?: { name: string; language_name: string };
}

export interface ContentEnvelope {
  envelope: 1;
  key: string;
  version: number;
  source: "qf";
  fetched_at: string;
  snapshot: QfSnapshot;
}

export const KIND_BY_GROUP: Record<QfResourceGroup, ContentKind> = {
  translations: "translation",
  tafsirs: "tafsir",
};

export const QF_GROUPS: readonly QfResourceGroup[] = ["tafsirs", "translations"];

export function isQfResourceGroup(value: string): value is QfResourceGroup {
  return value === "translations" || value === "tafsirs";
}

export function contentKey(group: QfResourceGroup, id: number): string {
  return `qf:${group}:${id}`;
}
```

- [ ] **Step 4: Implement the storage**

`src/lib/contentStorage.ts`:

```ts
import type { ContentConfig } from "../config/content";

export interface ContentStorage {
  put(objectKey: string, gzippedBody: Uint8Array): Promise<void>;
  presign(objectKey: string, expiresInSeconds: number): string;
  delete(objectKey: string): Promise<void>;
}

export function createR2ContentStorage(config: ContentConfig["r2"]): ContentStorage {
  const client = new Bun.S3Client({
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  return {
    async put(objectKey, gzippedBody) {
      // Content-Encoding lets the device's HTTP stack decompress transparently.
      await client.file(objectKey).write(gzippedBody, { type: "application/json", contentEncoding: "gzip" });
    },
    presign(objectKey, expiresInSeconds) {
      return client.file(objectKey).presign({ method: "GET", expiresIn: expiresInSeconds });
    },
    async delete(objectKey) {
      await client.file(objectKey).delete();
    },
  };
}
```

If `tsc` rejects `contentEncoding` in the write options type, keep the option (runtime support was verified on Bun 1.3.12) and widen with a typed options object:
`const options: Parameters<ReturnType<typeof client.file>["write"]>[1] & { contentEncoding: string } = { type: "application/json", contentEncoding: "gzip" };`

- [ ] **Step 5: Add the in-memory fake**

`tests/helpers/contentFakes.ts`:

```ts
import type { ContentStorage } from "@/lib/contentStorage";

export class MemoryContentStorage implements ContentStorage {
  objects = new Map<string, Uint8Array>();
  deleted: string[] = [];

  async put(objectKey: string, gzippedBody: Uint8Array): Promise<void> {
    this.objects.set(objectKey, gzippedBody);
  }

  presign(objectKey: string, expiresInSeconds: number): string {
    return `https://r2.test/${objectKey}?X-Amz-Expires=${expiresInSeconds}`;
  }

  async delete(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
    this.deleted.push(objectKey);
  }

  readJson(objectKey: string): unknown {
    const body = this.objects.get(objectKey);
    if (!body) throw new Error(`no object ${objectKey}`);
    return JSON.parse(new TextDecoder().decode(Bun.gunzipSync(body)));
  }
}
```

- [ ] **Step 6: Run, typecheck, commit**

Run: `bun test tests/unit/lib/contentStorage.test.ts && bunx tsc --noEmit`
Expected: PASS (2 tests).

```bash
git add src/types/content.ts src/lib/contentStorage.ts tests/helpers/contentFakes.ts tests/unit/lib/contentStorage.test.ts
git commit -m "feat(content): add content types and R2 storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: QF content client

**Files:**
- Create: `src/services/qfContentClient.ts`
- Modify: `tests/helpers/contentFakes.ts` (add `FakeQfContentClient`)
- Test: `tests/unit/services/qfContentClient.test.ts`

**Interfaces:**
- Consumes: `ContentConfig["qf"]` (Task 2), types from Task 3.
- Produces:
  ```ts
  export interface QfContentClient {
    syncPage(input: { bootstrap: boolean; filter: string; syncToken: string | null; cursorPath: string | null }): Promise<QfSyncPage>;
    snapshot(group: QfResourceGroup, id: number): Promise<QfSnapshot>;
    listResources(group: QfResourceGroup): Promise<QfResourceListing[]>;
  }
  export class QfContentError extends Error { code: "unavailable" | "rate_limited" | "resync_required" | "not_found" | "invalid_response" | "auth_failed"; retryAfterSeconds: number | null }
  export function canonicalFilter(groups: readonly QfResourceGroup[]): string;
  export function createQfContentClient(config: ContentConfig["qf"], fetchImpl?: typeof fetch, now?: () => number): QfContentClient;
  ```
- `canonicalFilter` returns the un-encoded canonical string (`tafsirs:*;translations:*`); the client URL-encodes it.

- [ ] **Step 1: Write the failing tests**

`tests/unit/services/qfContentClient.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { canonicalFilter, createQfContentClient, QfContentError } from "@/services/qfContentClient";

const config = {
  clientId: "cid",
  clientSecret: "csecret",
  oauthBaseUrl: "https://oauth.test",
  contentBaseUrl: "https://content.test/content/api/v4",
};

type Call = { url: string; init?: RequestInit };

function fakeFetch(responses: Array<(call: Call) => Response>) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: input.toString(), init };
    calls.push(call);
    const next = responses.shift();
    if (!next) throw new Error(`unexpected call ${call.url}`);
    return next(call);
  }) as typeof fetch;
  return { impl, calls };
}

const token = () => Response.json({ access_token: "tok", expires_in: 3600, token_type: "bearer", scope: "content" });

describe("canonicalFilter", () => {
  test("sorts groups alphabetically", () => {
    expect(canonicalFilter(["translations", "tafsirs"])).toBe("tafsirs:*;translations:*");
  });
});

describe("QF content client", () => {
  test("uses basic auth for the token and content headers for calls", async () => {
    const { impl, calls } = fakeFetch([
      token,
      () => Response.json({ sync: { sync_until_sequence: 1, has_more: false, next_page_url: null, next_sync_token: "t1", mutations: [] } }),
    ]);
    const client = createQfContentClient(config, impl);
    const page = await client.syncPage({ bootstrap: true, filter: "tafsirs:*;translations:*", syncToken: null, cursorPath: null });

    expect(calls[0].url).toBe("https://oauth.test/oauth2/token");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("authorization")).toBe(`Basic ${btoa("cid:csecret")}`);
    expect(String(calls[0].init?.body)).toBe("grant_type=client_credentials&scope=content");
    expect(String(calls[0].init?.body)).not.toContain("csecret");

    expect(calls[1].url).toBe(
      "https://content.test/content/api/v4/resources/sync?bootstrap=true&resources=tafsirs%3A*%3Btranslations%3A*&per_page=100",
    );
    const contentHeaders = new Headers(calls[1].init?.headers);
    expect(contentHeaders.get("x-auth-token")).toBe("tok");
    expect(contentHeaders.get("x-client-id")).toBe("cid");
    expect(page).toEqual({ mutations: [], hasMore: false, nextPageUrl: null, nextSyncToken: "t1" });
  });

  test("reuses the token until it is about to expire", async () => {
    let now = 0;
    const sync = () => Response.json({ sync: { sync_until_sequence: 1, has_more: false, next_page_url: null, next_sync_token: "t", mutations: [] } });
    const { impl, calls } = fakeFetch([token, sync, sync, token, sync]);
    const client = createQfContentClient(config, impl, () => now);
    const input = { bootstrap: false, filter: "tafsirs:*;translations:*", syncToken: "s", cursorPath: null };
    await client.syncPage(input);
    now = 3_000_000;
    await client.syncPage(input);
    now = 3_590_000;
    await client.syncPage(input);
    expect(calls.filter((c) => c.url.endsWith("/oauth2/token"))).toHaveLength(2);
  });

  test("incremental sync sends the token and cursor pages use the relative path", async () => {
    const { impl, calls } = fakeFetch([
      token,
      () => Response.json({ sync: { sync_until_sequence: 2, has_more: true, next_page_url: "/api/v4/resources/sync?cursor=abc", next_sync_token: null, mutations: [] } }),
      () => Response.json({ sync: { sync_until_sequence: 2, has_more: false, next_page_url: null, next_sync_token: "t2", mutations: [] } }),
    ]);
    const client = createQfContentClient(config, impl);
    const first = await client.syncPage({ bootstrap: false, filter: "tafsirs:*;translations:*", syncToken: "t1", cursorPath: null });
    expect(calls[1].url).toContain("sync_token=t1");
    await client.syncPage({ bootstrap: false, filter: "tafsirs:*;translations:*", syncToken: "t1", cursorPath: first.nextPageUrl });
    expect(calls[2].url).toBe("https://content.test/content/api/v4/resources/sync?cursor=abc");
  });

  test("maps resync_required, 404, 429 and 5xx", async () => {
    const { impl } = fakeFetch([
      token,
      () => Response.json({ details: { error: { code: "resync_required" } } }, { status: 409 }),
      () => Response.json({ details: { error: { code: "snapshot_not_found" } } }, { status: 404 }),
      () => new Response("slow down", { status: 429, headers: { "retry-after": "30" } }),
      () => new Response("boom", { status: 502 }),
    ]);
    const client = createQfContentClient(config, impl);
    const input = { bootstrap: false, filter: "tafsirs:*;translations:*", syncToken: "t", cursorPath: null };
    await expect(client.syncPage(input)).rejects.toMatchObject({ code: "resync_required" });
    await expect(client.snapshot("tafsirs", 1)).rejects.toMatchObject({ code: "not_found" });
    await expect(client.snapshot("tafsirs", 1)).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 30 });
    await expect(client.snapshot("tafsirs", 1)).rejects.toBeInstanceOf(QfContentError);
  });

  test("token failure does not leak the secret", async () => {
    const { impl } = fakeFetch([() => Response.json({ error: "invalid_client" }, { status: 401 })]);
    const client = createQfContentClient(config, impl);
    try {
      await client.listResources("translations");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "auth_failed" });
      expect((error as Error).message).not.toContain("csecret");
    }
  });

  test("parses snapshots and resource listings", async () => {
    const { impl } = fakeFetch([
      token,
      () => Response.json({ resource_group: "translations", resource_id: 20, resource_content_id: 20, schema_version: 1, sync_sequence: 9, records: [{ id: 1, verse_key: "1:1", text: "x" }] }),
      () => Response.json({ translations: [{ id: 20, name: "Saheeh International", author_name: "Saheeh International", slug: "en-sahih", language_name: "english" }] }),
    ]);
    const client = createQfContentClient(config, impl);
    const snapshot = await client.snapshot("translations", 20);
    expect(snapshot.records).toHaveLength(1);
    const list = await client.listResources("translations");
    expect(list[0].id).toBe(20);
  });

  test("rejects malformed sync bodies", async () => {
    const { impl } = fakeFetch([token, () => Response.json({ sync: { mutations: "nope" } })]);
    const client = createQfContentClient(config, impl);
    await expect(client.syncPage({ bootstrap: true, filter: "tafsirs:*;translations:*", syncToken: null, cursorPath: null }))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/unit/services/qfContentClient.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the client**

`src/services/qfContentClient.ts`:

```ts
import type { ContentConfig } from "../config/content";
import type { QfMutation, QfResourceGroup, QfResourceListing, QfSnapshot, QfSyncPage } from "../types/content";

const TOKEN_SKEW_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

export type QfContentErrorCode =
  | "unavailable"
  | "rate_limited"
  | "resync_required"
  | "not_found"
  | "invalid_response"
  | "auth_failed";

export class QfContentError extends Error {
  constructor(public code: QfContentErrorCode, message: string, public retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "QfContentError";
  }
}

export interface QfContentClient {
  syncPage(input: { bootstrap: boolean; filter: string; syncToken: string | null; cursorPath: string | null }): Promise<QfSyncPage>;
  snapshot(group: QfResourceGroup, id: number): Promise<QfSnapshot>;
  listResources(group: QfResourceGroup): Promise<QfResourceListing[]>;
}

export function canonicalFilter(groups: readonly QfResourceGroup[]): string {
  return [...groups].sort().map((group) => `${group}:*`).join(";");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMutation(value: unknown): QfMutation {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.resource_group !== "string"
    || typeof value.resource_id !== "number" || typeof value.sequence !== "number") {
    throw new QfContentError("invalid_response", "Malformed sync mutation");
  }
  return {
    sequence: value.sequence,
    type: value.type as QfMutation["type"],
    resource_group: value.resource_group,
    resource_id: value.resource_id,
    snapshot_url: typeof value.snapshot_url === "string" ? value.snapshot_url : null,
    unavailable_reason: typeof value.unavailable_reason === "string" ? value.unavailable_reason : null,
    changed_at: typeof value.changed_at === "string" ? value.changed_at : "",
  };
}

function parseSyncPage(body: unknown): QfSyncPage {
  if (!isRecord(body) || !isRecord(body.sync) || !Array.isArray(body.sync.mutations)
    || typeof body.sync.has_more !== "boolean") {
    throw new QfContentError("invalid_response", "Malformed sync page");
  }
  const sync = body.sync;
  return {
    mutations: sync.mutations.map(parseMutation),
    hasMore: sync.has_more as boolean,
    nextPageUrl: typeof sync.next_page_url === "string" ? sync.next_page_url : null,
    nextSyncToken: typeof sync.next_sync_token === "string" ? sync.next_sync_token : null,
  };
}

function parseSnapshot(body: unknown): QfSnapshot {
  if (!isRecord(body) || typeof body.resource_group !== "string" || typeof body.resource_id !== "number"
    || typeof body.schema_version !== "number" || !Array.isArray(body.records)) {
    throw new QfContentError("invalid_response", "Malformed snapshot");
  }
  return {
    resource_group: body.resource_group,
    resource_id: body.resource_id,
    resource_content_id: typeof body.resource_content_id === "number" ? body.resource_content_id : null,
    schema_version: body.schema_version,
    sync_sequence: typeof body.sync_sequence === "number" ? body.sync_sequence : 0,
    records: body.records.filter(isRecord),
  };
}

function parseListing(value: unknown): QfResourceListing | null {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string") return null;
  return {
    id: value.id,
    name: value.name,
    author_name: typeof value.author_name === "string" ? value.author_name : null,
    slug: typeof value.slug === "string" ? value.slug : null,
    language_name: typeof value.language_name === "string" ? value.language_name : "",
  };
}

async function errorFor(response: Response): Promise<QfContentError> {
  const retryAfter = Number(response.headers.get("retry-after"));
  let code = "";
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.details) && isRecord(body.details.error) && typeof body.details.error.code === "string") {
      code = body.details.error.code;
    }
  } catch {
    // Non-JSON error bodies are fine; status decides.
  }
  if (code === "resync_required" || code === "token_filter_mismatch" || code.startsWith("cursor_")) {
    return new QfContentError("resync_required", `QF sync requires a resync (${code})`);
  }
  if (response.status === 404) return new QfContentError("not_found", "QF resource not found");
  if (response.status === 429) {
    return new QfContentError("rate_limited", "QF rate limited", Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3600) : 60);
  }
  if (response.status === 401 || response.status === 403) return new QfContentError("auth_failed", "QF rejected the content token");
  return new QfContentError("unavailable", `QF returned ${response.status}`);
}

export function createQfContentClient(
  config: ContentConfig["qf"],
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): QfContentClient {
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt - TOKEN_SKEW_MS > now()) return token.value;
    const response = await fetchImpl(`${config.oauthBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=content",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new QfContentError("auth_failed", `QF token request failed with ${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.access_token !== "string") {
      throw new QfContentError("auth_failed", "QF token response was malformed");
    }
    const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
    token = { value: body.access_token, expiresAt: now() + expiresIn * 1000 };
    return token.value;
  }

  async function getJson(url: string): Promise<unknown> {
    const response = await fetchImpl(url, {
      headers: { "x-auth-token": await getToken(), "x-client-id": config.clientId },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw await errorFor(response);
    try {
      return await response.json();
    } catch {
      throw new QfContentError("invalid_response", "QF returned invalid JSON");
    }
  }

  // next_page_url is a relative /api/v4/... path; resolve it against the content origin + /content.
  function resolveCursor(path: string): string {
    const base = new URL(config.contentBaseUrl);
    const prefix = base.pathname.replace(/\/api\/v4\/?$/, "");
    return `${base.origin}${prefix}${path}`;
  }

  return {
    async syncPage({ bootstrap, filter, syncToken, cursorPath }) {
      if (cursorPath) return parseSyncPage(await getJson(resolveCursor(cursorPath)));
      const params = new URLSearchParams();
      if (bootstrap) params.set("bootstrap", "true");
      params.set("resources", filter);
      if (!bootstrap && syncToken) params.set("sync_token", syncToken);
      params.set("per_page", "100");
      return parseSyncPage(await getJson(`${config.contentBaseUrl}/resources/sync?${params.toString()}`));
    },
    async snapshot(group, id) {
      return parseSnapshot(await getJson(`${config.contentBaseUrl}/resources/snapshots/${group}/${id}`));
    },
    async listResources(group) {
      const body = await getJson(`${config.contentBaseUrl}/resources/${group}`);
      const list = isRecord(body) && Array.isArray(body[group]) ? body[group] : [];
      return list.map(parseListing).filter((item): item is QfResourceListing => item !== null);
    },
  };
}
```

Note on the test URL: `URLSearchParams` encodes `:` as `%3A`, `;` as `%3B` and leaves `*` as is, which is the encoded form verified against production in spec 11a.

- [ ] **Step 4: Add the fake client to `tests/helpers/contentFakes.ts`**

```ts
import { QfContentError, type QfContentClient } from "@/services/qfContentClient";
import type { QfResourceGroup, QfResourceListing, QfSnapshot, QfSyncPage } from "@/types/content";

export class FakeQfContentClient implements QfContentClient {
  pages: QfSyncPage[] = [];
  syncCalls: Array<{ bootstrap: boolean; filter: string; syncToken: string | null; cursorPath: string | null }> = [];
  snapshots = new Map<string, QfSnapshot | QfContentError>();
  listings: Record<QfResourceGroup, QfResourceListing[]> = { translations: [], tafsirs: [] };
  syncError: QfContentError | null = null;

  async syncPage(input: { bootstrap: boolean; filter: string; syncToken: string | null; cursorPath: string | null }): Promise<QfSyncPage> {
    this.syncCalls.push(input);
    if (this.syncError) {
      const error = this.syncError;
      this.syncError = null;
      throw error;
    }
    const page = this.pages.shift();
    if (!page) throw new Error("FakeQfContentClient: no page queued");
    return page;
  }

  async snapshot(group: QfResourceGroup, id: number): Promise<QfSnapshot> {
    const value = this.snapshots.get(`${group}:${id}`);
    if (!value) throw new QfContentError("not_found", "missing");
    if (value instanceof QfContentError) throw value;
    return value;
  }

  async listResources(group: QfResourceGroup): Promise<QfResourceListing[]> {
    return this.listings[group];
  }
}
```

- [ ] **Step 5: Run, typecheck, commit**

Run: `bun test tests/unit/services/qfContentClient.test.ts && bunx tsc --noEmit`
Expected: PASS (7 tests).

```bash
git add src/services/qfContentClient.ts tests/helpers/contentFakes.ts tests/unit/services/qfContentClient.test.ts
git commit -m "feat(content): add QF content sync client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Snapshot validation

**Files:**
- Create: `src/services/contentValidation.ts`
- Modify: `tests/fixtures/content.ts` (snapshot builders)
- Test: `tests/unit/services/contentValidation.test.ts`

**Interfaces:**
- Consumes: `QfSnapshot`, `QfResourceGroup` (Task 3).
- Produces:
  ```ts
  export const SUPPORTED_SCHEMA_VERSIONS: ReadonlySet<number>; // {1}
  export const TOTAL_VERSES = 6236;
  export type ValidationResult = { ok: true; rowCount: number } | { ok: false; reason: "unsupported_schema" | "empty" | "invalid_rows" | "incomplete_coverage" };
  export function validateSnapshot(group: QfResourceGroup, snapshot: QfSnapshot): ValidationResult;
  ```
- Produces (fixtures): `buildTranslationSnapshot(id: number, opts?: { verses?: number; schemaVersion?: number }): QfSnapshot` and `buildTafsirSnapshot(id: number, opts?: { verses?: number }): QfSnapshot`. Both build records over real verse keys using `VERSE_COUNTS` (114 chapter lengths).

- [ ] **Step 1: Add snapshot builders to `tests/fixtures/content.ts`**

```ts
import type { QfSnapshot } from "@/types/content";

// Verses per chapter, 1..114 (sums to 6236).
export const VERSE_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

function verseKeys(limit = 6236): string[] {
  const keys: string[] = [];
  VERSE_COUNTS.forEach((count, index) => {
    for (let verse = 1; verse <= count; verse++) keys.push(`${index + 1}:${verse}`);
  });
  return keys.slice(0, limit);
}

export function buildTranslationSnapshot(id: number, opts: { verses?: number; schemaVersion?: number } = {}): QfSnapshot {
  return {
    resource_group: "translations",
    resource_id: id,
    resource_content_id: id,
    schema_version: opts.schemaVersion ?? 1,
    sync_sequence: 1,
    records: verseKeys(opts.verses).map((verse_key, index) => ({
      id: index + 1,
      verse_id: index + 1,
      verse_key,
      text: `Translation ${verse_key}`,
      foot_notes: [],
    })),
  };
}

export function buildTafsirSnapshot(id: number, opts: { verses?: number } = {}): QfSnapshot {
  return {
    resource_group: "tafsirs",
    resource_id: id,
    resource_content_id: id,
    schema_version: 1,
    sync_sequence: 1,
    records: verseKeys(opts.verses).map((verse_key, index) => ({
      id: index + 1,
      verse_id: index + 1,
      verse_key,
      start_verse_id: index + 1,
      end_verse_id: index + 1,
      group_verses_count: 1,
      text: `<p>Tafsir ${verse_key}</p>`,
    })),
  };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/services/contentValidation.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { validateSnapshot } from "@/services/contentValidation";
import { buildTafsirSnapshot, buildTranslationSnapshot } from "@tests/fixtures/content";

describe("validateSnapshot", () => {
  test("accepts a complete translation", () => {
    expect(validateSnapshot("translations", buildTranslationSnapshot(20))).toEqual({ ok: true, rowCount: 6236 });
  });

  test("rejects unsupported schema versions", () => {
    expect(validateSnapshot("translations", buildTranslationSnapshot(20, { schemaVersion: 2 })))
      .toEqual({ ok: false, reason: "unsupported_schema" });
  });

  test("rejects empty snapshots", () => {
    expect(validateSnapshot("tafsirs", buildTafsirSnapshot(169, { verses: 0 }))).toEqual({ ok: false, reason: "empty" });
  });

  test("rejects incomplete translation coverage", () => {
    expect(validateSnapshot("translations", buildTranslationSnapshot(20, { verses: 6000 })))
      .toEqual({ ok: false, reason: "incomplete_coverage" });
  });

  test("rejects duplicate or invalid verse keys", () => {
    const duplicate = buildTranslationSnapshot(20);
    duplicate.records[1] = { ...duplicate.records[1], verse_key: "1:1" };
    expect(validateSnapshot("translations", duplicate)).toEqual({ ok: false, reason: "invalid_rows" });
    const invalid = buildTranslationSnapshot(20);
    invalid.records[0] = { ...invalid.records[0], verse_key: "115:1" };
    expect(validateSnapshot("translations", invalid)).toEqual({ ok: false, reason: "invalid_rows" });
  });

  test("accepts grouped tafsir rows and empty continuation rows", () => {
    const snapshot = buildTafsirSnapshot(169);
    snapshot.records[0] = { ...snapshot.records[0], start_verse_id: 1, end_verse_id: 2, group_verses_count: 2 };
    snapshot.records[1] = { ...snapshot.records[1], text: "" };
    expect(validateSnapshot("tafsirs", snapshot)).toEqual({ ok: true, rowCount: 6236 });
  });

  test("rejects tafsir rows with inverted ranges", () => {
    const snapshot = buildTafsirSnapshot(169);
    snapshot.records[5] = { ...snapshot.records[5], start_verse_id: 9, end_verse_id: 3 };
    expect(validateSnapshot("tafsirs", snapshot)).toEqual({ ok: false, reason: "invalid_rows" });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test tests/unit/services/contentValidation.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement the validator**

`src/services/contentValidation.ts`:

```ts
import type { QfResourceGroup, QfSnapshot } from "../types/content";

export const SUPPORTED_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([1]);
export const TOTAL_VERSES = 6236;
const VERSE_KEY = /^(\d{1,3}):(\d{1,3})$/;

export type ValidationResult =
  | { ok: true; rowCount: number }
  | { ok: false; reason: "unsupported_schema" | "empty" | "invalid_rows" | "incomplete_coverage" };

function isValidVerseKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = VERSE_KEY.exec(value);
  if (!match) return false;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  return chapter >= 1 && chapter <= 114 && verse >= 1 && verse <= 286;
}

function validateTranslation(records: Array<Record<string, unknown>>): ValidationResult {
  const seen = new Set<string>();
  for (const record of records) {
    if (!isValidVerseKey(record.verse_key) || typeof record.text !== "string" || seen.has(record.verse_key)) {
      return { ok: false, reason: "invalid_rows" };
    }
    seen.add(record.verse_key);
  }
  if (seen.size !== TOTAL_VERSES) return { ok: false, reason: "incomplete_coverage" };
  return { ok: true, rowCount: records.length };
}

function validateTafsir(records: Array<Record<string, unknown>>): ValidationResult {
  for (const record of records) {
    const start = record.start_verse_id;
    const end = record.end_verse_id;
    if (!isValidVerseKey(record.verse_key) || typeof start !== "number" || typeof end !== "number"
      || start < 1 || end > TOTAL_VERSES || start > end
      || (record.text !== null && record.text !== undefined && typeof record.text !== "string")) {
      return { ok: false, reason: "invalid_rows" };
    }
  }
  return { ok: true, rowCount: records.length };
}

export function validateSnapshot(group: QfResourceGroup, snapshot: QfSnapshot): ValidationResult {
  if (!SUPPORTED_SCHEMA_VERSIONS.has(snapshot.schema_version)) return { ok: false, reason: "unsupported_schema" };
  if (snapshot.records.length === 0) return { ok: false, reason: "empty" };
  return group === "translations" ? validateTranslation(snapshot.records) : validateTafsir(snapshot.records);
}
```

- [ ] **Step 5: Run, typecheck, commit**

Run: `bun test tests/unit/services/contentValidation.test.ts && bunx tsc --noEmit`
Expected: PASS (7 tests).

```bash
git add src/services/contentValidation.ts tests/fixtures/content.ts tests/unit/services/contentValidation.test.ts
git commit -m "feat(content): validate QF snapshots before publishing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Publisher

**Files:**
- Create: `src/services/contentPublisher.ts`
- Test: `tests/integration/services/contentPublisher.test.ts`

**Interfaces:**
- Consumes: `ContentStorage` (Task 3), `validateSnapshot` (Task 5), tables (Task 1), types (Task 3).
- Produces:
  ```ts
  export type PublishOutcome = "published" | "unchanged" | "held" | "rejected";
  export async function publishSnapshot(input: { group: QfResourceGroup; id: number; snapshot: QfSnapshot; meta?: ContentMeta; storage: ContentStorage; now?: Date }): Promise<PublishOutcome>;
  export async function withdrawResource(key: string, reason: string, now?: Date): Promise<boolean>;
  export async function releaseHeld(key: string, now?: Date): Promise<boolean>;
  export async function markPendingRefetch(key: string, error: string, group: QfResourceGroup, id: number, now?: Date): Promise<void>;
  export async function collectGarbage(storage: ContentStorage, now?: Date): Promise<number>;
  export const DROP_GUARD_RATIO = 0.05;
  ```
- Behavior contract:
  - Validation failure with `unsupported_schema` stores the artifact as held (status `held` for a new resource, or `held_*` fields on an existing active resource so it keeps serving). Any other validation failure returns `rejected`, sets `pending_refetch` with `last_error`, publishes nothing.
  - If the envelope body hash (excluding `version` and `fetched_at`) equals the current published snapshot hash, return `unchanged` and clear `pending_refetch`. Implement by hashing `JSON.stringify(snapshot)` into `snapshot_sha` stored in `held_reason`? No: store it in object key? Use this rule: compute `contentSha = sha256(JSON.stringify(snapshot))`; the object key uses `contentSha`; if `object_key` of the current row equals the new object key, it is unchanged.
  - Drop guard: if current `row_count` exists and new `rowCount < current * (1 - 0.05)`, upload the object and record it in `held_*` with `held_reason = "row_drop"`, return `held`.
  - Otherwise upload, then in one transaction: upsert row with `version = version + 1` (or 1 for new), `status = active`, clear withdrawn and held fields, clear `pending_refetch`, mark the previous `object_key` superseded in `content_objects`, insert the new object.

- [ ] **Step 1: Write the failing tests**

`tests/integration/services/contentPublisher.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contentObjects, contentResources } from "@/db/schema";
import { collectGarbage, publishSnapshot, releaseHeld, withdrawResource } from "@/services/contentPublisher";
import { MemoryContentStorage } from "@tests/helpers/contentFakes";
import { buildTafsirSnapshot, buildTranslationSnapshot } from "@tests/fixtures/content";

async function row(key: string) {
  const [result] = await db.select().from(contentResources).where(eq(contentResources.key, key));
  return result;
}

describe("publishSnapshot", () => {
  test("publishes a new resource as version 1 with a verifiable envelope", async () => {
    const storage = new MemoryContentStorage();
    const outcome = await publishSnapshot({
      group: "translations", id: 20, snapshot: buildTranslationSnapshot(20), storage,
      meta: { name: "Saheeh International", language: "en", direction: "ltr" },
    });
    expect(outcome).toBe("published");
    const published = await row("qf:translations:20");
    expect(published.version).toBe(1);
    expect(published.status).toBe("active");
    expect(published.row_count).toBe(6236);
    expect(published.object_key).toMatch(/^content\/translation\/20\/[0-9a-f]{64}\.json$/);

    const envelope = storage.readJson(published.object_key!) as { envelope: number; key: string; version: number; snapshot: { records: unknown[] } };
    expect(envelope.envelope).toBe(1);
    expect(envelope.key).toBe("qf:translations:20");
    expect(envelope.version).toBe(1);
    expect(envelope.snapshot.records).toHaveLength(6236);

    const text = new TextDecoder().decode(Bun.gunzipSync(storage.objects.get(published.object_key!)!));
    expect(new Bun.CryptoHasher("sha256").update(text).digest("hex")).toBe(published.sha256);
    expect(published.bytes).toBe(storage.objects.get(published.object_key!)!.byteLength);
  });

  test("identical snapshot is unchanged and does not bump the version", async () => {
    const storage = new MemoryContentStorage();
    await publishSnapshot({ group: "translations", id: 20, snapshot: buildTranslationSnapshot(20), storage });
    const outcome = await publishSnapshot({ group: "translations", id: 20, snapshot: buildTranslationSnapshot(20), storage });
    expect(outcome).toBe("unchanged");
    expect((await row("qf:translations:20")).version).toBe(1);
  });

  test("a changed snapshot bumps the version and supersedes the old object", async () => {
    const storage = new MemoryContentStorage();
    await publishSnapshot({ group: "translations", id: 20, snapshot: buildTranslationSnapshot(20), storage });
    const first = await row("qf:translations:20");
    const changed = buildTranslationSnapshot(20);
    changed.records[0] = { ...changed.records[0], text: "corrected" };
    expect(await publishSnapshot({ group: "translations", id: 20, snapshot: changed, storage })).toBe("published");
    const second = await row("qf:translations:20");
    expect(second.version).toBe(2);
    expect(second.object_key).not.toBe(first.object_key);
    const [old] = await db.select().from(contentObjects).where(eq(contentObjects.object_key, first.object_key!));
    expect(old.superseded_at).not.toBeNull();
  });

  test("drop guard: 5.1% drop is held and keeps serving, 4.9% publishes", async () => {
    const storage = new MemoryContentStorage();
    await publishSnapshot({ group: "tafsirs", id: 169, snapshot: buildTafsirSnapshot(169), storage });
    const before = await row("qf:tafsirs:169");

    const bigDrop = buildTafsirSnapshot(169, { verses: Math.floor(6236 * 0.949) });
    expect(await publishSnapshot({ group: "tafsirs", id: 169, snapshot: bigDrop, storage })).toBe("held");
    const held = await row("qf:tafsirs:169");
    expect(held.status).toBe("active");
    expect(held.version).toBe(before.version);
    expect(held.object_key).toBe(before.object_key);
    expect(held.held_reason).toBe("row_drop");
    expect(held.held_object_key).not.toBeNull();

    const smallDrop = buildTafsirSnapshot(169, { verses: Math.ceil(6236 * 0.951) });
    expect(await publishSnapshot({ group: "tafsirs", id: 169, snapshot: smallDrop, storage })).toBe("published");
    const after = await row("qf:tafsirs:169");
    expect(after.held_reason).toBeNull();
    expect(after.version).toBe(before.version + 1);
  });

  test("invalid snapshots are rejected and marked for refetch", async () => {
    const storage = new MemoryContentStorage();
    const outcome = await publishSnapshot({ group: "translations", id: 7, snapshot: buildTranslationSnapshot(7, { verses: 10 }), storage });
    expect(outcome).toBe("rejected");
    expect(storage.objects.size).toBe(0);
  });

  test("unsupported schema on a new resource is held, not served", async () => {
    const storage = new MemoryContentStorage();
    const outcome = await publishSnapshot({ group: "translations", id: 8, snapshot: buildTranslationSnapshot(8, { schemaVersion: 2 }), storage });
    expect(outcome).toBe("held");
    const held = await row("qf:translations:8");
    expect(held.status).toBe("held");
    expect(held.held_reason).toBe("unsupported_schema");
  });

  test("releaseHeld promotes the held artifact", async () => {
    const storage = new MemoryContentStorage();
    await publishSnapshot({ group: "tafsirs", id: 169, snapshot: buildTafsirSnapshot(169), storage });
    await publishSnapshot({ group: "tafsirs", id: 169, snapshot: buildTafsirSnapshot(169, { verses: 3000 }), storage });
    const heldRow = await row("qf:tafsirs:169");
    expect(await releaseHeld("qf:tafsirs:169")).toBe(true);
    const released = await row("qf:tafsirs:169");
    expect(released.object_key).toBe(heldRow.held_object_key);
    expect(released.version).toBe(heldRow.version + 1);
    expect(released.held_object_key).toBeNull();
    expect(released.row_count).toBe(3000);
  });

  test("withdraw then recreate reactivates with a bumped version", async () => {
    const storage = new MemoryContentStorage();
    await publishSnapshot({ group: "translations", id: 20, snapshot: buildTranslationSnapshot(20), storage });
    expect(await withdrawResource("qf:translations:20", "copyright_holder_request")).toBe(true);
    const withdrawn = await row("qf:translations:20");
    expect(withdrawn.status).toBe("withdrawn");
    expect(withdrawn.withdrawn_reason).toBe("copyright_holder_request");

    const restored = buildTranslationSnapshot(20);
    restored.records[0] = { ...restored.records[0], text: "restored" };
    await publishSnapshot({ group: "translations", id: 20, snapshot: restored, storage });
    const active = await row("qf:translations:20");
    expect(active.status).toBe("active");
    expect(active.withdrawn_at).toBeNull();
    expect(active.version).toBe(withdrawn.version + 1);
  });
});

describe("collectGarbage", () => {
  test("deletes objects superseded more than 30 days ago", async () => {
    const storage = new MemoryContentStorage();
    const now = new Date("2026-11-30T00:00:00Z");
    await db.insert(contentObjects).values([
      { object_key: "old", resource_key: "k", superseded_at: new Date("2026-10-01T00:00:00Z") },
      { object_key: "recent", resource_key: "k", superseded_at: new Date("2026-11-15T00:00:00Z") },
      { object_key: "live", resource_key: "k", superseded_at: null },
    ]);
    storage.objects.set("old", new Uint8Array([1]));
    expect(await collectGarbage(storage, now)).toBe(1);
    expect(storage.deleted).toEqual(["old"]);
    const remaining = await db.select().from(contentObjects);
    expect(remaining.map((r) => r.object_key).sort()).toEqual(["live", "recent"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/integration/services/contentPublisher.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the publisher**

`src/services/contentPublisher.ts`:

```ts
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { contentObjects, contentResources, type ContentMeta, type ContentResourceRow } from "../db/schema";
import type { ContentStorage } from "../lib/contentStorage";
import { KIND_BY_GROUP, contentKey, type ContentEnvelope, type QfResourceGroup, type QfSnapshot } from "../types/content";
import { validateSnapshot } from "./contentValidation";

export const DROP_GUARD_RATIO = 0.05;
const GC_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type PublishOutcome = "published" | "unchanged" | "held" | "rejected";

function sha256Hex(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

interface Artifact {
  objectKey: string;
  sha256: string;
  bytes: number;
}

async function uploadArtifact(
  storage: ContentStorage,
  group: QfResourceGroup,
  id: number,
  version: number,
  snapshot: QfSnapshot,
  now: Date,
): Promise<Artifact> {
  const key = contentKey(group, id);
  // The object key is addressed by the snapshot content so an identical snapshot maps to the same key.
  const contentSha = sha256Hex(JSON.stringify(snapshot));
  const envelope: ContentEnvelope = { envelope: 1, key, version, source: "qf", fetched_at: now.toISOString(), snapshot };
  const text = JSON.stringify(envelope);
  const gzipped = Bun.gzipSync(new TextEncoder().encode(text));
  const objectKey = `content/${KIND_BY_GROUP[group]}/${id}/${contentSha}.json`;
  await storage.put(objectKey, gzipped);
  await db.insert(contentObjects).values({ object_key: objectKey, resource_key: key }).onConflictDoNothing();
  return { objectKey, sha256: sha256Hex(text), bytes: gzipped.byteLength };
}

async function currentRow(key: string): Promise<ContentResourceRow | undefined> {
  const [row] = await db.select().from(contentResources).where(eq(contentResources.key, key));
  return row;
}

export async function markPendingRefetch(key: string, error: string, group: QfResourceGroup, id: number, now: Date = new Date()): Promise<void> {
  // A resource we have never published is recorded as held (it is not served).
  // An existing resource only gets its refetch fields touched, so its published artifact keeps serving.
  await db.insert(contentResources).values({
    key, kind: KIND_BY_GROUP[group], source: "qf", upstream_group: group, upstream_id: id,
    status: "held", held_reason: "never_published", pending_refetch: true, pending_since: now, last_error: error,
  }).onConflictDoUpdate({
    target: contentResources.key,
    set: {
      pending_refetch: true,
      pending_since: sql`coalesce(${contentResources.pending_since}, ${now})`,
      last_error: error,
      updated_at: now,
    },
  });
}

export async function publishSnapshot(input: {
  group: QfResourceGroup;
  id: number;
  snapshot: QfSnapshot;
  meta?: ContentMeta;
  storage: ContentStorage;
  now?: Date;
}): Promise<PublishOutcome> {
  const { group, id, snapshot, storage } = input;
  const now = input.now ?? new Date();
  const key = contentKey(group, id);
  const existing = await currentRow(key);
  const validation = validateSnapshot(group, snapshot);

  if (!validation.ok && validation.reason !== "unsupported_schema") {
    await markPendingRefetch(key, `validation_failed:${validation.reason}`, group, id, now);
    return "rejected";
  }

  const contentSha = sha256Hex(JSON.stringify(snapshot));
  const expectedObjectKey = `content/${KIND_BY_GROUP[group]}/${id}/${contentSha}.json`;
  if (existing && existing.status === "active" && existing.object_key === expectedObjectKey) {
    await db.update(contentResources)
      .set({ pending_refetch: false, pending_since: null, last_error: null, updated_at: now, ...(input.meta ? { meta: input.meta } : {}) })
      .where(eq(contentResources.key, key));
    return "unchanged";
  }

  const nextVersion = (existing?.version ?? 0) + 1;
  const rowCount = snapshot.records.length;
  const artifact = await uploadArtifact(storage, group, id, nextVersion, snapshot, now);
  const holdReason = !validation.ok
    ? "unsupported_schema"
    : existing?.row_count && existing.status !== "withdrawn" && rowCount < existing.row_count * (1 - DROP_GUARD_RATIO)
      ? "row_drop"
      : null;

  if (holdReason) {
    const held = {
      held_object_key: artifact.objectKey, held_sha256: artifact.sha256, held_bytes: artifact.bytes,
      held_row_count: rowCount, held_reason: holdReason, pending_refetch: false, pending_since: null,
      last_error: null, updated_at: now,
    };
    if (existing && existing.object_key) {
      await db.update(contentResources).set(held).where(eq(contentResources.key, key));
    } else {
      await db.insert(contentResources).values({
        key, kind: KIND_BY_GROUP[group], source: "qf", upstream_group: group, upstream_id: id,
        version: nextVersion, upstream_schema_version: snapshot.schema_version, status: "held",
        meta: input.meta ?? {}, ...held,
      }).onConflictDoUpdate({ target: contentResources.key, set: { ...held, status: "held" } });
    }
    return "held";
  }

  await db.transaction(async (tx) => {
    if (existing?.object_key) {
      await tx.update(contentObjects).set({ superseded_at: now }).where(eq(contentObjects.object_key, existing.object_key));
    }
    const published = {
      version: nextVersion, upstream_schema_version: snapshot.schema_version, status: "active",
      withdrawn_reason: null, withdrawn_at: null, object_key: artifact.objectKey, sha256: artifact.sha256,
      bytes: artifact.bytes, row_count: rowCount, held_object_key: null, held_sha256: null, held_bytes: null,
      held_row_count: null, held_reason: null, pending_refetch: false, pending_since: null, last_error: null,
      updated_at: now, ...(input.meta ? { meta: input.meta } : {}),
    };
    await tx.insert(contentResources).values({
      key, kind: KIND_BY_GROUP[group], source: "qf", upstream_group: group, upstream_id: id, meta: input.meta ?? {}, ...published,
    }).onConflictDoUpdate({ target: contentResources.key, set: published });
  });
  return "published";
}

export async function withdrawResource(key: string, reason: string, now: Date = new Date()): Promise<boolean> {
  const updated = await db.update(contentResources)
    .set({ status: "withdrawn", withdrawn_reason: reason, withdrawn_at: now, pending_refetch: false, updated_at: now })
    .where(eq(contentResources.key, key))
    .returning({ key: contentResources.key });
  return updated.length > 0;
}

export async function releaseHeld(key: string, now: Date = new Date()): Promise<boolean> {
  const row = await currentRow(key);
  if (!row?.held_object_key || !row.held_sha256) return false;
  await db.transaction(async (tx) => {
    if (row.object_key) {
      await tx.update(contentObjects).set({ superseded_at: now }).where(eq(contentObjects.object_key, row.object_key));
    }
    await tx.update(contentResources).set({
      version: row.object_key ? row.version + 1 : row.version, status: "active",
      object_key: row.held_object_key, sha256: row.held_sha256, bytes: row.held_bytes, row_count: row.held_row_count,
      held_object_key: null, held_sha256: null, held_bytes: null, held_row_count: null, held_reason: null, updated_at: now,
    }).where(eq(contentResources.key, key));
  });
  return true;
}

export async function collectGarbage(storage: ContentStorage, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - GC_AFTER_MS);
  const stale = await db.select().from(contentObjects)
    .where(and(isNotNull(contentObjects.superseded_at), lt(contentObjects.superseded_at, cutoff)));
  for (const object of stale) {
    await storage.delete(object.object_key);
    await db.delete(contentObjects).where(eq(contentObjects.object_key, object.object_key));
  }
  return stale.length;
}
```

`markPendingRefetch` must not overwrite an existing published artifact, which the `onConflictDoUpdate` set above guarantees (it only touches refetch fields). `withdrawResource` keeps `version` unchanged; a later re-create bumps it.

Note the version semantics for the release test: a held artifact uploaded with `nextVersion` in its envelope is promoted as `row.version + 1`, which equals that `nextVersion` because the row's version did not change while held. The envelope's version therefore matches the manifest.

- [ ] **Step 4: Run, typecheck, commit**

Run: `bun test tests/integration/services/contentPublisher.test.ts && bunx tsc --noEmit`
Expected: PASS (9 tests).

```bash
git add src/services/contentPublisher.ts tests/integration/services/contentPublisher.test.ts
git commit -m "feat(content): publish versioned snapshots to R2 with drop guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sync job

**Files:**
- Create: `src/services/contentSyncJob.ts`
- Test: `tests/integration/services/contentSyncJob.test.ts`

**Interfaces:**
- Consumes: `QfContentClient`, `canonicalFilter`, `QfContentError` (Task 4); `publishSnapshot`, `withdrawResource`, `markPendingRefetch`, `collectGarbage` (Task 6); tables (Task 1).
- Produces:
  ```ts
  export interface ContentSyncResult { status: "completed" | "skipped_locked" | "failed"; mode: "bootstrap" | "incremental"; published: number; unchanged: number; held: number; rejected: number; withdrawn: number; pendingRetried: number; error: string | null }
  export async function runContentSync(deps: { client: QfContentClient; storage: ContentStorage; now?: () => Date }): Promise<ContentSyncResult>;
  export const CONTENT_SYNC_LOCK_ID = 7_210_001;
  ```
- Behavior:
  1. `pg_try_advisory_lock(CONTENT_SYNC_LOCK_ID)` on a dedicated connection; if false return `skipped_locked`. Always unlock in `finally`.
  2. Load or create `content_sync_state` for `qf` with `resources_filter = canonicalFilter(QF_GROUPS)`. If the stored filter differs from the canonical one, clear `sync_token` (forces bootstrap).
  3. Refresh `meta` for both groups from `listResources` (best effort: a failure logs to `last_error` but does not stop the run). Map listing to `ContentMeta`: `name`, `author` (`author_name`), `language` (`language_name`), `slug`, `direction` from a small RTL language list (`arabic, urdu, persian, farsi, hebrew, pashto, sindhi, kurdish, uyghur, dhivehi`), `attribution: "<name>, via Quran Foundation"`.
  4. Walk pages (`bootstrap` when no token). Collect `publish` set and `withdraw` map keyed by `group:id`, ignoring groups other than `translations`/`tafsirs`. For each mutation: `RESOURCE_CREATE`, `RESOURCE_INVALIDATE`, `ROW_*` add to publish (and remove from withdraw); `RESOURCE_DELETE` adds to withdraw (and removes from publish); `RESOURCE_UPDATE` is ignored.
  5. Bootstrap only: if any group in the filter produced zero resources, fail the run with `error = "bootstrap_missing_group:<group>"` and do not store the token. Also withdraw (`absent_from_bootstrap`) every active `qf` resource not in the bootstrap publish set.
  6. Apply withdrawals, then publish each resource: fetch snapshot; on `QfContentError` mark pending refetch and continue; `rate_limited` stops further fetching in this run (remaining resources are marked pending).
  7. Retry every resource with `pending_refetch = true` not already handled this run (same rules).
  8. Store `next_sync_token`, `last_success_at`, clear `last_error`. Run `collectGarbage`.
  9. `resync_required` from a sync page: clear the token and run the bootstrap path once within the same run.

- [ ] **Step 1: Write the failing tests**

`tests/integration/services/contentSyncJob.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contentResources, contentSyncState } from "@/db/schema";
import { CONTENT_SYNC_LOCK_ID, runContentSync } from "@/services/contentSyncJob";
import { QfContentError } from "@/services/qfContentClient";
import type { QfMutation, QfSyncPage } from "@/types/content";
import { FakeQfContentClient, MemoryContentStorage } from "@tests/helpers/contentFakes";
import { buildTafsirSnapshot, buildTranslationSnapshot } from "@tests/fixtures/content";

function mutation(type: QfMutation["type"], group: string, id: number, extra: Partial<QfMutation> = {}): QfMutation {
  return { sequence: 1, type, resource_group: group, resource_id: id, snapshot_url: null, unavailable_reason: null, changed_at: "", ...extra };
}

function page(mutations: QfMutation[], token: string | null = "tok-1", nextPageUrl: string | null = null): QfSyncPage {
  return { mutations, hasMore: nextPageUrl !== null, nextPageUrl, nextSyncToken: nextPageUrl ? null : token };
}

function setup() {
  const client = new FakeQfContentClient();
  const storage = new MemoryContentStorage();
  client.snapshots.set("translations:20", buildTranslationSnapshot(20));
  client.snapshots.set("tafsirs:169", buildTafsirSnapshot(169));
  client.listings.translations = [{ id: 20, name: "Saheeh International", author_name: "Saheeh International", slug: "en-sahih", language_name: "english" }];
  client.listings.tafsirs = [{ id: 169, name: "Ibn Kathir (Abridged)", author_name: "Hafiz Ibn Kathir", slug: "en-ibn-kathir", language_name: "english" }];
  return { client, storage };
}

async function state() {
  const [row] = await db.select().from(contentSyncState).where(eq(contentSyncState.source, "qf"));
  return row;
}

describe("runContentSync", () => {
  test("bootstrap across pages publishes both groups and stores the token only at the end", async () => {
    const { client, storage } = setup();
    client.pages = [
      page([mutation("RESOURCE_CREATE", "translations", 20)], null, "/api/v4/resources/sync?cursor=a"),
      page([mutation("RESOURCE_CREATE", "tafsirs", 169)], "tok-1"),
    ];
    const result = await runContentSync({ client, storage });
    expect(result).toMatchObject({ status: "completed", mode: "bootstrap", published: 2 });
    expect(client.syncCalls[0]).toMatchObject({ bootstrap: true, filter: "tafsirs:*;translations:*" });
    expect(client.syncCalls[1].cursorPath).toBe("/api/v4/resources/sync?cursor=a");
    expect((await state()).sync_token).toBe("tok-1");
    const [saheeh] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:translations:20"));
    expect(saheeh.meta).toMatchObject({ name: "Saheeh International", language: "english", direction: "ltr", attribution: "Saheeh International, via Quran Foundation" });
  });

  test("bootstrap missing a group fails without storing a token", async () => {
    const { client, storage } = setup();
    client.pages = [page([mutation("RESOURCE_CREATE", "translations", 20)])];
    const result = await runContentSync({ client, storage });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("bootstrap_missing_group:tafsirs");
    expect((await state()).sync_token).toBeNull();
  });

  test("incremental: row update republishes, delete withdraws, resource update is ignored", async () => {
    const { client, storage } = setup();
    client.pages = [page([mutation("RESOURCE_CREATE", "translations", 20), mutation("RESOURCE_CREATE", "tafsirs", 169)])];
    await runContentSync({ client, storage });

    const corrected = buildTranslationSnapshot(20);
    corrected.records[0] = { ...corrected.records[0], text: "fixed" };
    client.snapshots.set("translations:20", corrected);
    client.pages = [page([
      mutation("ROW_UPDATE", "translations", 20),
      mutation("RESOURCE_DELETE", "tafsirs", 169, { unavailable_reason: "copyright_holder_request" }),
      mutation("RESOURCE_UPDATE", "translations", 20),
    ], "tok-2")];
    const result = await runContentSync({ client, storage });
    expect(result).toMatchObject({ mode: "incremental", published: 1, withdrawn: 1 });
    expect(client.syncCalls.at(-1)).toMatchObject({ bootstrap: false, syncToken: "tok-1" });
    const rows = await db.select().from(contentResources);
    expect(rows.find((r) => r.key === "qf:translations:20")!.version).toBe(2);
    expect(rows.find((r) => r.key === "qf:tafsirs:169")).toMatchObject({ status: "withdrawn", withdrawn_reason: "copyright_holder_request" });
    expect((await state()).sync_token).toBe("tok-2");
  });

  test("a failing snapshot is marked pending and retried on the next run", async () => {
    const { client, storage } = setup();
    client.snapshots.set("tafsirs:169", new QfContentError("unavailable", "502"));
    client.pages = [page([mutation("RESOURCE_CREATE", "translations", 20), mutation("RESOURCE_CREATE", "tafsirs", 169)])];
    const first = await runContentSync({ client, storage });
    expect(first.status).toBe("completed");
    const [pending] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:tafsirs:169"));
    expect(pending.pending_refetch).toBe(true);

    client.snapshots.set("tafsirs:169", buildTafsirSnapshot(169));
    client.pages = [page([], "tok-2")];
    const second = await runContentSync({ client, storage });
    expect(second.pendingRetried).toBe(1);
    const [fixed] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:tafsirs:169"));
    expect(fixed).toMatchObject({ status: "active", pending_refetch: false });
  });

  test("resync_required re-bootstraps and withdraws resources absent from the new bootstrap", async () => {
    const { client, storage } = setup();
    client.snapshots.set("translations:21", buildTranslationSnapshot(21));
    client.pages = [page([mutation("RESOURCE_CREATE", "translations", 20), mutation("RESOURCE_CREATE", "translations", 21), mutation("RESOURCE_CREATE", "tafsirs", 169)])];
    await runContentSync({ client, storage });

    client.syncError = new QfContentError("resync_required", "resync");
    client.pages = [page([mutation("RESOURCE_CREATE", "translations", 20), mutation("RESOURCE_CREATE", "tafsirs", 169)], "tok-3")];
    const result = await runContentSync({ client, storage });
    expect(result.mode).toBe("bootstrap");
    const [gone] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:translations:21"));
    expect(gone).toMatchObject({ status: "withdrawn", withdrawn_reason: "absent_from_bootstrap" });
    expect((await state()).sync_token).toBe("tok-3");
  });

  test("a second concurrent run exits on the lease", async () => {
    const { client, storage } = setup();
    const holder = postgres(process.env.DATABASE_URL!, { max: 1 });
    await holder`SELECT pg_advisory_lock(${CONTENT_SYNC_LOCK_ID})`;
    try {
      const result = await runContentSync({ client, storage });
      expect(result.status).toBe("skipped_locked");
      expect(client.syncCalls).toHaveLength(0);
    } finally {
      await holder`SELECT pg_advisory_unlock(${CONTENT_SYNC_LOCK_ID})`;
      await holder.end();
    }
  });

  test("rate limiting stops fetching and leaves the rest pending", async () => {
    const { client, storage } = setup();
    client.snapshots.set("tafsirs:169", new QfContentError("rate_limited", "429", 60));
    client.pages = [page([mutation("RESOURCE_CREATE", "tafsirs", 169), mutation("RESOURCE_CREATE", "translations", 20)])];
    const result = await runContentSync({ client, storage });
    expect(result.status).toBe("completed");
    const rows = await db.select().from(contentResources);
    expect(rows.filter((r) => r.pending_refetch).map((r) => r.key).sort()).toEqual(["qf:tafsirs:169", "qf:translations:20"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/integration/services/contentSyncJob.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the job**

`src/services/contentSyncJob.ts`:

```ts
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { contentResources, contentSyncState, type ContentMeta } from "../db/schema";
import type { ContentStorage } from "../lib/contentStorage";
import { QF_GROUPS, contentKey, isQfResourceGroup, type QfResourceGroup, type QfResourceListing } from "../types/content";
import { collectGarbage, markPendingRefetch, publishSnapshot, withdrawResource } from "./contentPublisher";
import { QfContentError, canonicalFilter, type QfContentClient } from "./qfContentClient";

export const CONTENT_SYNC_LOCK_ID = 7_210_001;
const RTL_LANGUAGES = new Set(["arabic", "urdu", "persian", "farsi", "hebrew", "pashto", "sindhi", "kurdish", "uyghur", "dhivehi"]);

export interface ContentSyncResult {
  status: "completed" | "skipped_locked" | "failed";
  mode: "bootstrap" | "incremental";
  published: number;
  unchanged: number;
  held: number;
  rejected: number;
  withdrawn: number;
  pendingRetried: number;
  error: string | null;
}

type Target = { group: QfResourceGroup; id: number };

function targetKey(target: Target): string {
  return `${target.group}:${target.id}`;
}

function toMeta(listing: QfResourceListing): ContentMeta {
  return {
    name: listing.name,
    author: listing.author_name,
    language: listing.language_name,
    slug: listing.slug ?? undefined,
    direction: RTL_LANGUAGES.has(listing.language_name.toLowerCase()) ? "rtl" : "ltr",
    attribution: `${listing.name}, via Quran Foundation`,
  };
}

async function loadMeta(client: QfContentClient): Promise<{ meta: Map<string, ContentMeta>; error: string | null }> {
  const meta = new Map<string, ContentMeta>();
  try {
    for (const group of QF_GROUPS) {
      for (const listing of await client.listResources(group)) meta.set(`${group}:${listing.id}`, toMeta(listing));
    }
    return { meta, error: null };
  } catch (error) {
    return { meta, error: `meta_refresh_failed:${error instanceof Error ? error.message : "unknown"}` };
  }
}

export async function runContentSync(deps: { client: QfContentClient; storage: ContentStorage; now?: () => Date }): Promise<ContentSyncResult> {
  const now = deps.now ?? (() => new Date());
  const lockConnection = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
  const result: ContentSyncResult = {
    status: "completed", mode: "incremental", published: 0, unchanged: 0, held: 0, rejected: 0, withdrawn: 0, pendingRetried: 0, error: null,
  };
  try {
    const [{ locked }] = await lockConnection<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${CONTENT_SYNC_LOCK_ID}) AS locked`;
    if (!locked) return { ...result, status: "skipped_locked" };
    try {
      return await runLocked(deps.client, deps.storage, now, result);
    } finally {
      await lockConnection`SELECT pg_advisory_unlock(${CONTENT_SYNC_LOCK_ID})`;
    }
  } finally {
    await lockConnection.end({ timeout: 5 });
  }
}

async function runLocked(client: QfContentClient, storage: ContentStorage, now: () => Date, result: ContentSyncResult): Promise<ContentSyncResult> {
  const filter = canonicalFilter(QF_GROUPS);
  await db.insert(contentSyncState).values({ source: "qf", resources_filter: filter }).onConflictDoNothing();
  const [stored] = await db.select().from(contentSyncState).where(eq(contentSyncState.source, "qf"));
  let syncToken = stored.resources_filter === filter ? stored.sync_token : null;
  await db.update(contentSyncState).set({ last_attempt_at: now(), resources_filter: filter }).where(eq(contentSyncState.source, "qf"));

  const { meta, error: metaError } = await loadMeta(client);
  let walk: { publish: Map<string, Target>; withdraw: Map<string, string>; token: string | null };
  try {
    walk = await walkPages(client, filter, syncToken);
  } catch (error) {
    if (error instanceof QfContentError && error.code === "resync_required") {
      syncToken = null;
      walk = await walkPages(client, filter, null);
    } else {
      return await fail(result, error, now);
    }
  }
  result.mode = syncToken ? "incremental" : "bootstrap";

  if (result.mode === "bootstrap") {
    for (const group of QF_GROUPS) {
      if (![...walk.publish.values()].some((target) => target.group === group)) {
        return await fail(result, new Error(`bootstrap_missing_group:${group}`), now);
      }
    }
    const active = await db.select({ key: contentResources.key }).from(contentResources)
      .where(and(eq(contentResources.source, "qf"), eq(contentResources.status, "active")));
    const present = new Set([...walk.publish.values()].map((t) => contentKey(t.group, t.id)));
    for (const row of active) if (!present.has(row.key)) walk.withdraw.set(row.key, "absent_from_bootstrap");
  }

  for (const [key, reason] of walk.withdraw) {
    if (await withdrawResource(key, reason, now())) result.withdrawn++;
  }

  const handled = new Set<string>();
  let rateLimited = false;
  async function publish(target: Target): Promise<void> {
    const key = contentKey(target.group, target.id);
    handled.add(key);
    if (rateLimited) {
      await markPendingRefetch(key, "deferred_rate_limited", target.group, target.id, now());
      return;
    }
    try {
      const snapshot = await client.snapshot(target.group, target.id);
      const outcome = await publishSnapshot({ group: target.group, id: target.id, snapshot, storage, meta: meta.get(targetKey(target)), now: now() });
      result[outcome]++;
    } catch (error) {
      if (error instanceof QfContentError && error.code === "rate_limited") rateLimited = true;
      await markPendingRefetch(key, error instanceof Error ? error.message : "unknown", target.group, target.id, now());
    }
  }

  for (const target of walk.publish.values()) await publish(target);

  const pending = await db.select().from(contentResources)
    .where(and(eq(contentResources.source, "qf"), eq(contentResources.pending_refetch, true)));
  for (const row of pending) {
    if (handled.has(row.key) || !isQfResourceGroup(row.upstream_group)) continue;
    result.pendingRetried++;
    await publish({ group: row.upstream_group, id: row.upstream_id });
  }

  await db.update(contentSyncState)
    .set({ sync_token: walk.token, last_success_at: now(), last_error: metaError, updated_at: now() })
    .where(eq(contentSyncState.source, "qf"));
  await collectGarbage(storage, now());
  return result;
}

async function walkPages(client: QfContentClient, filter: string, syncToken: string | null) {
  const publish = new Map<string, Target>();
  const withdraw = new Map<string, string>();
  let cursorPath: string | null = null;
  let token: string | null = null;
  do {
    const page = await client.syncPage({ bootstrap: syncToken === null, filter, syncToken, cursorPath });
    for (const mutation of page.mutations) {
      if (!isQfResourceGroup(mutation.resource_group)) continue;
      const target: Target = { group: mutation.resource_group, id: mutation.resource_id };
      const id = targetKey(target);
      const key = contentKey(target.group, target.id);
      if (mutation.type === "RESOURCE_DELETE") {
        publish.delete(id);
        withdraw.set(key, mutation.unavailable_reason ?? "unavailable");
      } else if (mutation.type !== "RESOURCE_UPDATE") {
        withdraw.delete(key);
        publish.set(id, target);
      }
    }
    cursorPath = page.hasMore ? page.nextPageUrl : null;
    token = page.nextSyncToken ?? token;
  } while (cursorPath);
  return { publish, withdraw, token };
}

async function fail(result: ContentSyncResult, error: unknown, now: () => Date): Promise<ContentSyncResult> {
  const message = error instanceof Error ? error.message : "unknown";
  await db.update(contentSyncState).set({ last_error: message, updated_at: now() }).where(eq(contentSyncState.source, "qf"));
  return { ...result, status: "failed", error: message };
}
```

Two details to keep while implementing:
- The `result[outcome]++` line relies on `PublishOutcome` values `"published" | "unchanged" | "held" | "rejected"` matching the result fields. Keep those names in sync.
- In the "resync_required" test the first run already stored `tok-1`, so the second run starts incremental, gets `resync_required`, clears the token and bootstraps. `result.mode` is computed after the walk from `syncToken`, so it reports `bootstrap`.

- [ ] **Step 4: Run, typecheck, commit**

Run: `bun test tests/integration/services/contentSyncJob.test.ts && bunx tsc --noEmit`
Expected: PASS (7 tests).

```bash
git add src/services/contentSyncJob.ts tests/integration/services/contentSyncJob.test.ts
git commit -m "feat(content): add QF content sync job with lease and pending refetch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Cron entrypoint and Railway service

**Files:**
- Create: `scripts/content-sync.ts`
- Modify: `package.json` (`content:sync` script)
- Modify: `README.md` (Content sync section)

**Interfaces:**
- Consumes: `readContentConfig` (Task 2), `createR2ContentStorage` (Task 3), `createQfContentClient` (Task 4), `runContentSync` (Task 7), `initSentry`/`captureException` from `src/lib/sentry.ts`.

- [ ] **Step 1: Write the entrypoint**

`scripts/content-sync.ts`:

```ts
import * as Sentry from "@sentry/bun";
import { readContentConfig } from "../src/config/content";
import { createR2ContentStorage } from "../src/lib/contentStorage";
import { captureException, initSentry } from "../src/lib/sentry";
import { runContentSync } from "../src/services/contentSyncJob";
import { createQfContentClient } from "../src/services/qfContentClient";

initSentry();
const config = readContentConfig();
if (!config.enabled) {
  console.log(JSON.stringify({ job: "content-sync", status: "disabled" }));
  process.exit(0);
}

const checkInId = Sentry.captureCheckIn(
  { monitorSlug: "content-sync", status: "in_progress" },
  { schedule: { type: "crontab", value: "0 * * * *" }, checkinMargin: 10, maxRuntime: 30, failureIssueThreshold: 6 },
);

try {
  const result = await runContentSync({
    client: createQfContentClient(config.qf),
    storage: createR2ContentStorage(config.r2),
  });
  console.log(JSON.stringify({ job: "content-sync", ...result }));
  const ok = result.status !== "failed";
  Sentry.captureCheckIn({ checkInId, monitorSlug: "content-sync", status: ok ? "ok" : "error" });
  if (result.held > 0) captureException(new Error(`content-sync held ${result.held} resource(s)`), { result });
  if (!ok) captureException(new Error(`content-sync failed: ${result.error}`), { result });
  await Sentry.flush(2000);
  process.exit(ok ? 0 : 1);
} catch (error) {
  captureException(error, { job: "content-sync" });
  Sentry.captureCheckIn({ checkInId, monitorSlug: "content-sync", status: "error" });
  await Sentry.flush(2000);
  process.exit(1);
}
```

The Sentry monitor alerts after 6 consecutive missed or failed hourly check-ins, which is the spec's "no success in 6 hours" rule.

- [ ] **Step 2: Add the script**

In `package.json` scripts: `"content:sync": "bun run scripts/content-sync.ts"`.

- [ ] **Step 3: Smoke-run it disabled**

Run: `CONTENT_SYNC_ENABLED=false bun run content:sync`
Expected: prints `{"job":"content-sync","status":"disabled"}` and exits 0.

- [ ] **Step 4: Document the Railway service**

Add a "Content sync" section to `README.md`:

```md
## Content sync (QF Content Sync)

A second Railway service runs the hourly content sync from this repo.

- Service: `content-sync`, same repo and branch as the API.
- Start command: `bun run content:sync`
- Cron schedule: `0 * * * *`
- Restart policy: never (the next cron run retries).
- Variables: the same `DATABASE_URL` and `SENTRY_*` as the API, plus
  `CONTENT_SYNC_ENABLED=true`, `QF_CLIENT_ID`, `QF_CLIENT_SECRET`,
  `QF_OAUTH_BASE_URL=https://oauth2.quran.foundation`,
  `QF_CONTENT_BASE_URL=https://apis.quran.foundation/content/api/v4`,
  `CONTENT_R2_ENDPOINT`, `CONTENT_R2_BUCKET=bayaan-content`,
  `CONTENT_R2_ACCESS_KEY_ID`, `CONTENT_R2_SECRET_ACCESS_KEY`.
- The API service needs the `CONTENT_R2_*` variables and `CONTENT_SYNC_ENABLED=true`
  to presign downloads. It never needs the QF client secret for content.
- Always use the production QF client: pre-live only covers surahs 1 and 2.
- The R2 bucket `bayaan-content` must be private (no public access, no custom domain).
```

- [ ] **Step 5: Typecheck and commit**

```bash
bunx tsc --noEmit
git add scripts/content-sync.ts package.json README.md
git commit -m "feat(content): add hourly content sync entrypoint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Manifest endpoint

**Files:**
- Create: `src/services/contentManifest.ts`
- Create: `src/routes/v1/content.ts`
- Modify: `src/routes/v1/index.ts`
- Test: `tests/integration/routes/v1.content.test.ts`

**Interfaces:**
- Consumes: tables (Task 1), `readContentConfig` (Task 2).
- Produces:
  ```ts
  export interface ManifestEntry { key: string; kind: string; source: string; version: number; status: "active" | "withdrawn"; upstream_schema_version?: number; bytes?: number; sha256?: string; meta?: ContentMeta; withdrawn_reason?: string | null }
  export interface Manifest { format: 1; generated_at: string; paused: boolean; resources: ManifestEntry[] }
  export async function buildManifest(kinds: string[], paused: boolean, now?: Date): Promise<{ manifest: Manifest; etag: string }>;
  export const WITHDRAWN_WINDOW_DAYS = 90;
  ```
- Route: `GET /v1/content/manifest?kinds=translation,tafsir` (default both). `ETag` is `"` + sha256 of the JSON body excluding `generated_at` + `"`. `If-None-Match` equal to it returns 304 with no body. `Cache-Control: no-store`. Disabled config returns 503 `CONTENT_UNAVAILABLE`.
- Manifest rules: `active` rows listed with full fields; `held` rows with an `object_key` (held update on an active resource) listed as active with their current published fields; `held` rows without `object_key` omitted; `withdrawn` rows listed with `key, kind, source, version, status, withdrawn_reason` only, if `withdrawn_at` is within 90 days.

- [ ] **Step 1: Write the failing tests**

`tests/integration/routes/v1.content.test.ts`:

```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { __resetRateLimitForTesting } from "@/middleware/apiAuth";
import { buildTestApp } from "@tests/helpers/app";
import { makeApiKey } from "@tests/fixtures/apiKey";
import { makeContentResource } from "@tests/fixtures/content";

process.env.CONTENT_SYNC_ENABLED = "true";
process.env.QF_CLIENT_ID = "cid";
process.env.QF_CLIENT_SECRET = "secret";
process.env.QF_OAUTH_BASE_URL = "https://oauth.test";
process.env.QF_CONTENT_BASE_URL = "https://content.test/content/api/v4";
process.env.CONTENT_R2_ENDPOINT = "https://acct.r2.cloudflarestorage.com";
process.env.CONTENT_R2_BUCKET = "bayaan-content";
process.env.CONTENT_R2_ACCESS_KEY_ID = "ak";
process.env.CONTENT_R2_SECRET_ACCESS_KEY = "sk";

async function get(path: string, headers: Record<string, string> = {}) {
  const { rawKey } = await makeApiKey();
  return buildTestApp().request(path, { headers: { Authorization: `Bearer ${rawKey}`, ...headers } });
}

describe("/v1/content/manifest", () => {
  beforeEach(() => __resetRateLimitForTesting());

  test("401 without an API key", async () => {
    const res = await buildTestApp().request("/v1/content/manifest");
    expect(res.status).toBe(401);
  });

  test("lists active resources with meta and integrity fields", async () => {
    await makeContentResource({ key: "qf:translations:20", version: 3, upstream_schema_version: 1 });
    const res = await get("/v1/content/manifest?kinds=translation");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.format).toBe(1);
    expect(body.paused).toBe(false);
    expect(body.resources).toEqual([{
      key: "qf:translations:20", kind: "translation", source: "qf", version: 3, status: "active",
      upstream_schema_version: 1, bytes: 1000, sha256: "a".repeat(64),
      meta: { name: "Test Translation", language: "en", direction: "ltr" },
    }]);
  });

  test("withdrawn entries appear for 90 days with minimal fields", async () => {
    await makeContentResource({ key: "qf:tafsirs:93", status: "withdrawn", withdrawn_reason: "copyright_holder_request", withdrawn_at: new Date(Date.now() - 10 * 86_400_000) });
    await makeContentResource({ key: "qf:tafsirs:94", status: "withdrawn", withdrawn_reason: "old", withdrawn_at: new Date(Date.now() - 91 * 86_400_000) });
    const body = await (await get("/v1/content/manifest?kinds=tafsir")).json();
    expect(body.resources).toEqual([
      { key: "qf:tafsirs:93", kind: "tafsir", source: "qf", version: 1, status: "withdrawn", withdrawn_reason: "copyright_holder_request" },
    ]);
  });

  test("held updates keep serving the published version; first-publish holds are omitted", async () => {
    await makeContentResource({ key: "qf:tafsirs:169", held_object_key: "x", held_reason: "row_drop" });
    await makeContentResource({ key: "qf:tafsirs:170", status: "held", object_key: null, sha256: null, held_object_key: "y", held_reason: "unsupported_schema" });
    const body = await (await get("/v1/content/manifest?kinds=tafsir")).json();
    expect(body.resources.map((r: { key: string }) => r.key)).toEqual(["qf:tafsirs:169"]);
    expect(body.resources[0].status).toBe("active");
  });

  test("ETag and If-None-Match return 304", async () => {
    await makeContentResource({ key: "qf:translations:20" });
    const first = await get("/v1/content/manifest");
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    const second = await get("/v1/content/manifest", { "If-None-Match": etag! });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  test("paused flag is reported", async () => {
    process.env.CONTENT_SYNC_PAUSED = "true";
    try {
      const body = await (await get("/v1/content/manifest")).json();
      expect(body.paused).toBe(true);
    } finally {
      delete process.env.CONTENT_SYNC_PAUSED;
    }
  });

  test("rejects unknown kinds", async () => {
    const res = await get("/v1/content/manifest?kinds=audio");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/integration/routes/v1.content.test.ts`
Expected: FAIL, 404 for `/v1/content/manifest`.

- [ ] **Step 3: Implement the manifest service**

`src/services/contentManifest.ts`:

```ts
import { inArray } from "drizzle-orm";
import { db } from "../db/client";
import { contentResources, type ContentMeta, type ContentResourceRow } from "../db/schema";

export const WITHDRAWN_WINDOW_DAYS = 90;
export const MANIFEST_KINDS = ["translation", "tafsir"] as const;

export interface ManifestEntry {
  key: string;
  kind: string;
  source: string;
  version: number;
  status: "active" | "withdrawn";
  upstream_schema_version?: number;
  bytes?: number;
  sha256?: string;
  meta?: ContentMeta;
  withdrawn_reason?: string | null;
}

export interface Manifest {
  format: 1;
  generated_at: string;
  paused: boolean;
  resources: ManifestEntry[];
}

function toEntry(row: ContentResourceRow, now: Date): ManifestEntry | null {
  if (row.status === "withdrawn") {
    const cutoff = now.getTime() - WITHDRAWN_WINDOW_DAYS * 86_400_000;
    if (!row.withdrawn_at || row.withdrawn_at.getTime() < cutoff) return null;
    return { key: row.key, kind: row.kind, source: row.source, version: row.version, status: "withdrawn", withdrawn_reason: row.withdrawn_reason };
  }
  if (!row.object_key || !row.sha256 || row.bytes === null) return null;
  return {
    key: row.key, kind: row.kind, source: row.source, version: row.version, status: "active",
    upstream_schema_version: row.upstream_schema_version, bytes: row.bytes, sha256: row.sha256, meta: row.meta,
  };
}

export async function buildManifest(kinds: string[], paused: boolean, now: Date = new Date()): Promise<{ manifest: Manifest; etag: string }> {
  const rows = await db.select().from(contentResources).where(inArray(contentResources.kind, kinds));
  const resources = rows
    .map((row) => toEntry(row, now))
    .filter((entry): entry is ManifestEntry => entry !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
  const stable = JSON.stringify({ format: 1, paused, resources });
  const etag = `"${new Bun.CryptoHasher("sha256").update(stable).digest("hex")}"`;
  return { manifest: { format: 1, generated_at: now.toISOString(), paused, resources }, etag };
}
```

- [ ] **Step 4: Implement the route**

`src/routes/v1/content.ts`:

```ts
import { Hono } from "hono";
import { readContentConfig } from "../../config/content";
import { error } from "../../lib/response";
import { apiAuth } from "../../middleware/apiAuth";
import { MANIFEST_KINDS, buildManifest } from "../../services/contentManifest";

const app = new Hono();
app.use("*", apiAuth);
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

function parseKinds(raw: string | undefined): string[] | null {
  if (!raw) return [...MANIFEST_KINDS];
  const kinds = raw.split(",").map((kind) => kind.trim()).filter(Boolean);
  const allowed: readonly string[] = MANIFEST_KINDS;
  return kinds.every((kind) => allowed.includes(kind)) ? kinds : null;
}

app.get("/manifest", async (c) => {
  const config = readContentConfig();
  if (!config.enabled) return error(c, "CONTENT_UNAVAILABLE", "Content sync is not enabled", 503);
  const kinds = parseKinds(c.req.query("kinds"));
  if (!kinds) return error(c, "BAD_REQUEST", "Unknown content kind", 400);
  const { manifest, etag } = await buildManifest(kinds, config.paused);
  c.header("ETag", etag);
  if (c.req.header("if-none-match") === etag) return c.body(null, 304);
  return c.json(manifest);
});

export default app;
```

If `error()` in `src/lib/response.ts` does not accept 503, check its status type and widen it to include 503 in the same file (it is a one-line union change).

In `src/routes/v1/index.ts` add `import contentRoute from './content';` and `v1.route('/content', contentRoute);`.

- [ ] **Step 5: Run, typecheck, commit**

Run: `bun test tests/integration/routes/v1.content.test.ts && bunx tsc --noEmit`
Expected: PASS (7 tests).

```bash
git add src/services/contentManifest.ts src/routes/v1/content.ts src/routes/v1/index.ts src/lib/response.ts tests/integration/routes/v1.content.test.ts
git commit -m "feat(content): serve the content manifest with ETag support

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Download endpoint

**Files:**
- Modify: `src/services/contentManifest.ts` (add `resolveDownload`)
- Modify: `src/routes/v1/content.ts`
- Test: `tests/integration/routes/v1.content.test.ts` (new `describe`)

**Interfaces:**
- Produces:
  ```ts
  export interface DownloadTicket { url: string; version: number; sha256: string; bytes: number; expires_at: string }
  export async function resolveDownload(key: string, storage: ContentStorage, now?: Date): Promise<DownloadTicket | null>;
  export const PRESIGN_SECONDS = 600;
  ```
- Route: `GET /v1/content/resources/:key/download`. `:key` is URL-encoded (`qf%3Atranslations%3A20`). Returns 200 `{ data: DownloadTicket }`, 404 for unknown, withdrawn, or never-published keys. Rate limiting comes from the existing per-key limiter in `apiAuth`. The route module takes a storage factory so tests inject `MemoryContentStorage`: export `setContentStorageForTesting(storage: ContentStorage | null)`.

- [ ] **Step 1: Write the failing tests**

In `tests/integration/routes/v1.content.test.ts`, add these two imports to the import block at the top of the file:

```ts
import { setContentStorageForTesting } from "@/routes/v1/content";
import { MemoryContentStorage } from "@tests/helpers/contentFakes";
```

Then append this `describe` block at the end of the file:

```ts
describe("/v1/content/resources/:key/download", () => {
  beforeEach(() => {
    __resetRateLimitForTesting();
    setContentStorageForTesting(new MemoryContentStorage());
  });

  test("presigns the current version", async () => {
    await makeContentResource({ key: "qf:translations:20", version: 4, object_key: "content/translation/20/v4.json", sha256: "b".repeat(64), bytes: 600 });
    const res = await get(`/v1/content/resources/${encodeURIComponent("qf:translations:20")}/download`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ version: 4, sha256: "b".repeat(64), bytes: 600 });
    expect(data.url).toBe("https://r2.test/content/translation/20/v4.json?X-Amz-Expires=600");
    expect(new Date(data.expires_at).getTime()).toBeGreaterThan(Date.now() + 590_000);
  });

  test("a stale client still gets the newest version", async () => {
    await makeContentResource({ key: "qf:tafsirs:169", version: 9, object_key: "content/tafsir/169/v9.json" });
    const { data } = await (await get(`/v1/content/resources/${encodeURIComponent("qf:tafsirs:169")}/download`)).json();
    expect(data.version).toBe(9);
    expect(data.url).toContain("v9.json");
  });

  test("404 for withdrawn, unknown and never-published keys", async () => {
    await makeContentResource({ key: "qf:tafsirs:93", status: "withdrawn", withdrawn_at: new Date() });
    await makeContentResource({ key: "qf:tafsirs:170", status: "held", object_key: null });
    for (const key of ["qf:tafsirs:93", "qf:tafsirs:170", "qf:tafsirs:999"]) {
      const res = await get(`/v1/content/resources/${encodeURIComponent(key)}/download`);
      expect(res.status).toBe(404);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/integration/routes/v1.content.test.ts`
Expected: the new tests FAIL (404 route / missing export).

- [ ] **Step 3: Implement `resolveDownload`**

Append to `src/services/contentManifest.ts`:

```ts
import { eq } from "drizzle-orm";
import type { ContentStorage } from "../lib/contentStorage";

export const PRESIGN_SECONDS = 600;

export interface DownloadTicket {
  url: string;
  version: number;
  sha256: string;
  bytes: number;
  expires_at: string;
}

export async function resolveDownload(key: string, storage: ContentStorage, now: Date = new Date()): Promise<DownloadTicket | null> {
  const [row] = await db.select().from(contentResources).where(eq(contentResources.key, key));
  if (!row || row.status === "withdrawn" || !row.object_key || !row.sha256 || row.bytes === null) return null;
  return {
    url: storage.presign(row.object_key, PRESIGN_SECONDS),
    version: row.version,
    sha256: row.sha256,
    bytes: row.bytes,
    expires_at: new Date(now.getTime() + PRESIGN_SECONDS * 1000).toISOString(),
  };
}
```

(Merge the `eq` import into the existing `drizzle-orm` import line.)

- [ ] **Step 4: Add the route**

In `src/routes/v1/content.ts`:

```ts
import { createR2ContentStorage, type ContentStorage } from "../../lib/contentStorage";
import { success } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { resolveDownload } from "../../services/contentManifest";

let storageOverride: ContentStorage | null = null;
export function setContentStorageForTesting(storage: ContentStorage | null): void {
  storageOverride = storage;
}

app.get("/resources/:key/download", async (c) => {
  const config = readContentConfig();
  if (!config.enabled) return error(c, "CONTENT_UNAVAILABLE", "Content sync is not enabled", 503);
  const storage = storageOverride ?? createR2ContentStorage(config.r2);
  const ticket = await resolveDownload(decodeURIComponent(c.req.param("key")), storage);
  if (!ticket) throw new NotFoundError("Content resource not found");
  return success(c, ticket);
});
```

- [ ] **Step 5: Run, typecheck, commit**

Run: `bun test tests/integration/routes/v1.content.test.ts && bunx tsc --noEmit`
Expected: PASS (10 tests in the file).

```bash
git add src/services/contentManifest.ts src/routes/v1/content.ts tests/integration/routes/v1.content.test.ts
git commit -m "feat(content): presign downloads for the current resource version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Admin endpoints

**Files:**
- Create: `src/routes/admin/content.ts`
- Modify: `src/routes/admin/index.ts`
- Test: `tests/integration/routes/admin.content.test.ts`

**Interfaces:**
- Consumes: `releaseHeld`, `withdrawResource` (Task 6); tables (Task 1); `readContentConfig` (Task 2).
- Routes (all behind `adminAuth`):
  - `GET /admin/content` lists every row (all statuses) plus the `qf` sync state.
  - `POST /admin/content/:key/refetch` sets `pending_refetch = true` (picked up on the next hourly run).
  - `POST /admin/content/:key/release` calls `releaseHeld`; 404 if nothing is held.
  - `POST /admin/content/resync` clears the `qf` sync token (next run bootstraps).
  - `POST /admin/content/:key/withdraw` and `/restore`: only when `CONTENT_ADMIN_QA_ENABLED=true`, otherwise 404. Withdraw uses reason `qa_withdrawal`; restore sets `status = active`, clears `withdrawn_*`, bumps `version`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/routes/admin.content.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contentResources, contentSyncState } from "@/db/schema";
import { signJwt } from "@/middleware/adminAuth";
import { buildTestApp } from "@tests/helpers/app";
import { makeAdminUser } from "@tests/fixtures/adminUser";
import { makeContentResource } from "@tests/fixtures/content";

async function admin(path: string, init: RequestInit = {}) {
  const user = await makeAdminUser();
  const token = await signJwt({ sub: user.id, email: user.email, role: user.role });
  return buildTestApp().request(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
}

const enc = encodeURIComponent;

describe("/admin/content", () => {
  test("requires admin auth", async () => {
    expect((await buildTestApp().request("/admin/content")).status).toBe(401);
  });

  test("lists resources and sync state", async () => {
    await makeContentResource({ key: "qf:translations:20" });
    await db.insert(contentSyncState).values({ source: "qf", resources_filter: "tafsirs:*;translations:*", sync_token: "t" });
    const { data } = await (await admin("/admin/content")).json();
    expect(data.resources).toHaveLength(1);
    expect(data.sync.sync_token_present).toBe(true);
  });

  test("refetch, release and resync", async () => {
    await makeContentResource({ key: "qf:tafsirs:169", held_object_key: "h", held_sha256: "c".repeat(64), held_bytes: 5, held_row_count: 6000, held_reason: "row_drop" });
    await db.insert(contentSyncState).values({ source: "qf", resources_filter: "tafsirs:*;translations:*", sync_token: "t" });

    expect((await admin(`/admin/content/${enc("qf:tafsirs:169")}/refetch`, { method: "POST" })).status).toBe(200);
    expect((await admin(`/admin/content/${enc("qf:tafsirs:169")}/release`, { method: "POST" })).status).toBe(200);
    const [row] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:tafsirs:169"));
    expect(row).toMatchObject({ object_key: "h", held_reason: null, pending_refetch: true });

    expect((await admin(`/admin/content/${enc("qf:tafsirs:169")}/release`, { method: "POST" })).status).toBe(404);
    expect((await admin("/admin/content/resync", { method: "POST" })).status).toBe(200);
    const [state] = await db.select().from(contentSyncState);
    expect(state.sync_token).toBeNull();
  });

  test("QA withdraw and restore only when enabled", async () => {
    await makeContentResource({ key: "qf:translations:20", version: 2 });
    const path = `/admin/content/${enc("qf:translations:20")}`;
    expect((await admin(`${path}/withdraw`, { method: "POST" })).status).toBe(404);
    process.env.CONTENT_ADMIN_QA_ENABLED = "true";
    try {
      expect((await admin(`${path}/withdraw`, { method: "POST" })).status).toBe(200);
      let [row] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:translations:20"));
      expect(row).toMatchObject({ status: "withdrawn", withdrawn_reason: "qa_withdrawal" });
      expect((await admin(`${path}/restore`, { method: "POST" })).status).toBe(200);
      [row] = await db.select().from(contentResources).where(eq(contentResources.key, "qf:translations:20"));
      expect(row).toMatchObject({ status: "active", withdrawn_at: null, version: 3 });
    } finally {
      delete process.env.CONTENT_ADMIN_QA_ENABLED;
    }
  });
});
```

Check `tests/fixtures/adminUser.ts` for the exact returned shape (`id`, `email`, `role`) and adjust the `signJwt` payload accordingly; `tests/integration/routes/admin.keys.test.ts` shows the pattern.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/integration/routes/admin.content.test.ts`
Expected: FAIL, 404 routes.

- [ ] **Step 3: Implement the admin routes**

`src/routes/admin/content.ts`:

```ts
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { readContentConfig } from "../../config/content";
import { db } from "../../db/client";
import { contentResources, contentSyncState } from "../../db/schema";
import { NotFoundError } from "../../lib/errors";
import { success } from "../../lib/response";
import { adminAuth } from "../../middleware/adminAuth";
import { releaseHeld, withdrawResource } from "../../services/contentPublisher";

const app = new Hono();
app.use("*", adminAuth);

function keyParam(raw: string): string {
  return decodeURIComponent(raw);
}

app.get("/", async (c) => {
  const resources = await db.select().from(contentResources).orderBy(contentResources.key);
  const [state] = await db.select().from(contentSyncState).where(eq(contentSyncState.source, "qf"));
  return success(c, {
    resources,
    sync: state
      ? { sync_token_present: state.sync_token !== null, resources_filter: state.resources_filter, last_success_at: state.last_success_at, last_attempt_at: state.last_attempt_at, last_error: state.last_error }
      : null,
  });
});

app.post("/resync", async (c) => {
  await db.update(contentSyncState).set({ sync_token: null, updated_at: new Date() }).where(eq(contentSyncState.source, "qf"));
  return success(c, { resync: "scheduled" });
});

app.post("/:key/refetch", async (c) => {
  const key = keyParam(c.req.param("key"));
  const updated = await db.update(contentResources)
    .set({ pending_refetch: true, pending_since: new Date(), updated_at: new Date() })
    .where(eq(contentResources.key, key))
    .returning({ key: contentResources.key });
  if (updated.length === 0) throw new NotFoundError("Content resource not found");
  return success(c, { key, refetch: "scheduled" });
});

app.post("/:key/release", async (c) => {
  const key = keyParam(c.req.param("key"));
  if (!(await releaseHeld(key))) throw new NotFoundError("Nothing held for this resource");
  return success(c, { key, released: true });
});

app.post("/:key/withdraw", async (c) => {
  if (!readContentConfig().adminQaEnabled) throw new NotFoundError("Not found");
  const key = keyParam(c.req.param("key"));
  if (!(await withdrawResource(key, "qa_withdrawal"))) throw new NotFoundError("Content resource not found");
  return success(c, { key, status: "withdrawn" });
});

app.post("/:key/restore", async (c) => {
  if (!readContentConfig().adminQaEnabled) throw new NotFoundError("Not found");
  const key = keyParam(c.req.param("key"));
  const updated = await db.update(contentResources)
    .set({ status: "active", withdrawn_at: null, withdrawn_reason: null, version: sql`${contentResources.version} + 1`, updated_at: new Date() })
    .where(eq(contentResources.key, key))
    .returning({ key: contentResources.key });
  if (updated.length === 0) throw new NotFoundError("Content resource not found");
  return success(c, { key, status: "active" });
});

export default app;
```

In `src/routes/admin/index.ts` add `import contentAdmin from './content';` and `admin.route('/content', contentAdmin);`.

- [ ] **Step 4: Run, typecheck, commit**

Run: `bun test tests/integration/routes/admin.content.test.ts && bunx tsc --noEmit`
Expected: PASS (4 tests).

```bash
git add src/routes/admin/content.ts src/routes/admin/index.ts tests/integration/routes/admin.content.test.ts
git commit -m "feat(content): add admin endpoints for holds, refetch and QA withdrawals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Production smoke runner, CI and full verification

**Files:**
- Create: `scripts/content-smoke.ts`
- Modify: `.github/workflows/ci.yml` (no new required env; confirm tests pass with content disabled by default)
- Modify: `README.md` (smoke runner usage)

**Interfaces:**
- Consumes: `createQfContentClient`, `canonicalFilter` (Task 4), `validateSnapshot` (Task 5), `readContentConfig` is NOT used (the smoke runner needs only QF variables).

- [ ] **Step 1: Write the smoke runner**

`scripts/content-smoke.ts`:

```ts
// Manual check against production QF. Prints sizes and validation results only, never credentials.
// Usage: set -a; . ~/.config/bayaan/qf-prod.env; set +a; bun run scripts/content-smoke.ts
import { canonicalFilter, createQfContentClient } from "../src/services/qfContentClient";
import { validateSnapshot } from "../src/services/contentValidation";
import { QF_GROUPS } from "../src/types/content";

const client = createQfContentClient({
  clientId: process.env.QF_CLIENT_ID ?? "",
  clientSecret: process.env.QF_CLIENT_SECRET ?? "",
  oauthBaseUrl: process.env.QF_OAUTH_BASE_URL ?? "https://oauth2.quran.foundation",
  contentBaseUrl: process.env.QF_CONTENT_BASE_URL ?? "https://apis.quran.foundation/content/api/v4",
});

const filter = canonicalFilter(QF_GROUPS);
const counts: Record<string, number> = {};
let cursorPath: string | null = null;
do {
  const page = await client.syncPage({ bootstrap: true, filter, syncToken: null, cursorPath });
  for (const m of page.mutations) counts[m.resource_group] = (counts[m.resource_group] ?? 0) + 1;
  cursorPath = page.hasMore ? page.nextPageUrl : null;
} while (cursorPath);
console.log("bootstrap resources by group:", counts);

for (const [group, id] of [["translations", 20], ["tafsirs", 169]] as const) {
  const snapshot = await client.snapshot(group, id);
  const text = JSON.stringify(snapshot);
  console.log(`${group}:${id}`, {
    rows: snapshot.records.length,
    raw_mb: (text.length / 1e6).toFixed(2),
    gzip_mb: (Bun.gzipSync(new TextEncoder().encode(text)).byteLength / 1e6).toFixed(2),
    validation: validateSnapshot(group, snapshot),
  });
}
```

- [ ] **Step 2: Run it against production (needs the local credentials file)**

Run: `set -a; . ~/.config/bayaan/qf-prod.env; set +a; bun run scripts/content-smoke.ts`
Expected: both groups present in the bootstrap counts (roughly 145+ translations and 23+ tafsirs), Saheeh about 0.60 MB gzipped with `validation: { ok: true, rowCount: 6236 }`, Ibn Kathir about 3.6 MB gzipped with `ok: true`. If either validation fails, stop and report the exact result: the validator must accept real production data.

- [ ] **Step 3: Document it**

Add to the README "Content sync" section:

```md
Production smoke check (manual, prints no secrets):
`set -a; . ~/.config/bayaan/qf-prod.env; set +a; bun run scripts/content-smoke.ts`
```

- [ ] **Step 4: Full verification**

Run:
```bash
bunx tsc --noEmit
docker compose up -d postgres-test
set -a; . ./.env.test.example; set +a
bun test --coverage
```
Expected: all tests pass, no file under the 0.8 coverage threshold. CI needs no new variables because `CONTENT_SYNC_ENABLED` defaults to false and every content test sets its own environment.

- [ ] **Step 5: Commit and open the PR**

```bash
git add scripts/content-smoke.ts README.md
git commit -m "chore(content): add production smoke runner and docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/content-sync
gh pr create --draft --base develop --title "feat(content): QF Content Sync and content freshness API" --body "Implements the backend half of docs/superpowers/specs/2026-10-05-content-freshness-qf-sync-design.md (thebayaan/Bayaan). See docs/superpowers/plans/2026-10-06-content-sync-backend.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Deployment checklist (after merge, done by Osman)

1. Create the private R2 bucket `bayaan-content` and an R2 API token scoped to it.
2. On the API service set `CONTENT_SYNC_ENABLED=true` and the four `CONTENT_R2_*` variables.
3. Create the `content-sync` Railway service per the README with the production QF client.
4. Run it once manually; check `GET /admin/content` shows about 168 active resources and no holds.
5. Spot-check `GET /v1/content/manifest` with a Bayaan API key.
