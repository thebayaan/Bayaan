# RFC-017: Server-driven config envelope

| Field    | Value                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Status   | Proposed                                                                    |
| Date     | 2026-05-26                                                                  |
| Author   | Omar Zarka (@omar-zarka)                                                    |
| Reviewer | @osmansaeday                                                                |
| Related  | RFC-007 (multi-tenancy seam), RFC-010 (catalog version endpoint), RFC-016 (server-driven home rows) |

## Summary

Codify the wire-shape and client-side polling contract that RFC-010 (`/v1/catalog-version`) and RFC-016 (`/v1/home-config`) both consume into a single named pattern: the **server-driven config envelope**. Future seams of the same family (Listen-tab top slot, search filter dimensions, onboarding row order, featured-playlist surface) MUST adopt the envelope verbatim rather than re-deriving it per-feature.

Also codify the **platform-parity rule** that RFC-016 introduced as a first-class contract on envelope endpoints: no `?platform=` query parameter, no per-platform variance in the response, and a defined escape hatch for the rare case where a row or feature genuinely cannot exist on a given surface.

Doc only. Zero code change. The envelope, auth, and status-code rules below are written to match what the shipped RFC-016 `/v1/home-config` endpoint and `hooks/useRemoteHomeConfig.ts` already do — the deployed code conforms to this contract as documented. The one forward-looking item (a CDN `Cache-Control` header) is called out explicitly as a recommendation, not a claim about the current backend.

## Motivation

RFC-016's final section asks for two things explicitly:

1. Sanity-check on the no-`?platform=` decision.
2. Confirmation that `{version, updated_at, ...payload}` is the standard wire shape for future server-driven config seams, rather than one-off-per-feature.

