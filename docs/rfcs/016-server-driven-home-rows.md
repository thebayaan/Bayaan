# RFC-016: Server-driven home row config

| Field    | Value                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Status   | Proposed                                                                    |
| Date     | 2026-05-25                                                                  |
| Author   | Osman Sa'eday (@osmansaeday)                                                |
| Reviewer | @omar-zarka                                                                 |
| Related  | RFC-007 (multi-tenancy seam), RFC-010 (catalog version endpoint pattern), PR #260 (`branding.homeRowConfig`) |

## Summary

Move the Listen-tab home row order from the bundled `branding.homeRowConfig` (PR #260) to a tiny backend endpoint `GET /v1/home-config`. Every client platform (mobile, web, TV) consumes the same response and renders the rows it knows how to render. The bundled `branding.homeRowConfig` becomes the offline fallback, not the source of truth. No `?platform=` parameter, no per-tenant variance in v1: one config, every surface.

## Motivation

PR #260 (`feat: branding.homeRowConfig`) made the Listen-tab row order data-driven, but the data still lives in `config/branding.js:26-39` and ships with the binary. To reorder a row, hide a row, or A/B test the order, every active platform has to cut a new build and propagate it through TestFlight / Play / web deploy / TV deploy. That is unworkable as the surface count grows.

Today's surface count:

- Mobile (this repo, `feat/rfc-016-server-driven-home-rows` branched off `develop`).
- Web (exists, separate codebase).
- TV (in progress, see local branch `feature/tv-platforms`).

The bundled config also forces every client codebase to carry its own copy of the row order, with the inevitable drift that produces. The wire shape from PR #260 (`HomeRow[]` where each row is `{id: HomeRowId, enabled: boolean}`) is already cross-language safe (just strings + booleans) and `RecitersView` already silently skips unknown ids (`components/RecitersView.tsx:749-753`), so the forward-compat story for "web ships first, mobile rolls out next sprint" already works.

What is missing is the wire.

## Decision

### Wire format

`GET /v1/home-config` on the existing Bayaan backend (`/Users/osmansaeday/theBayaan/bayaan-backend`, Hono/Bun on Railway). No auth, public, cacheable.

Response:

```json
{
  "version": 1,
  "updated_at": "2026-05-25T10:00:00Z",
  "rows": [
    {"id": "continue-listening", "enabled": true},
    {"id": "new-to-quran", "enabled": true},
    {"id": "favorites", "enabled": true},
    {"id": "featured", "enabled": true},
    {"id": "adhkar", "enabled": true},
    {"id": "follow-along", "enabled": true},
    {"id": "playlists", "enabled": true},
    {"id": "exclusives", "enabled": true},
    {"id": "tajweed", "enabled": true},
    {"id": "memorization", "enabled": true},
    {"id": "rewayat", "enabled": true},
    {"id": "collection", "enabled": true}
  ]
}
```

`version` is a monotonically increasing integer. `rows[].id` is a string drawn from the `HomeRowId` union in `config/branding.d.ts:21-33`. The set of recognized ids is owned by each client, not the server: the server can include an id that a given client does not yet render, and the client silently skips it (PR #260, `components/RecitersView.tsx:751-753`).

### Backend (one table, one row)

New table `home_config` in `bayaan-backend/src/db/schema.ts`:

```typescript
export const homeConfig = pgTable('home_config', {
  id: integer('id').primaryKey().default(1),
  version: integer('version').notNull(),
  rows: jsonb('rows').$type<HomeRow[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

The `id` column is a sentinel: there is exactly one row, always with `id = 1`. A check constraint (`CHECK (id = 1)`) enforces this. This is uglier than a key/value table, but reads stay a single-row fetch and writes do not need composite-key wrangling.

New file `bayaan-backend/src/routes/v1/home-config.ts`:

```typescript
import { Hono } from 'hono';
import { db } from '../../db/client';
import { homeConfig } from '../../db/schema';
import { eq } from 'drizzle-orm';

const route = new Hono();

route.get('/', async (c) => {
  const row = await db.query.homeConfig.findFirst({
    where: eq(homeConfig.id, 1),
  });
  if (!row) return c.json({ error: 'not_found' }, 404);
  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  return c.json({
    version: row.version,
    updated_at: row.updatedAt.toISOString(),
    rows: row.rows,
  });
});

export default route;
```

Wired into `bayaan-backend/src/routes/v1/index.ts:7-13` as `v1.route('/home-config', homeConfigRoute)`.

Initial seed migration writes `version: 1` with the exact array currently in `config/branding.js:26-39` so behavior is verbatim-identical on first deploy.

Admin write path lives under `bayaan-backend/src/routes/admin/` (existing pattern, see `keys.ts`, `reciters.ts`). `POST /admin/home-config` accepts `{ rows: HomeRow[] }`, validates each `id` against the server-known union, bumps `version`, and writes. For v1 the admin UI is out of scope: edits happen via `psql` or a `curl` call signed with the admin JWT.

### Mobile client

New file `hooks/useRemoteHomeConfig.ts`:

```typescript
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import type { HomeRow } from '@/config/branding';

const storage = new MMKV({ id: 'home-config' });
const CACHE_KEY = 'home-config.cached';
const POLL_TIMEOUT_MS = 1500;
const FOREGROUND_DEBOUNCE_MS = 5 * 60 * 1000;
const ENDPOINT = process.env.EXPO_PUBLIC_BACKEND_URL + '/v1/home-config';

interface CachedConfig {
  version: number;
  rows: HomeRow[];
}

function readCache(): CachedConfig | null {
  const raw = storage.getString(CACHE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as CachedConfig; } catch { return null; }
}

function writeCache(config: CachedConfig): void {
  storage.set(CACHE_KEY, JSON.stringify(config));
}

let lastPolledAt = 0;

export function useRemoteHomeConfig(): HomeRow[] | null {
  const [rows, setRows] = useState<HomeRow[] | null>(() => readCache()?.rows ?? null);

  useEffect(() => {
    const poll = async () => {
      if (Date.now() - lastPolledAt < FOREGROUND_DEBOUNCE_MS) return;
      lastPolledAt = Date.now();
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), POLL_TIMEOUT_MS);
        const res = await fetch(ENDPOINT, { signal: ctl.signal });
        clearTimeout(t);
        if (!res.ok) return;
        const data = await res.json() as CachedConfig;
        const cached = readCache();
        if (!cached || data.version > cached.version) {
          writeCache(data);
          setRows(data.rows);
        }
      } catch {
        // fail-open: keep cache / fallback
      }
    };

    void poll();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void poll();
    });
    return () => sub.remove();
  }, []);

  return rows;
}
```

`components/RecitersView.tsx:726` changes from:

```typescript
const homeRowConfig = branding.homeRowConfig ?? DEFAULT_HOME_ROW_CONFIG;
```

to:

```typescript
const remoteRows = useRemoteHomeConfig();
const homeRowConfig = remoteRows ?? branding.homeRowConfig ?? DEFAULT_HOME_ROW_CONFIG;
```

The `rowNodes` registry and `filter(enabled).map(...)` rendering at `components/RecitersView.tsx:556-748` is untouched. PR #260's unknown-id skip semantics carry over verbatim.

### Web and TV

Both consume the same endpoint with the same response shape. Each codebase owns its own `rowNodes` analogue (web renderers, TV renderers) keyed on the same `HomeRowId` strings. Web caches in `localStorage`, TV caches in whatever its platform offers. The `version` comparison rule is the same. There is no per-platform field in the response.

### Platform parity rule

The endpoint takes no `?platform=` parameter and the response carries no platform variance. If a future row genuinely needs to differ per platform (e.g. a "Cast to TV" row that only mobile renders), the right move is a new `HomeRowId` that web/TV do not register in their `rowNodes` registry, not a server-side filter. This keeps the wire format dumb and the platform logic local to each client.

## Alternatives considered

### A. Static JSON on R2/CDN

Drop a `home-config.json` on Cloudflare R2 behind the existing CDN. No backend code. Cheapest possible operation. Rejected because edits then require a deploy (commit + PR + CI). The point of moving to a server is fast iteration.

### B. Per-platform endpoint or `?platform=` query param

Allow `GET /v1/home-config?platform=ios` to return a different ordering than `?platform=tv`. Rejected because the project's design rule is platform parity (see [project_multi_platform_parity in memory]). Per-platform variance is a 30-minute add when there is a concrete reason to do it; carrying it from day 1 across three clients is unjustified cost.

### C. Server-sent events or WebSocket push

Real-time propagation. Rejected as overkill. Home row order changes ≤ weekly. The poll-on-cold-start + foreground-debounced pattern from RFC-010 (`services/catalogVersionPoll.ts`) is the right shape and the project already has the muscle memory for it.

### D. Status quo (PR #260 bundled config only)

Keep editing `config/branding.js` and shipping a build. Rejected because it does not scale to three platforms and blocks any non-engineer from changing the order. The bundled config stays as the offline fallback, but it is no longer the source of truth.

### E. Reuse the existing `catalogVersionEndpoint` (RFC-010) and ship rows in the catalog payload

Bolt the row config onto the catalog JSON. Rejected because the catalog is ~500 KB and changes infrequently; the row config is ~500 bytes and changes more often. Bundling them ties two independent cache lifetimes together and makes per-platform CDN tuning awkward.

## Consequences

**Positive:**

- Reordering, hiding, or A/B testing a row is a single SQL update + ~60s CDN propagation. No build, no deploy across three platforms.
- All three platforms read from the same source of truth, so divergence between mobile / web / TV is impossible by construction.
- Bayaan's existing `homeRowConfig` array becomes a true offline fallback, not the live config. Lives where it belongs.

**Neutral:**

- Wire format is identical to PR #260's interface, so client-side TypeScript types are unchanged (just exported from a different module on web/TV).
- The 12 `HomeRowId` values stay client-owned. Server cannot ship a new id and force clients to render it; it can only reorder / disable known ids.

**Negative / risks:**

- Adds one network call on cold-start. ~500 bytes. Timeout is 1.5 s. Fail-open: any error keeps the cached (or bundled) value.
- The `home_config` table is a single-row table, which is unusual. Mitigated by the `CHECK (id = 1)` constraint and a defensive query that asserts exactly one row exists in tests.
- A misconfigured admin write could ship an empty `rows` array, which would render an empty Listen tab. Mitigated by admin-side schema validation (`rows.length > 0` + every id in the server's known union) and a smoke test that hits `/v1/home-config` after each admin write.
- The endpoint is unauthenticated and public. That is correct for read (the row order is not sensitive) but means we should not extend the same endpoint with per-user fields without adding auth.

## How we'll know it worked

- One SQL update on the backend changes the row order on a freshly-launched mobile build, a freshly-loaded web tab, and a freshly-launched TV app, without any binary change to any platform.
- `GET /v1/home-config` returns the expected JSON shape in production, served from CDN with `age >= 0` and `cache-control: max-age=60`.
- The mobile binary continues to launch normally with the backend offline (verified by airplane-mode cold-start: the bundled `homeRowConfig` renders).
- Lighthouse / cold-start traces show < 50 ms added to TTI on mobile (the poll runs after first render, not blocking).

## Open questions

1. **Should the response include a per-row `since_version` so clients can ignore brand-new ids until a certain client version?** Deferred. The unknown-id skip semantics already cover the forward-compat case.
2. **Should admin writes require a SemVer-style version bump per change type (rows reordered vs. row enabled toggled)?** Deferred. Single monotonic integer is enough until we add A/B testing.
3. **Where does the admin UI live?** Deferred to a follow-up. v1 is psql + curl. If we end up with > 1 such config, a generic "branding config admin" page in `bayaan-backend/src/routes/admin/` is the natural home.

## Maintainer ask

cc @omar-zarka. This RFC builds directly on your PR #260 (`feat: branding.homeRowConfig`) and follows the RFC-010 idiom (small additive seam + small service module). The 12-row union and the rendering loop in `RecitersView` are unchanged; the only client change is one line at `components/RecitersView.tsx:726`.

Two requests:

1. Sanity-check the choice to NOT add `?platform=` from day 1. Given the platform-parity rule, I think it is right, but you have been carrying the multi-tenant seam work and may see a concrete divergence I am missing.
2. Confirm the wire shape (`{version, updated_at, rows}`) is one you want to standardize on for future server-driven config seams, vs. one-off-per-feature.

Happy to split this into doc-only-first if you prefer to align on shape before any code lands.
