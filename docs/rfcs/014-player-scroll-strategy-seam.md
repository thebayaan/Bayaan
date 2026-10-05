# RFC-014: Player scroll-handler seam (`branding.playerMushafScrollBehavior`)

**Status:** Approved (RFC doc-PR `thebayaan/Bayaan#279` approved 2026-05-24 by @osmansaeday).
Shape and naming locked. This update folds in maintainer feedback and ships alongside the
implementation PR.
**Authors:** Omar Zarka (Qariah)
**Targets:** `thebayaan/Bayaan` `develop`
**Related:** RFC-013 (`thebayaan/Bayaan#269`, merged 2026-05-23 — `branding.initialPlayerVerseKey`)

---

## Summary

Add an optional `branding.playerMushafScrollBehavior?: 'gorhom' | 'native'` field. When absent
from `config/branding.js`, the consumer (`QuranView`) defaults to `'gorhom'` via `??`, preserving
Bayaan's current behavior byte-equivalent. When a fork sets it to `'native'`, `QuranView` skips
`useBottomSheetScrollableCreator()` and passes no `renderScrollComponent` to `FlashList`. The
swipe-down-to-close gesture on the player sheet is thereby opt-out; forks that need reliable
imperative `scrollToIndex` calls (range-anchored seeks, bookmark deeplinks, future word-by-word
follow-along) can trade the gesture for scroll correctness.

A string union (rather than a boolean) leaves room for future strategies — e.g. a third value
when RN Gesture Handler v3's scroll-coupling pattern lands, or a Skia-v2 gesture integration —
without a breaking-change field rename. The naming aligns with the noun-phrase convention of
every prior `Branding` field (`homeRowConfig`, `catalogVersionEndpoint`, `listenTabTopComponent`,
`searchFilters`, `initialPlayerVerseKey`, `translationProvider`, `tafsirProvider`).

---

## Motivation

### The cross-fork problem

`QuranView/index.tsx` calls `useBottomSheetScrollableCreator()` from `@gorhom/bottom-sheet` and
passes the resulting factory as `renderScrollComponent` on `FlashList`. This wires the Mushaf
list's scroll gesture into the sheet's pan gesture recognizer so the user can swipe down anywhere
on the Mushaf to dismiss the player — a natural and desirable UX for Bayaan.

The gorhom integration has a well-known side effect: **it intercepts imperative scroll calls
(FlashList `ref.current.scrollToIndex(…)` / `scrollToOffset(…)`) whenever the sheet's internal
state machine has not yet settled into `EXTENDED` or `FILL_PARENT`**. During that transition
window — which spans the full open animation on every player launch, and re-occurs on every sheet
snap point change — any imperative scroll is silently no-oped. The list stays at its current
position; no error is thrown, no callback fires.

For Bayaan, which always starts playback from surah position 0 (ayah 1), the sheet transition
window is irrelevant: the imperative `scrollToOffset({offset: 0})` in the surah-change effect
lands at the same position the FlashList would already occupy, so the no-op is invisible.

### Why Qariah hit it

RFC-013 (`thebayaan/Bayaan#269`, merged 2026-05-23) added `branding.initialPlayerVerseKey(track)`
so forks can anchor the Mushaf view on a specific ayah when a track starts playing. Qariah uses
this to support partial-recitation tracks — a track might cover only ayahs 79–86 of Al-Baqarah.
The anchor sequence is:

1. `initialScrollIndex` on `FlashList` → handles the cold-mount case (layout pass).
2. A 2-rAF deferred `scrollToIndex({index: partialStartIndex, animated: false, viewPosition:
   0.05, viewOffset: -headerHeightRef.current})` in the surah-change `useEffect` → handles
   in-app surah switches where `FlashList` stays mounted across re-renders.