Both are real questions, and the cost of answering them in a doc that lives next to RFC-016 (rather than buried in PR comments) is one file. Once the contract is named, every future RFC of this family — and there will be several, see [Candidate future seams](#candidate-future-seams) below — can say "conforms to RFC-017 envelope" in two lines and skip re-deriving the wire shape, polling rules, cache semantics, and fail-open behaviour.

The corrosion this RFC prevents is real. Without a named contract:

- The next RFC re-debates `{version, updated_at, ...}` vs `{etag, ts, payload}` vs `{rev, mtime, ...}`. Three platforms then ship slightly different parsers.
- The next RFC re-debates 60s vs 30s vs 5min cache TTL. Mobile picks 60s, web picks 300s, TV picks "whatever HTTP defaults to". The "platforms read from the same source of truth" property of RFC-016 quietly erodes within two quarters.
- The platform-parity rule lives in RFC-016's prose only. The next contributor opens a follow-up endpoint with `?platform=` because the rule was not load-bearing on RFC-016 itself, just commentary.

## Decision

### The envelope

Every server-driven config endpoint returns a JSON object with a single `data` wrapper holding these fields:

| Field           | Type                  | Notes                                                                                                 |
| --------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `data`          | object                | Wrapper. All envelope fields live under this single top-level key.                                    |
| `data.version`    | `integer`             | Monotonically increasing. Bumped on every admin write that changes the payload.                       |
| `data.updated_at` | `string` (ISO 8601)   | Server's last-write timestamp, UTC, second-precision (e.g. `"2026-05-26T10:00:00Z"`).                 |
| `data.{payload}`  | object or array       | Feature-specific. Key name is the feature's `snake_case` slug (e.g. `rows`, `filters`, `slots`).      |

Example (RFC-016 conformant — this is the exact shape `hooks/useRemoteHomeConfig.ts` parses):

```json
{
  "data": {
    "version": 7,
    "updated_at": "2026-05-26T10:00:00Z",
    "rows": [
      {"id": "continue-listening", "enabled": true}
    ]
  }
}
```

Example (hypothetical search-filter RFC, RFC-012's `/v1/search-filters`):

```json
{
  "data": {
    "version": 3,
    "updated_at": "2026-05-26T10:00:00Z",
    "filters": [
      {"id": "has-photo", "label": "Has photo", "default": false}
    ]
  }
}
```

The envelope is **`data`-wrapped**: `version`, `updated_at`, and the feature payload key all live under a single top-level `data` object. The client reads `body.data` and the payload key off that (e.g. `body.data.rows`); the natural ops read shape is `curl … | jq .data.rows`. This is the shape the shipped RFC-016 endpoint serves and `useRemoteHomeConfig.ts` consumes (`const next = body.data`), so the **RFC-016 hook** is conformant-by-construction. See [Alternatives considered](#alternatives-considered) for why the wrapper is kept rather than flattened.

> **Conformance scope (review reconciliation).** The "conformant by construction" claim is scoped to the **RFC-016 `/v1/home-config` hook** (`useRemoteHomeConfig.ts`), which already reads `body.data` + runs the step-4 shape check. It does **not** hold verbatim for RFC-010: `services/catalogVersionPoll.ts:76-77` reads `body.version` directly — RFC-010's reference impl is **flat (un-wrapped), not `data`-wrapped**. RFC-010 is therefore **grandfathered**, not retroactively conformant: its flat `{version, url}` shape is a pre-envelope precedent and is fine to keep as-is until it next changes, at which point it should migrate to the `data` wrapper. New consumers MUST use the `data` wrapper from day one; only RFC-010 is exempt.
>
> Separately, **RFC-016's own doc disagrees with its shipped hook** and should be annotated/fixed: the merged RFC-016 doc shows a flat `{version, updated_at, rows}` shape and "no auth, public", but the shipped hook reads `body.data` **and sends a `Bearer` token**. The deployed code (this RFC's contract: `data`-wrapped + Bearer) is the source of truth; RFC-016's doc text is stale and should be reconciled to match (`body.data` + Bearer required), or annotated to point here.

### Endpoint conventions

| Concern              | Rule                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Path                 | `GET /v{N}/{feature-slug}` on the existing Bayaan backend.                                                              |
| Auth                 | Bearer API key required via the existing `apiAuth` middleware. Per-user fields are NOT permitted on envelope endpoints — split those into a separate auth'd path. The client sends `Authorization: Bearer ${EXPO_PUBLIC_BAYAAN_API_KEY}`. |
| Cache-Control        | Not set today. The shipped `/v1/home-config` route emits no `Cache-Control` header; the client's own version-poll + 5-min foreground debounce bounds traffic. **Recommendation (not yet shipped):** add `public, max-age=60, s-maxage=60` so a CDN can absorb read traffic and bound propagation lag; tracked as a follow-up, not a current conformance claim. |
| Method               | `GET` only. Writes go through the admin surface and require the admin JWT (existing pattern).                          |
| Content-Type         | `application/json; charset=utf-8`.                                                                                      |
| HTTP status on empty | `404` (`NotFoundError`) when no config row exists — the shipped `homeConfigService` throws when the row is absent. Clients treat any non-`2xx` (including this `404`) as fail-open: keep the cached or bundled fallback. To deliberately publish an empty surface, the admin writes a row whose payload is an empty array (`"rows": []`), which returns `200`. |

The 404-on-missing-row behaviour is what the shipped backend does (`homeConfigService` throws `NotFoundError` → HTTP 404), and the client's fail-open path already treats it correctly: a `404` is a non-`2xx`, so the client keeps its cached/bundled value and renders nothing-new rather than clobbering state. To signal "the admin deliberately cleared this surface" distinctly from "no row was ever provisioned," the admin writes an explicit empty payload (`"rows": []`, returned as `200`) rather than deleting the row. A future envelope endpoint MAY instead choose to return `200` with an empty payload on a missing row; the contract only requires that the client fail-open on `404`, which it does.

### Client-side polling contract

Every envelope-consuming client (mobile / web / TV) MUST implement the following behaviour. The pattern is what RFC-010 (`services/catalogVersionPoll.ts`) and RFC-016 (`hooks/useRemoteHomeConfig.ts`) already implement — with the one wire-shape caveat that RFC-010 reads the payload **flat** (`body.version`) rather than `data`-wrapped (see the conformance-scope note above); the polling *behaviour* below is identical across both.

1. **Cold-start read order:** local cache → render → fetch → if `server.version > cache.version`, update cache + re-render.
2. **Foreground refresh:** debounced. On `AppState 'active'` transition, fetch IFF more than 5 minutes since the last fetch **attempt**. (Both shipped impls debounce on the last *attempt*, not the last *successful* fetch — a failed fetch still resets the debounce timer, which is the correct behaviour: it prevents a retry storm against a flapping backend.)
3. **Timeout:** 1500 ms on the network request. AbortController + timer.
4. **Shape validation (do not skip):** after `res.json()`, unwrap `body.data` and validate it before trusting any field. Reject (treat as fail-open) if `data` is absent, `data.version` is not a `number`, or the feature payload is not the expected type (e.g. `Array.isArray(data.rows)` for the home-config seam). Never feed an unvalidated `res.json()` into the cache or the render path. This mirrors what `useRemoteHomeConfig.ts` does (`const next = body.data; if (!next || typeof next.version !== 'number' || !Array.isArray(next.rows)) return;`) and the validation requirement the RFC-015 review (PR #286) established for fork-facing payloads — the server is trusted-but-versioned, not infallible, and a malformed write must not poison the cache.
5. **Fail-open:** any non-`2xx` response, network error, timeout, or shape-validation failure (step 4) → silently keep the cached (or bundled) value. No retry storm.
6. **Version comparison:** `server.version > cache.version`. NOT `!==` (a backend rollback should not clobber a newer client cache for the rest of the session; the cache-control TTL bounds the staleness either way).
7. **Bundled fallback:** every envelope MUST have a bundled-in-binary fallback (the constant that the seam originally replaced). Cache missing AND network down on first launch → use the bundled value. This is what makes RFC-016's offline-first claim load-bearing. Note this is a **two-level chain** for the home-config seam: `branding.homeRowConfig ?? DEFAULT_HOME_ROW_CONFIG`. The **guaranteed** layer is the upstream `DEFAULT_HOME_ROW_CONFIG` constant — `branding.homeRowConfig` is the per-fork override and may be `undefined` (it is on Bayaan), so the upstream default is the one that must always be present. A consumer that only checks the `branding` layer would render nothing on a fork that leaves the override unset; the contract is "fall through to the upstream default", not "fall through to the branding override".

Reference implementations live at `services/catalogVersionPoll.ts` (RFC-010, **flat** `body.version` — grandfathered pre-envelope shape) and the shipped `hooks/useRemoteHomeConfig.ts` (RFC-016, **`data`-wrapped** — the conformant reference) — the RFC-016 hook unwraps `body.data` and runs the step-4 shape check before touching the cache. New consumers should copy the **RFC-016 hook's** structure (`data`-wrapped), not RFC-010's flat shape, and not refactor it into a generic hook factory — the per-seam types and cache key are clearer inline than abstracted.

### Platform-parity rule

A single canonical response is served to all platforms. No `?platform=` query parameter. The endpoint does not branch on `User-Agent`, `X-Platform`, or any other request header for content selection. The only client-aware shaping the server does is HTTP-standard (gzip, ETag).

**Why this is the right default.** Each platform (mobile / web / TV) already owns its own renderer registry (`rowNodes` on mobile; analogue on web; analogue on TV). The renderer keyed on an unknown id silently no-ops. This gives forward-compat for free: a new id can land server-side and roll out platform-by-platform as each client adds the renderer, without server changes. Per-platform branching on the server-side would introduce a second axis of divergence that the existing client-owned-registry pattern already handles.

**Escape hatch for genuine platform-only features.** If a feature genuinely cannot exist on a given surface (e.g. a "Cast to TV" row that has no rendering on the TV app itself, or a "Background audio" toggle that is meaningless on web), the right move is:

1. Define a new id (`cast-to-tv`, `background-audio-toggle`).
2. The platforms that can render it add an entry to their `rowNodes` registry.
3. The platforms that cannot do nothing. The client-owned-registry pattern silently skips it.

This is strictly cheaper than `?platform=`: it requires zero server work, ships with the client that needs it, and is grep-able from the client side ("where do we render `cast-to-tv`?" returns the one platform that does).

**When to revisit.** This rule is overturnable. If we ever discover a case where the same `id` legitimately needs different `enabled`/`label`/`order` semantics across platforms (genuinely the same row, behaving differently), open a follow-up RFC. The dual-registry workaround would be ugly enough at that point that the cost-benefit flips. We have not seen such a case across RFC-010 + RFC-016 + the candidate future seams below.

### Candidate future seams

This RFC is partially motivated by the seam pipeline I see landing over the next 1–2 quarters. Each of these is a natural envelope consumer:

| Future RFC                                                  | Endpoint                       | Payload key            | Why server-driven                                                                                              |
| ----------------------------------------------------------- | ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| RFC-008 follow-up (Listen-tab top slot variant)             | `/v1/listen-tab-top-config`    | `slot`                 | A/B testing the top hero variant without rebuilding three platforms.                                           |
| RFC-012 v2 (composable search filter dimensions)            | `/v1/search-filters`           | `filters`              | New filter dimensions (translated-by, year-of-recording, etc.) land server-side, render client-side.           |
| Onboarding row order                                        | `/v1/onboarding-config`        | `cards`                | Per-cohort onboarding tweaks. Same forward-compat story as home rows.                                          |
| Featured-playlists surface                                  | `/v1/featured-playlists`       | `playlists`            | Editorial curation. Today this is `data/curatedPlaylists.ts` shipped in-binary; the wire shape is identical.   |

Each one fits the envelope verbatim. None of them needs `?platform=`. All four have a natural bundled-fallback (today's hardcoded constant).

I am NOT proposing we ship any of these as part of this RFC. They are listed only to make the case that the envelope contract is paying for itself across at least 4–6 future seams, not just RFC-010 + RFC-016.

## Alternatives considered

### A. Don't standardize; let each RFC re-derive the shape

What we have today. Rejected because RFC-010 and RFC-016 already had to litigate the same questions (cache TTL, fail-open, version-bump semantics). Standardizing across two existing precedents is cheap; standardizing across six is expensive and the divergence has set by then.

### B. A flat envelope (`{version, updated_at, ...payload}` at the top level)

Tempting for grep ergonomics (`jq .rows` instead of `jq .data.rows`) and one less level of indentation. Rejected because it diverges from the shipped RFC-016 endpoint, which serves the `data`-wrapped shape and is parsed by `useRemoteHomeConfig.ts` via `body.data`. Re-flattening now would require a backend change plus a coordinated client migration for a purely cosmetic win. The `data` wrapper also leaves room to add cross-cutting metadata later (`pagination`, `errors`, `links`) without colliding with a feature payload key, and the extra `jq` segment is trivial. The wrapper is the canonical envelope (see [The envelope](#the-envelope)); the flat form is the rejected alternative.

### C. Per-feature `etag` instead of `version`

HTTP `ETag` + `If-None-Match` is well-trodden and would let us drop the `version` integer. Rejected for two reasons: (1) the application-level `version` integer lets clients trivially express the "newer wins" rule without having to remember which etag they last saw, and (2) the client's own 5-min foreground debounce already bounds read traffic today, and the recommended `Cache-Control: max-age=60` (see the conventions table) would absorb the rest at the CDN if/when it lands. Keep both axes orthogonal: HTTP-level caching handles freshness, application-level `version` handles change detection.

### D. Per-platform endpoint (`?platform=ios` or `/v1/home-config/ios`)

Rejected per the platform-parity rule above. The dual-registry pattern handles every case we have today.

### E. Push (SSE / WebSocket) instead of poll

Rejected per RFC-016 alternative C: home row order and the candidate future seams all change ≤ weekly. Cold-start + foreground-debounced poll is the right cadence; push is overkill.

## Consequences

**Positive:**

- Every future server-driven config seam can cite this RFC in two lines and inherit the wire shape, polling rules, cache semantics, and platform-parity rule.
- The `services/catalogVersionPoll.ts` (mobile) and analogue (web, TV) implementations stay structurally similar across seams, which lowers the per-platform implementation cost.
- The platform-parity rule is now a written contract, not commentary in a prior RFC. Reviewers can point at it.

**Neutral:**

- The shipped RFC-016 `/v1/home-config` endpoint and `useRemoteHomeConfig.ts` hook conform to the envelope, auth, and 404-on-missing-row rules as documented above — this RFC describes the deployed reality, not a target state. No code change to either is required to satisfy the contract. The only non-shipped item is the `Cache-Control` recommendation, which is explicitly flagged as a follow-up rather than a conformance claim.
- The escape hatch (new id) for genuine platform-only features is the same pattern RFC-016 already implies; this RFC just names it.

**Negative / risks:**

- A future genuinely-cross-platform-divergent case would force an RFC amendment. Probability estimate is low given the candidate-seam list above, but real.
- The `version` integer is per-endpoint, not global. A user juggling multiple envelope-driven features sees independent version counters. This is fine for our use cases but worth flagging if we ever want a "config bundle" surface.
- The `Cache-Control` recommendation (`max-age=60, s-maxage=60`) is not yet shipped — `/v1/home-config` sets no cache header today, so the client's version-poll cadence is the only thing bounding read traffic. If/when the recommendation lands, a misconfigured admin write would be visible to all users within the chosen TTL. Mitigated by admin-side schema validation (RFC-016 already specifies this for `home-config`) and a documented rollback path (admin re-writes with the prior payload + a bumped `version`).

## How we'll know it worked

- The next server-driven config RFC (e.g. a Listen-tab top slot variant, or search-filter dimensions) cites this RFC in its "Wire format" section and is ≤ 2 pages shorter as a result.
- A cross-platform review of `services/catalogVersionPoll.ts` (mobile) and the web equivalent shows structurally identical timeout / debounce / fail-open code modulo platform primitives.
- No future RFC reopens the `?platform=` debate without explicit reference to this RFC's [When to revisit](#platform-parity-rule) section.

## Open questions

1. **Should the envelope reserve a `min_client_version` field for future use?** A way for the server to say "this payload uses semantics that need client ≥ X". Today's escape hatch (unknown-id skip) handles the additive case, but a semantic change to an existing id (e.g. `enabled` becoming a per-cohort object) would need it. Deferred — add when first needed; YAGNI today.
2. **Should `updated_at` be required, or optional?** Strictly speaking the client only consumes `version`. `updated_at` is debugging-grade (it answers "when did this last change?" without DB access). My read: required, because the cost of typing it is zero and the operational value is high. Open to either.
3. **Bundled-fallback location convention.** Today RFC-016 puts the fallback in `config/branding.js` (the per-fork override layer). Future seams might want a different fallback location (e.g. a `defaults/` directory). Worth picking a convention now or leaving per-seam? My read: leave per-seam; the location is the seam's natural home and forcing a directory move buys nothing.

## Maintainer ask

cc @osmansaeday. This RFC directly responds to the two specific questions in RFC-016's "Maintainer ask" section. Both answers are codified above:

1. **No `?platform=` from day 1** — endorsed, with the escape-hatch pattern named explicitly.
2. **Wire shape as future standard** — yes, formalized as the `data`-wrapped envelope (`{ data: { version, updated_at, ...payload } }`), matching exactly what the shipped `/v1/home-config` serves and `useRemoteHomeConfig.ts` parses, with four candidate future consumers listed.

If you accept this RFC, RFC-016 ships as-is — the envelope, Bearer auth, and 404-on-missing-row rules above are written to describe the deployed `/v1/home-config` + `useRemoteHomeConfig.ts`, so the conformance claim is now literal rather than aspirational. The only forward-looking item is the optional `Cache-Control` header, flagged as a recommendation, not a current claim. If you want adjustments to the envelope before locking it in, this is the cheapest moment to make them — zero code change either way.

Happy to fold this into RFC-016 directly if you would rather have one document instead of two. The argument for keeping it separate is that the envelope contract outlives any single seam.
