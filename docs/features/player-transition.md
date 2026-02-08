# Player Transition: Unified Bottom Sheet Architecture

> **Status:** Planned
> **Branch:** TBD (off `develop`)
> **Dependencies:** expo-audio migration (Phase 1 complete on `feature/audio-integration`)

## Overview

Merge the separate `FloatingPlayer` (mini) and `PlayerSheet` (full) into a **single always-visible `@gorhom/bottom-sheet`** with two snap points. The transition between mini and full states is driven by continuous interpolation of the sheet's `animatedIndex`, producing a smooth morph effect (cross-fading content, scaling artwork, animating border radius and margins).

### Current Architecture

```
┌─────────────────────────────┐
│  _layout.tsx                │
│  ├── <FloatingPlayer />     │  ← Separate Animated.View, absolute positioned
│  └── <PlayerSheet />        │  ← gorhom BottomSheet, snap ['100%'], close to hide
└─────────────────────────────┘
```

- **FloatingPlayer** (`components/player/v2/FloatingPlayer/index.tsx`): Standalone `Animated.View` with spring show/hide. Contains play button, track info, heart icon, surah glyph. On press → `setSheetMode('full')`.
- **PlayerSheet** (`components/player/v2/PlayerSheet.tsx`): `@gorhom/bottom-sheet` with single snap point `['100%']`. Opens/closes via `sheetMode` Zustand state (`'hidden' | 'full'`). Contains `PlayerContent` with scrollable surah view, controls, etc.
- **Transition:** Instant — FloatingPlayer hides, sheet slides up. No morph animation.

### Target Architecture

```
┌─────────────────────────────┐
│  _layout.tsx                │
│  └── <PlayerSheet />        │  ← Single gorhom BottomSheet
│       snapPoints: [MINI, MINI, '100%']
│       ├── <MiniPlayerContent />   (opacity: 1→0 as index 1→2)
│       └── <PlayerContent />       (opacity: 0→1 as index 1→2)
└─────────────────────────────┘
```

- **One component** handles both states
- **Continuous animation** driven by `animatedIndex` shared value
- **Cross-fade** between mini and full content layers
- **Morphing shell** that interpolates height, margins, border radius, background color

---

## Technical Design

### Snap Points Strategy

```tsx
const snapPoints = [MINI_SNAP, MINI_SNAP, '100%'];
//                   index 0    index 1    index 2
```

**Why duplicate the mini snap?** The `@gorhom/bottom-sheet` library allows `enablePanDownToClose` to dismiss the sheet below the lowest snap point. By duplicating the mini snap at indices 0 and 1, we prevent the sheet from being dragged below the mini height while keeping the standard index-based API. The sheet "rests" at index 1 (mini) and can be expanded to index 2 (full). Index -1 is used when no track is playing (fully hidden).

**MINI_SNAP calculation:**
```tsx
const MINI_SNAP = FLOATING_PLAYER_HEIGHT + getFloatingPlayerBottomPosition(insets.bottom);
// ≈ 65px (player) + tabBar + inset + margin
```

This positions the mini player content directly above the tab bar, matching the current FloatingPlayer position.

### Animation Model

