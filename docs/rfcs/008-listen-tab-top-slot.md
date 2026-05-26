# RFC-008: Listen-tab top-region component slot

| Field  | Value      |
| ------ | ---------- |
| Status | Proposed   |
| Date   | 2026-05-15 |
| Author | Omar Zarka (Qariah fork) |

## Summary

Add an opt-in config slot to `Branding` that lets forks replace the Listen tab's top region (currently the hardcoded `<RecitersHero />` in `components/RecitersView.tsx`) with a fork-provided React component. Bayaan's behavior is unchanged when the slot is empty.

This RFC is the second in the XF-NNN multi-tenancy series, following RFC-007 (the `Branding` interface itself) and PR #260 (`branding.homeRowConfig` for the row order below the hero). It targets the only remaining merge-conflict-prone hardcoded JSX in `RecitersView.tsx` after #260 lands.

## Motivation

`components/RecitersView.tsx` currently renders the top region as a fixed `<RecitersHero />` element at the start of the ScrollView (`RecitersView.tsx:545` on `develop`). Forks that ship a different top region — Qariah ships a 3-tile grid (`ListenTabTopGrid`) with stacked Reciter + Surah pills on the left and a tall Shuffle pill on the right — have no extension seam, so they fork the `<RecitersHero />` line directly.

This is the same divergence shape that PR #260 (`branding.homeRowConfig`) just resolved for the rows beneath the hero. The single remaining hardcoded JSX line in this file is the hero render.

