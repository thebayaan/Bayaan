# RFC-015: Timestamp CDN base seam (`branding.timestampCdnBase`)

**Status:** Proposed (combined doc + code PR — small surface, single-line
change at the consumer, low shape risk).
**Authors:** Omar Zarka (Qariah)
**Targets:** `thebayaan/Bayaan` `develop`
**Related:** PR `thebayaan/Bayaan#278` (merged 2026-05-22) — timestamps R2
mirror feature that introduced the hardcoded `cdn.thebayaan.com` URL base
this RFC lifts.

---

## Summary

PR #278 (timestamps R2 mirror) shipped with a hardcoded production CDN base
URL in the timestamps fetch service:

```ts
// services/timestamps/TimestampFetchService.ts:5
const R2_BASE = 'https://cdn.thebayaan.com/timestamps';
```

Forks that want to mirror ayah-timestamp JSONs to their own R2 bucket are
forced to shadow the entire file today — there is no seam to swap just the
URL base. This RFC adds an optional `branding.timestampCdnBase?: string`
field; when absent, the consumer applies
`?? 'https://cdn.thebayaan.com/timestamps'` and Bayaan's behavior is
preserved byte-equivalent. When set, the consumer reads the fork's URL.

The change is two files (`config/branding.d.ts` + `services/timestamps/TimestampFetchService.ts`)
totaling under 15 lines. No new infrastructure, no API surface beyond a
single optional string field. Same shape as RFC-010
(`branding.catalogVersionEndpoint`) — combined doc + code PR is appropriate.

---

## Motivation

A fork that wants to mirror timestamps to its own CDN today has three
options, all bad:

1. **Shadow `TimestampFetchService.ts`.** Every upstream change to the
   file needs manual porting into each fork. The whole point of the
   cross-fork seam work (RFC-007 onward) is to avoid this.
2. **Patch the constant at build time** (e.g. a CI-side `sed`). Brittle,
   invisible to fork maintainers reading the code, and a footgun for
   anyone running the app locally.
3. **Override the field on `branding` and pray.** Doesn't work — the
   constant captures the literal at module load and never re-reads.

A single optional config field absorbs all forks at one declaration site.

### Why now

Qariah-side timestamp mirroring is about to ramp up — TECH_DEBT #36
(timing data for non-Zaynab reciters) tracks the work. Filing this RFC
preemptively so the seam is in place before the first Qariah-side mirror
upload happens, rather than racing the fork against a stuck-on-the-wrong-CDN
release.

The shape is small enough that a second fork can use the same seam without
coordination overhead.

---

## Proposed change

### `config/branding.d.ts` addition

```typescript
export interface Branding {
  // ... existing fields ...

  /**
   * Base URL for ayah-timestamp JSONs served from a fork's R2 bucket
   * (or any CDN with the same `{base}/{rewayatId}/{NNN}.json` layout
   * `TimestampFetchService` constructs).
   *
   * Field absent → consumer applies
   * `?? 'https://cdn.thebayaan.com/timestamps'` at the call site →
   * byte-equivalent to today's behavior.
   *
   * Forks set this to their own mirror's base when the
   * `has_timestamps` flag is true for any reciter in their catalog
   * and the timestamp JSONs live somewhere other than the Bayaan
   * production CDN. No trailing slash; consumer composes
   * `${timestampCdnBase}/${rewayatId}/${paddedSurah}.json`.
   */
  timestampCdnBase?: string;
}
```

### `config/branding.js` (Bayaan default)

Field omitted. The `?? 'https://cdn.thebayaan.com/timestamps'` fallback at
the consumer site preserves Bayaan's behavior verbatim. Zero diff to
`config/branding.js` in the Bayaan distribution.

### `services/timestamps/TimestampFetchService.ts` change (the only code diff)

```diff
+import branding from '@/config/branding';
 import {RECITERS, type Rewayat} from '@/data/reciterData';
 import {timestampDatabaseService} from './TimestampDatabaseService';
 import type {AyahTimestamp} from '@/types/timestamps';

-const R2_BASE = 'https://cdn.thebayaan.com/timestamps';
+const R2_BASE =
+  branding.timestampCdnBase ?? 'https://cdn.thebayaan.com/timestamps';
```

