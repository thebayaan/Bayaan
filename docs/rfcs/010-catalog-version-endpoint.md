# RFC-010: `branding.catalogVersionEndpoint` — runtime catalog refresh

| Field    | Value                                                                        |
| -------- | ---------------------------------------------------------------------------- |
| Status   | Proposed                                                                     |
| Date     | 2026-05-16                                                                   |
| Author   | Omar Zarka (Qariah)                                                          |
| Related  | RFC-007 (app-layer multi-tenancy seam, merged via PR #235)                   |

## Summary

Add an optional `branding.catalogVersionEndpoint?: string` field. When set, the app polls this URL on cold-start (and optionally on `AppState 'active'`) to discover whether the published catalog is newer than the locally-cached one, and triggers a `CatalogProvider` refetch when so — without requiring an app rebuild.

Default behavior for Bayaan is unchanged: the field is undefined → no polling → catalog versioning by app build only (today's behavior).

## Motivation

Bayaan today versions its reciter catalog by app build: `services/dataService.ts:37` declares `const DATA_VERSION = '4'` as the AsyncStorage cache-bust key. A catalog update requires shipping a new app build. For Bayaan's relatively static reciter list this is fine.

Fork-side context — Qariah (the fork at `omar-zarka/qariah-v2`) recently shipped an ops console (`omar-zarka/qariah-ops-console`) that publishes catalog updates frequently (new reciters, metadata edits, recitation uploads). Tying every catalog change to an app rebuild + TestFlight cycle is incompatible with that workflow. Qariah needs runtime catalog refresh.

The cleanest way to add this is at the multi-tenant config seam established by RFC-007: a single optional URL the app polls. Tenants who don't want runtime refresh (Bayaan, others) simply don't set the field.

## Decision

### Config field

```typescript
// config/branding.d.ts
export interface Branding {
  // ... existing fields ...

  /**
   * Optional URL the app polls on cold-start to discover catalog updates.
   * When set, the response is expected to be JSON of shape:
   *
   *   { version: number, updated_at?: string, url?: string }
   *
   * If `version` exceeds the locally-tracked last-seen version, the app
   * refetches the catalog. When `url` is present, the app SHOULD use it
   * instead of the configured live catalog URL — the URL points at an
   * immutable per-version snapshot, so the CDN can cache it aggressively
   * while propagation stays instant (the URL itself is the cache key).
   *
   * If undefined (default), no polling — catalog is versioned only by the
   * bundled `DATA_VERSION` constant.
   *
   * Fail-open: poll failures (offline, 5xx, parse error) are swallowed.
   * The bundled catalog is always the source of truth on cold-start.
   */
  catalogVersionEndpoint?: string;
}
```

### Polling behavior

A small new module `services/catalogVersionPoll.ts`:

```typescript
import {AppState, type AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import branding from '../config/branding';

const LAST_SEEN_KEY = 'bayaan:lastSeenCatalogVersion';
const POLL_TIMEOUT_MS = 1500;
const FOREGROUND_DEBOUNCE_MS = 5 * 60 * 1000;

export type RefetchCatalog = (
  newVersion: number,
  versionedUrl?: string,
) => Promise<void> | void;

export function initCatalogVersionPolling(refetch: RefetchCatalog): void {
  const endpoint = branding.catalogVersionEndpoint;
  if (!endpoint) return;
  void pollOnce(endpoint, refetch);

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active' && Date.now() - lastPolledAt > FOREGROUND_DEBOUNCE_MS) {
      void pollOnce(endpoint, refetch);
    }
  });
}

// ... pollOnce: fetch, parse, compare lastSeen vs server, call refetch ...
```

### Call site

In `app/_layout.tsx` after the existing `await getAllReciters()` (around the AppInitializer block):

```typescript
import {initCatalogVersionPolling} from '@/services/catalogVersionPoll';
import {refetchCatalogToVersion} from '@/services/dataService';

// ...
await getAllReciters();
initCatalogVersionPolling(refetchCatalogToVersion);
```

`refetchCatalogToVersion(newVersion, versionedUrl?)` is a small new export on `dataService.ts` that prefers the versioned URL when provided and wipes the AsyncStorage cache before re-fetching.

### Fail-open semantics

The bundled catalog is always the source of truth on cold-start. The poll is purely additive: if it succeeds and the remote is newer, the app upgrades; if it fails for any reason, the user sees the bundled (or last-cached) catalog. A misconfigured endpoint, a CDN outage, or even a malicious response cannot brick the app — at worst, runtime refresh is degraded.

## Alternatives considered

### A. Server-Sent Events / WebSocket push

Push from server on catalog change. Real-time. More complex: requires a long-lived connection, retry/backoff, server-side fan-out. Overkill for a catalog that updates ≤ daily.

### B. Webhook → CDN cache purge → ETag refetch

App always refetches catalog on cold-start; CDN handles freshness via ETag. Simpler in some ways but adds a per-cold-start network round-trip on the full catalog (~500 KB for Qariah) or a 304 if cached. RFC-010's poll is smaller (~80 bytes per poll); the catalog refetch only happens when something changed.

### C. App polls the full catalog.json directly on cold-start

No new endpoint needed. But polling a ~500 KB catalog on every cold-start is wasteful when 99% of the time nothing changed. The tiny version endpoint costs ~80 bytes per poll.

### D. Embed version in catalog filename (`catalog-v8.json`)

Requires the app to "guess" the next version, or to be told via a separate config — which is just this RFC by another name.

### E. Status quo (build-time-only versioning)

Forces every tenant with dynamic catalog ops into a custom forked solution. Defeats the multi-tenant config seam established by RFC-007.

## Consequences

**Positive:**
- Tenants with dynamic catalog operations (Qariah today; potentially others) can publish catalog updates without an app rebuild.
- Versioned `url` enables aggressive CDN caching with instant propagation, since the URL is the cache key per version.
- One small additive seam — no API change for `CatalogProvider`.

**Neutral:**
- Bayaan's default behavior is unchanged (undefined endpoint → no poll).
- No backwards-compat concerns: the field is purely additive.

**Negative / risks:**
- A misconfigured endpoint claiming high version numbers could trigger per-cold-start catalog refetches. Mitigation: rate-limit (max once per cold-start + once per 5 min in foreground); fail-open on parse errors.
- Adds a tiny network call on every cold-start when configured. Cost: ~80 bytes + a 1.5s timeout.
- Forks setting this field commit to publishing a stable `catalog-version.json` shape. The doc above defines that shape; mismatches fail-open.

## Open questions

1. **Should the poll also trigger on `AppState 'active'`?** Pro: faster propagation when the app is left open. Con: extra network calls. The reference impl in this PR does both, debounced at 5 min. Open to dropping the foreground trigger if the maintainer prefers cold-start-only.
2. **Should `catalog-version.json` carry a `min_app_version`?** Would let publishers block stale clients from refetching a catalog that uses newer fields. Defer to a follow-up RFC; not needed for v1.
3. **Should the refetch be eager (block UI) or deferred (next foreground)?** Reference impl is eager because catalog hydration is already async after cold-start, so the user sees the bundled data first regardless. Happy to switch to deferred if the maintainer prefers.

## Maintainer ask

This RFC follows the RFC-007 idiom (small config field + small service module), so I've shipped doc + code together rather than the doc-only pattern used for RFC-008 (which proposed a more unusual component-as-config shape).

The Qariah ops console is the concrete consumer. Qariah has already shipped this poll behavior locally against its own endpoint (see `omar-zarka/qariah-v2` `services/catalogVersionPoll.ts`); if accepted, Qariah opens a small follow-up to swap the hard-coded constant for `branding.catalogVersionEndpoint` for shape conformance.

Happy to split into a doc-only-first PR if you'd prefer to discuss the shape before code lands. Just say the word.