All animations are driven by a single shared value: `animatedIndex` (provided by gorhom's `animatedIndex` prop). This value changes continuously as the user drags or the sheet animates between snap points.

#### Continuous Interpolations (every frame via `useAnimatedStyle`)

| Property | Index 1 (mini) | Index 2 (full) | Notes |
|---|---|---|---|
| Shell height | `MINI_HEIGHT` (~65px) | `screenHeight` | The visual container |
| Shell marginHorizontal | `10` | `0` | Inset card → edge-to-edge |
| Shell borderRadius | `12` | `0` | Rounded card → square |
| Shell backgroundColor | `theme.colors.card` | `theme.colors.background` | Card bg → screen bg |
| Mini content opacity | `1` | `0` | Fades out by index ~1.3 |
| Full content opacity | `0` | `1` | Fades in from index ~1.3 |
| Backdrop opacity | `0` | `0.5` | Semi-transparent overlay |

#### Spring Animations (one-shot via `onAnimate`)

The `onAnimate` callback fires when a transition begins (user swipe or programmatic snap). It triggers:

- **Artwork position:** Spring from top-left corner (mini) to centered (full) or vice versa
- **Content cross-fade:** `withTiming` (100-150ms) for the opacity switch

**Recommended spring config (from reference, heavily damped):**
```tsx
{damping: 500, stiffness: 1000, mass: 3, overshootClamping: true}
```

This produces a smooth, non-bouncy transition. Should be tested against gorhom's default spring and adjusted for feel.

### Component Structure

```tsx
// PlayerSheet.tsx (simplified)
<BottomSheet
  snapPoints={[MINI_SNAP, MINI_SNAP, '100%']}
  animatedIndex={bottomSheetIndex}
  enablePanDownToClose={false}
  animateOnMount={false}
  detached={true}
  onAnimate={handleTransition}
  enableContentPanningGesture={isExpanded}
>
  {/* Morphing shell — interpolates size, radius, color */}
  <Animated.View style={shellAnimatedStyle}>

    {/* Full player content — fades in during expansion */}
    <Animated.View style={fullContentStyle}>
      <PlayerContent ... />
    </Animated.View>

    {/* Mini player content — fades out during expansion */}
    <Pressable onPress={expand}>
      <Animated.View style={miniContentStyle}>
        <MiniPlayerContent />
      </Animated.View>
    </Pressable>

  </Animated.View>
</BottomSheet>

{/* Backdrop — semi-transparent, fades in during expansion */}
<Animated.View style={backdropStyle} />
```

### State Management

The `sheetMode` Zustand state gains a new value:

```typescript
// services/player/types/state.ts
export interface UIState {
  sheetMode: 'hidden' | 'mini' | 'full';  // 'mini' is new
  // isTransitioning removed — no longer needed
}
```

**State transitions:**
| Trigger | From | To | Sheet Action |
|---|---|---|---|
| Track starts playing | `hidden` | `mini` | Snap to index 1 |
| Tap mini player | `mini` | `full` | Snap to index 2 |
| Swipe up on mini | `mini` | `full` | Snap to index 2 |
| Tap close button | `full` | `mini` | Snap to index 1 |
| Swipe down (scroll at top) | `full` | `mini` | Snap to index 1 |
| Android back button | `full` | `mini` | Snap to index 1 |
| Track ends / queue empty | `mini`/`full` | `hidden` | Snap to index -1 |
| Navigate to reciter | `full` | `mini` | Snap to index 1, then navigate |

### Scroll Handling

The full player contains scrollable content (`BottomSheetScrollView` wrapping QuranView, SurahSummary, etc.). gorhom's bottom-sheet handles the gesture conflict natively:

- When scrolled to top: swipe down collapses the sheet
- When scrolled down: swipe down scrolls the content
- `enableContentPanningGesture`: `true` when expanded, `false` when at mini snap (prevents accidental scroll gestures on the mini player)

### Platform Considerations

| Concern | Approach |
|---|---|
| **iOS BlurView** | Keep `@react-native-community/blur` in `MiniPlayerContent` for the mini state glass effect |
| **Android elevation** | Use `elevation` prop (not CSS `boxShadow` — requires RN 0.79+, we're on 0.76.9) |
| **iOS shadow** | Use `shadowColor/Offset/Opacity/Radius` properties |
| **Safe area (top)** | Full player needs `paddingTop: insets.top` for the drag handle and header |
| **Safe area (bottom)** | Mini snap height includes tab bar + bottom inset via `getFloatingPlayerBottomPosition()` |
| **StatusBar** | Light/dark based on theme text color when expanded (existing behavior) |
| **Android back** | `BackHandler` snaps to mini instead of hiding |

---

## Implementation Steps

### Step 1: Create `MiniPlayerContent` component

**New file:** `components/player/v2/MiniPlayerContent.tsx`

Extract the render content from current `FloatingPlayer/index.tsx`:
- BlurView (iOS) / solid card (Android)
- Play button (reuse existing `PlayButton` component)
- Track title + artist
- Heart icon with love toggle
- Surah glyph (or microphone icon for uploads)
- Loading indicator for buffering state

This is a **pure presentational component** — no animation logic, no gesture handling, no positioning. All layout/animation is owned by `PlayerSheet`.

### Step 2: Rewrite `PlayerSheet` with dual-snap architecture

**Modify:** `components/player/v2/PlayerSheet.tsx`

Core changes:
1. Snap points: `[MINI_SNAP, MINI_SNAP, '100%']`
2. Add `animatedIndex` shared value fed by gorhom's `animatedIndex` prop
3. `enablePanDownToClose={false}` — permanent sheet
4. `detached={true}` with transparent background — the inner `Animated.View` IS the visual card
5. `onAnimate` callback triggers spring animations for artwork + cross-fade
6. Render both `MiniPlayerContent` and `PlayerContent` simultaneously
7. Interpolate shell shape (height, margins, radius, bg) from `animatedIndex`
8. Cross-fade mini/full content opacity from `animatedIndex`
9. Add backdrop `Animated.View` behind the sheet that fades in during expansion
10. `enableContentPanningGesture` toggled based on current snap index

Keeps all existing logic:
- Sleep timer
- Action sheet handlers (speed, sleep timer, mushaf layout, summary, options)
- Reciter navigation
- StatusBar management

### Step 3: Modify `PlayerContent` for scroll handling

**Modify:** `components/player/v2/PlayerContent/index.tsx`

Minimal changes — keep `BottomSheetScrollView` as-is. gorhom handles the scroll+gesture conflict natively.

### Step 4: Update Header close button

**Modify:** `components/player/v2/PlayerContent/Header.tsx`

Change close button behavior:
```diff
- setSheetMode('hidden');
+ onClose();  // Callback from PlayerSheet that snaps to mini
```

Add `onClose` prop to `HeaderProps`.

### Step 5: Update `_layout.tsx`

**Modify:** `app/_layout.tsx`

```diff
- <FloatingPlayer />
  <PlayerSheet />
```

Remove `FloatingPlayer` import and component. `PlayerSheet` now handles both states.

### Step 6: Sync with Zustand store

**Modify:** `components/player/v2/PlayerSheet.tsx`

Map `sheetMode` state to snap indices:
- `'hidden'` → index `-1`
- `'mini'` → index `1`
- `'full'` → index `2`

Update `handleSheetChanges` to derive `sheetMode` from index.

### Step 7: Update state types

**Modify:** `services/player/types/state.ts`

```diff
  export interface UIState {
-   sheetMode: 'hidden' | 'full';
+   sheetMode: 'hidden' | 'mini' | 'full';
-   isTransitioning: boolean;
  }
```

**Modify:** `hooks/usePlayerActions.ts` — update `setSheetMode` type signature.

**Modify:** `services/player/store/playerStore.ts` — update store type + initial state.

### Step 8: Update consumers of `setSheetMode`

| File | Current | New | Reason |
|---|---|---|---|
| `PlayerContent/UploadPlaceholder.tsx` | `setSheetMode('hidden')` | `setSheetMode('mini')` | Collapse to mini, don't hide |
| `PlayerContent/TrackInfo.tsx` | `setSheetMode('hidden')` | `setSheetMode('mini')` | Collapse to mini, don't hide |
| `PlayerSheet.tsx` (reciter nav) | `setSheetMode('hidden')` | `setSheetMode('mini')` | Collapse before navigating |

### Step 9: Delete replaced files

- **Delete** `components/player/v2/FloatingPlayer/index.tsx` — logic moved to `MiniPlayerContent` + `PlayerSheet`
- **Keep** `components/player/v2/FloatingPlayer/PlayButton.tsx` — move to `components/player/v2/PlayButton.tsx` or keep in place (imported by `MiniPlayerContent`)

### Step 10: Delete dead code

These files exist but are **never imported** anywhere in the codebase (confirmed via grep). They were replaced by action sheets during a previous refactor:

| File | Reason |
|---|---|
| `components/BottomSheetModal.tsx` | Never imported |
| `components/modals/BaseModal.tsx` | Never imported (only by other dead Modals) |
| `components/player/v2/Modals/PlaybackSpeedModal.tsx` | Replaced by `playback-speed` action sheet |
| `components/player/v2/Modals/PlayerOptionsModal.tsx` | Replaced by `player-options` action sheet |
| `components/player/v2/Modals/SleepTimerModal.tsx` | Replaced by `sleep-timer` action sheet |
| `components/player/v2/Modals/MushafLayoutModal.tsx` | Replaced by `mushaf-layout` action sheet |
| `components/player/v2/SurahSummary/ExtendedSummaryModal.tsx` | Replaced by `extended-summary` action sheet |

---

## Key Files Reference

| File | Action | Role |
|---|---|---|
| `components/player/v2/PlayerSheet.tsx` | **Rewrite** | Main orchestrator — dual snap + interpolations |
| `components/player/v2/MiniPlayerContent.tsx` | **Create** | Extracted mini player presentation |
| `components/player/v2/FloatingPlayer/index.tsx` | **Delete** | Replaced by MiniPlayerContent inside sheet |
| `components/player/v2/FloatingPlayer/PlayButton.tsx` | **Keep/Move** | Reused by MiniPlayerContent |
| `components/player/v2/PlayerContent/index.tsx` | **Minor** | Keep BottomSheetScrollView as-is |
| `components/player/v2/PlayerContent/Header.tsx` | **Minor** | Close snaps to mini instead of hiding |
| `app/_layout.tsx` | **Minor** | Remove FloatingPlayer, keep PlayerSheet |
| `services/player/types/state.ts` | **Minor** | Add `'mini'` to sheetMode, remove `isTransitioning` |
| `hooks/usePlayerActions.ts` | **Minor** | Update setSheetMode type |
| `services/player/store/playerStore.ts` | **Minor** | Update store type + initial state |
| `components/player/v2/PlayerContent/UploadPlaceholder.tsx` | **Minor** | `setSheetMode('mini')` |
| `components/player/v2/PlayerContent/TrackInfo.tsx` | **Minor** | `setSheetMode('mini')` |

---

## Adaptations from Reference

The architecture is inspired by [expo-apple-music-bottom-sheet](https://github.com/nicobrinkkemper/expo-apple-music-bottom-sheet), a simplified Apple Music-style player demo. Key adaptations needed for our codebase:

| Reference Pattern | Our Adaptation |
|---|---|
| Simple static content | Scrollable content (QuranView, SurahSummary) — use gorhom's `BottomSheetScrollView` |
| No tab bar | Mini snap height accounts for tab bar + safe area via `getFloatingPlayerBottomPosition()` |
| CSS `boxShadow` (RN 0.79+) | `elevation` (Android) + `shadowColor/Offset/Opacity/Radius` (iOS) — we're on RN 0.76.9 |
| No backdrop | Semi-transparent `Animated.View` backdrop that fades in during expansion |
| No blur | Keep `@react-native-community/blur` BlurView on iOS mini player |
| No safe area handling | `paddingTop: insets.top` for full player header |
| `{damping: 500, stiffness: 1000, mass: 3}` | Test against gorhom default spring, pick what feels better |
| No state management | Sync with Zustand `sheetMode` store (`'hidden' | 'mini' | 'full'`) |

---

## Verification Checklist

- [ ] **Tap mini player** → full player expands with smooth morph (content cross-fades, shell morphs)
- [ ] **Swipe up on mini player** → follows finger continuously, snaps to full or back to mini
- [ ] **Swipe down on full player** (when scrolled to top) → collapses to mini with morph
- [ ] **Tap close button** → collapses to mini (not hidden)
- [ ] **Android back button** → collapses to mini
- [ ] **No track playing** → sheet fully hidden (index -1)
- [ ] **Track starts** → sheet animates in to mini position
- [ ] **Scroll content in full player** → scrolls normally; swipe down only activates at scroll top
- [ ] **All action sheets** (speed, sleep timer, options, mushaf layout) still work
- [ ] **Sleep timer countdown** still displays
- [ ] **Mini player** has play/pause, heart, track info, surah glyph — same as current FloatingPlayer
- [ ] **TypeScript compiles** with no new errors
- [ ] **Upload tracks** show microphone icon instead of surah glyph in mini player
- [ ] **Navigate to reciter** from full player collapses to mini, then navigates

---

## Dependencies

- `@gorhom/bottom-sheet` ^5.2.8 (already installed)
- `react-native-reanimated` ~4.1.1 (already installed)
- `react-native-gesture-handler` (already installed)
- `@react-native-community/blur` (already installed, used for iOS mini player)

No new packages required.
