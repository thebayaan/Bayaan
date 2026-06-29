# RFC-012: composable filter dimensions in the Search tab

**Status:** Draft (doc-only — code PR planned as a follow-up after shape clears review)
**Authors:** Omar Zarka (Qariah fork)
**Related:** RFC-007 (multi-tenant config seam, merged), RFC-008 (component slot — listen-tab top), RFC-011 (continue-reading history size)

---

## Summary

Move filter composition into the Search tab. Today, "Browse by X" tiles on the Home/Listen tab each route into `components/browse/BrowseReciters.tsx` with a single pre-set filter param (`surahId`, `teacher`/`student`, `rewayatName`), but the filter is invisible to the user once they're there — they can't see *what* filtered them in, and can't *combine* dimensions. This RFC proposes consolidating reciter filtering into the Search tab with composable, user-editable filter chips and reducing the Browse-by-X tiles on the Home tab to preset deeplinks into Search with those chips pre-applied.

The chip set spans the dimensions the Reciter model can support — `rewaya`, `has-surah`, `has-photo`, and `recitation-style` work against fields that exist today (`Reciter.rewayat[].name`, `Reciter.rewayat[].surah_list`, `Reciter.image_url`, `Reciter.rewayat[].style`); `country` / `translation` are **future dimensions** that first require adding the corresponding fields to `Reciter` in `data/reciterData.ts` and populating them from the catalog. The RFC treats those two as a named prerequisite rather than assuming they already exist (see Design).

Default behavior is preserved via opt-in: a new `branding.searchFilters?: SearchFilterDimension[]` (or component-slot equivalent — see Alternatives) lets each tenant declare which dimensions to surface and in what order. If undefined, Search behaves exactly as today.

---

## Motivation

The destination is *already* unified — `app/(tabs)/(a.home)/reciter/browse.tsx` and `app/(tabs)/(b.search)/reciter/browse.tsx` both render `BrowseReciters.tsx`. Today the param surface is small: `BrowseRecitersProps` declares `surahId | initialTeacher | initialStudent`, the Home route reads `surahId | teacher | student | rewayatName`, and the Search route reads only `surahId`. This RFC's composable-filter model **would extend** that param surface (a small additive change — adding `country | translation | …` params and the matching props); the ~600-LOC migration estimate below is measured from that real starting point, not from a pre-existing full param set. Every "Browse by X" tile constructs one of these param sets and deeplinks in.