The fallback is folded into the module-scope constant, evaluated once at
module load. Cheap; preserves the read-site shape (the rest of the file
references `R2_BASE` exactly as today).

Total upstream diff: under 15 lines across 2 files (branding type +
TimestampFetchService import + R2_BASE line). No new files.

---

## Migration / default behavior

**Bayaan:** no change. Field absent → fallback fires → URL is
`https://cdn.thebayaan.com/timestamps`. Zero action required; byte-equivalent
to today.

**Forks opting in:** declare the field once in `config/branding.js` with the
fork's mirror base. No code changes anywhere else. The fork's mirror is
responsible for serving the same `{base}/{rewayatId}/{NNN}.json` layout
TimestampFetchService constructs (already documented in PR #278's RFC text).

---

## Open questions

1. **Field name shape — single field vs nested `timestamps` sub-object.**
   `timestampCdnBase` is the smallest API surface today. If future timestamp
   configuration grows (e.g. CDN auth, per-rewaya overrides), the natural
   evolution is a `timestamps: {cdnBase: '...', ...}` sub-object. This RFC
   ships the flat field; a future RFC can refactor under the nested-object
   convention if needed.

2. **Default inline at the consumer vs in `config/branding.js`.** This RFC
   uses the inline `??` fallback (consistent with RFC-010 and RFC-014).
   An alternative would be to set the field explicitly in Bayaan's
   `config/branding.js` and read without a fallback. The inline pattern is
   more fork-friendly (a fork that forgets the field still gets sensible
   behavior); the explicit pattern makes Bayaan's default URL more
   discoverable. Happy to flip if there's a maintainer preference.

---

## Alternatives considered

### Environment variable (e.g. `EXPO_PUBLIC_TIMESTAMP_CDN_BASE`)

Rejected. Env vars get embedded into the app bundle at build time, so
ergonomics are identical to a branding field — but env vars are typed
`string | undefined` with no documentation surface and no
fork-discoverability, and they spread brand-specific configuration across
the env layer instead of consolidating it under `branding`.

### Fork-detection branch inside `TimestampFetchService`

Add an `if (isQariah) R2_BASE = '...'`-style conditional. Anti-pattern; every
new fork would balloon the conditional.

### Per-reciter URL override in catalog JSON

Add `timestamps_cdn_base?: string` on `Rewayat`. Over-flexible; no use case
for per-reciter CDN bases. Adds noise to every catalog row.

---

## Out of scope

- **Changes to the `{base}/{rewayatId}/{NNN}.json` URL layout.** This RFC
  only configures the base; the rest of the path is the consumer's
  responsibility (and matches PR #278's documented contract).
- **Timestamp authoring / mirror upload tooling.** Forks own their own
  pipeline; this RFC is about read-side configurability only.
- **`has_timestamps` / `timestamps_surah_list` catalog flags.** Already in
  the upstream schema from PR #278; forks set them per-rewaya in their own
  catalog.

---

## Reference implementation

Qariah's adoption ships in the same sprint as this RFC, against the same
shape:

- `config/branding.js` declares
  `timestampCdnBase: 'https://new.qariah-storage.xyz/timestamps'`.
- `services/timestamps/TimestampFetchService.ts` consumes the seam with the
  `?? upstream URL` fallback (this PR's exact change).
- Qariah's branding-conformance lint allowlist keeps the file allowlisted —
  the literal `cdn.thebayaan.com` fallback string is intentional per the
  RFC contract.

---

## Cross-references

- PR #278 — `feature/timestamps-r2-mirror` (merged 2026-05-22). Introduced
  the hardcoded URL this RFC lifts.
- RFC-010 — `branding.catalogVersionEndpoint` (similar shape: optional
  string field with inline fallback).
- RFC-014 — recent seam pattern reference (same combined doc+code pattern
  when shape risk is low).
