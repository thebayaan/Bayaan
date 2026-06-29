# RFC-011: Continue-Reading hero history size

| Field  | Value      |
| ------ | ---------- |
| Status | Proposed   |
| Date   | 2026-05-17 |
| Author | Omar Zarka (Qariah fork) |

## Summary

Add an optional numeric config field to `Branding` that lets forks widen the Surahs-tab "CONTINUE READING" hero from a single most-recent-page card into a horizontal carousel of the last *N* stopping points. Bayaan's behavior is unchanged when the field is omitted (or set to `1`).

This RFC is the fourth in the XF-NNN multi-tenancy series, following RFC-007 (the `Branding` interface itself), RFC-008 (`branding.listenTabTopComponent`), and RFC-010 (`branding.catalogVersionEndpoint`). It targets the only remaining hardcoded reading-history shape in `services/mushaf/MushafSessionStore.ts` + `components/hero/ContinueReadingHero.tsx`.

## Motivation

`services/mushaf/MushafSessionStore.ts` stores exactly one `lastReadPage: number` in MMKV. `components/hero/ContinueReadingHero.tsx` reads that single value and renders a single `SurahHeroSection` titled `CONTINUE READING` (or `SURAH OF THE DAY` when there's no history). This is great for users who read one surah at a time start-to-finish.

Multi-session readers — users who switch between several surahs in a day for different purposes (e.g., daily review of Al-Kahf on Fridays, ongoing memorization in Yāsīn, study notes in Al-Baqarah) — lose context every time they open a new surah, because the single MMKV slot gets overwritten. The "where was I" affordance becomes "where was I most recently" only.

Concrete cost in Qariah's user testing: roughly **40% of returning users open the Surahs tab without using the Continue Reading hero**, because the displayed last page is no longer the one they want to resume. They scroll past the hero and navigate manually.

Qariah ships a horizontal 5-card carousel of the last 5 stopping points to address this. The diff is structurally similar to RFC-008's component-slot pattern but only along one axis: how many cards the hero shows. The render shape (a `FlatList` of `SurahHeroSection` cards) is the same; the data shape (an array vs. a singleton) is the difference.

Today Qariah achieves this by forking both `services/mushaf/MushafSessionStore.ts` (widening the persistence layer) and `components/hero/ContinueReadingHero.tsx` (swapping in a `RecentReadingCarousel` when the flag is on). Every Bayaan touch to either file creates a merge conflict for Qariah even when Bayaan's edit is unrelated to history-size. This RFC pulls the size out as a single number on `Branding`, so the persistence layer and the hero both stay upstream-shared.

## Decision

Add an optional numeric field to `Branding`:

```typescript
// config/branding.d.ts
export interface Branding {
  // …existing fields…

  /**
   * Optional. Maximum number of recent reading positions the Continue
   * Reading hero shows. Defaults to `1` (Bayaan's existing single-card
   * behavior). Forks setting this to a value greater than `1` get a
   * horizontal carousel of the last N stopping points, ordered most-
   * recent first. The persistence layer (`MushafSessionStore`) honors
   * the same number when trimming its FIFO list.
   *
   * Values must be in [1, 10]. Values outside the range are clamped at
   * read time with a `console.warn`.
   */
  continueReadingHistorySize?: number;
}
```

`MushafSessionStore` widens internally — the persisted MMKV value becomes a `RecentPage[]`, with a one-time migration from the legacy `lastReadPage: number` key when present. Existing API surface is preserved:

```typescript
// services/mushaf/MushafSessionStore.ts (post-RFC)

export type RecentPage = {
  page: number;
  openedAt: number;
};

export const mushafSessionStore = {
  // unchanged
  getLastScreenWasMushaf, setLastScreenWasMushaf,

  /** Shim — returns the most recent page or null. */
  getLastReadPage(): number | null {
    return this.getRecentPages()[0]?.page ?? null;
  },

  /** Dedupe-and-promote into the FIFO list (capped at branding.continueReadingHistorySize). */
  setLastReadPage(p: number): void {
    // ...
  },

  /** New — returns up to `branding.continueReadingHistorySize` entries, most-recent first. */
  getRecentPages(): RecentPage[] {
    // ...
  },
};
```

`ContinueReadingHero` renders the existing single-hero layout when `branding.continueReadingHistorySize ?? 1` is `1`, and a horizontal `FlatList` of `SurahHeroSection` cards (same component, no new layout primitives) when the value is `> 1`. The empty-history fallback to `SURAH OF THE DAY` is unchanged in both modes.

Total Bayaan-side diff: ~80 lines (50 in `MushafSessionStore.ts` for the persistence widening + migration, 25 in `ContinueReadingHero.tsx` for the conditional carousel render, 5 in `branding.d.ts`/`branding.js` for the field declaration).

## Alternatives considered

### Alt 1 — Component slot: `branding.continueReadingHero?: ComponentType`

Hand the entire `ContinueReadingHero` over to forks via a component slot, like RFC-008's `listenTabTopComponent`.

**Rejected** because:
- The render shape of the carousel doesn't actually diverge from Bayaan's single-hero render — both layouts use `SurahHeroSection`. Only the data shape (1 vs. N entries) differs. A component-slot would force Qariah to duplicate `SurahHeroSection` rendering boilerplate it could just share.
- The persistence layer (`MushafSessionStore`) ALSO needs to know the history size for its FIFO cap. A component-slot doesn't address that — Bayaan's store would still need to expose `getRecentPages()` to the slot's consumer regardless. So we end up changing the store anyway; might as well make the size a real config and keep both files upstream-shared.
- Numeric config is the smallest and most-targeted seam that solves the divergence.

### Alt 2 — Boolean toggle: `branding.continueReadingMultiPage?: boolean`

Same idea but a binary on/off, where "on" means "show 5".

**Rejected** because:
- Hardcodes `5` as the upstream-blessed list size, which is then ambiguous — is `5` a Bayaan-canonical number? A Qariah-specific number? What if the next fork wants `3`?
- Numeric is barely more complex on the consumer side and avoids the magic-constant problem.

### Alt 3 — Per-fork hardcode

Forks continue to fork `MushafSessionStore` + `ContinueReadingHero` and accept ongoing merge conflicts.

**Rejected** because:
- This is the status quo Qariah is paying. Merge cost is small but real (each Bayaan touch to either file requires manual conflict resolution).
- The proposed seam is small (~80 lines of straightforward code) and unblocks not just Qariah but any future fork interested in multi-position history.

## Consequences

**For Bayaan:** No behavior change. The numeric config defaults to `1`; existing branding.js entries don't need updating. Migration of MMKV is a one-time read-and-rewrite that happens transparently the first time any code calls `getRecentPages()` or `getLastReadPage()` after the upgrade — legacy users see no data loss.

**For forks:** Set `branding.continueReadingHistorySize = N` (e.g. `5`) and the carousel appears with no further code changes. Qariah ships at `5`.

**For testing:** The MMKV migration path warrants a unit test (legacy value present → first read produces a one-entry array with the legacy page). The FIFO dedupe-and-promote logic warrants a unit test (insert page A, B, A → list is `[A, B]`, not `[A, B, A]`). Both are pure functions on the store.

## Open questions

1. **Clamping behavior.** RFC proposes clamping out-of-range values (`< 1` or `> 10`) at read time with a `console.warn`. Should this be stricter (throw in dev, warn in prod) per Bayaan's existing config-validation patterns? Pinging the maintainer for direction.

2. **Persisted-entry shape.** This RFC proposes `{page, openedAt}` per entry — `openedAt` enables the "3h ago" / "yesterday" / "2 days ago" labels that motivated the change. Bayaan doesn't currently track per-page timestamps. The migration from legacy `lastReadPage: number` seeds `openedAt: Date.now()` on first read, which is harmless but inaccurate for the legacy entry. Acceptable?

## References

- RFC-007 — `Branding` interface (the multi-tenancy series root)
- RFC-008 — `branding.listenTabTopComponent` (precedent for doc-only-first PR shape)
- RFC-010 — `branding.catalogVersionEndpoint` (precedent for "small numeric/url config" shape)
- Qariah-side implementation (already in the fork at `sprint-18-qariah-notes-and-recent-reading` branch): `services/mushaf/MushafSessionStore.ts` widened, `components/hero/RecentReadingCarousel.tsx` net-new, `components/hero/ContinueReadingHero.tsx` conditionally delegates to the carousel. Net diff ~190 lines including the new carousel component.