In Debug builds (Metro startup latency, slower JS thread), the deferred call fires well after the
sheet has settled → it works. In **iOS Release** builds (fast boot, the user taps "Continue
Listening" before the catalog has fully populated, or switches surahs in rapid succession), the
2-rAF window lands inside the sheet's open animation. The gorhom wrapper intercepts the call, the
list stays at ayah 1, and the track plays audio from ayah 79 while the Mushaf displays ayah 1.

This is the canonical failure mode of combining an imperative-scroll pattern with gorhom's
scrollable integration: the bug is **not detectable in Debug / simulator** and manifests
exclusively in Release on fast hardware.

### Imperative scroll call sites inside `QuranView` (the seam covers all four)

The interception race affects every imperative scroll the component issues. Today there are four
distinct call sites; the seam applies uniformly to all of them (i.e. when set to `'native'`, none
go through the gorhom wrapper).

1. **`initialScrollIndex` (mount layout pass).** Cold-mount jump into the RFC-013 anchor when the
   player opens for the first time on a given surah.
2. **2-rAF deferred `scrollToIndex` (surah-change effect).** In-app surah switches where
   `FlashList` stays mounted across re-renders; this is the call Sprint-23 / 24 documented as the
   Qariah-side trigger.
3. **`scrollToOffset({offset: 0})` fallback.** Non-anchored tracks (`initialPlayerVerseKey`
   returns `undefined`) scroll the list to the top on surah change.
4. **Active-ayah auto-scroll (`useEffect` on `currentVerseKey` while `isLocked === true`).**
   Fires continuously during playback, including immediately on player open when `isLocked`
   starts `true`. This call is arguably **the highest-impact one for default Bayaan**: if the
   player opens while the sheet is still mid-animation, the first auto-scroll lands at ayah 1
   and stays there until the next `currentVerseKey` tick fires after the sheet settles. The
   visible symptom on default Bayaan is "the verse-highlight ribbon doesn't follow audio for the
   first few ayahs after a cold player open"; on Qariah's partial-recitation tracks the same
   race additionally combines with site (1)/(2) above.

The flag's contract — "no gorhom wrapper when set to `'native'`" — covers all four uniformly. No
per-call-site opt-out is exposed; a fork choosing `'native'` is opting out of the sheet's
swipe-to-dismiss everywhere, in exchange for guaranteed delivery of every imperative scroll.

### Qariah's workaround (Qariah commit `5331148`, 2026-05-24)

1. Drop `useBottomSheetScrollableCreator()` entirely — do not call the hook, do not pass
   `renderScrollComponent` to `FlashList`.
2. Retain `key={currentSurah}` on `FlashList` (remounts on surah change; ensures clean layout
   state before the deferred scroll fires).

The swipe-down-to-close gesture is gone. The sheet is still dismissable via the (×) button in the
player header. The comment at `QuranView/index.tsx` lines 20–28 documents the reasoning:

```
// Note: not wiring `useBottomSheetScrollableCreator()` here. The gorhom
// wrapper intercepts imperative `scrollToIndex` calls when the sheet
// state machine hasn't transitioned to EXTENDED/FILL_PARENT, which on
// iOS Release causes partial-recitation seeks to silently no-op (track
// lands at ayah 1 instead of the partial range start). The sheet is
// already dismissable via the (x) button in the player header, so the
// pan-down-to-close gesture is not required.
```

This workaround is a local Qariah divergence — no seam in the shared codebase lets Bayaan
preserve its gesture while Qariah opts out. This RFC proposes that seam.

### Why Bayaan should care beyond Qariah

Any future imperative scroll into `QuranView` faces the same race. Concrete candidates already in
the Bayaan roadmap or community wishlist:

- **Bookmark deeplinks** — tapping a shared verse link opens the player and jumps to that ayah.
- **Word-by-word follow-along auto-scroll** — the active word scrolls into the center of the
  viewport as audio progresses; must fire continuously, including during the player's open
  animation on first launch.
- **Surah-change verse retention** — if/when the player remembers the last-read ayah per surah
  and restores it on re-open.

All three will silently fail on iOS Release whenever they fire during the open-transition window,
for exactly the same reason Qariah's partial-recitation seek fails. The fix, without a seam, is
a fork-local divergence every time.

---

## Today's behavior in Bayaan upstream

In `components/player/v2/PlayerContent/QuranView/index.tsx`, the relevant lines are:

```tsx
// (inside QuranView function body)
const renderScrollComponent = useBottomSheetScrollableCreator();

// ...

<FlashList
  ref={listRef}
  renderScrollComponent={renderScrollComponent}
  // ... other props
/>
```

`useBottomSheetScrollableCreator()` returns a factory function that gorhom uses to wrap every
inner scroll view rendered by `FlashList`. The wrapper registers the scroll gesture with the
sheet's pan responder. While the sheet is animating (any state other than `EXTENDED` /
`FILL_PARENT`), gorhom holds the scroll gesture and parks imperative calls — the underlying
`ScrollView`/`FlashList` native scroll node is not reachable until the animation completes.

