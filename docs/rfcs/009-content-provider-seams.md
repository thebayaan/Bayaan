# RFC-009: External content provider seams (translations + tafsir)

| Field  | Value                    |
| ------ | ------------------------ |
| Status | Proposed                 |
| Date   | 2026-05-16               |
| Author | Omar Zarka (Qariah fork) |

## Summary

Add two optional `Branding` slots — `translationProvider?: TranslationProvider` and `tafsirProvider?: TafsirProvider` — so forks can supply their own translation and tafsir sources for the Settings → Translations and Settings → Tafsir download flows. Bayaan's default behavior is unchanged when the slots are empty (the existing alQuran.cloud-backed translation service and api.quran.com-backed tafsir service stay the defaults). The SQLite cache layers that already wrap each service do not move and do not change shape.

This RFC is the third in the XF-NNN multi-tenancy series, following RFC-007 (the `Branding` interface itself + `CatalogProvider`) and RFC-008 (`branding.listenTabTopComponent`). It covers the two external content-source seams in the app together because the consumers, lifecycles, and provider contracts are structurally identical — splitting them into two RFCs would mean duplicated reviewer overhead and a risk of half-migrated state if one merged and the other stalled.

## Motivation

Two services hit external content APIs with the same shape and the same consumer pattern:

**`services/translation/TranslationApiService.ts`** hardcodes `https://api.alquran.cloud/v1` at line 3, exposes `fetchAvailableEditions` (line 47) and `fetchFullTranslation` (line 59), and exports a singleton `translationApiService` (line 101) consumed by `store/translationStore.ts:33` (via `fetchFullTranslation`).

**`services/tafseer/TafseerApiService.ts`** hardcodes `https://api.quran.com/api/v4` at line 3, exposes `fetchAvailableEditions` (line 55) and `fetchFullTafseer` (line 79), and exports a singleton `tafseerApiService` (line 163) consumed by `store/tafseerStore.ts:39` (via `fetchFullTafseer`).

Both consumers follow the same lifecycle: pick edition → call `fetch{X}` with a progress callback → destructure `{edition, verses}` → hand off to a `dbService.save{X}()` that writes SQLite rows → update store metadata. The shape parity is exact; only the underlying upstream API differs (alQuran.cloud aggregator vs. api.quran.com / QF public API).

Each service is a third-party choice that forks may legitimately want to change. Today, a fork that prefers a different source — for example, Qariah pointing translations at `apis.quran.foundation/v4/translations`, or swapping tafsir to a different aggregator — has to fork the entire service file to change the base URL and response-shape mapping. That puts each file on the weekly merge-conflict list even though the *consumer surface* hasn't actually changed.

This is the same divergence shape RFC-007 resolved for the catalog (`CatalogProvider`): the concrete data source is hardcoded; the interface the rest of the app needs is small and stable; a provider seam makes the source swappable without forcing forks to maintain parallel copies of the service files.

Concrete cost today: every Bayaan change to `TranslationApiService.ts` (e.g. the recent `direction`-default fallback at lines 90–95) or to `TafseerApiService.ts` (e.g. the verse-grouping logic at lines 127–157, which has been iterated on) creates a merge conflict for any fork that has swapped the base URL, even when the change is orthogonal to the source choice.

Two parallel seams introduced together also signal architecture rather than ad-hoc point fixes — they establish the pattern alongside RFC-007's `CatalogProvider` for the next external-content seam that surfaces.

## Decision

Introduce two distinct interfaces — `TranslationProvider` and `TafsirProvider` — each with two methods that mirror the existing service surfaces. Add two corresponding optional fields to `Branding`. Extract the current implementations into default-named providers that the singletons resolve to when no override is set.

### 1. `TranslationProvider`

