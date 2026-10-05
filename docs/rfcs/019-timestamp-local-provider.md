# RFC-019: Bundled timestamp provider + coverage-list seam pair (`branding.timestampLocalProvider` + `timestampLocalSurahList`)

**Status:** Draft (doc-first — the consumer touches the timestamp fetch
hot-path in three methods, so the shape is worth confirming before code lands;
code PR follows on shape approval).
**Authors:** Omar Zarka (Qariah)
**Targets:** `thebayaan/Bayaan` `develop`
**Related:** RFC-015 (`branding.timestampCdnBase`, merged) — the read-side CDN
seam this RFC complements; PR `thebayaan/Bayaan#278` (timestamps R2 mirror).

> **RFC numbering:** 017 (server-driven config envelope, PR #291) and 018
> (community-reflections provider, PR #299) are already claimed by open PRs, so
> this RFC takes **019**.

---

## Summary

`TimestampFetchService` resolves ayah-timing data for the Mushaf follow-along
highlight exclusively over the network — `fetchAndCache` builds an R2 URL and
`fetch`es it. A fork that ships **bundled** ayah-timing data for one of its own
reciters (timings authored offline, baked into the app rather than served from
a CDN) has no seam to plug that into the fetch service: the only way to make
`hasSource` / `hasSurah` / `fetchAndCache` aware of a locally-provided dataset
is to shadow the whole file.

This RFC adds an optional **provider pair**:

- `branding.timestampLocalProvider?: (rewayatId, surahNumber) => AyahTimestamp[] | null`
  — returns the bundled timings for one surah, or `null`.
- `branding.timestampLocalSurahList?: (rewayatId) => number[] | null` — the
  **explicit coverage signal**: the list of surahs the bundle covers for a
  rewayat (`null` / empty → no local coverage). This mirrors the *shape* of the
  catalog's existing `Rewayat.timestamps_surah_list?: number[]`, so `hasSource` /
  `hasSurah` can answer coverage questions **without** calling the data
  provider or guessing from a sentinel surah. One semantic difference from the
  R2 rule — the local list is an **exact allow-list** (empty means *no*
  coverage, not "all"); see [Coverage
  semantics](#coverage-semantics-local-is-an-exact-allow-list-not-empty-means-all).

When set, the three consumer methods consult the pair before going to the
network — `hasSource` / `hasSurah` gate on the coverage list, `fetchAndCache`
calls the data provider and validates its output; when unset (Bayaan's
default), an inline `?? null` coalesce makes every path byte-identical to
today. The `'local'` `TimestampSource` already exists in the upstream schema —
this RFC just gives a fork a supported way to reach it.

> **Why a coverage list rather than a surah-1 presence probe** (review,
> Issue 1): a fork that bundles timings for a partial-coverage reciter —
> one whose `surah_list` lacks surah 1 (28 of ~268 rewayat in the current
> catalog have no surah 1) — would return `null` from a surah-1 probe, so
> `hasSource` would report "no local source" and the follow-along UI (gated on
> `hasTimestampSource`) would be suppressed entirely despite valid bundled
> data. The coverage list keyed by rewayat (not by a fixed sentinel surah) is
> the correctness fix; see Open question 1.

---

## Motivation

A fork that bundles its own timing data today has three options, all bad:

1. **Shadow `TimestampFetchService.ts`.** This is the status quo for Qariah,
   and it is the exact problem the cross-fork seam work (RFC-007 onward) exists
   to retire. The file changes upstream (RFC-015 reworked `R2_BASE` and added a
   JSON-shape guard; PR #278 rewrote it wholesale), and every such change
   silently drops the fork's local-provider branch on the next absorption —
   the follow-along highlight then goes dark for that reciter until someone
   notices and re-applies the divergence by hand.
2. **Mirror the bundled timings to a CDN anyway** (combine with RFC-015's
   `timestampCdnBase`). Works, but forces a network round-trip and an R2 bucket
   for data the fork already has on disk — and the timings are unavailable
   offline, which defeats the point of bundling them.
3. **Branch on a fork flag inside the service.** An `if (isQariah) …`
   conditional is the anti-pattern RFC-015 already rejected; every new fork
   balloons it.

An optional config-field pair — symmetric with RFC-015's read-side seam —
absorbs all forks at the three consumer call sites.

### Why now

The upstream schema **already** carries the destination this RFC unlocks:
`type TimestampSource = 'r2' | 'local'` (`types/timestamps.ts`) and
`TimestampDatabaseService.writeTimestamps(..., source: TimestampSource)` both
accept `'local'`. The only thing missing is a supported way for a fork to feed
locally-authored timings into the resolver — today that requires shadowing the
file. Filing this now so the seam lands before the next wholesale rewrite of
`TimestampFetchService` drops a fork's local branch again.

The shape mirrors RFC-015 (read-side CDN base) and RFC-009/RFC-018 (nullable
provider functions on `branding`), so a second fork can reuse it with no
coordination overhead.

---

## Proposed change

### `config/branding.d.ts` addition

```typescript
import type {AyahTimestamp} from '@/types/timestamps';

export interface Branding {
  // ... existing fields ...

  /**
   * Optional provider for **bundled** ayah-timing data, for forks that ship
   * their own offline-authored timestamps for a reciter rather than serving
   * them from a CDN (see `timestampCdnBase`, RFC-015).
   *
   * Called by `TimestampFetchService.fetchAndCache` (the data path) before any
   * network fetch. Return the surah's timestamps (validated, then written to
   * the cache with source `'local'`), or `null` to fall through to the
   * existing R2/CDN path.
   *
   * Field absent → consumer applies `?? null` at each call site →
   * byte-equivalent to today's behavior (network-only resolution).
   *
   * Must be synchronous and side-effect-free. Read bundled data from a
   * module-level import, not I/O.
   */
  timestampLocalProvider?: (
    rewayatId: string,
    surahNumber: number,
  ) => AyahTimestamp[] | null;

  /**
   * Optional **coverage signal** companion to `timestampLocalProvider`: the
   * list of surah numbers the bundle covers for a rewayat, or `null` / `[]`
   * for a rewayat with no local coverage.
   *
   * This is what `hasSource` / `hasSurah` consult to gate the follow-along UI —
   * NOT a presence probe against the data provider. Keying coverage by rewayat
   * (rather than probing a fixed sentinel surah) is required for **partial-
   * coverage** reciters whose `surah_list` lacks surah 1; a surah-1 probe would
   * falsely suppress the feature for them.
   *
   * Mirrors the catalog's existing `Rewayat.timestamps_surah_list?: number[]`
   * one-to-one, so the local path answers coverage the same way the R2 path
   * already does. A fork sets this alongside `timestampLocalProvider`; the two
   * must agree (a surah in the list must have data from the provider).
   *
   * Must be synchronous and side-effect-free.
   */
  timestampLocalSurahList?: (rewayatId: string) => number[] | null;
}
```

### `config/branding.js` (Bayaan default)

Field omitted. The `?? null` fallback at each consumer site preserves Bayaan's
behavior verbatim. **Zero diff** to `config/branding.js` in the Bayaan
distribution.

### `services/timestamps/TimestampFetchService.ts` (the only code diff)

The pair is consulted in the three resolution methods, each falling through to
today's logic when the fields are unset. Coverage is decided by
`timestampLocalSurahList` (the explicit signal) in `hasSource` / `hasSurah`; the
data provider is called only on the `fetchAndCache` write path, where its
output is shape-validated before it reaches the cache. Sketch:

```diff
 import branding from '@/config/branding';
 import {RECITERS, type Rewayat} from '@/data/reciterData';
 import {timestampDatabaseService} from './TimestampDatabaseService';
 import type {AyahTimestamp} from '@/types/timestamps';

 class TimestampFetchService {
+  // Fork-supplied local coverage for a rewayat, or [] when none. Reads the
+  // explicit coverage signal — never probes the data provider, so a partial-
+  // coverage reciter whose bundle omits surah 1 is not falsely suppressed.
+  // `?? null` keeps Bayaan's behavior identical when the field is unset.
+  private localSurahs(rewayatId: string): number[] {
+    return branding.timestampLocalSurahList?.(rewayatId) ?? [];
+  }
+
   hasSource(rewayatId: string): boolean {
+    // Any local coverage at all counts as a source.
+    if (this.localSurahs(rewayatId).length > 0) return true;
     const rw = this.findRewayat(rewayatId);
     return Boolean(rw?.has_timestamps);
   }

   hasSurah(rewayatId: string, surahNumber: number): boolean {
+    if (this.localSurahs(rewayatId).includes(surahNumber)) return true;
     const rw = this.findRewayat(rewayatId);
     // ... unchanged ...
   }

   async fetchAndCache(
     rewayatId: string,
     surahNumber: number,
   ): Promise<AyahTimestamp[] | null> {
+    // Local bundle wins over R2 (Open question 3), but only when the coverage
+    // signal claims this surah AND the provider returns a well-shaped array.
+    if (this.localSurahs(rewayatId).includes(surahNumber)) {
+      const local =
+        branding.timestampLocalProvider?.(rewayatId, surahNumber) ?? null;
+      // Same first-element shape probe the R2 path runs (added post-#286):
+      // fork-authored bundles are an untrusted-shape source too. A malformed
+      // entry (snake_cased fields, a missing `durationMs`, an old shape) would
+      // otherwise land `undefined` in the SQLite `duration_ms` column and
+      // produce NaN highlight offsets.
+      if (
+        Array.isArray(local) &&
+        local.length > 0 &&
+        isAyahTimestampShape(local[0])
+      ) {
+        await timestampDatabaseService.writeTimestamps(
+          rewayatId,
+          surahNumber,
+          local,
+          'local',
+        );
+        return local;
+      }
+      // Coverage claimed but data missing/malformed → fall through to R2
+      // rather than caching garbage.
+    }
     if (!this.hasSurah(rewayatId, surahNumber)) return null;
     // ... unchanged R2 fetch ...
   }
 }
```

`isAyahTimestampShape` is the existing module-level guard the R2 path gained in
the RFC-015 review (PR #286); the local path reuses it verbatim — no new
validator. Total upstream diff is two branding types + one private helper +
three guarded early-outs in `TimestampFetchService` (plus a one-line import for
`AyahTimestamp` in `branding.d.ts`). No new files, no new infrastructure.

### Coverage semantics: local is an exact allow-list, not empty-means-all

The local coverage signal and the existing R2 coverage rule are **not
symmetric**, and the code PR must not paper over the difference. Calling it out
explicitly (review, Issue: coverage asymmetry):

- **Local path** — `timestampLocalSurahList(rewayatId)` is an **exact
  allow-list**. `hasSurah` returns true only when
  `localSurahs(rewayatId).includes(surahNumber)`. An **empty / `null`** list
  means **no local coverage** (`hasSource` returns false for the local check) —
  it does **not** mean "all surahs covered." There is no sentinel value for
  "everything"; a fork that bundles all 114 surahs lists all 114.
- **R2 path** — `has_timestamps && empty surah_list` is treated as **"all
  surahs covered"** (`timestamps_surah_list` absent/empty + the `has_timestamps`
  flag = the whole reciter is covered on the CDN). This is the existing
  upstream rule and is unchanged by this RFC.

So the two paths read an empty list **oppositely**: empty-on-R2 = "all", empty-on-local = "none". This asymmetry is intentional and arguably safer for bundled data (you can't accidentally claim coverage you didn't ship), but because the local signal *mirrors the shape* of `timestamps_surah_list`, it would be easy for the consumer PR to copy the R2 "empty ⇒ all" branch onto the local path by reflex. **Do not.** The local gate is `.includes(surah)` with empty ⇒ none, full stop.

Two corollaries the consumer PR must preserve:

1. **Local coverage bypasses `has_timestamps`.** The local checks in
   `hasSource` / `hasSurah` short-circuit to `true` **before** the
   `rw?.has_timestamps` read — a fork's bundled reciter need **not** carry the
   `has_timestamps` catalog flag at all. The flag gates only the R2 path; local
   coverage is authoritative on its own via the coverage list. (This is why the
   sketch's `localSurahs(...).length > 0` / `.includes(...)` early-returns sit
   above the `findRewayat` / `has_timestamps` lines.)
2. **No "empty list ⇒ all surahs" sentinel for local, ever** — if a future fork
   really wants "all surahs are local," it enumerates them (or a follow-up RFC
   adds an explicit `'*'`-style sentinel deliberately). Empty stays "none" so
   the default-off / partial-coverage cases are safe by construction.

---

## Migration / default behavior

**Bayaan:** no change. Field absent → every `?? null` short-circuits → the R2
fetch path runs exactly as today. Byte-equivalent; zero action required.

**Forks opting in:** declare the pair once in `config/branding.js` —
`timestampLocalSurahList` returning the covered surah numbers for each
authored rewayat (`null` otherwise), and `timestampLocalProvider` returning the
bundled timings for a covered `(rewayatId, surahNumber)` (`null` otherwise).
The two must agree: every surah in the coverage list must have data from the
provider. The cache stores validated entries with source `'local'` (already a
valid `TimestampSource`), so the rest of the highlight pipeline is unchanged.

The coverage list is what gates the follow-along UI, so a fork bundling a
**partial-coverage** reciter (e.g. surahs 2–286 with no surah 1) simply lists
the surahs it has; the feature is enabled for exactly those, never falsely
suppressed.

---

## Open questions

1. **~~`hasSource` presence-probe shape.~~ RESOLVED (review, Issue 1).** The
   original sketch probed surah 1 to answer "does this rewayat have local
   coverage." That is a **correctness hole, not a taste question**: a
   partial-coverage reciter whose bundle lacks surah 1 (28 of ~268 rewayat in
   the current catalog have no surah 1 in `surah_list`) returns `null` from the
   probe → `hasSource` reports false → the follow-along UI, gated on
   `hasTimestampSource`, is suppressed entirely despite valid bundled data.
   Adopted the alternative (b) from the original draft: an explicit
   `branding.timestampLocalSurahList?: (rewayatId) => number[] | null` coverage
   signal, mirroring the catalog's existing `Rewayat.timestamps_surah_list`.
   `hasSource` / `hasSurah` consult the list (never the data provider, never a
   sentinel surah); the data provider is called only on the `fetchAndCache`
   write path. No open question remains here.

2. **Sync vs async provider.** This RFC specifies a **synchronous** pair (the
   methods `hasSource`/`hasSurah` are sync today, and bundled data is
   in-memory). If a fork ever needs async-loaded bundled data, the provider
   would need a `Promise` return and `hasSurah` would have to become async — a
   larger change. Keeping it sync unless there's a concrete async need.

3. **Precedence vs R2.** The sketch lets a covered, well-shaped local result
   win over the R2 path. That's the intended semantic (a fork that bundles
   timings wants them used). Stated explicitly so a future reciter that has
   *both* a bundle and an R2 mirror resolves deterministically: **local wins
   when the coverage list claims the surah and the provider returns valid
   data**; if coverage is claimed but the bundle is missing or malformed, the
   code falls through to R2 rather than caching garbage (see the `fetchAndCache`
   sketch).

---

## Alternatives considered

### Reuse RFC-015's `timestampCdnBase` and mirror bundled timings to a CDN

Rejected as the primary path. It works, but forces an R2 bucket + a network
round-trip for data the fork already ships on disk, and the timings then can't
resolve offline. RFC-015 (CDN base) and this RFC (bundled provider) are
complementary read-side seams, not substitutes.

### Catalog field carrying inline timestamps per rewayat

Add the timings directly onto the `Rewayat` catalog row. Rejected: it bloats
the catalog JSON (timings are large), couples authoring to catalog versioning,
and the catalog is the wrong place for kilobytes of per-ayah timing arrays.

### Fork-detection branch inside `TimestampFetchService`

An `if (isQariah) …` conditional. Anti-pattern — every new fork grows the
conditional. Same reasoning RFC-015 used to reject it.

### Env variable

`EXPO_PUBLIC_*` can carry a string, not a function returning typed timing
arrays. Wrong tool for a provider seam.

---

## Out of scope

- **The R2/CDN fetch path** (RFC-015 / PR #278). This RFC adds a pre-network
  provider; it does not change how R2 timings are fetched, validated, or
  cached. It does **reuse** the R2 path's `isAyahTimestampShape` guard (PR #286)
  on the local data before writing — same threat model (fork/operator-authored
  data of untrusted shape), same one-line guard, no new validator.
- **Timestamp authoring / bundling tooling.** Forks own how they produce and
  bundle their timing data; this RFC is read-side configurability only.
- **The `cached_surahs.source` column / `TimestampSource` enum.** Already in
  the upstream schema (`'r2' | 'local'`); this RFC just reaches the existing
  `'local'` value through a supported seam.

---

## Reference implementation

Qariah's adoption ships against the same shape:

- `config/branding.js` declares the pair — `timestampLocalSurahList` returning
  the covered surah numbers for the fork's locally-authored reciter (today a
  single reciter whose timings are baked into the app, with a partial coverage
  list) and `timestampLocalProvider` returning the bundled timings for a
  covered surah, `null` otherwise.
- `services/timestamps/TimestampFetchService.ts` consumes the seam with the
  `?? null` fallbacks shown above, gating coverage on the explicit list and
  running the existing `isAyahTimestampShape` guard on local data before it
  reaches the cache — retiring a recurring hot-file divergence that has been
  dropped multiple times on wholesale absorptions of this file.

---

## Cross-references

- RFC-015 — `branding.timestampCdnBase` (read-side CDN seam; this RFC is the
  bundled-data counterpart, same inline-fallback pattern).
- RFC-009 / RFC-018 — nullable provider functions on `branding` (shape
  precedent for an optional fork-supplied function).
- PR #278 — `feature/timestamps-r2-mirror`. Introduced the fetch service this
  RFC extends.