On iOS this is a hard timing dependency: the sheet open animation takes 300–450 ms in Release
(spring physics, no `skipTo` override), and the 2-rAF deferred imperative scroll (RFC-013's
anchor mechanism) fires in approximately 32 ms. The call always lands inside the transition
window.

---

## Proposed change (locked, post-review)

### `config/branding.d.ts` addition

```typescript
export interface Branding {
  // ... existing fields ...

  /**
   * Strategy for wiring the player Mushaf FlashList (`QuranView`)'s scroll
   * handling.
   *
   * `'gorhom'` — `useBottomSheetScrollableCreator()` is called and its result
   *   is passed as `renderScrollComponent` on FlashList. The
   *   swipe-down-to-dismiss gesture on the player sheet is active. Imperative
   *   `scrollToIndex` / `scrollToOffset` calls issued before the sheet's
   *   animation has settled into EXTENDED/FILL_PARENT are intercepted by the
   *   gorhom wrapper and silently no-op.
   *
   * `'native'` — gorhom wrapper skipped; imperative scroll calls reach the
   *   native scroll node immediately, regardless of the sheet's animation
   *   state. The sheet's swipe-down-to-dismiss gesture stops working at the
   *   Mushaf list level — forks opting in must provide an alternative
   *   dismiss affordance (e.g. an explicit close button in the player
   *   header).
   *
   * Field absent from `config/branding.js` → consumer applies `?? 'gorhom'`
   * at the call site, byte-equivalent to today's behavior.
   *
   * Applies identically on iOS and Android — forks don't need
   * platform-conditional branding.
   */
  playerMushafScrollBehavior?: 'gorhom' | 'native';
}
```