```ts
// types/TranslationProvider.ts
import type {RemoteTranslationEdition} from '@/types/translation';
import type {TranslationVerse} from '@/services/translation/TranslationApiService';

export interface TranslationProvider {
  /** Lists every translation edition the provider can serve. */
  fetchAvailableEditions(): Promise<RemoteTranslationEdition[]>;

  /**
   * Fetches every verse for one edition. Progress callback fires at
   * surah granularity (0..1). The returned `edition` object MUST have
   * `direction` set (provider is responsible for defaulting it if the
   * upstream API omits it — see the RTL fallback at
   * `TranslationApiService.ts:92-95`).
   */
  fetchFullTranslation(
    editionId: string,
    onProgress?: (progress: number) => void,
  ): Promise<{
    edition: RemoteTranslationEdition;
    verses: TranslationVerse[];
  }>;
}
```

`TranslationVerse` already exists at `TranslationApiService.ts:39-44`; it would move to `types/translation.ts` as part of the implementation PR (mechanical re-export; no behavior change).

### 2. `TafsirProvider`

```ts
// types/TafsirProvider.ts
import type {TafseerEdition} from '@/types/tafseer';
import type {TafseerVerse} from '@/services/tafseer/TafseerApiService';

export interface TafsirProvider {
  /** Lists every tafsir edition the provider can serve. */
  fetchAvailableEditions(): Promise<TafseerEdition[]>;

  /**
   * Fetches every verse-level tafsir for one edition. Progress callback
   * fires at chapter granularity (0..1). Verse-group semantics (grouped
   * verses sharing one tafsir text) are encoded via the optional
   * `groupVerseKey` / `fromAyah` / `toAyah` fields on `TafseerVerse` —
   * see the grouping logic at `TafseerApiService.ts:127-157`. Providers
   * that don't return grouped tafsir leave those fields unset.
   */
  fetchFullTafseer(
    editionId: string,
    onProgress?: (progress: number) => void,
  ): Promise<{
    edition: TafseerEdition;
    verses: TafseerVerse[];
  }>;
}
```

`TafseerVerse` already exists at `TafseerApiService.ts:40-48`; it would move to `types/tafseer.ts` as part of the implementation PR.

### 3. Branding slots

```ts
// config/branding.d.ts (additive)
import type {TranslationProvider} from '@/types/TranslationProvider';
import type {TafsirProvider} from '@/types/TafsirProvider';

export interface Branding {
  // …existing fields…

  /**
   * Optional translation source. `undefined` keeps Bayaan's default
   * (the alQuran.cloud-backed `AlQuranCloudTranslationProvider`).
   */
  translationProvider?: TranslationProvider;

  /**
   * Optional tafsir source. `undefined` keeps Bayaan's default
   * (the api.quran.com-backed `QuranComTafsirProvider`).
   */
  tafsirProvider?: TafsirProvider;
}
```

### 4. Default implementations

Each current class body is extracted verbatim into a default-named provider; the existing singleton becomes a thin resolver.

```ts
// services/translation/TranslationApiService.ts (post-refactor)
import branding from '@/config/branding';
import {alQuranCloudTranslationProvider} from './AlQuranCloudTranslationProvider';

export const translationApiService =
  branding.translationProvider ?? alQuranCloudTranslationProvider;
```

```ts
// services/tafseer/TafseerApiService.ts (post-refactor)
import branding from '@/config/branding';
import {quranComTafsirProvider} from './QuranComTafsirProvider';

export const tafseerApiService =
  branding.tafsirProvider ?? quranComTafsirProvider;
```

The exported names and types stay the same, so `store/translationStore.ts:33` and `store/tafseerStore.ts:39` (and any future consumer) don't change.

### 5. Cache layers (non-change)

The SQLite cache layers (`translationDbService`, `tafseerDbService`) sit *outside* the API services in the store + DB layer. They are not part of the provider contracts and do not move. Each provider returns in-memory `{edition, verses}`; the corresponding cache wraps the provider call exactly as it wraps the current concrete service. This mirrors how RFC-007's `CatalogProvider` left the catalog-cache layer untouched.

## Backwards compatibility