The user feedback that triggered this RFC (on the Qariah fork's TestFlight beta, 2026-05-19) crystallized the problem: tapping "Surah Al-Baqarah" from the Home/Listen tab dropped the user into a reciter list filtered to Al-Baqarah, but the user couldn't tell *why* the list was filtered, couldn't relax the filter to see more reciters, and couldn't add a second filter ("show me Spanish-translation reciters who have Al-Baqarah"). The hidden-filter UX masks the platform's actual capability.

A targeted fix shipped Qariah-side for the Al-Baqarah case (cross-reciter recitations flat list when `surahId` is set), but the deeper pattern remains: each new Browse-by-X tile is bespoke UI, and the filtering capability stays invisible. RFC-012 proposes the structural fix that benefits both Bayaan and forks.

---

## Design

### Concept

```
┌─ Search ────────────────────────────────────────┐
│  🔍 Search reciters, surahs…                    │
├─────────────────────────────────────────────────┤
│  Filters:                                       │
│  [Country: Algeria ×]  [Rewaya: Hafs ×]  [+]   │
├─────────────────────────────────────────────────┤
│  Results: 8 reciters, 14 recitations            │
│  ┌────┐ Reciter Name              [Hafs]       │
│  │ 👤 │ Algeria                                 │
│  └────┘                                         │
│  …                                              │
└─────────────────────────────────────────────────┘
```

### Two shape options for the multi-tenant seam

#### Option A — Declarative config

```typescript
// config/branding.d.ts
export interface Branding {
  /**
   * Filter dimensions surfaced as composable chips in the Search tab.
   * Order = visual order of the chip-picker. If undefined, the Search
   * tab renders no filter chips (today's behavior).
   *
   * Each dimension lifts an existing BrowseReciters URL param into a
   * user-editable chip. The Search screen owns the chip UI uniformly;
   * each tenant just declares which subset matters.
   */
  searchFilters?: SearchFilterDimension[];
}

export type SearchFilterDimension =
  | 'rewaya'              // Reciter.rewayat[].name → teacher/student (exists today)
  | 'has-surah'           // surah picker → Reciter.rewayat[].surah_list includes (exists today)
  | 'has-photo'           // Reciter.image_url present (exists today)
  | 'recitation-style'    // Reciter.rewayat[].style → 'murattal'|'mojawwad'|'molim' (exists today)
  | 'country'             // ⚠ prerequisite: add Reciter.country, then slug-compare
  | 'translation';        // ⚠ prerequisite: add Reciter.translation, then slug-compare
```

**Field prerequisites.** `Reciter` in `data/reciterData.ts` is `{id, name, slug, date, image_url, rewayat}` today, and `Rewayat` carries `name`, `surah_list`, and `style` — so `rewaya`, `has-surah`, `has-photo`, and `recitation-style` are implementable against existing fields, but `country` and `translation` first need their fields added to the `Reciter` type and populated from the catalog API. A tenant that lists those two dimensions in `branding.searchFilters` without the fields present should get a dev-time warning and a no-op chip. Bayaan can ship the four exists-today dimensions immediately; the rest land as the catalog model grows.

Bayaan adopts with whatever subset fits its product — initially the exists-today dimensions (`['rewaya', 'has-surah', 'has-photo', 'recitation-style']`), adding `country` / `translation` once their `Reciter` fields land. Forks add their preferred dims on top.

Pro: each chip dimension lives in shared chip UI. New filter dims need a code PR per dim (the chip's value picker, label, predicate).
Con: extensibility requires a code PR — but the cost is small (each new dim is ~50 LOC).

#### Option B — Component slot (mirrors RFC-008)

```typescript
// config/branding.d.ts
export interface Branding {
  /**
   * React component slot rendered above the search results. Used to
   * compose filter chips. Tenants own the chip set entirely; the Search
   * screen wires the resulting filter state into BrowseReciters' existing
   * URL params (or a new equivalent prop drill).
   */
  searchFiltersComponent?: React.ComponentType<SearchFiltersSlotProps>;
}

export interface SearchFiltersSlotProps {
  onFiltersChange: (filters: Record<string, string | string[]>) => void;
  initialFilters?: Record<string, string | string[]>;
}
```

Pro: each tenant fully owns their chip UI; zero code in Bayaan beyond the slot wiring.
Con: greater divergence — each fork builds its own composer; no shared UI / interaction patterns. Same trade-off RFC-008 lives with.

### Browse-by-X tile reduction

Whichever option lands, the per-tile JSX on the Home/Listen tab collapses to a single helper:

```tsx
<BrowseByTile
  filter={{country: 'algeria'}}
  label="Algeria"
  icon={<CountryShape code="DZ" .../>}
/>
// → routes to /(tabs)/(b.search)/reciter?country=algeria
```

The Search screen reads the param, surfaces it as a chip the user can remove, and shows results filtered.

### BrowseReciters changes

Largely additive. The existing param shape stays; we add a `useURLFiltersAsChips` hook (or similar) that derives chip state from URL params + user interactions. Filter mutations rewrite the URL via `router.setParams` so deeplinks remain shareable.

### What does NOT change

- `BrowseReciters.tsx` data-shape logic (filtering predicates, rendering grid vs flat list).
- Home/Listen-tab tile gating (`branding.homeRowConfig` from RFC-007 still controls visibility + order).

---

## Alternatives considered

### Status quo
Each "Browse by X" tile builds its own filtered list. Works today. Loses to user-empowerment + duplicated UI across N hidden-filter screens.

### Filters on BrowseReciters (not Search tab)
Add composable chips to `BrowseReciters` directly; Home-tab tiles still deeplink in with pre-set chips. Considered and rejected because Search is where users *expect* filters to live; BrowseReciters is a "render a filtered list" surface, not a "compose a query" surface. Adding chips there muddles the two surfaces.

### Don't lift to Bayaan — keep fork-local
Loses the multi-tenant-first principle that motivated RFC-007. Bayaan would benefit equally from composable filters when its reciter catalog grows.

---

## Migration plan

1. **Land config seam upstream** (this RFC + its accompanying code PR). Bayaan ships with `searchFilters: undefined` (no chips visible) — zero behavior change.
2. **Bayaan adopts** with a chosen subset of dims. Each Browse-by-X Home tile flips its `href` to deeplink into Search with the chip pre-set. The carousel rows stay; the destination changes.
3. **Forks adopt** the same seam with their extended dim sets.
4. **Deprecate per-screen filter knobs** that `BrowseReciters` has accumulated (style filter, etc) over time — they all become Search-tab chips. Several sprints of cleanup.

---

## Open questions

1. **Multi-value chips:** does a chip hold one value (Country: Algeria) or many (Country: Algeria + Morocco)? Multi-value adds chip UX complexity; single-value matches the Home-tab tile deeplink semantics most naturally. Recommend single-value v1, multi-value as follow-up.
2. **Chip set ordering:** alphabetical by label, or matching the `branding.searchFilters` declaration order? Recommend declaration order — gives tenants control.
3. **"Recitation" vs "Reciter" result mode:** the `has-surah` chip implies the result row is a (reciter, rewaya) tuple, not a reciter card. Result-row component switches based on the chip set.
4. **Deeplink stability:** lifting filters into the URL means every chip change rewrites the URL. Recommend `router.setParams` (in-place URL update) over `router.push` so back-navigation isn't polluted by filter twiddling.
5. **Mobile-first chip ergonomics:** chip count > 3 wraps to multiple rows on narrow phones; Filter sheet (modal) for chip *picking* but inline chip *display*. The chip count itself is bounded by the dim list, so multi-row wrap is probably fine.

---

## Code-PR plan (after shape clears)

This RFC is doc-only on landing. The code PR follows:

1. Extract the existing surahId → (reciter, rewaya) flat-list view from `BrowseReciters` into a shared `<RecitationsList>` component.
2. `<SearchFilters>` chip composer in `components/search/`. Reads `branding.searchFilters`; renders one chip widget per declared dim.
3. Sub-pickers per dim (existing `CountryCard`-style picker for country; surah picker reusing `BrowseSurahs`).
4. `useURLFiltersAsChips` hook owns the URL-state ↔ chip-state derivation.
5. Home-tab Browse-by-X tiles flip `href` to deeplink into Search.

Estimated PR size: ~600 LOC across ~10 files; one focused sprint of work after the shape clears.

---

## Risks

- **UX flavor disagreement:** chip placement (above list / sheet / chip drawer), chip removal affordance (× / long-press / drag), chip-pick affordance (tap / sheet / dropdown) all have legitimate variations. Mitigation: ship Option A (shared UI, tenant-declared dims) — flavor is shared, content is local.
- **Bundle-size:** each new chip dim's value picker is potentially a chunky component. Tree-shaking + lazy-loading mitigations available.
- **Discoverability:** if Browse-by-X tiles deeplink straight to Search-with-chip, users might not realize the filter is editable. Mitigation: chip styling (close button visible, hover/long-press affordance) + a one-time onboarding tooltip the first time they land via tile.

---

## Acceptance for this doc-only PR

The RFC lands when the shape (Option A vs B) is decided. The accompanying code PR is a separate review cycle.

Per the RFC-008 + RFC-009 pattern: mock-first for visual features. Mock to be drafted by the implementing sprint before any code lands (chip placement, chip styling, picker sheet design).