The string union is forward-compatible: a future strategy (e.g. `'gesture-handler-v3'` for RNGH
v3's scroll-coupling pattern, or `'skia-gesture'` for a Skia-v2 integration) is an additive
change with no breaking-change field rename.

### `config/branding.js` (Bayaan default)

Field omitted. The `?? 'gorhom'` fallback at the call site preserves Bayaan's behavior verbatim.
Zero diff to `config/branding.js` in the Bayaan distribution.

### `QuranView/index.tsx` change (the only code diff)

```diff
+import branding from '@/config/branding';
+
 export const QuranView: React.FC<QuranViewProps> = ({...}) => {
   // ...
-  const renderScrollComponent = useBottomSheetScrollableCreator();
+  const scrollBehavior = branding.playerMushafScrollBehavior ?? 'gorhom';
+  // Hook call is unconditional (rules-of-hooks); the resulting factory is
+  // only attached as renderScrollComponent when scrollBehavior === 'gorhom'.
+  // When 'native', the factory is discarded and FlashList renders with its
+  // default ScrollView wrapper — imperative scroll calls reach the native
+  // scroll node directly.
+  const gorhomScrollComponent = useBottomSheetScrollableCreator();
+  const renderScrollComponent =
+    scrollBehavior === 'gorhom' ? gorhomScrollComponent : undefined;

   // ...
   return (
     <View style={styles.container}>
       <FlashList
         ref={listRef}
-        renderScrollComponent={renderScrollComponent}
+        {...(renderScrollComponent ? {renderScrollComponent} : {})}
         // ... unchanged props
       />
     </View>
   );
 };
```

Total upstream diff: ~10 lines across 2 files (branding type + `QuranView`). No new files.

### Optional dev-mode warning for forks opting into `'native'`

To surface the "must provide an alternative dismiss affordance" requirement at dev time (it has
no enforcement mechanism at the type level), the consumer includes a `__DEV__`-only one-shot
warning:

```ts
if (__DEV__ && scrollBehavior === 'native') {
  // Module-scope guard so it fires once per JS context, not per render.
  warnOncePlayerScrollBehaviorNative();
}
```

The warning text points to this RFC and to the "Forks opting into `'native'`" migration note
below. Stripped from Release builds by Metro's `__DEV__` dead-code elimination. Resolves
RFC-draft Open Question 2 (do we add a warning?) as a small dev-only nudge rather than the
intrusive timing-instrumentation originally floated.

---

## Migration / default behavior

**Bayaan:** no change. Field absent from `config/branding.js` → `?? 'gorhom'` in `QuranView` →
`useBottomSheetScrollableCreator()` called → `renderScrollComponent` passed → behavior
byte-equivalent to today. Zero action required.

**Forks opting into `'native'`:** the swipe-down-to-close gesture on the player sheet stops
working at the Mushaf list level. The sheet itself is not removed — the (×) close button in the
player header, or any other dismiss trigger the fork provides, still works. Forks must audit
their player dismiss UX before shipping this setting. The dev-mode warning above is the only
in-product nudge; the contract beyond that lives in this RFC.

**Forks that don't set the field:** same as Bayaan. The default is explicit (`?? 'gorhom'`) and
documented so there is no silent behavior change on upstream merge.

**Platform parity:** the field is single-valued across iOS and Android. A fork that wants
gorhom on Android but native on iOS would need to either (a) extend the type to a per-platform
shape in a follow-up RFC, or (b) read `Platform.OS` inside its own `config/branding.js` and emit
the right value at module load. Neither is being proposed in this RFC.

---

## Alternatives considered

### Boolean field (`useBottomSheetScrollableInQuranView: boolean`)

The original RFC draft (the one approved at PR #279) used a boolean. Maintainer feedback during
review preferred the string union for two reasons: (a) every other `Branding` field uses a
noun-phrase name, and a boolean named after a verb (`useBottomSheet…`) reads like a hook; (b)
a boolean closes the door on a future third strategy without a breaking-change rename. The
string union resolves both. Documented here so future RFC authors see the convention.

### Component-factory slot (`playerListScrollComponentFactory`)

Expose the scroll wrapper as a fork-supplied factory. More flexible — a fork could swap in a
completely different gesture library — but exposes the `renderScrollComponent` prop shape to
fork authors, requires a `null` convention for "no wrapper", and is overkill for the two
strategies that actually exist. The string union covers today's two strategies and accepts
additional values additively.

### Hook-level auto-detection (no flag)

`QuranView` could observe whether `branding.initialPlayerVerseKey` is configured and bypass the
gorhom wrapper for that render cycle. Rejected: couples the gorhom-bypass decision to RFC-013
semantics, which is an accident. Future imperative-scroll callers (bookmark deeplinks,
follow-along) would have to misuse `initialPlayerVerseKey` to opt in, or the detection logic
grows more heuristics. The flag is explicit documentation of a fork-level architectural choice.

### Patch gorhom upstream to forward imperative scrolls unconditionally

gorhom deliberately parks scroll calls during sheet animation to avoid conflict between the
sheet's pan responder and an in-progress scroll momentum. Removing that behavior upstream would
affect every gorhom user, not just Bayaan forks, and could introduce physics artifacts in the
sheet close animation on content that is scrolled mid-dismiss. Not our call to upstream-patch a
third-party library for a fork-specific edge case.

### Await the sheet's `EXTENDED` state before firing the deferred scroll

Read gorhom's `animatedIndex` shared value; only call `scrollToIndex` once it equals the
EXTENDED snap value. This works around the race without any branding seam. Drawbacks: requires
importing gorhom internals inside `QuranView` (couples the component to sheet implementation
details), the `animatedIndex` threshold for "settled enough to accept scroll" is not part of
gorhom's public contract and has shifted across minor versions, and it adds async complexity
(another `useEffect` with an Animated listener) to a component already managing several effects.
The flag approach is O(1) and version-stable.

### `key={currentSurah}` alone (remount on surah change)

Remounting `FlashList` resets layout state, which prevents a stale-list scroll race — but
`initialScrollIndex` (set during the mount layout pass) also fires inside the sheet's transition
window when the player opens for the first time on a given surah. The no-op race is orthogonal to
whether the list was remounted. `key={currentSurah}` is a useful companion fix (it is retained in
Qariah's workaround) but does not address the gorhom interception by itself.

### Forks shadow `QuranView` entirely

Each fork that needs reliable imperative scroll copies `QuranView/index.tsx` and omits the
gorhom line. This defeats the multi-tenant model the cross-fork seam work has been building
toward (RFC-007, RFC-010, RFC-011, RFC-013). Every upstream change to `QuranView` would need
manual porting into each fork's shadow copy — for what is a single conditional hook call.

---

## Open questions (resolved)

The three open questions from the original RFC draft are all resolved as of this revision:

1. **FlashList prop shape (absent vs `undefined`).** Resolved as **spread to absent** — the
   conditional spread `{...(renderScrollComponent ? {renderScrollComponent} : {})}` keeps prop
   parity with Bayaan's no-fork render path. FlashList accepts both forms, but absent is the
   closer-to-no-op shape.
2. **Dev-mode warning.** Resolved as **include a small one-shot `__DEV__` warning** when a fork
   sets `'native'`. Surfaces the "alternative dismiss affordance" responsibility at dev time.
   Module-scope guarded so it fires once per JS context. Stripped from Release. The originally
   floated timing-instrumentation approach (warn when a scroll fires within N ms of sheet state
   change) is rejected as too intrusive for the value it provides.
3. **Naming.** Resolved as `playerMushafScrollBehavior: 'gorhom' | 'native'`. See the post-review
   summary at the top of this RFC for the rationale.

---

## Out of scope

- **A second branding field for per-call-site opt-in.** All four imperative scroll sites listed
  in "Motivation > Imperative scroll call sites" are covered uniformly by the same flag value.
  A fork choosing `'native'` opts out of the gorhom wrapper for all four. If a future use case
  needs per-site granularity, that's a follow-up RFC.
- **Any change to `branding.initialPlayerVerseKey`.** That is RFC-013, already merged. This RFC
  only addresses the scroll-integration plumbing that RFC-013 exposes as a race condition.
- **Changes to the player sheet's snap behavior or animation timing.** The race window is a
  consequence of gorhom's gesture integration, not the sheet configuration.
- **Per-platform default.** The flag applies identically on iOS and Android. The race on Android
  is narrower in practice (the Choreographer schedules the rAF callback after the first Vsync
  following layout commit, which on typical Release timing lands after the sheet's initial
  EXTENDED transition) and Qariah has not observed it. A fork that wants different defaults per
  platform reads `Platform.OS` in its own `config/branding.js`.

---

## Cross-references

- RFC-013 — `branding.initialPlayerVerseKey` (`thebayaan/Bayaan#269`, merged 2026-05-23). This
  RFC formalizes the scroll seam that RFC-013's anchor mechanism requires.
- Qariah Sprint 23 working fix — commit `6f64a6f8535b33abc080a38942e163ff225059ac` (original
  out-of-band patch, dropped `useBottomSheetScrollableCreator` as an ad-hoc divergence).
- Qariah Sprint 24 restore — commit `5331148` (today, 2026-05-24; re-applied the workaround on
  the Sprint 24 branch; comment added at `QuranView/index.tsx:20–28`).
- Sprint 15 standing rule: "Unusual structural patterns → doc-only RFC PR first; code PR follows
  once shape clears."

---

## Reference implementation

Qariah's adoption ships in the same sprint as this RFC, against the same shape. Specifically:

- `config/branding.js` declares `playerMushafScrollBehavior: 'native'`.
- `config/branding.d.ts` adds the typed field on `QariahBranding` (will lift to upstream
  `Branding` once this RFC's code PR merges).
- `components/player/v2/PlayerContent/QuranView/index.tsx` consumes the seam with the `??
  'gorhom'` fallback inline, plus the dev-mode warning.
- The Qariah-side `key={currentSurah}` divergence on `FlashList` remains in place — it's a
  companion fix from the same Sprint 23 work and is orthogonal to the gorhom interception (it
  prevents stale-list scroll races on rapid surah switching, not the imperative-scroll race).
  Not part of this RFC.