None broken. With both `branding.translationProvider` and `branding.tafsirProvider` unset (Bayaan's default), the exported singletons resolve to the current class bodies extracted unchanged. Base URLs, response shapes, RTL-language fallbacks, paginated-chapter fetch loops, verse-grouping logic, progress-callback semantics, and error messages are all preserved verbatim. Neither store changes.

## Alternatives considered

### Alt 1 — Leave forks to monkey-patch or copy each file

Forks fork `TranslationApiService.ts` and/or `TafseerApiService.ts` wholesale and edit the URL + response mapping.

**Rejected.** This is the status quo and it's exactly the problem. Each file lands on the weekly merge-conflict list permanently. Any Bayaan-side improvement to either service (e.g. the recent `direction` fallback in translation, or any future change to the tafsir verse-grouping detection) collides with the fork's edits even when the changes are orthogonal.

### Alt 2 — One generic `ContentEditionProvider<T>` interface

Define a single `ContentEditionProvider<TVerse, TEdition>` interface with `fetchAvailableEditions(): Promise<TEdition[]>` + `fetchFull(editionId, onProgress): Promise<{edition: TEdition, verses: TVerse[]}>`, then `type TranslationProvider = ContentEditionProvider<TranslationVerse, RemoteTranslationEdition>` and `type TafsirProvider = ContentEditionProvider<TafseerVerse, TafseerEdition>`. One branding slot per concrete type.

**Rejected.** Tempting but premature. The verse shapes already differ (`TafseerVerse` carries `groupVerseKey`/`fromAyah`/`toAyah` for verse-group encoding that `TranslationVerse` doesn't need), and the edition shapes differ (`TafseerEdition` carries `authorName`). The generic ends up with two type parameters and the call-site method names (`fetchFullTranslation` vs `fetchFullTafseer`) would either collapse to a generic `fetchFull` — forcing both store call-sites to change for no real win — or stay distinct, which defeats the unification. Two parallel interfaces compose to the same machinery without the abstraction tax and let the two seams evolve independently if shapes diverge later. If a third content-provider seam surfaces with the same shape, revisit.

### Alt 3 — Ship a multi-provider mux upstream

Bayaan-side code knows about both alQuran.cloud and QF (and any future provider), and a `branding.translationProviderId: 'alquran-cloud' | 'qf' | …` enum selects between them. Same for tafsir.

**Rejected** for the same reason RFC-008 rejected its string-enum alternative: it conflates fork code with Bayaan-source code. Bayaan would either carry QF-specific (or any-fork-specific) client code permanently or leave the enum value as a no-op outside the matching forks. The whole point of the seam is that fork-specific source choices live in the fork.

### Alt 4 — Just swap the defaults upstream

Replace alQuran.cloud / api.quran.com with whatever a particular fork prefers.

**Rejected.** Default-switching is a Bayaan product decision orthogonal to multi-tenancy and not something this RFC should drive. The current defaults have served Bayaan reliably. The seams are neutral: if Bayaan later decides to switch a default, it sets the corresponding branding field in its own `config/branding.js`. Same machinery.

### Alt 5 — Split into two RFCs (translations, tafsir)

Open one RFC for translations and a separate one for tafsir later.

**Rejected.** The two services are structurally identical at the consumer surface, the contract derivation is identical, and the backwards-compatibility argument is identical. Reviewing them together is strictly less work than reviewing them sequentially. Splitting also creates a half-migrated risk: if one RFC merges and the other stalls, forks have to maintain a mixed pattern (one provider seam + one forked file) which is worse than either endpoint. The implementation PRs can still split (see Implementation plan) if that's easier to land.

## Consequences

**Positive**
- Forks override translation source and/or tafsir source via one field each in `config/branding.js`; no fork of either service file.
- Pattern matches RFC-007 (`CatalogProvider`) exactly — no new architectural concept to learn, and a second instance of the pattern signals it's the convention for external-content seams.
- Zero behavior change for Bayaan; the default resolution paths return the same singletons they do today.

**Neutral**
- Adds two new type files (`types/TranslationProvider.ts`, `types/TafsirProvider.ts`) and two extracted provider files (`AlQuranCloudTranslationProvider.ts`, `QuranComTafsirProvider.ts`). The two `*ApiService.ts` files collapse to ~5 lines each (the resolvers).
- `TranslationVerse` and `TafseerVerse` move to their respective `types/` files; existing imports update mechanically.

**Negative / risks**
- The interfaces commit Bayaan to specific provider contracts. If a future provider needs (e.g.) per-verse streaming or async edition discovery, the interface needs extension. Mitigation: keep v1 minimal — only the two methods each store actually calls today — and extend additively when a concrete need surfaces. Same trade-off RFC-007's `CatalogProvider` made.
- `branding.translationProvider` and `branding.tafsirProvider` are "live code in config" fields, the same pattern RFC-008's `listenTabTopComponent` introduces. Two more precedents now — confirming the convention.

## How we'll know it worked

- `npx tsc --noEmit` from repo root produces no new errors after the implementation PR.
- `store/translationStore.ts:33` and `store/tafseerStore.ts:39` work unchanged; downloading a translation or a tafsir from Settings produces byte-identical SQLite rows to `develop` baseline when neither branding slot is set.
- A fork can set `branding.translationProvider = qfTranslationProvider` and/or `branding.tafsirProvider = qfTafsirProvider` and the downloads work without modifying any file present in `develop`.
- Qariah's eventual divergence-ledger rows for `TranslationApiService.ts` and `TafseerApiService.ts` read "Upstreamed (RFC-009)" and the fork's diff against `upstream/develop` for both paths drops to zero.

## Open questions

1. **Rate limits / auth.** alQuran.cloud is anonymous. api.quran.com is currently anonymous for the read endpoints we use. `apis.quran.foundation` may require an OAuth app token even for read-only access. The provider interfaces treat this as a provider-internal concern (each provider holds its own credential), but Bayaan-side documentation should note that fork-supplied providers may carry their own auth lifecycle. Not blocking for this RFC.

2. **Should the SQLite cache keys include the provider id?** Today the cache keys are `editionId` alone for both translations and tafsir. If two providers ever serve the same `editionId` with different content (unlikely — `editionId` is provider-namespaced in practice), the cache could serve stale rows across a provider swap. Probably not worth solving until a real conflict shows up; flag here so reviewers can weigh in.

3. **Naming.** `TranslationProvider` / `TafsirProvider` vs. `…Source` vs. `…Api`. Matched `CatalogProvider` naming from RFC-007 for consistency. Open to bikeshedding. Also: `Tafsir` vs. `Tafseer` — the codebase uses `Tafseer` for existing identifiers (`tafseerApiService`, `TafseerEdition`); the new interface uses `TafsirProvider` to match the more common English transliteration, but the implementation PR could go either way for consistency. Slight preference for keeping existing identifiers stable and naming the new interface `TafseerProvider` for grep parity — open to either.

## Implementation plan

This is a doc-only RFC. If accepted:

1. **Code PR(s) — Bayaan side.** Translations and tafsir can land in one PR or two separate PRs; maintainer's / fork's call. The per-service diff is symmetric:
   - Add `types/{Translation,Tafsir}Provider.ts`.
   - Move `{Translation,Tafseer}Verse` to the respective `types/` file.
   - Extract the existing class into `services/{translation,tafseer}/{AlQuranCloud,QuranCom}{Translation,Tafsir}Provider.ts`.
   - Collapse `{Translation,Tafseer}ApiService.ts` to the resolver.
   - Add the optional field to `Branding`.
   - Default Bayaan branding leaves the field unset; behavior unchanged.
   - ~80 lines diff per service.

2. **Code PR — Qariah-side (in qariah-v2 repo).** Add `services/translation/QfTranslationProvider.ts` and/or `services/tafseer/QfTafsirProvider.ts` implementing the respective interfaces against `apis.quran.foundation`, set the branding fields in `config/branding.js`. Qariah's divergence-ledger rows for both service files flip from "would-be Local" to "Upstreamed".

If the maintainer prefers Alt 2 (generic interface), Alt 3 (multi-provider mux), Alt 4 (swap defaults), or Alt 5 (split RFCs), this RFC is withdrawn and a new one opens with the preferred shape.