Concrete cost today: every Bayaan change to `RecitersHero` (which has been touched 3× in the last 6 sprints — sprints 7, 10, 13 of Qariah's tracking) creates a merge conflict at this exact line for Qariah's `qariah-main` branch even though Qariah doesn't use `RecitersHero` at all.

Real cite of Qariah's current divergence: see `components/RecitersView.tsx:687-698` in the Qariah fork — a flag-gated branch that swaps `<RecitersHero />` for `<ListenTabTopGrid />`. The flag plus the JSX swap is the entire workaround.

## Decision

Add an optional component-slot field to `Branding`:

```typescript
// config/branding.d.ts
import type {ComponentType} from 'react';

export interface ListenTabTopComponentProps {
  // Reserved for future props. The slot starts with no required props so
  // forks can ship a plain `() => JSX.Element`. Future additions (e.g.
  // theming context, navigation hooks) must default to optional so existing
  // implementations don't break.
}

export interface Branding {
  // …existing fields…

  /**
   * Optional component that replaces the Listen-tab top region (the
   * default `RecitersHero`). Forks return a React component; `undefined`
   * keeps Bayaan's `RecitersHero` rendering verbatim.
   *
   * The component renders directly inside the ScrollView at the top,
   * above the rows controlled by `homeRowConfig`. It receives no required
   * props today; the type is a slot for future extension.
   */
  listenTabTopComponent?: ComponentType<ListenTabTopComponentProps>;
}
```

Render-site change in `components/RecitersView.tsx`:

```tsx
// Before
<RecitersHero />

// After
{branding.listenTabTopComponent
  ? <branding.listenTabTopComponent />
  : <RecitersHero />}
```

Total Bayaan-side diff: ~10 lines (5 in branding.d.ts, 2 in branding.js for the field declaration, 3 in RecitersView.tsx for the conditional render).

## Alternatives considered

### Alt 1 — Declarative tile schema: `branding.listenTabTopTiles: TopTileConfig[]`

Define a structured schema (`{type: 'reciter-pill' | 'surah-pill' | 'shuffle-pill', position: …}`) and have RecitersView render from the array.

**Rejected** because:
- Constrains the design space to whatever tile types Bayaan thinks to enumerate today. Qariah's current grid is 3 tiles; the next fork might want 4 with a different layout; the one after that might want a horizontal swipe carousel. Each new shape requires a Bayaan-side schema update and propagation to all callers.
- The render layer ends up as a giant switch-statement, which is exactly the kind of "registry that knows about every consumer" anti-pattern multi-tenancy is supposed to retire.
- The whole point of the seam is that forks design their own top region.

### Alt 2 — String enum: `branding.listenTabTopMode: 'browse-all-hero' | 'tile-grid' | 'custom'`

Pick from a finite set of known top-region shapes; Bayaan-side code knows how to render each named mode.

**Rejected** because:
- Pushes fork-specific layouts into Bayaan's source tree. Bayaan would either (a) carry Qariah's `ListenTabTopGrid` code permanently or (b) leave the enum value `'tile-grid'` as a no-op outside Qariah. Both options conflate fork code with main-branch code.
- Doesn't actually solve the divergence — Qariah's `ListenTabTopGrid` lives in the Qariah tree regardless, and the only thing exported across the seam is a string. The component still has to be wired up downstream.
- Discoverability is worse: you have to read the enum + the consumer code to know what each mode does, vs. reading the fork's branding.js entry which IS the component.

### Alt 3 — Component slot (RECOMMENDED — this RFC)

Forks pass a React component reference through `Branding`. Bayaan renders `<branding.listenTabTopComponent />` if set, otherwise `<RecitersHero />`.

**Why this won:**
- Smallest possible Bayaan-side change (one conditional).
- Zero opinion on what the top region looks like. Forks own their layout entirely.
- Type-safe: the component type lives in the same `branding.d.ts` that defines all the other fork-extension points.
- No registry: Bayaan doesn't need to know about Qariah's component at all.

### Alt 4 — Status quo (no RFC, keep forking the line)

**Rejected** because:
- The hardcoded `<RecitersHero />` line is the last remaining merge-conflict-prone shared file in `RecitersView.tsx` after PR #260. Closing this seam eliminates the divergence entirely.
- Future forks hit the same problem; the cost is shared.

## Consequences

### Positive
- Forks that want a different top region declare it in `branding.js` instead of forking `RecitersView.tsx`. Zero Bayaan-source diff at the per-fork level.
- The seam is opt-in; existing callers (Bayaan included) are unaffected.
- Composes cleanly with `homeRowConfig` (PR #260): hero is fully fork-owned, row order is fork-config-driven, leaving `RecitersView.tsx` itself as Bayaan-managed shell.

### Neutral
- Adds one field to `Branding`. The type addition is ~5 lines.
- Render-site change is ~3 lines.

### Negative / risks
- **Component-as-config is an unusual pattern for a Branding interface.** Most config fields are scalars or arrays. The reviewer should weigh whether passing a `ComponentType` through `Branding` is too much "live code" in a config layer. Counter-argument: the alternative is forks editing `RecitersView.tsx` directly, which is strictly worse for merge-conflict cost.
- **Future props need careful design.** The `ListenTabTopComponentProps` interface starts empty; any field added later must default to optional or the seam breaks for existing implementations.
- **Bayaan won't catch fork-side render bugs.** If Qariah's `ListenTabTopGrid` crashes, Bayaan's CI can't see it. Mitigation: ErrorBoundary around the slot at the render site (additive; not in the initial PR).

## How we'll know it worked

- Qariah's `qariah-main` branch removes its `<RecitersHero />` swap from `components/RecitersView.tsx` (currently lines 687–698 of the Qariah fork) and instead sets `listenTabTopComponent: ListenTabTopGrid` in its `config/branding.js`.
- After Qariah adopts, the diff between Qariah's `components/RecitersView.tsx` and `upstream/develop`'s for this file drops from ~620 lines to ~10 lines (the title-string override for the 'rewayat' row that the upstream PR #260 introduces).
- A future Bayaan fork (hypothetical) can add a different top region in its own branding.js without modifying `RecitersView.tsx` at all.

## Open questions

1. **Should the slot receive props?** Today no — the component is self-contained. If future Bayaan adds (e.g.) a "scroll-up-pull-to-refresh" affordance that wraps the top region, the slot might need an `onRefresh` callback. Defer until a concrete consumer needs it; the empty `ListenTabTopComponentProps` interface reserves the namespace.

2. **ErrorBoundary at the slot?** Probably yes eventually, but not in the initial PR. Bayaan's existing top-level boundary already catches render crashes; per-slot boundaries are a polish layer.

3. **Should this RFC also cover the bottom of the ScrollView (e.g. a `branding.listenTabBottomComponent` for footers)?** No. Add only when a fork actually needs it. Single-purpose RFCs merge faster.

## Implementation plan

This is a doc-only PR. If accepted:

1. **Code PR #1 (Bayaan side):** add the field to `branding.d.ts` + `branding.js` + conditional in `RecitersView.tsx`. ~30 lines. Default Bayaan branding leaves the field undefined; behavior unchanged.

2. **Code PR #2 (Qariah-side, in qariah-v2 repo):** sets `listenTabTopComponent: ListenTabTopGrid` in `config/branding.js`; removes the inline JSX swap from `components/RecitersView.tsx`. Qariah's divergence ledger row for this file updates from "Local" to "Upstreamed".

If alternatives 1 or 2 are preferred by the maintainer, this RFC is withdrawn and we'll open a new RFC with the alternative shape.
